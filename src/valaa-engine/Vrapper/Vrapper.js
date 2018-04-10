// @flow
import { GraphQLObjectType, isAbstractType } from "graphql/type";
import { Iterable } from "immutable";

import VALK, { VALKOptions, packedSingular } from "~/valaa-core/VALK";

import { fieldsSet, addedToFields, removedFromFields, replacedWithinFields, isCreatedLike }
    from "~/valaa-core/command";
import { VRef, vRef, invariantifyId, getRawIdFrom, tryCoupledFieldFrom, expandIdDataFrom,
    obtainVRef } from "~/valaa-core/ValaaReference";
import { createPartitionURI, getPartitionRawIdFrom } from "~/valaa-core/tools/PartitionURI";
import { tryElevateFieldValue } from "~/valaa-core/tools/denormalized/FieldInfo";

import dataFieldValue from "~/valaa-core/tools/denormalized/dataFieldValue";
import Resolver from "~/valaa-core/tools/denormalized/Resolver";
import type { State } from "~/valaa-core/tools/denormalized/State";
import Transient from "~/valaa-core/tools/denormalized/Transient";
import { createGhostVRefInInstance, isMaterialized, createMaterializeGhostAction }
    from "~/valaa-core/tools/denormalized/ghost";
import { MissingPartitionConnectionsError, addConnectToPartitionToError }
    from "~/valaa-core/tools/denormalized/partitions";
import getObjectTransient from "~/valaa-core/tools/denormalized/getObjectTransient";
import { getObjectRawField } from "~/valaa-core/tools/denormalized/getObjectField";

import isResourceType from "~/valaa-core/tools/graphql/isResourceType";

import { ValaaPrimitive } from "~/valaa-script";

import { Discourse, Transaction, PartitionConnection, Prophecy } from "~/valaa-prophet";

import VALEK, { Valker, Kuery, dumpKuery, expressionFromValue } from "~/valaa-engine/VALEK";

import Cog, { extractMagicMemberEventHandlers } from "~/valaa-engine/Cog";
import debugId from "~/valaa-engine/debugId";
import { createModuleGlobal } from "~/valaa-engine/interpreter/importFromString";
import _FieldUpdate from "~/valaa-engine/Vrapper/FieldUpdate";
import _VrapperSubscriber from "~/valaa-engine/Vrapper/VrapperSubscriber";
import evaluateToCommandData from "~/valaa-engine/Vrapper/evaluateToCommandData";
import { defaultOwnerCoupledField } from "~/valaa-engine/ValaaSpaceAPI/Valaa/injectSchemaTypeBindings";

import { dumpify, dumpObject, invariantify, invariantifyObject, invariantifyString, isPromise,
    thenChainEagerly, outputError, wrapError } from "~/valaa-tools";
import { mediaTypeFromFilename } from "~/valaa-tools/MediaTypeData";

export const FieldUpdate = _FieldUpdate;
export const VrapperSubscriber = _VrapperSubscriber;

const INACTIVE = "Inactive";
const ACTIVATING = "Activating";
const ACTIVE = "Active";
const UNAVAILABLE = "Unavailable";
const DESTROYED = "Destroyed";
const NONRESOURCE = "NonResource";

function isNonActivateablePhase (candidate: string) {
  return (candidate === UNAVAILABLE) || (candidate === DESTROYED) || (candidate === NONRESOURCE);
}

/**
 * Vrapper is a proxy for accessing a specific Valaa Resource in the backend.
 * With the ValaaEngine, these Vrapper instances form the interface between Valaa backend content
 * (through the backing False Prophet in-memory shadow repository) and between local presentation
 * and computation layers.
 *
 * 1. Vrapper as a singular, shared proxy object to single Valaa resource.
 *
 * There is zero or one Vrapper objects per one Valaa resource, identified and shared by
 * the resource raw id. Vrapper proxies for resources which don't have already are created
 * on-demand; see ValaaEngine.getVrapper.
 *
 * By default all Vrapper operations are executed in the context of the most recent state known by
 * ('main line state') the backing False Prophet.
 *
 * Transactions can have differing states for this same resource. To make it possible to share
 * the same Vrapper object possible, all operations accept options: { transaction: Transaction }.
 * This can be used to override the operation execution context and must be used whenever operations
 * are being performed inside a transactional context; see FalseProphetDiscourse.acquireTransaction.
 *
 * 2. Vrapper lifecycle and active operations.
 *
 * The Vrapper can be in multiple different phases, depending on the current status of associated
 * partition connections as well as whether the resource or any of its prototypes are destroyed.
 *
 * Active-operations are operations like kueries, mutations but also introspection calls represented
 * by Vrapper member functions which all require that the backing FalseProphet has full knowledge
 * of the proxied, non-destroyed resource and all of its non-destroyed prototypes. This means all
 * partitions of the prototype chain must be fully connected and no resource in the prototype chain
 * can be destroyed.
 *
 * The lifecycle phases:
 *
 * 2.1. Inactive: the partition of some prototype chain Resource is not connected and the connection
 *   is not being acquired (note: Resource itself is considered part of the prototype chain here)
 *   or some prototype chain resource is destroyed.
 *   isInactive() returns true and getPhase() returns "Inactive".
 *   Active-operations will throw MissingPartitionConnectionsError.
 *   Calling activate() will transfer the Vrapper into 'Activating' by acquiring the connections
 *   to all the partitions of all the Resource's in the prototype chain.
 *
 * 2.2. Activating: all partitions of prototype chain Resource's are being connected or already have
 *   a connection.
 *   isActivating() returns true and getPhase() returns "Activating".
 *   Active-operations will throw MissingPartitionConnectionsError.
 *   Calling activate() will return a Promise which resolves once Vrapper enters 'Active'
 *   state, or throws if the Vrapper enters 'Unavailable' state but won't cause other changes.
 *
 * 2.3. Active: all partitions of this resource and all of its prototype chain resources have
 *   an active connection and no prototype chain resource is destroyed.
 *   isActive() returns true and getPhase() returns "Active".
 *   Active-operations can be synchronously accessed.
 *
 * 2.4. Destroyed: the proxied Resource has been destroyed.
 *   isDestroyed() returns true and getPhase() returns "Destroyed".
 *   Active-operations will throw an exception.
 *
 * 2.5. Unavailable: the connection for a prototype chain Resource partition couldn't be acquired.
 *   isUnavailable() returns true and getPhase() returns "Unavailable".
 *   Active-operations will throw an exception describing the cause of unavailability.
 *
 * 2.6. NonResource: the Vrapper is a degenerate proxy to a non-Resource Valaa object; Blob or Data.
 *   isUnavailable() returns true and getPhase() returns "NonResource".
 *   Such Vrapper's like their associated backend objects are essentially immutable. They have no
 *   lifecycle and many operations (usually those with side-effects) are not available for them.
 *   They cannot have listeners associated with them and they are not cached by ValaaEngine (this
 *   means that these objects can in fact have multiple different Vrapper objects per same id).
 *
 * There are two primary mechanisms for creating Vrapper's:
 * 1. All CREATED and DUPLICATED create Vrapper for their primary resource.
 *
 * @export
 * @class Vrapper
 * @extends {Cog}
 */
export default class Vrapper extends Cog {
  static vrapperIndex = 0;

  constructor (engine: ?Object, id: VRef, typeName: string, immediateRefresh?: [any, any]) {
    invariantifyId(id, "Vrapper.constructor.id");
    invariantifyString(typeName, "Vrapper.constructor.typeName");
    super({ engine, name: `Vrapper/${id.rawId()}:${typeName}` });
    this.vrapperIndex = (Vrapper.vrapperIndex += 1);
    this._objectId = id;
    this._setTypeName(typeName);
    if (typeName === "Blob" || !this.engine) {
      this._phase = NONRESOURCE;
    } else {
      this._phase = isResourceType(this.getTypeIntro()) ? INACTIVE : NONRESOURCE;
      this.engine.addCog(this);
      if (immediateRefresh) {
        this._refreshPhaseOrGetBlocker(...immediateRefresh);
      }
    }
  }

  getPhase () { return this._phase; }
  isInactive () { return this._phase === INACTIVE; }
  isActivating () { return this._phase === ACTIVATING; }
  isActive () { return this._phase === ACTIVE; }
  isUnavailable () { return this._phase === UNAVAILABLE; }
  isDestroyed () { return this._phase === DESTROYED; }

  isResource () {
    return this._phase !== NONRESOURCE;
  }

  isPartitionRoot () {
    const partitionURI = this._objectId.partitionURI();
    if (!partitionURI) return false;
    return getPartitionRawIdFrom(partitionURI) === this._objectId.rawId();
  }

  toJSON () {
    return this.getId().toJSON();
  }

  toString () { return this.debugId(); }

  prototypeChainString () {
    const prototypeIdData = this.getTransient().get("prototype");
    if (!prototypeIdData) return "";
    const coupledField = tryCoupledFieldFrom(prototypeIdData);
    return `'${this.getRawId("id")}'${
        coupledField === "prototypers" ? "<==>"
        : coupledField === "instances" ? "<=|>"
        : coupledField === "materializedGhosts" ? "<-|>"
        : coupledField === null ? "-|>" // immaterialized ghost
        : ""
        }${this.get("prototype").prototypeChainString()}`;
  }

  getSchema () {
    return this.engine.prophet.schema;
  }

  getTypeIntro () {
    if (!this._typeIntro) {
      const intro = this.engine.prophet.schema.getType(this._typeName);
      if (!intro) throw new Error(`Could not find schema type for '${this._typeName}'`);
      this._typeIntro = intro;
    }
    return this._typeIntro;
  }

  getFieldIntro (fieldName: string): Object { return this.getTypeIntro().getFields()[fieldName]; }


  /**
   * Returns a newly initiated or an already existing activation process if the current phase is
   * Inactive or Activating. Returns falsy if already Active.
   * Otherwise the resource itself is inactivateable and throws.
   *
   * @param {Object} [state]
   * @returns
   *
   * @memberof Vrapper
   */
  activate (state?: Object) {
    const initialBlocker = this._refreshPhaseOrGetBlocker(state);
    if (!initialBlocker) return undefined;
    if (this._activationProcess) return this._activationProcess;
    this._phase = ACTIVATING;
    return (this._activationProcess = (async () => {
      let blocker;
      try {
        for (blocker = initialBlocker; blocker; blocker = this._refreshPhaseOrGetBlocker()) {
          if (isNonActivateablePhase(blocker.getPhase())) {
            throw new Error(`Cannot activate ${blocker.debugId()
                } because it is ${blocker.getPhase()}`);
          }
          if (!blocker._partitionConnection) {
            await blocker.getPartitionConnection();
          }
        }
        return true;
      } catch (error) {
        this._phase =
            (blocker !== this) ? INACTIVE
            : this.isActivating() ? UNAVAILABLE
            : this._phase; // no change.
        throw this.wrapErrorEvent(error, "activate.process",
            "\n\tproxy:", this,
            "\n\tblocker:", blocker);
      } finally {
        delete this._activationProcess;
      }
    })());
  }

  /**
   * Tries to synchronously activate the Vrapper to Active phase from Inactive or Activating
   * phase (or do nothing if already Active), returns undefined if successful ie. the phase is now
   * Active, otherwise returns the Vrapper blocking the immediate activation (which might be this
   * Vrapper itself).
   * Will *not* initiate an activation process by itself.
   * The blocking cause can be inspected by blocker.getPhase(): if the phase is Inactive or
   * Activating, the cause is a non-full partition connection. Otherwise the cause is a
   * non-activateable phase (Destroyed, Unavailable, NonResource).
   *
   * @param {Object} state
   * @param {Transient} transient
   * @returns
   *
   * @memberof Vrapper
   */
  _refreshPhaseOrGetBlocker (refreshingState?: Object, refreshingTransient?: Transient) {
    if (this._phase === ACTIVE) return undefined;
    if ((this._phase !== INACTIVE) && (this._phase !== ACTIVATING)) return this;
    const state = refreshingState || this.engine.discourse.getState();
    const transient = refreshingTransient
        || getObjectTransient(state, this._objectId, this._typeName);
    this.updateTransient(state, transient);
    this._objectId = transient.get("id");
    if (!this.tryPartitionConnection()) {
      if (this._objectId.isInactive() || this._partitionConnectionProcess) return this;
    }
    let prototypeId = transient.get("prototype");
    if (!prototypeId) {
      const prototypeGhostPath = this._objectId.previousGhostStep();
      if (prototypeGhostPath) {
        prototypeId = vRef(prototypeGhostPath.headRawId(), undefined, prototypeGhostPath);
      }
    }
    if (prototypeId) {
      const prototypeVrapper = this.engine.getVrapper(prototypeId, { optional: true });
      if (!prototypeVrapper) {
        throw new Error("Ghost prototype dynamic activation not implemented yet");
      }
      const blocker = prototypeVrapper._refreshPhaseOrGetBlocker();
      if (blocker) return blocker;
    }
    this._phase = ACTIVE;
    this._activationProcess = undefined;
    this._finalizeActivate(state, transient);
    return undefined;
  }

  _finalizeActivate (state: Object, transient: Transient) {
    let partitionAuthorityURIString;
    let authorityConnection;
    try {
      if (!this._typeName || (this._typeName === "InactiveResource")) {
        this._setTypeName(transient.get("typeName"));
      }
      this.setName(`Vrapper/${this.getRawId()}:${this._typeName}`);
      this.registerComplexHandlers(this.engine._prophecyHandlerRoot, state);
      this._refreshDebugId(transient, { state });
      if (this.hasInterface("Scope")) this._setUpScopeFeatures({ state });
    } catch (error) {
      outputError(this.wrapErrorEvent(error, "_finalizeActivate()",
          "caught an error after activation, which will be swallowed",
          "\n\ttransient:", ...dumpObject(transient.toJS()),
          "\n\tpartitionConnection:", ...dumpObject(this._partitionConnection),
          "\n\tpartitionConnectionProcess:", ...dumpObject(this._partitionConnectionProcess),
          "\n\tpartitionAuthorityURI:", partitionAuthorityURIString,
          "\n\tauthorityConnection:", authorityConnection,
          "\n\tthis:", ...dumpObject(this),
      ));
    }
  }


  /**
   * Tries to set phase to Active and returns, throws otherwise with the blocking reason.
   *
   * @param {VALKOptions} [options]
   * @returns
   *
   * @memberof Vrapper
   */
  requireActive (options?: VALKOptions) {
    const blocker = this._refreshPhaseOrGetBlocker();
    if (!blocker) return;
    if (blocker.isDestroyed() && options) {
      // TODO(iridian): While this takes care of the situation where a Resource is destroyed in the
      // main line but not destroyed in a transaction, the reverse scenario is not handled:
      // if a resource is destroyed in transaction but not in main line, requireActive will keep on
      // passing. This is a lesser issue as any illegal operations will still be caught by the
      // False Prophet and backend validations. But nevertheless the lack of symmetry and dirty
      // caching is unclean.
      const state = options.state || (options.transaction && options.transaction.getState());
      if (state && getObjectTransient(state, this._objectId, this._typeName)) return;
    }
    const error =
        !blocker.isResource() ?
            new Error(`Cannot operate on a non-Resource ${this.debugId()}`)
        : this.isDestroyed() ?
            new Error(`Cannot operate on a Destroyed ${this.debugId()}`)
        : this.isUnavailable() ?
            new Error(`Cannot operate on an Unavailable ${this.debugId()}`)
        : addConnectToPartitionToError(new MissingPartitionConnectionsError(
                `Missing or not fully narrated partition connection for an Activating ${
                    blocker.debugId()}`,
                [this.activate()]),
            this.engine.discourse.connectToMissingPartition);
    throw this.wrapErrorEvent(error, "requireActive",
        "\n\toptions:", ...dumpObject(options),
        "\n\tactivation blocker is",
            (blocker === this) ? "this object itself" : "some prototype of this",
        "\n\tthis._objectId:", ...dumpObject(this._objectId),
        "\n\tthis._partitionConnection:", ...dumpObject(this._partitionConnection),
        "\n\tthis._partitionConnectionProcess:", ...dumpObject(this._partitionConnectionProcess),
        "\n\tblocker:", ...dumpObject(blocker),
        "\n\tblocker._partitionConnection:", ...dumpObject(blocker._partitionConnection),
        "\n\tblocker._partitionConnectionProcess:",
            ...dumpObject(blocker._partitionConnectionProcess),
        "\n\tthis:", ...dumpObject(this));
  }

  tryPartitionConnection (options: Object = {}): ?PartitionConnection {
    options.require = false;
    options.dontCreateNewConnection = true;
    this.getPartitionConnection(options);
    return this._partitionConnection;
  }

  getPartitionConnection (options:
      { require?: boolean, transaction?: Transaction, dontCreateNewConnection?: boolean }
          = { require: true }): ?PartitionConnection {
    // FIXME(iridian): the direct singular caching means that if the partitionConnection is changed,
    // the change is not visible to Vrapper. When implementing this, be mindful that the full
    // solution involves partition-specific return values, so some kind of mapping is needed.
    // However this carries an extra burden: the connections must be released at some point,
    // otherwise they will hog resources (ie. they hold refcounts on in-memory files).
    if (this._partitionConnectionProcess) {
      if (!this._partitionConnectionProcess.fullConnection) return this._partitionConnectionProcess;
      this._partitionConnection = this._partitionConnectionProcess.fullConnection;
      delete this._partitionConnectionProcess;
    }
    if (this._partitionConnection) return this._partitionConnection;
    let partitionURI;
    let nonGhostOwnerRawId;
    try {
      if (!this.isResource()) {
        throw new Error(`Non-resource Vrapper's cannot have partition connections`);
      }
      partitionURI = this._objectId.partitionURI();
      if (!partitionURI) {
        nonGhostOwnerRawId = this._objectId.getGhostPath().headHostRawId()
            || this._objectId.rawId();
        const transient = (options.transaction || this.engine.discourse)
            .tryGoToTransientOfRawId(nonGhostOwnerRawId, "Resource");
        if (transient) {
          partitionURI = transient && transient.get("id").partitionURI();
          if (!partitionURI) {
            const authorityURIString = transient.get("partitionAuthorityURI");
            partitionURI = authorityURIString
                && createPartitionURI(authorityURIString, transient.get("id").rawId());
          }
        }
      }
      this._partitionConnectionProcess = partitionURI && this.engine.prophet
          .acquirePartitionConnection(partitionURI, {
            dontCreateNewConnection: options.dontCreateNewConnection,
            createNewPartition: false,
          });
      if (!this._partitionConnectionProcess) {
        if (!options.require) return undefined;
        throw new Error(`Cannot determine partition connection for ${this.debugId()}`);
      }
      const ret = thenChainEagerly(this._partitionConnectionProcess, (partitionConnection) => {
        this._partitionConnection = partitionConnection;
        if (ret) ret.fullConnection = partitionConnection;
        delete this._partitionConnectionProcess;
        return partitionConnection;
      });
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, `getPartitionConnection(${
              options.require ? "require" : "optional"})`,
          "\n\toptions:", ...dumpObject(options),
          "\n\tthis._objectId:", this._objectId,
          "\n\tthis._transient:", this._transient,
          "\n\tpartitionURI:", partitionURI,
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _withPartitionConnectionChainEagerly (options: VALKOptions,
      ...chainOperations: ((prev: any) => any)[]) {
    return thenChainEagerly(this.getPartitionConnection(options), chainOperations);
  }

  hasInterface (name: string, type: GraphQLObjectType = this.getTypeIntro()): boolean {
    if (type.name === name) return true;
    if (!type.getInterfaces) {
      throw new Error("Vrapper.hasInterface is not (yet) implemented for interface objects");
    }
    for (const interfaceType of type.getInterfaces()) {
      if (interfaceType.name === name) return true;
    }
    return false;
  }

  hasField (fieldName: string): boolean { return !!this.getFieldIntro(fieldName); }

  outputStatus (/* output */) {
    // Perhaps some debug-level stuff for switching these on and off? By default these would be a
    // lot of spam.
    // output.log(`${this.name}:`, this.getTransient().toJS());
  }

  /**
   * Returns the fully qualified id data structure of this resource. This structure contains the
   * owner field name as well as the possible ghost path of the object.
   *
   * @returns
   */
  getId (options?: VALKOptions): VRef {
    const transient = options ? this.getTransient(options) : this._transient;
    return transient ? transient.get("id") : this._objectId;
  }

  getIdCoupledWith (coupledField: string): VRef {
    return this.getId().coupleWith(coupledField);
  }

  /**
   * Returns the unique raw id string of this resource.
   * This id string should not be used as an id in outgoing kueries because it might belong to a
   * immaterial ghost or a resource outside known partitions. So in other words, while rawId
   * identifies a resource, it doesn't act as a universal locator. See idData for that.
   *
   * @returns
   */
  getRawId () { return this._objectId.rawId(); }


  getTypeName (options: any) {
    this.requireActive(options);
    return this._typeName;
  }

  tryTypeName () {
    return this._typeName;
  }

  _setTypeName (typeName: string) {
    this._typeName = typeName;
    this._typeIntro = null;
  }

  setDebug (level: number) { this._debug = level; }

  debugId () {
    if (!this.__debugId) this.__debugId = debugId(this._transient || this._objectId);
    return `${this.constructor.name}(${
        this._phase === ACTIVE ? "" : `${this._phase}: `}${this.__debugId})`;
  }

  _refreshDebugId (transient: Transient, options: VALKOptions) {
    if (!transient) return;
    let targetText;
    if ((this._phase !== ACTIVE) || (this._typeName !== "Relation")) {
      this.__debugId = debugId(transient, options);
    } else {
      const targetId = transient.get("target");
      if (!targetId) targetText = "<null target>";
      else if (targetId.isInactive()) {
        targetText = `<in inactive '${targetId.partitionURI()}'>`;
      } else {
        const target = this.get("target", options);
        targetText = (target && debugId(target, options)) || "<target not found>";
      }
      this.__debugId = `${debugId(transient)}->${targetText}`;
    }
  }

  getTransient (options: ?{ state?: Object, transaction?: Transaction, typeName?: string }) {
    const explicitState = options &&
        (options.state || (options.transaction && options.transaction.getState()));
    if (explicitState) {
      const typeName = options.typeName || this.getTypeName(options);
      return explicitState.getIn([typeName, this.getRawId()])
          // Immaterial ghost.
          || getObjectTransient(options.state || options.transaction, this._objectId, typeName);
    }
    if (this.transientStaledIn) {
      this.updateTransient(null,
          getObjectTransient(this.transientStaledIn, this.getId(),
              (options && options.typeName) || this.getTypeName(options)));
    }
    return this._transient;
  }

  isGhost () { return this._objectId.isGhost(); }

  isMaterialized (transaction: ?Transaction) {
    const state = (transaction || this.engine.discourse).getState();
    this.requireActive({ state });
    return isMaterialized(state, this.getId());
  }

  materialize (transaction: ?Transaction) {
    const discourse = (transaction || this.engine.discourse);
    const state = discourse.getState();
    this.requireActive({ state });
    discourse.claim(createMaterializeGhostAction(state, this.getId()));
  }

  updateTransient (state: ?Object, object: ?Object) {
    // TODO(iridian): Storing the transient in the vrapper is silly and useless premature
    // optimization. With the transactions it can't really be used anyway, so yeah. Get rid of it
    // and just store the id VRef in the Vrapper.
    if (object) {
      invariantifyObject(object, "Vrapper.updateTransient.object", { instanceof: Transient });
      this._transient = object;
      this.transientStaledIn = null;
    } else if (this._transient) {
      this.transientStaledIn = state;
    } else throw new Error(`Must specify object with first updateTransient call`);
    if (!this.__debugId) this._refreshDebugId(this._transient, { state });
  }

  getSelfAsHead (singularTransient: any = this.getTransient()) {
    return packedSingular(singularTransient, this._typeName);
  }

  getLexicalScope () {
    this.requireActive();
    return this._lexicalScope || this.engine.getLexicalScope();
  }

  getNativeGlobal () {
    this.requireActive();
    return this._nativeGlobal || this.engine.getNativeGlobal();
  }

  getHostGlobal () {
    this.requireActive();
    if (!this._hostGlobal) {
      this._hostGlobal = createModuleGlobal();
      this._hostGlobal.Valaa = this._nativeGlobal;
    }
    return this._hostGlobal;
  }

  getVALKMethod (methodName: string, valker: Valker, transient: Transient, scope: Object) {
    const createApplicator = applicatorCreators[methodName];
    if (!createApplicator) {
      throw new Error(`Unknown VALK host function '${methodName}' in '${this.debugId()}'`);
    }
    return createApplicator(this, methodName, valker, transient, scope);
  }

/*
 * Running a live kuery through the Vrapper will make an implicit activate() call.
 */

  get (kuery: any, options: VALKOptions = {}) {
    options.pure = true;
    return this.do(kuery, options);
  }

  do (kuery: any, options: VALKOptions = {}) {
    try {
      return this.run(this.getId(), kuery, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, "do",
          "\n\tkuery:", ...dumpKuery(kuery),
          "\n\toptions:", ...dumpObject(options));
    }
  }

  run (head: any, kuery: Kuery, options: VALKOptions = {}) {
    if (this._phase === ACTIVE) {
      if (typeof options.scope === "undefined") options.scope = this.getLexicalScope();
    } else if (!options.state && !options.transaction && this.isResource()) {
      this.requireActive();
    }
    return super.run(head, kuery, options);
  }


  setField (fieldName: string, value: any, options: VALKOptions = {}) {
    let commandValue;
    try {
      const { transaction, id } = this._primeTransactionAndOptionsAndId(options);
      commandValue = evaluateToCommandData(value, options);
      return transaction.claim(fieldsSet({ id, typeName: this._typeName },
          { [fieldName]: commandValue },
      ));
    } catch (error) {
      throw this.wrapErrorEvent(error, `setField(${fieldName})`,
          "\n\tfield name:", fieldName,
          "\n\tnew value:", ...dumpObject(value),
          "\n\tnew value (after command post-process):", ...dumpObject(commandValue),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  addToField (fieldName: string, value: any, options: VALKOptions = {}) {
    let commandValue;
    try {
      const { transaction, id } = this._primeTransactionAndOptionsAndId(options);
      commandValue = this._intoArray(evaluateToCommandData(value, options));
      return transaction.claim(addedToFields({ id, typeName: this._typeName },
          { [fieldName]: commandValue },
      ));
    } catch (error) {
      throw this.wrapErrorEvent(error, `addToField(${fieldName})`,
          "\n\tfield name:", fieldName,
          "\n\tnew value:", ...dumpObject(value),
          "\n\tnew value (after command post-process):", ...dumpObject(commandValue),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  removeFromField (fieldName: string, value: any, options: VALKOptions = {}) {
    let commandValue;
    try {
      const { transaction, id } = this._primeTransactionAndOptionsAndId(options);
      commandValue = evaluateToCommandData(value, options);
      if (commandValue !== null && !Array.isArray(commandValue)) commandValue = [commandValue];
      return transaction.claim(removedFromFields({ id, typeName: this._typeName },
          { [fieldName]: commandValue },
      ));
    } catch (error) {
      throw this.wrapErrorEvent(error, `removeFromField(${fieldName})`,
          "\n\tfield name:", fieldName,
          "\n\tremoved value:", ...dumpObject(value),
          "\n\tremoved value (after command post-process):", ...dumpObject(commandValue),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  deleteField (fieldName: string, options: VALKOptions = {}) {
    return this.removeFromField(fieldName, null, options);
  }

  replaceWithinField (fieldName: string, replacedValues: any[], withValues: any[],
      options: VALKOptions = {}) {
    let commandRemovedValues;
    let commandAddedValues;
    const addedValues = new Set(withValues);
    try {
      const { transaction, id } = this._primeTransactionAndOptionsAndId(options);
      commandRemovedValues = this._intoArray(evaluateToCommandData(
          replacedValues.filter(replacedValue => !addedValues.has(replacedValue)), options));
      commandAddedValues = this._intoArray(evaluateToCommandData(withValues, options));
      return transaction.claim(replacedWithinFields({ id, typeName: this._typeName },
          { [fieldName]: commandRemovedValues },
          { [fieldName]: commandAddedValues },
      ));
    } catch (error) {
      throw this.wrapErrorEvent(error, `replaceInField(${fieldName})`,
          "\n\tfield name:", fieldName,
          "\n\treplaced values:", ...dumpObject(replacedValues),
          "\n\tremoved values (after command post-process):", ...dumpObject(commandRemovedValues),
          "\n\twith values:", ...dumpObject(addedValues),
          "\n\tadded values (after command post-process):", ...dumpObject(commandAddedValues),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  _primeTransactionAndOptionsAndId (options: VALKOptions): { transaction: Discourse, id: VRef } {
    const transaction = options.transaction || this.engine.discourse;
    this.requireActive(options);
    const id = transaction.bindObjectId(this.getId(), this._typeName, true);
    options.head = this;
    const partitionURI = id.partitionURI();
    options.partitionURIString = partitionURI && partitionURI.toString();
    return { transaction, id };
  }

  _intoArray (value: any) { return Array.isArray(value) ? value : [value]; }


  /**
   * Creates an object using this as sub-kuery head.
   * Note! The created resource thus does not have this resource as owner unless explicitly
   * specified in the initialState.owner.
   * Use \see emplaceSet and \see emplaceAddTo to add ownership at the same time.
   *
   * @param {any} typeName
   * @param {any} [initialState={}]
   * @param {{ transaction?: Object, scope: ?} [options=Object]
   * @param {any} Object
   * @param {any} Number
   */
  create (typeName: string, initialState: Object = {}, options: VALKOptions = {}) {
    this.requireActive(options);
    if (options.coupledField && initialState.owner) {
      initialState.owner = initialState.owner.getIdCoupledWith(options.coupledField);
    }
    options.head = this;
    return this.engine.create(typeName, initialState, options);
  }

  duplicate (initialState: Object, options: VALKOptions = {}) {
    this.requireActive(options);
    options.head = this;
    return this.engine.duplicate(this, initialState, options);
  }

  /**
   * Creates an instance of this resource with given initialState overrides, by adding this
   * resource as instancePrototype in the initialState. If the owner is not explicitly set (TODO:
   * introspect for all owner aliases) in the initialState this sets the owner in the initialState
   * to be the same as the owner of this resource.
   *
   * @memberof Vrapper
   */
  instantiate (initialState: Object = {}, options: VALKOptions = {}) {
    const typeName = this.getTypeName(options);
    initialState.instancePrototype = this;
    if (typeof initialState.owner === "undefined"
        && !((typeName === "Relation") && initialState.source)) {
      initialState.owner = this.get("owner", Object.create(options));
    }
    return this.create(typeName, initialState, options);
  }

  destroy (options: { transaction?: Transaction } = {}) {
    this.requireActive(options);
    return (options.transaction || this.engine.discourse).destroy({
      id: this.getId(options), typeName: this._typeName,
    });
  }

  /**
   * Creates a new object and sets it as the given fieldName.
   *
   * @param {any} fieldNames
   * @returns
   */
  emplaceSetField (fieldName: string, initialState: Object = {}, options: VALKOptions = {}) {
    return this._emplace(true, fieldName, initialState, options);
  }

  /**
   * Creates a new object and adds it to given fieldName list.
   *
   * @param {any} fieldNames
   * @returns
   */
  emplaceAddToField (fieldName: string, initialState: Object = {}, options: VALKOptions = {}) {
    return this._emplace(false, fieldName, initialState, options);
  }

  _emplace (isSet: boolean, fieldName: string, initialState: Object = {}, options:
      VALKOptions = {}) {
    this.requireActive(options);
    let typeName = options.typeName;
    let transaction;
    try {
      transaction = (options.transaction || this.engine.discourse).acquireTransaction();
      options.transaction = transaction;
      if (!typeName) {
        const fieldIntro = this.getTypeIntro().getFields()[fieldName];
        invariantifyObject(fieldIntro, `no such field '${fieldName}' in ${
            this.getTypeIntro().name}`);
        const type = fieldIntro.namedType;
        if (isAbstractType(type)) {
          throw new Error(`Cannot emplace-create an abstract field list ${fieldName}:${
              type.name}[] entry with implicit type, provide options.typeName`);
        }
        typeName = type.name;
      }
      const vFieldValue = this.engine.create(typeName, initialState,
          { ...options, head: this });
      if (isSet) this.setField(fieldName, vFieldValue, options);
      else this.addToField(fieldName, vFieldValue, options);
      transaction.releaseTransaction();
      return vFieldValue;
    } catch (error) {
      throw this.wrapErrorEvent(error, `emplace${isSet ? "SetField" : "AddToField"}(${fieldName})`,
          "\n\tfield name:", fieldName,
          "\n\tinitialState:", initialState,
          "\n\toptions.typeName:", options.typeName,
          "\n\tdeduced type:", typeName,
      );
    }
  }

  // Scope and Property property host operations

  propertyValue (propertyName: string | Symbol, options: VALKOptions = {}) {
    // eslint-disable-next-line
    const typeName = this.getTypeName(options);
    const vProperty = this._getProperty(propertyName, Object.create(options));
    if (vProperty) {
      return vProperty.extractValue(options, this);
    }
    const hostValue = this.engine.getRootScope().Valaa[typeName].hostObjectPrototype[propertyName];
    if ((typeof hostValue === "object") && (hostValue !== null) && hostValue.isHostField) {
      // TODO(iridian): Make this solution semantically consistent native field access.
      // Now stupidly trying to setField even if the field is not a primaryField.
      return this.get(hostValue.kuery, options);
    }
    return hostValue;
  }

  _getProperty (propertyName: string | Symbol, options: VALKOptions) {
    if (typeof propertyName !== "string") return undefined;
    const ret = this._lexicalScope && this._lexicalScope.hasOwnProperty(propertyName)
          // FIXME(iridian): If a property gets renamed inside a transaction and a new property gets
          // created with (or renamed to) the same name we get a cache issue here:
          // _lexicalScope only updates on actual ValaaEngine events which have not yet landed.
          // Similar issues might arise with herecy rollbacks.
        && this._lexicalScope[propertyName];
    if (ret && !ret.isDestroyed()) return ret;
    // New properties which don't exist in _lexicalScope work fine as they get kueried here.
    return this.get(VALEK.property(propertyName), options);
  }

  alterProperty (propertyName: any, alterationVAKON: Object, options: VALKOptions = {}) {
    // If lexicalScope is undefined then this resource doesn't implement Scope, which is required
    // for propertyValue.
    const typeName = this.getTypeName(options);
    const vProperty = this._getProperty(propertyName, Object.create(options));
    const actualAlterationVAKON =
        (typeof alterationVAKON === "object" && typeof alterationVAKON.toVAKON === "function")
            ? alterationVAKON.toVAKON()
            : alterationVAKON;
    if (vProperty) {
      return vProperty.alterValue(actualAlterationVAKON, options, this);
    }
    let newValue = this.run(0, [["§void"], actualAlterationVAKON],
        { ...options, scope: this.getLexicalScope() });
    const hostType = this.engine.getRootScope().Valaa[typeName];
    const prototypeEntry = hostType.hostObjectPrototype[propertyName];
    if ((typeof prototypeEntry === "object") && (prototypeEntry !== null)
        && prototypeEntry.writableFieldName) {
      // TODO(iridian): Make this solution semantically consistent host field access.
      // Now stupidly trying to setField even if the field is not a primaryField.
      if (prototypeEntry.fieldName === "owner"
          && !(newValue instanceof VRef && newValue.getCoupledField())) {
        const defaultCoupledField = hostType[defaultOwnerCoupledField];
        if (defaultCoupledField) {
          newValue = newValue instanceof Vrapper
              ? newValue.getIdCoupledWith(defaultCoupledField)
              : obtainVRef(newValue, defaultCoupledField);
        }
      }
      this.setField(prototypeEntry.writableFieldName, newValue, options);
      return newValue;
    }
    options.head = this;
    this.engine.create("Property", {
      owner: this.getIdCoupledWith("properties"),
      name: propertyName,
      value: expressionFromValue(newValue),
    }, options);
    return newValue;
  }

  deleteProperty (propertyName: any, options: VALKOptions = {}) {
    this.requireActive(options);
    const vProperty = this._getProperty(propertyName, Object.create(options));
    if (vProperty) {
      // TODO: check for configurability and return false if this value is non-configurable (and
      // thus it cannot be deleted)
      vProperty.deleteField("value", options);
    }
    return true;
  }

  /**
   * Gets the native value of this resource.
   * For types other than Property the native value is the resource itself. Otherwise the resource
   * is a property and the native value is contained within and is extracted as follows.
   * If the property is a a pointer to a ValaaScript Media
   * this compiles and evaluates the pointed ValaaScript program once (with its program-level
   * side-effects) and returns the resulting value of the evaluation (the last statement if it is
   * an expression statement).
   * All further calls will return this same evaluated value until the program is touched or the
   * evaluation context (surrounding ValaaEngine) is flushed.
   *
   * @param {VALKOptions} [options={}]
   * @param null vExplicitOwner
   * @param {any} Vrapper
   * @param null transient
   * @param {any} Transient
   * @returns
   *
   * @memberof Vrapper
   */
  extractValue (options: VALKOptions = {}, vExplicitOwner: ?Vrapper) {
    try {
      const typeName = this.getTypeName(options);
      switch (typeName) {
        case "Property":
          return this.extractPropertyValue(options, vExplicitOwner);
        case "Media":
          return this._extractMediaInterpretation(options, vExplicitOwner, typeName);
        default:
      }
      return this;
    } catch (error) {
      throw this.wrapErrorEvent(error, "extractValue",
          "\n\toptions:", ...dumpObject(options),
          "\n\tvExplicitOwner:", ...dumpObject(vExplicitOwner));
    }
  }

  extractPropertyValue (options: VALKOptions, vExplicitOwner: ?Vrapper, explicitValueEntry?: any) {
    let valueEntry;
    let ret;
    try {
      valueEntry = explicitValueEntry || this._getFieldTransient("value", options);
      if (!valueEntry) return undefined;
      if (!this._extractedPropertyValues) this._extractedPropertyValues = new WeakMap();
      if (this._extractedPropertyValues.has(valueEntry)) {
        return this._extractedPropertyValues.get(valueEntry);
      }
      let state;
      let valueType;
      const isExpandedTransient = !(valueEntry instanceof VRef);
      if (isExpandedTransient) {
        valueType = dataFieldValue(valueEntry, "typeName");
      } else {
        state = (options.transaction || this.engine.discourse).getState();
        valueType = state.getIn(["Expression", valueEntry.rawId()]);
      }
      if (valueType === "Literal") {
        ret = isExpandedTransient
            ? dataFieldValue(valueEntry, "value")
            : state.getIn(["Literal", valueEntry.rawId(), "value"]);
      } else if (valueType === "Identifier") {
        ({ ret, valueEntry } = this._extractPointerValue(options, vExplicitOwner, valueEntry));
      } else if (valueType === "KueryExpression") {
        const vakon = isExpandedTransient
            ? dataFieldValue(valueEntry, "vakon")
            : state.getIn(["KueryExpression", valueEntry.rawId(), "vakon"]);
        if (typeof vakon === "undefined") return undefined;
        const vOwner = vExplicitOwner || this.get("owner", Object.create(options)) || this;
        options.scope = vOwner.getLexicalScope();
        // TODO(iridian): We could add a flag to KueryExpression to denote that the evaluated value
        // of the KueryExpression can be cached. However as this is mostly a perf thing (when
        // KueryExpression is used to implement method imports) with semantic implications (if the
        // VAKON path actually changes, this function will return stale values), this is quite the
        // low priority.
        return vOwner.get(vakon, options);
      } else {
        throw new Error(
            `Vrapper(${this.debugId()}).extractValue: unsupported value type '${valueType}'`);
      }
      if (typeof valueEntry !== "undefined") {
        this._extractedPropertyValues.set(valueEntry, ret);
      }
      return ret;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .extractValue(), with:`,
          "\n\tvalueEntry:", ...dumpObject(valueEntry),
          "\n\tret:", ...dumpObject(ret),
      );
    }
  }

  _getFieldTransient (fieldName: string, options: VALKOptions) {
    const thisTransient = this.getTransient(options);
    const valueEntry = thisTransient.get(fieldName);
    if (valueEntry) return valueEntry;
    // This is kludgish handling of immaterial properties.
    return getObjectRawField(options.transaction || this.engine.discourse, thisTransient,
        fieldName);
  }

  _extractPointerValue (options: VALKOptions = {}, vExplicitOwner: ?Vrapper,
      valueEntry: Transient) {
    this.requireActive(options);
    const target = this.get(["§->", "value", "reference"], Object.create(options));
    if (!target) {
      console.warn(`Vrapper(${this.debugId()
          }).extractValue: Cannot resolve pointed resource from Property.value:`, valueEntry);
      return { ret: undefined, valueEntry: undefined };
    }
    return { ret: target, valueEntry };
  }

  _extractedMediaInterpretations: WeakMap<Object, { [mime: string]: Object }>;

  static toMediaInfoFields = VALK.fromVAKON({
    blobId: ["content", false, "blobId"],
    name: "name",
    sourceURL: "sourceURL",
    type: ["mediaType", false, "type"],
    subtype: ["mediaType", false, "subtype"],
  });

  _resolveMediaInfo (options: VALKOptions) {
    let mediaInfo = options && options.mediaInfo && { ...options.mediaInfo };
    function setMediaInfoMIME (mime) {
      const split = mime.split("/");
      mediaInfo.type = split[0];
      mediaInfo.subtype = split[1];
    }
    let mime = (options && options.mime) || (mediaInfo && mediaInfo.mime);
    if (!mediaInfo) mediaInfo = this.get(Vrapper.toMediaInfoFields, options);
    if (typeof mime === "string") setMediaInfoMIME(mime);
    else {
      if (!mediaInfo.type || !mediaInfo.subtype) {
        const fileNameMediaType = mediaTypeFromFilename(mediaInfo.name);
        if (fileNameMediaType) Object.assign(mediaInfo, fileNameMediaType);
        else {
          setMediaInfoMIME((options && options.mimeFallback) || mediaInfo.mimeFallback
              || "application/octet-stream");
        }
      }
      mime = `${mediaInfo.type}/${mediaInfo.subtype}`;
    }
    return { mediaInfo, mime };
  }

  _extractMediaInterpretation (options: VALKOptions, vExplicitOwner: ?Vrapper, typeName: ?string) {
    let mediaInfo;
    let mime;
    try {
      const activeTypeName = typeName || this.getTypeName(options);
      invariantify(this.hasInterface("Media"),
          "Vrapper._extractMediaInterpretation only available for objects with Media interface",
          "\n\ttype:", activeTypeName,
          "\n\tobject:", this);
      ({ mediaInfo, mime } = this._resolveMediaInfo(Object.create(options)));
      // Interpretation instances are cached by transient and flushed if it changes via adding or
      // removing of properties, change of mediaType etc. This does _not_ include the change of
      // Media property values themselves as they don't affect the Media transient itself.
      // TODO(iridian): Re-evaluate this if ever we end up having Media properties affect the
      // interpretation. In that case the change of a property should flush this cache.
      const thisTransient = this.getTransient(Object.create(options));
      let transientInterpretations = (this._extractedMediaInterpretations
          || (this._extractedMediaInterpretations = new WeakMap()))
          .get(thisTransient);
      const cachedInterpretation = transientInterpretations && transientInterpretations[mime];
      if (cachedInterpretation) {
        return (options.immediate !== false)
            ? cachedInterpretation
            : Promise.resolve(cachedInterpretation);
      }
      let content = options.content;
      if (typeof content === "undefined") {
        content = this._withPartitionConnectionChainEagerly(Object.create(options),
            connection => connection.readMediaContent(this.getId(options), mediaInfo));
        if ((options.immediate === true) && isPromise(content)) {
          throw new Error(`Media content not immediately available for '${
              (mediaInfo && mediaInfo.name) || "<unnamed>"}'`);
        }
        if ((options.immediate === false) || isPromise(content)) {
          return (async () => {
            options.content = await content;
            options.immediate = true;
            return this._extractMediaInterpretation(options, vExplicitOwner, activeTypeName);
          })();
        }
        // else: content is immediately available and immediate !== false. Proceed to
        // interpretation and caching.
      }
      let vScope = vExplicitOwner || this.get("owner", Object.create(options));
      while (vScope && !vScope.hasInterface("Scope")) {
        vScope = vScope.get("owner", Object.create(options));
      }
      if (!vScope) vScope = this;
      const newInterpretation = this.engine.interpretMediaContent(
          content, vScope, mediaInfo, options);
      if (!transientInterpretations) {
        this._extractedMediaInterpretations.set(thisTransient, transientInterpretations = {});
      }
      transientInterpretations[mime] = newInterpretation;
      return newInterpretation;
    } catch (error) {
      throw this.wrapErrorEvent(error,
          `extractMediaInterpretation('${this.get("name", options)}' as ${String(mime)})`,
          "\n\tid:", this.getId(options).toString(),
          "\n\toptions:", ...dumpObject(options),
          "\n\tvExplicitOwner:", ...dumpObject(vExplicitOwner),
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tthis:", ...dumpObject(this),
      );
    }
  }

  _getMediaTypeFromTags () {
    this.requireActive();
    let ret = null;
    if (!this.hasField("tags")) return ret;
    // Expect mediaType tag to be formatted like this
    // "tag:" authorityName "," YYYY-MM-DD-date ":" specific [ "#" fragment ]
    // e.g. tag:valaa.com,2017-07-21-date:mediaType#text/plain
    for (const tag of this.get("tags")) {
      const specificWithFragment = tag.tagURI.split(":")[2];
      if (!specificWithFragment) continue;
      const [specific, fragment] = specificWithFragment.split("#");
      if (specific !== "mediaType" || !fragment) continue;
      const [type, subtype] = fragment.split("/");
      ret = { type, subtype };
      break;
    }
    return ret;
  }

  alterValue (alterationVAKON: Kuery, options: VALKOptions = {}, vExplicitOwner: ?Vrapper) {
    try {
      this.requireActive(options);
      if (this._typeName !== "Property") {
        throw new Error("Non-Property values cannot be modified");
      }
      const currentValue = this.extractValue(options, vExplicitOwner);
      const vOwner = vExplicitOwner || this.get("owner", Object.create(options));
      invariantify(!vOwner || vOwner.getLexicalScope,
          "property owner (if defined) must be a Vrapper");
      options.scope = (vOwner || this).getLexicalScope();
      const newValue = this.run(currentValue, alterationVAKON, Object.create(options));
      this.setField("value", expressionFromValue(newValue), options);
      if (typeof newValue !== "object") {
        // TODO(iridian): Could set the cachedExtractvalueEntry for non-object types.
      }
      return newValue;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .alterValue(), with:`,
          "\n\talterationVAKON:", dumpify(alterationVAKON));
    }
  }

  // Blob and Media content management


  /**
   * Returns raw blob content of this Blob as an ArrayBuffer object.
   *
   * @param {*} blobContent
   * @param {VALKOptions} [options={}]
   * @returns
   *
   * @memberof Vrapper
   */
  blobContent (): ArrayBuffer {
    try {
      invariantify(this._typeName === "Blob",
          "Vrapper.blobContent only available for objects of Blob type",
          "\n\ttype:", this._typeName,
          "\n\tobject:", this);
      const content = this.engine.prophet.tryGetCachedBlobContent(this.getRawId());
      if (typeof content !== "undefined") return content;
      throw new Error(`Cannot locate Blob content directly from caches (with id '${
          this.getRawId()}'`);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .blobContent()`);
    }
  }

  /**
   * Eagerly returns a URL for this content of this Media. The URI can be used in the local browser
   * context to access the media content. If the partition of the Media is not acquired, returns
   * a promise for acquiring the partition and performing this operation instead.
   *
   * @param {VALKOptions} [options={}]
   * @returns
   *
   * @memberof Vrapper
   */
  mediaURL (options: VALKOptions = {}) {
    let mediaInfo;
    try {
      this.requireActive(options);
      invariantify(this.hasInterface("Media"),
          "Vrapper.mediaURL only available for objects with Media interface",
          "\n\ttype:", this._typeName,
          "\n\tobject:", this);
      ({ mediaInfo } = this._resolveMediaInfo(Object.create(options)));
      const ret = this._withPartitionConnectionChainEagerly(Object.create(options), connection =>
          connection.getMediaURL(this.getId(options), mediaInfo));
      if (typeof options.immediate !== "undefined") {
        if (!options.immediate) return Promise.resolve(ret);
        if (isPromise(ret)) {
          throw new Error(`Media URL not immediately available for '${
              (mediaInfo && mediaInfo.name) || "<unnamed>"}'`);
        }
      }
      return ret;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .mediaURL(), with:`,
          "\n\tinfo:", mediaInfo);
    }
  }

  /**
   * Eagerly returns the content of this Media. The return type based on requested media type:
   * structured data like JSON is returned as native javascript objects and so on.
   * TODO(iridian): Clarify this further.
   * If the content is not immediately available or if the partition of the Media is not
   * acquired, returns a promise for acquiring the partition and performing this operation instead.
   *
   * @param {VALKOptions} [options={}]
   * @returns
   *
   * @memberof Vrapper
   */
  mediaContent (options: VALKOptions = {}) { return this._extractMediaInterpretation(options); }

  /**
   * Eagerly updates the Media content cache entry with given blobContent, creates a new Blob for it
   * and returns the Blob id.
   * If the partition of the Media is not acquired, returns a promise for acquiring the partition
   * and performing this operation instead.
   * TODO(iridian): This is quite a sucky API. It was deviced to work nicely with LinkField toValue
   * etc. but the interaction just feels forced and stupid: it really should just set the content
   * Blob field of the Media.
   *
   * @param {*} blobContent
   * @param {VALKOptions} [options={}]
   * @returns a function callback which creates the Blob object inside the transaction specified in
   * the options.transaction parameter.
   *
   * @memberof Vrapper
   */
  prepareBlob (content: any, options: VALKOptions = {}) {
    let mediaInfo;
    try {
      this.requireActive(options);
      if (this.hasInterface("Media")) {
        mediaInfo = this.get(Vrapper.toMediaInfoFields, Object.create(options));
      }
      return this._withPartitionConnectionChainEagerly(Object.create(options),
          connection => connection.prepareBlob(content, mediaInfo),
          ({ persistProcess }) => persistProcess,
          (contentId) => {
            const engine = this.engine;
            function ret (innerOptions: VALKOptions = Object.create(options)) {
              innerOptions.id = contentId;
              const callerValker = this && this.__callerValker__;
              if (callerValker) innerOptions.transaction = callerValker;
              return engine.create("Blob", undefined, innerOptions);
            }
            ret._valkCaller = true;
            return ret;
          });
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .prepareBlob(), with:`,
          "\n\tmediaInfo:", mediaInfo);
    }
  }

  updateMediaContent (content: any, options: VALKOptions = {}) {
    console.error("DEPRECATED: Vrapper.updateMediaContent\n\tprefer:Vrapper.prepareBlob");
    return this.prepareBlob(content, options);
  }

  recurseConnectedPartitionMaterializedFieldResources (fieldNames: Array<string>,
      options: Kuery = {}) {
    const activeConnections = this.engine.prophet.getFullPartitionConnections();
    const result = [];
    for (const partitionRawId of Object.keys(activeConnections)) {
      const partition = this.engine.tryVrapper(partitionRawId);
      if (partition) {
        result.push(...(partition.recurseMaterializedFieldResources(fieldNames, options)));
      }
    }
    return result;
  }

  recurseMaterializedFieldResources (fieldNames: Array<string>, options: VALKOptions = { global }) {
    this.requireActive(options);

    invariantify(this.isResource(),
        "Vrapper.recurseMaterializedFieldResources only available for Resource objects");
    const ret = new Map();
    const state = options.state
        || (options.transaction && options.transaction.getState())
        || this.engine.discourse.getState();
    this._accumulateMaterializedFieldResources(state,
        state.getIn([this.getTypeName(), this.getRawId()]), fieldNames, ret);
    return [...(ret.values())];
  }

  _accumulateMaterializedFieldResources (state: Object, transient: Transient,
      fieldNames: Array<string>, results: Map<Transient, Vrapper>) {
    if (!transient) return;
    for (const fieldName of fieldNames) {
      const fieldValue = transient.get(fieldName);
      for (const fieldEntry of
          (!fieldValue ? []
              : (Array.isArray(fieldValue)
                      || (Iterable.isIterable(fieldValue) && !(Iterable.isKeyed(fieldValue))))
                  ? fieldValue
              : [fieldValue])) {
        // TODO(iridian): Replace with tryRawIdFrom or similar
        const id = getRawIdFrom(fieldEntry);
        const typeName = id && state.getIn(["Resource", id]);
        const fieldTransient = typeName && state.getIn([typeName, id]);
        if (fieldTransient && !results.has(fieldTransient)) {
          const vrapper = this.engine.getVrapper(id);
          results.set(fieldTransient, vrapper);
          this._accumulateMaterializedFieldResources(state, fieldTransient, fieldNames, results);
        }
      }
    }
  }

  /**
   * fields - sugar for returning requested fields in an object
   *
   * @param {array<string>} fieldNames
   * @returns
   */
  fields (...fieldNames: any[]) { return this.get(VALEK.select(fieldNames)); }

  registerHandlers (targetEventHandlers: Object) {
    this.setIdSubHandler(targetEventHandlers.get("rawId"), this.getRawId(), null,
        [this, getVrapperEventHandlers()]);
  }

  registerComplexHandlers (targetEventHandlers: Object, state: Object) {
    const idHandlers = targetEventHandlers.get("rawId");
    // Add primary vrapper entry
    let currentRawId = this.getRawId();
    let currentObject = this.getTransient();
    let ghostPath = currentObject.get("id").getGhostPath();
    const listenedRawIds = [];
    try {
      const table = state.get(this._typeName);
      invariantify(table, `type '${this._typeName}' table missing`);
      do {
        // Alternate walking down ghostpaths and prototypes: for ghost paths we might not have
        // actually materialized objects and on the other hand prototypes can only be found from
        // materialized Resource's.

        // currentRawId and thus current head of ghostPath has already been registered here, so skip
        while ((ghostPath = ghostPath && ghostPath.previousStep())) {// eslint-disable-line
          currentRawId = ghostPath.headRawId();
          listenedRawIds.push(currentRawId);
        }
        do {// eslint-disable-line
          currentObject = table.get(currentRawId);
          const prototypeIdData = currentObject.get("prototype");
          if (!prototypeIdData) break;
          [currentRawId, , ghostPath] = expandIdDataFrom(prototypeIdData);
          listenedRawIds.push(currentRawId);
        } while (!ghostPath);
      } while (ghostPath);
      this.refreshHandlers(targetEventHandlers, listenedRawIds, idHandlers);
    } catch (error) {
      throw this.wrapErrorEvent(error, `registerComplexHandlers`,
          "\n\trawId:", currentRawId,
          "\n\tcurrentObject:", ...dumpObject(currentObject && currentObject.toJS()),
          "\n\tghost path:", ...dumpObject(ghostPath),
          "\n\tlistened rawId's:", ...dumpObject(listenedRawIds),
      );
    }
  }

  unregisterHandlers (targetEventHandlers: Object) {
    const idHandlers = targetEventHandlers.get("rawId");
    this.refreshHandlers(targetEventHandlers, undefined, idHandlers);

    // Clear primary vrapper entry
    this.clearIdSubHandler(idHandlers, this.getRawId(), null);
  }

  refreshHandlers (targetEventHandlers: Object, newListenedRawIds: ?any[],
      idHandlers: Object = targetEventHandlers.get("rawId")) {
    for (const id of (this.listenedRawIds || [])) this.clearIdSubHandler(idHandlers, id, this);
    this.listenedRawIds = null;
    for (const id of (newListenedRawIds || [])) {
      this.setIdSubHandler(idHandlers, id, this, getVrapperEventHandlers());
    }
    this.listenedRawIds = newListenedRawIds;
  }

  setIdSubHandler (idHandlers: Object, id: string, key: any, rule: any) {
    let handlersById = idHandlers.get(id);
    if (!handlersById) idHandlers.set(id, (handlersById = new Map()));
    handlersById.set(key, rule);
  }

  clearIdSubHandler (idHandlers: Object, id: string, key: any) {
    const handlersById = idHandlers.get(id);
    handlersById.delete(key);
    if (!handlersById.size) idHandlers.delete(id);
  }


/**
 * Returns or finds an existing partition proxy of this object in the given partition.
 * Given partition p proxy x of prototype object o as x = pProxy(o, p), the following hold:
 * 1. primary proxy object rules:
 * 1.1. x.id = derivedId(o.id, { proxyPartition: p.id })
 * 1.2. x.prototype = p.id
 * Thus obtaining the proxy object is idempotent in its partition, after first creation.
 * Unlike with partition instances the member couplings of the proxy object are not processed at
 * all. This means that any property accesses have to perform a further obtainProxyIn translation
 * to obtain similar proxy objects.
 * Partition proxies and partition instances are disjoint even for same prototypes.
 * @param {any} partition
 * @param {any} transaction If given, the proxy lookup and possible creation are performed in the
 *   transaction context. Otherwise, the lookup and creation are immediately performed against the
 *   backing engine and its false prophet.
 */
  getGhostIn (vInstance: Vrapper, transaction: ?Transaction) {
    this.requireActive({ transaction });
    const state = (transaction || this.engine.discourse).getState();
    const ghostVRef = createGhostVRefInInstance(this._objectId,
        vInstance.getTransient({ transaction }));
    // TODO(iridian): Verify and return null if this object has no ghost in instance, ie. if this
    // object is not a sub-component in the direct prototype of vInstance
    if (false) return null;
    return this.engine.getVrapper(ghostVRef, { state });
  }

  onEventCREATED (vResource: Vrapper, { state }: Prophecy) {
    this.updateTransient(state);
  }

  onEventMODIFIED (vResource: Vrapper, prophecy: Prophecy) {
    if (this._debug) {
      console.log(`${this.debugId()}.onEventMODIFIED()`, prophecy, this);
    }
    try {
      this.updateTransient(prophecy.state);
      if (prophecy.passage.sets && prophecy.passage.sets.name) {
        this._refreshDebugId(
            this.getTransient({ typeName: prophecy.passage.typeName, state: prophecy.state }),
            { state: prophecy.state });
      }
      if (prophecy.passage.actualAdds) {
        for (const fieldName of prophecy.passage.actualAdds.keys()) {
          this.notifyMODIFIEDHandlers(fieldName, prophecy, vResource);
        }
      }
      if (prophecy.passage.actualRemoves) {
        for (const fieldName of prophecy.passage.actualRemoves.keys()) {
          if (!prophecy.passage.actualAdds || !prophecy.passage.actualAdds.has(fieldName)) {
            // Only fire modified event once per property.
            this.notifyMODIFIEDHandlers(fieldName, prophecy, vResource);
          }
        }
      }
      if (prophecy.passage.actualMoves) {
        for (const fieldName of prophecy.passage.actualMoves.keys()) {
          if ((!prophecy.passage.actualAdds || !prophecy.passage.actualAdds.has(fieldName))
              && (!prophecy.passage.actualRemoves
                  || !prophecy.passage.actualRemoves.has(fieldName))) {
            // Only fire modified event once per property.
            this.notifyMODIFIEDHandlers(fieldName, prophecy, vResource);
          }
        }
      }
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .onEventMODIFIED()`);
    }
  }

  onEventFIELDS_SET (vResource: Vrapper, prophecy: Prophecy) { // eslint-disable-line camelcase
    return this.onEventMODIFIED(vResource, prophecy);
  }

  onEventADDED_TO (vResource: Vrapper, prophecy: Prophecy) { // eslint-disable-line camelcase
    return this.onEventMODIFIED(vResource, prophecy);
  }

  onEventREMOVED_FROM (vResource: Vrapper, prophecy: Prophecy) { // eslint-disable-line camelcase
    return this.onEventMODIFIED(vResource, prophecy);
  }

  onEventREPLACED_WITHIN (vResource: Vrapper, prophecy: Prophecy) { // eslint-disable-line camelcase
    return this.onEventMODIFIED(vResource, prophecy);
  }

  onEventSPLICED (vResource: Vrapper, prophecy: Prophecy) { // eslint-disable-line camelcase
    return this.onEventMODIFIED(vResource, prophecy);
  }

  onEventDESTROYED (vResource: Vrapper, { timed }: Prophecy) {
    (this._destroyedHandlers || []).forEach(handler => handler(timed));
    this._phase = DESTROYED;
    this.engine.delayedRemoveCog(this);
  }

  addDESTROYEDHandler (handler: Function) {
    if (!this._destroyedHandlers) this._destroyedHandlers = [];
    this._destroyedHandlers.push(handler);
  }

  notifyMODIFIEDHandlers (fieldName: string, prophecy: Prophecy, vProphecyResource: Vrapper) {
    const subscribers = this._subscribersByFieldName && this._subscribersByFieldName.get(fieldName);
    const filterSubscribers = this._fieldFilterSubscribers;
    if (!subscribers && !filterSubscribers) return;
    const fieldUpdate = new FieldUpdate(
        this, fieldName, prophecy, { state: prophecy.state }, undefined, vProphecyResource);
    this._delayedNotifyMODIFIEDHandlers(fieldUpdate, subscribers, filterSubscribers);
    return;
  }

  async _delayedNotifyMODIFIEDHandlers (fieldUpdate: FieldUpdate, subscribers: any,
      filterSubscribers: any) {
    const fieldName = fieldUpdate.fieldName();
    const alreadyNotified = fieldUpdate.prophecy()._alreadyNotified
        || (fieldUpdate.prophecy()._alreadyNotified = new Set());
    for (const subscriber of (subscribers || [])) {
      try {
        if (!alreadyNotified.has(subscriber)) {
          alreadyNotified.add(subscriber);
          subscriber._triggerUpdateByFieldUpdate(fieldUpdate);
        }
      } catch (error) {
        outputError(wrapError(error,
            `Exception caught during ${this.debugId()}\n .delayedNotifyMODIFIEDHandlers('${
                fieldName}')`,
            "\n\tfield update:", fieldUpdate,
            "\n\tfailing field subscriber:", ...dumpObject(subscriber),
            "\n\tstate:", ...dumpObject(fieldUpdate.prophecy().state.toJS())));
      }
    }
    if (filterSubscribers) {
      const fieldIntro = this.getTypeIntro().getFields()[fieldName];
      for (const filterSubscriber of filterSubscribers) {
        try {
          if (!alreadyNotified.has(filterSubscriber)) {
            alreadyNotified.add(filterSubscriber);
            filterSubscriber._tryTriggerUpdateByFieldUpdate(fieldIntro, fieldUpdate);
          }
        } catch (error) {
          outputError(wrapError(error,
              `Exception caught during ${this.debugId()}\n .delayedNotifyMODIFIEDHandlers('${
                  fieldName}')`,
              "\n\tfield update:", fieldUpdate,
              "\n\tfailing filter subscriber:", ...dumpObject(filterSubscriber),
              "\n\tstate:", ...dumpObject(fieldUpdate.prophecy().state.toJS())));
        }
      }
    }
  }

  /**
   * Adds a new subscriber for modifications on fields filtered by given filter.
   *
   * @param {(boolean | string | (fieldIntro: Object) => boolean | Kuery)} filter
   * @param {(update: FieldUpdate) => void} callback       called on any updates on filtered fields
   * @param {VrapperSubscriber} [subscriber=new VrapperSubscriber()]
   * @returns {VrapperSubscriber}
   *
   * @memberof Vrapper
   */
  subscribeToMODIFIED (filter: boolean | string | (fieldIntro: Object) => boolean | Kuery,
      callback: (update: FieldUpdate) => void,
      subscriber: VrapperSubscriber = new VrapperSubscriber(),
      options: VALKOptions = {}): VrapperSubscriber {
    try {
      this.requireActive();
      if (filter instanceof Kuery) {
        return subscriber.initializeKuery(this, this, filter, callback, options);
      }
      return subscriber.initializeFilter(this, filter, callback);
    } catch (error) {
      throw this.wrapErrorEvent(error, `subscribeToMODIFIED()`,
          "\n\tfilter:", ...(filter instanceof Kuery ? dumpKuery(filter) : dumpObject(filter)),
          "\n\tsubscriber:", ...dumpObject(subscriber),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _subscribersByFieldName: Map<string, Set<VrapperSubscriber>>;

  _registerSubscriberByFieldName (fieldName: string, subscriber: VrapperSubscriber) {
    let currentSubscribers;
    try {
      if (this._phase === NONRESOURCE) return undefined;
      this.requireActive();
      if (!this._subscribersByFieldName) this._subscribersByFieldName = new Map();
      currentSubscribers = this._subscribersByFieldName.get(fieldName);
      if (!currentSubscribers) {
        currentSubscribers = new Set();
        this._subscribersByFieldName.set(fieldName, currentSubscribers);
      }
      currentSubscribers.add(subscriber);
      return currentSubscribers;
    } catch (error) {
      throw this.wrapErrorEvent(error, `_registerSubscriberByFieldName('${fieldName}')`,
          "\n\tsubscriber:", ...dumpObject(subscriber),
          "\n\tcurrent field subscribers:", ...dumpObject(currentSubscribers),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _fieldFilterSubscribers: Set<VrapperSubscriber>;

  _registerSubscriberByFieldFilter (fieldFilter: Function | boolean,
      subscriber: VrapperSubscriber) {
    try {
      if (this._phase === NONRESOURCE) return undefined;
      this.requireActive();
      if (!this._fieldFilterSubscribers) this._fieldFilterSubscribers = new Set();
      this._fieldFilterSubscribers.add(subscriber);
      return this._fieldFilterSubscribers;
    } catch (error) {
      throw this.wrapErrorEvent(error, "_registerSubscriberByFieldFilter()",
          "\n\tfield filter:", ...dumpObject(fieldFilter),
          "\n\tsubscriber:", ...dumpObject(subscriber),
          "\n\tcurrent filter subscribers:", ...dumpObject(this._fieldFilterSubscribers),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _tryElevateFieldValueFrom (state: State, name: string, value: any, vIdOwner: Vrapper) {
    if (!vIdOwner || (vIdOwner === this)) return value;
    const options = { state };
    return tryElevateFieldValue(new Resolver(options), value, {
      name,
      intro: this.getFieldIntro(name),
      sourceTransient: vIdOwner.getTransient(options),
      elevationInstanceId: this.getId(options),
    });
  }

  _setUpScopeFeatures (options: VALKOptions) {
    // Refers all Scope.properties:Property objects in this._lexicalScope to enable scoped script
    // access which uses the owner._lexicalScope as the scope prototype if one exists.

    this._scopeOwnerSubscriber = this.subscribeToMODIFIED("owner", (ownerUpdate: FieldUpdate) => {
      const parent = ownerUpdate.value() || this.engine;
      if (!this._lexicalScope) {
        this._lexicalScope = Object.create(parent.getLexicalScope());
        this._lexicalScope.this = this;
        this._nativeGlobal = Object.create(parent.getNativeGlobal());
      } else {
        Object.setPrototypeOf(this._lexicalScope, parent.getLexicalScope());
        Object.setPrototypeOf(this._nativeGlobal, parent.getNativeGlobal());
      }
    }, new VrapperSubscriber().setSubscriberInfo(`Vrapper(${this.debugId()}).scope.owner`)
    ).triggerUpdate(options);
    if (!this._lexicalScope) {
      throw this.wrapErrorEvent(new Error("Vrapper owner is not immediately available"),
          "_setUpScopeFeatures",
          "\n\tthis:", ...dumpObject(this));
    }
    this._scopeNameSubscribers = {};
    this._scopePropertiesSub = this.subscribeToMODIFIED("properties", (update: FieldUpdate) => {
      update.actualAdds().forEach(vActualAdd => {
        // TODO(iridian): Perf opt: this uselessly creates a subscriber in each Property Vrapper.
        // We could just as well have a cog which tracks Property.name changes and
        // updates their owning Scope Vrapper._lexicalScope's.
        // Specifically: it is the call to actualAdds() which does this.
        this._scopeNameSubscribers[vActualAdd.getRawId()] = vActualAdd.subscribeToMODIFIED("name",
        nameUpdate => {
          const newName = nameUpdate.value();
          if ((newName === "this") || (newName === "self")) {
            this.warnEvent(`Property name '${newName
                }' is a reserved word and is omitted from scope`);
            return;
          }
          const passage = nameUpdate.prophecy() && nameUpdate.prophecy().passage;
          if (passage && !isCreatedLike(passage)) {
            for (const propertyName of Object.keys(this._lexicalScope)) {
              if (this._lexicalScope[propertyName] === vActualAdd) {
                delete this._lexicalScope[propertyName];
                delete this._nativeGlobal[propertyName];
                break;
              }
            }
          }
          if (!newName) return;
          if (this._lexicalScope.hasOwnProperty(newName)) { // eslint-disable-line
            if (vActualAdd === this._lexicalScope[newName]) return;
            console.warn(`Overriding existing Property '${newName}' in Scope ${
                this.debugId()}, with:`,
                "\n\tnew value:", ...dumpObject(vActualAdd),
                "\n\tprevious value:", ...dumpObject(this._lexicalScope[newName]),
                "\n\tfull Scope object:", ...dumpObject(this));
          }
          this._lexicalScope[newName] = vActualAdd;
          Object.defineProperty(this._nativeGlobal, newName, {
            configurable: true,
            enumerable: true,
            get: () => vActualAdd.extractValue(undefined, this),
            set: (value) => vActualAdd.setField("value", expressionFromValue(value),
                { scope: this._lexicalScope }),
          });
        }, new VrapperSubscriber().setSubscriberInfo(
            `Vrapper(${this.debugId()}).properties(${vActualAdd.getRawId()}).name`)
        ).triggerUpdate(update.valkOptions());
      });
      update.actualRemoves().forEach(vActualRemove => {
        const subscriber = this._scopeNameSubscribers[vActualRemove.getRawId()];
        if (subscriber) {
          subscriber.unregister();
          delete this._scopeNameSubscribers[vActualRemove.getRawId()];
        }
        const propertyName = vActualRemove.get("name", update.previousStateOptions());
        if (this._lexicalScope[propertyName] === vActualRemove) {
          delete this._lexicalScope[propertyName];
          delete this._nativeGlobal[propertyName];
        }
      });
    }, new VrapperSubscriber().setSubscriberInfo(`Vrapper(${this.debugId()}).properties`)
    ).triggerUpdate(options);
  }
}

Vrapper.prototype[ValaaPrimitive] = true;

let vrapperEventHandlers;

function getVrapperEventHandlers () {
  if (!vrapperEventHandlers) {
    vrapperEventHandlers = new Map();
    const prototype = new Vrapper(null, new VRef(["dummy"]), "Dummy");
    extractMagicMemberEventHandlers(vrapperEventHandlers, prototype, null);
  }
  return vrapperEventHandlers;
}

const applicatorCreators = {
  hasInterface: createApplicatorWithNoOptions,
  hasField: createApplicatorWithNoOptions,
  setField: createApplicatorWithOptionsThird,
  addToField: createApplicatorWithOptionsThird,
  removeFromField: createApplicatorWithOptionsThird,
  create: createApplicatorWithOptionsThird,
  duplicate: createApplicatorWithOptionsSecond,
  instantiate: createApplicatorWithOptionsSecond,
  destroy: createApplicatorWithOptionsFirst,
  emplaceSetField: createApplicatorWithOptionsThird,
  emplaceAddToField: createApplicatorWithOptionsThird,
  propertyValue: createApplicatorWithOptionsSecond,
  alterProperty: createApplicatorWithOptionsThird,
  deleteProperty: createApplicatorWithOptionsSecond,
  extractValue: createApplicatorWithOptionsFirst,
  blobContent: createApplicatorWithOptionsThird,
  mediaURL: createApplicatorWithOptionsFirst,
  mediaContent: createApplicatorWithOptionsFirst,
  prepareBlob: createApplicatorWithOptionsSecond,
  updateMediaContent: createApplicatorWithOptionsSecond,
  recurseMaterializedFieldResources: createApplicatorWithOptionsSecond,
  recurseConnectedPartitionMaterializedFieldResources: createApplicatorWithOptionsSecond,
};

function createApplicatorWithNoOptions (vrapper: Vrapper, methodName: string) {
  return (...args: any[]) => {
    try {
      return vrapper[methodName](...args);
    } catch (error) {
      throw wrapError(error, `During ${vrapper.debugId()}\n .getVALKMethod(${methodName}), with:`,
          ...(Array.isArray(args) ? args : [args])
              .reduce((accum, arg, index) =>
                  accum.concat([`\n\targ#${index}:`]).concat(dumpify(arg)), []),
      );
    }
  };
}

function createApplicatorWithOptionsFirst (vrapper: Vrapper, methodName: string, valker: Valker) {
  return (options: Object = {}, ...rest) => {
    try {
      options.transaction = valker;
      return vrapper[methodName](options, ...rest);
    } catch (error) {
      throw wrapError(error, `During ${vrapper.debugId()}\n .getVALKMethod(${
              methodName}), with:`,
          "\n\targ#0, options:", ...dumpObject(options),
      );
    }
  };
}

function createApplicatorWithOptionsSecond (vrapper: Vrapper, methodName: string, valker: Valker) {
  return (first: any, options: Object = {}, ...rest) => {
    try {
      options.transaction = valker;
      return vrapper[methodName](first, options, ...rest);
    } catch (error) {
      throw wrapError(error, `During ${vrapper.debugId()}\n .getVALKMethod(${
              methodName}), with:`,
          "\n\targ#0:", dumpify(first),
          "\n\targ#1, options:", ...dumpObject(options),
      );
    }
  };
}

function createApplicatorWithOptionsThird (vrapper: Vrapper, methodName: string, valker: Valker) {
  return (first: any, second: any, options: Object = {}, ...rest) => {
    try {
      options.transaction = valker;
      return vrapper[methodName](first, second, options, ...rest);
    } catch (error) {
      throw wrapError(error, `During ${vrapper.debugId()}\n .getVALKMethod(${
              methodName}), with:`,
          "\n\targ#0:", dumpify(first),
          "\n\targ#1:", dumpify(second),
          "\n\targ#2, options:", ...dumpObject(options),
      );
    }
  };
}
