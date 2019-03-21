// @flow

import { GraphQLObjectType, isAbstractType } from "graphql/type";
import { Iterable } from "immutable";

import VALK, { packedSingular } from "~/raem/VALK";
import type { VALKOptions } from "~/raem/VALK"; // eslint-disable-line no-duplicate-imports
import type { Passage, Story } from "~/raem/redux/Bard";
import { getHostRef, HostRef, UnpackedHostValue } from "~/raem/VALK/hostReference";

import { addedTo, fieldsSet, isCreatedLike, removedFrom, replacedWithin } from "~/raem/events";
import ValaaReference, { vRef, invariantifyId, getRawIdFrom, tryCoupledFieldFrom }
    from "~/raem/ValaaReference";
import type { VRef } from "~/raem/ValaaReference"; // eslint-disable-line no-duplicate-imports
import { naiveURI } from "~/raem/ValaaURI";

import dataFieldValue from "~/raem/tools/denormalized/dataFieldValue";

import { Transient } from "~/raem/state";
import type { State } from "~/raem/state"; // eslint-disable-line no-duplicate-imports
import { tryElevateFieldValue } from "~/raem/state/FieldInfo";
import { getObjectRawField } from "~/raem/state/getObjectField";

import { createGhostVRefInInstance, isMaterialized, createMaterializeGhostAction }
    from "~/raem/tools/denormalized/ghost";
import { MissingPartitionConnectionsError, addConnectToPartitionToError }
    from "~/raem/tools/denormalized/partitions";

import isResourceType from "~/raem/tools/graphql/isResourceType";
import isInactiveTypeName from "~/raem/tools/graphql/isInactiveTypeName";

import { ValaaPrimitiveTag } from "~/script";

import { Discourse, Transaction, PartitionConnection } from "~/prophet";
import { ChronicleEventResult } from "~/prophet/api/types";

import { createModuleGlobal } from "~/tools/mediaDecoders/JavaScriptDecoder";

import VALEK, { Valker, Kuery, dumpKuery, expressionFromProperty } from "~/engine/VALEK";

import Cog, { extractMagicMemberEventHandlers } from "~/engine/Cog";
import debugId from "~/engine/debugId";
import _FieldUpdate from "~/engine/Vrapper/FieldUpdate";
import _Subscription from "~/engine/Vrapper/Subscription";
import universalizeCommandData from "~/engine/Vrapper/universalizeCommandData";
import { defaultOwnerCoupledField } from
    "~/engine/ValaaSpace/Valaa/injectSchemaTypeBindings";

import { arrayFromAny, iterableFromAny, dumpify, dumpObject,
  invariantify, invariantifyObject, invariantifyString,
  isPromise, thenChainEagerly, outputError, wrapError,
} from "~/tools";
import { mediaTypeFromFilename } from "~/tools/MediaTypeData";

export const FieldUpdate = _FieldUpdate;
export const Subscription = _Subscription;

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
 * 2.6. NonResource: the Vrapper is a degenerate proxy to a non-Resource Valaa object; Bvob or Data.
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
    Vrapper.vrapperIndex += 1;
    this.vrapperIndex = Vrapper.vrapperIndex;
    this[HostRef] = id;
    this._setTypeName(typeName);
    if (typeName === "Blob" || !this.engine) {
      this._phase = NONRESOURCE;
    } else {
      this._phase = isResourceType(this.getTypeIntro()) ? INACTIVE : NONRESOURCE;
      this.engine.addCog(this);
      if (!id.isGhost() && !id.getPartitionURI()) {
        if (!id.isInactive()) {
          throw new Error(`Cannot create an active non-ghost Vrapper without id.partitionURI: <${
              id}>`);
        }
        this.logEvent(1, () => [
          "non-ghost Vrapper encountered without a partitionURI and which thus cannot be",
          "activated directly. This is most likely ghost prototype path root resource which",
          "needs to have all intervening partitions activated first",
        ]);
      } else if (immediateRefresh) {
        this.refreshPhase(...immediateRefresh);
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
    const partitionURI = this[HostRef].getPartitionURI();
    if (!partitionURI) return false;
    return naiveURI.getPartitionRawId(partitionURI) === this[HostRef].rawId();
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
    return this.engine.discourse.schema;
  }

  getTypeIntro () {
    if (!this._typeIntro && this.engine) {
      const intro = this.engine.discourse.schema.getType(this._typeName);
      if (!intro) throw new Error(`Could not find schema type for '${this._typeName}'`);
      else if (!intro.getInterfaces) {
        throw new Error(`Interface type '${this._typeName}' cannot be used as Vrapper type`);
      }
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
    const initialBlocker = this.refreshPhase(state);
    if (!initialBlocker) return undefined;
    if (this._activationProcess) return this._activationProcess;
    this._phase = ACTIVATING;
    const operationInfo = { pendingConnection: null };
    this._activationProcess = (async () => {
      let blocker;
      try {
        for (blocker = initialBlocker; blocker; blocker = this.refreshPhase()) {
          if (isNonActivateablePhase(blocker.getPhase())) {
            throw new Error(`Cannot activate ${blocker.debugId()
                } because it is ${blocker.getPhase()}`);
          }
          if (!blocker._partitionConnection || !blocker._partitionConnection.isActive()) {
            await (operationInfo.pendingConnection = blocker.getPartitionConnection())
                .getActiveConnection();
          }
        }
        operationInfo.pendingConnection = null;
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
    })();
    this._activationProcess.operationInfo = operationInfo;
    return this._activationProcess;
  }

  /**
   * Refreshes the Vrapper state to Active phase if the resource and
   * all of its prototypes (and their connections) have been activated.
   * Will *not* initiate an activation process by itself.
   * Returns undefined if successful ie. the phase is now Active,
   * otherwise returns the Vrapper blocking the synchronous activation
   * (which might be this Vrapper itself).
   * Finally, if the activation is blocked by a fully inactive
   * prototype the VRef id of that prototype is returned.
   * The blocking cause can be inspected by blocker.getPhase(): if the
   * phase is Inactive or Activating, the cause is a non-full partition
   * connection. Otherwise the cause is a non-activateable phase
   * (Destroyed, Unavailable, NonResource).
   * Unavailable indicates an error on the partition connection sync
   * which can be extracted with
   * `Promise.resolve(conn.getActiveConnection()).catch(onError);`
   *
   * @param {Object} state
   * @param {Transient} transient
   * @returns
   *
   * @memberof Vrapper
   */
  refreshPhase (refreshingState?: Object, refreshingTransient?: Transient) {
    if (this._phase === ACTIVE) return undefined;
    if ((this._phase !== INACTIVE) && (this._phase !== ACTIVATING)) return this;
    const resolver = this.engine.discourse.maybeForkWithState(refreshingState);
    const transient = refreshingTransient
        || resolver.tryGoToTransient(this[HostRef], this._typeName);
    if (!transient) {
      this._phase = this[HostRef].isGhost() ? INACTIVE : DESTROYED;
      return undefined;
    }
    this._updateTransient(resolver.state, transient);
    const id = transient.get("id");
    if (!id.getPartitionURI() && !id.isGhost() && (this._typeName !== "Blob")) {
      if (id.isInactive()) return this;
      throw new Error(`Cannot update an active non-ghost Vrapper id with no partitionURI: <${
          id}>, (current id: <${this[HostRef]}>)`);
    }
    this[HostRef] = id;
    const connection = this.tryPartitionConnection();
    if (!connection || !connection.isActive()) {
      if (this[HostRef].isInactive()) return this;
    }
    let prototypeId = transient.get("prototype");
    if (!prototypeId) {
      const prototypeGhostPath = this[HostRef].previousGhostStep();
      if (prototypeGhostPath) {
        prototypeId = vRef(prototypeGhostPath.headRawId(), undefined, prototypeGhostPath);
      }
    }
    if (prototypeId) {
      const prototypeVrapper = this.engine.getVrapper(prototypeId, { optional: true });
      if (!prototypeVrapper) return prototypeId;
      const blocker = prototypeVrapper.refreshPhase();
      if (blocker) return blocker;
    }
    this._phase = ACTIVE;
    this._activationProcess = undefined;
    this._postActivate(resolver, transient);
    return undefined;
  }

  _postActivate (resolver: Object, transient: Transient) {
    let partitionAuthorityURIString;
    let authorityConnection;
    try {
      if (!this._typeName || isInactiveTypeName(this._typeName)) {
        const ref = this[HostRef];
        if (ref.isInactive()) {
          this.warnEvent("Activating id explicitly! Should have been activated by reducers");
          ref.setInactive(false);
        }
        let newTypeName = transient.get("typeName");
        if (isInactiveTypeName(newTypeName)) {
          newTypeName = resolver.tryGoToTransient(
              ref, "TransientFields", true, false, true, "typeName").get("typeName");
        }
        this._setTypeName(newTypeName);
      }
      this.setName(`Vrapper/${this.getRawId()}:${this._typeName}`);
      if (!this.isInactive()) {
        this.registerComplexHandlers(this.engine._storyHandlerRoot, resolver.state);
      }
      this._refreshDebugId(transient, { state: resolver.state });
      if (this.hasInterface("Scope")) this._setUpScopeFeatures({ state: resolver.state });
    } catch (error) {
      outputError(this.wrapErrorEvent(error,
              new Error("_postActivate()"),
              "\n\ttransient:", ...dumpObject(transient.toJS()),
              "\n\tpartitionConnection:", ...dumpObject(this._partitionConnection),
              "\n\tpartitionAuthorityURI:", partitionAuthorityURIString,
              "\n\tauthorityConnection:", authorityConnection,
              "\n\tthis:", ...dumpObject(this),
              "\n\tresolver.state:", ...dumpObject(resolver.state.toJS()),
              "\n\tdiscourse.state:", ...dumpObject(this.engine.discourse.getState().toJS())),
          "Exception caught and swallowed in Vrapper._postActivate");
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
    if (this._phase === ACTIVE
        || ((options && options.allowActivating) && (this._phase === ACTIVATING))) return;
    const blocker = this.refreshPhase();
    if (!blocker) return;
    if (blocker.isDestroyed() && options) {
      // TODO(iridian): While this takes care of the situation where
      // a Resource is destroyed in the main line but not destroyed in
      // a transaction, the reverse scenario is not handled: if a
      // resource is destroyed in transaction but not in main line,
      // requireActive will keep on passing. This is a lesser issue as
      // any illegal operations will still be caught by FalseProphet
      // and backend validations. But nevertheless the lack of symmetry
      // and dirty caching is unclean. Caching is hard.
      const resolver = options.transaction
          || (!options.state && this.engine.discourse)
          || Object.create(this.engine.discourse).setState(options.state);
      if (resolver.tryGoToTransient(this[HostRef], this._typeName)) return;
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
        "\n\tthis[HostRef]:", ...dumpObject(this[HostRef]),
        "\n\tthis._partitionConnection:", ...dumpObject(this._partitionConnection),
        "\n\tblocker:", ...dumpObject(blocker),
        "\n\tblocker._partitionConnection:", ...dumpObject(blocker._partitionConnection),
        "\n\tthis:", ...dumpObject(this));
  }

  tryPartitionConnection (options: Object = {}): ?PartitionConnection {
    options.require = false;
    options.newConnection = false;
    const ret = this.getPartitionConnection(options);
    return ret && ret.isActive() ? ret : undefined;
  }

  getPartitionConnection (options:
      { require?: boolean, transaction?: Transaction, newConnection?: boolean }
          = { require: true }): ?PartitionConnection {
    if (this._partitionConnection) return this._partitionConnection;
    let partitionURI;
    let nonGhostOwnerRawId;
    try {
      if (!this.isResource()) {
        throw new Error(`Non-resource Vrapper's cannot have partition connections`);
      }
      partitionURI = this[HostRef].getPartitionURI();
      const transaction = options.transaction || this.engine.discourse;
      if (!partitionURI) {
        nonGhostOwnerRawId = this[HostRef].getGhostPath().headHostRawId() || this[HostRef].rawId();
        const transient = transaction.tryGoToTransientOfRawId(nonGhostOwnerRawId, "Resource");
        if (transient) {
          partitionURI = transient && transient.get("id").getPartitionURI();
          if (!partitionURI) {
            const authorityURIString = transient.get("partitionAuthorityURI");
            partitionURI = authorityURIString
                && naiveURI.create(authorityURIString, transient.get("id").rawId());
          }
        }
      }
      this._partitionConnection = partitionURI
          && transaction.acquirePartitionConnection(partitionURI, {
            newPartition: false, newConnection: options.newConnection, require: options.require,
          });
      if (!this._partitionConnection) {
        if (!options.require) return undefined;
        throw new Error(`Failed to acquire the partition connection of ${this.debugId()}`);
      }
      if (!this._partitionConnection.isActive()) {
        this._partitionConnection.getActiveConnection().catch(onError.bind(this,
            new Error(`getPartitionConnection.acquire.getActiveConnection()`)));
      }
      return this._partitionConnection;
    } catch (error) {
      return onError.call(this, new Error(`getPartitionConnection(${
          options.require ? "require" : "optional"})`), error);
    }
    function onError (wrapper, error) {
      throw this.wrapErrorEvent(error, wrapper,
          "\n\toptions:", ...dumpObject(options),
          "\n\tthis[HostRef]:", this[HostRef],
          "\n\tthis._transient:", this._transient,
          "\n\tpartitionURI:", partitionURI,
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _withActiveConnectionChainEagerly (options: VALKOptions,
      chainOperations: ((prev: any) => any)[], onError?: Function) {
    return thenChainEagerly(
        this.getPartitionConnection(options).getActiveConnection(options.synchronous),
        chainOperations,
        onError);
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
    return transient ? transient.get("id") : this[HostRef];
  }

  /**
   * Returns the unique raw id string of this resource.
   * This id string should not be used as an id in outgoing kueries because it might belong to a
   * immaterial ghost or a resource outside known partitions. So in other words, while rawId
   * identifies a resource, it doesn't act as a universal locator. See idData for that.
   *
   * @returns
   */
  getRawId () { return this[HostRef].rawId(); }


  getTypeName (options: any) {
    if (this.isResource() && (!options || (options.require !== false))) this.requireActive(options);
    return this._typeName;
  }

  tryTypeName () {
    return this._typeName;
  }

  _setTypeName (typeName: string) {
    if (typeName === this._typeName) return;
    this._typeName = typeName;
    this._typeIntro = null;
  }

  setDebug (level: number) { this._debug = level; }

  debugId (options?: any) {
    if (options && options.short) {
      options.require = false;
      return debugId(this.getTransient(options) || this[HostRef], { short: true });
    }
    if (!this.__debugId) {
      this.__debugId = debugId(this._transient || this[HostRef]);
    }
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
        targetText = `<in inactive '${targetId.getPartitionURI()}'>`;
      } else {
        const target = this.get("target", options);
        targetText = (target && debugId(target, options)) || "<target not found>";
      }
      this.__debugId = `${debugId(transient)}->${targetText}`;
    }
  }

  getTransient (options: ?{
    state?: Object, transaction?: Transaction, typeName?: string, mostMaterialized?: any,
    withOwnField?: string,
  } = {}) {
    const explicitState = options.state
        || (options.transaction ? options.transaction.getState()
            : options.withOwnField ? this.engine.discourse.getState()
            : undefined);
    const state = explicitState || this._transientStaledIn;
    if (!state) return this._transient;
    const discourse = options.transaction || this.engine.discourse;
    const typeName = options.typeName || this.getTypeName(options);
    let ret = state.getIn([typeName, this.getRawId()]);
    if (!ret || (options.withOwnField && !ret.has(options.withOwnField))) {
      let resolver = discourse;
      if (discourse.state !== state) {
        resolver = Object.create(discourse);
        resolver.state = state;
      }
      ret = resolver.tryGoToTransient(this[HostRef], typeName,
          options.require, false, options.mostMaterialized, options.withOwnField);
    }
    if (ret && !explicitState) {
      this._updateTransient(null, ret);
    }
    return ret;
  }

  isGhost () { return this[HostRef].isGhost(); }

  isMaterialized (transaction: ?Transaction) {
    const state = (transaction || this.engine.discourse).getState();
    this.requireActive({ state });
    return isMaterialized(state, this.getId());
  }

  materialize (transaction: ?Transaction): ChronicleEventResult {
    const discourse = (transaction || this.engine.discourse);
    this.requireActive({ state: discourse.getState() });
    return discourse.chronicleEvent(
        createMaterializeGhostAction(discourse, this.getId(), this._typeName));
  }

  _updateTransient (state: ?Object, object: ?Object) {
    // TODO(iridian): Storing the transient in the vrapper is silly and useless premature
    // optimization. With the transactions it can't really be used anyway, so yeah. Get rid of it
    // and just store the id VRef in the Vrapper.
    if (object) {
      invariantifyObject(object, "Vrapper._updateTransient.object", { instanceof: Transient });
      this._transient = object;
      this._transientStaledIn = null;
    } else if (this._transient) {
      this._transientStaledIn = state;
    } else throw new Error(`Must specify object with first _updateTransient call`);
    if (!this.__debugId) this._refreshDebugId(this._transient, { state });
  }

  getSelfAsHead (singularTransient: any = this.getTransient()) {
    return packedSingular(singularTransient, this._typeName || "TransientFields");
  }

  getLexicalScope (createIfMissing: boolean) {
    if (!this._lexicalScope) {
      if (!createIfMissing) {
        this.requireActive();
        return this.engine.getLexicalScope();
      }
      this._initializeScopes(this.engine);
    }
    return this._lexicalScope;
  }

  getNativeScope (createIfMissing: boolean) {
    if (!this._nativeScope) {
      if (!createIfMissing) {
        this.requireActive();
        return this.engine.getNativeScope();
      }
      this._initializeScopes(this.engine);
    }
    return this._nativeScope;
  }

  _initializeScopes (parent: Object) {
    this._lexicalScope = Object.create(parent.getLexicalScope(true));
    this._nativeScope = Object.create(parent.getNativeScope(true));
  }

  getHostGlobal () {
    this.requireActive();
    if (!this._hostGlobal) {
      this._hostGlobal = createModuleGlobal();
      this._hostGlobal.Valaa = this._nativeScope;
    }
    return this._hostGlobal;
  }

  getVALKMethod (methodName: string, valker: Valker, transient: Transient, scope: Object,
      namespaceFieldLookup?: Object) {
    const createApplicator = applicatorCreators[methodName];
    if (!createApplicator) {
      throw new Error(`Unknown VALK host function '${methodName}' in '${this.debugId()}'`);
    }
    return createApplicator(this, methodName, valker, transient, scope, namespaceFieldLookup);
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
      if (options.scope === undefined) options.scope = this.getLexicalScope();
    } else if (!options.state && !options.transaction && this.isResource()) {
      this.requireActive();
    }
    return super.run(head, kuery, options);
  }


  setField (fieldName: string, value: any, options: VALKOptions = {}) {
    let commandValue;
    try {
      const { transaction, id } = this._primeTransactionAndOptionsAndId(options);
      commandValue = universalizeCommandData(value, options);
      return transaction.chronicleEvent(fieldsSet({ id, typeName: this._typeName,
        sets: { [fieldName]: commandValue },
      }));
    } catch (error) {
      throw this.wrapErrorEvent(error, `setField(${fieldName})`,
          "\n\tfield name:", fieldName,
          "\n\tnew value:", ...dumpObject(value),
          "\n\tnew value (after universalization):", ...dumpObject(commandValue),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  addToField (fieldName: string, value: any, options: VALKOptions = {}) {
    let commandValue;
    try {
      const { transaction, id } = this._primeTransactionAndOptionsAndId(options);
      commandValue = universalizeCommandData(value, options);
      return transaction.chronicleEvent(addedTo({ id, typeName: this._typeName,
        adds: { [fieldName]: arrayFromAny(commandValue || undefined) },
      }));
    } catch (error) {
      throw this.wrapErrorEvent(error, `addToField(${fieldName})`,
          "\n\tfield name:", fieldName,
          "\n\tnew value:", ...dumpObject(value),
          "\n\tnew value (after universalization):", ...dumpObject(commandValue),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  removeFromField (fieldName: string, value: any, options: VALKOptions = {}) {
    let commandValue;
    try {
      const { transaction, id } = this._primeTransactionAndOptionsAndId(options);
      commandValue = universalizeCommandData(value, options);
      return transaction.chronicleEvent(removedFrom({ id, typeName: this._typeName,
        removes: { [fieldName]: (commandValue === null) ? null : arrayFromAny(commandValue) },
      }));
    } catch (error) {
      throw this.wrapErrorEvent(error, `removeFromField(${fieldName})`,
          "\n\tfield name:", fieldName,
          "\n\tremoved value:", ...dumpObject(value),
          "\n\tremoved value (after universalization):", ...dumpObject(commandValue),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  deleteField (fieldName: string, options: VALKOptions = {}) {
    return this.removeFromField(fieldName, null, options);
  }

  replaceWithinField (fieldName: string, replacedValues: any[], withValues: any[],
      options: VALKOptions = {}) {
    let universalRemovedValues;
    let universalAddedValues;
    const addedValues = new Set(withValues);
    try {
      const { transaction, id } = this._primeTransactionAndOptionsAndId(options);
      universalRemovedValues = arrayFromAny(
          universalizeCommandData(
                  replacedValues.filter(replacedValue => !addedValues.has(replacedValue)), options)
              || undefined);
      universalAddedValues = arrayFromAny(
          universalizeCommandData(withValues, options)
              || undefined);
      return transaction.chronicleEvent(replacedWithin({ id, typeName: this._typeName,
        removes: { [fieldName]: universalRemovedValues },
        adds: { [fieldName]: universalAddedValues },
      }));
    } catch (error) {
      throw this.wrapErrorEvent(error, `replaceInField(${fieldName})`,
          "\n\tfield name:", fieldName,
          "\n\treplaced values:", ...dumpObject(replacedValues),
          "\n\tremoved values (after universalization):",
              ...dumpObject(universalRemovedValues),
          "\n\twith values:", ...dumpObject(addedValues),
          "\n\tadded values (after universalization):",
              ...dumpObject(universalAddedValues),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  _primeTransactionAndOptionsAndId (options: VALKOptions): { transaction: Discourse, id: VRef } {
    const transaction = options.transaction || this.engine.discourse;
    this.requireActive(options);
    let id = transaction.bindObjectId(this.getId(), this._typeName);
    options.head = this;
    let partitionURI = id.getPartitionURI();
    if (!partitionURI && id.isGhost()) {
      partitionURI = transaction.bindObjectId([id.getGhostPath().headHostRawId()], "Resource")
          .getPartitionURI();
      id = id.immutateWithPartitionURI(partitionURI);
    }
    options.partitionURIString = partitionURI && String(partitionURI);
    return { transaction, id };
  }

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
  create (typeName: string, initialState: Object = {}, options: VALKOptions = {}): Vrapper {
    this.requireActive(options);
    if (options.coupledField && initialState.owner) {
      initialState.owner = getHostRef(initialState.owner, "create.initialState.owner")
          .coupleWith(options.coupledField);
    }
    options.head = this;
    return this.engine.create(typeName, initialState, options);
  }

  duplicate (initialState: Object, options: VALKOptions = {}): Vrapper {
    this.requireActive(options);
    options.head = this;
    return this.engine.duplicate(this, initialState, options);
  }

  /**
   * Creates an instance of this resource with given initialState
   * overrides, by adding this resource as instancePrototype in the
   * initialState. If the owner is not explicitly set (TODO: introspect
   * for all owner aliases) in the initialState this sets the owner in
   * the initialState to be the same as the owner of this resource.
   *
   * @memberof Vrapper
   */
  instantiate (initialState: Object = {}, options: VALKOptions = {}): Vrapper {
    const typeName = this.getTypeName(options);
    initialState.instancePrototype = this;
    if (initialState.owner === undefined
        && !((typeName === "Relation") && initialState.source)
        && !initialState.partitionAuthorityURI) {
      initialState.owner = this.get("owner", Object.create(options));
    }
    return this.create(typeName, initialState, options);
  }

  destroy (options: { transaction?: Transaction } = {}) {
    this.requireActive(options);
    return (options.transaction || this.engine.discourse).destroy({ id: this.getId(options) });
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
      transaction = (options.transaction || this.engine.discourse).acquireTransaction("emplace");
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
      const createOptions = { ...options, head: this };
      if (typeName === "Property") {
        initialState.owner = this.getId().coupleWith(fieldName);
      }
      const vFieldValue = this.engine.create(typeName, initialState, createOptions);
      if (typeName !== "Property") {
        if (isSet) this.setField(fieldName, vFieldValue, options);
        else this.addToField(fieldName, vFieldValue, options);
      }
      transaction.releaseTransaction();
      return vFieldValue;
    } catch (error) {
      transaction.releaseTransaction({ abort: true, reason: error });
      throw this.wrapErrorEvent(error, `emplace${isSet ? "SetField" : "AddToField"}(${fieldName})`,
          "\n\tfield name:", fieldName,
          "\n\tinitialState:", initialState,
          "\n\toptions.typeName:", options.typeName,
          "\n\tdeduced type:", typeName,
      );
    }
  }

  // Scope and Property property host operations

  _namespaceProxies: ?Object;

  propertyValue (propertyName: string | Symbol, options: VALKOptions = {}) {
    // eslint-disable-next-line
    const typeName = this.getTypeName(options);
    const vProperty = this._getProperty(propertyName, Object.create(options));
    if (vProperty) {
      return vProperty.extractValue(options, this);
    }
    const hostReference = this.engine.getHostObjectPrototype(typeName)[propertyName];
    if ((typeof hostReference === "object") && (hostReference !== null)
        && hostReference.isHostField) {
      if (hostReference.namespace) {
        return ((this._namespaceProxies
            || (this._namespaceProxies = {}))[hostReference.namespace]
                || (this._namespaceProxies[hostReference.namespace]
                    = this.engine.getRootScope().Valaa.$valosNamespace._createProxy(this)));
      }
      return this.get(hostReference.kuery, options);
    }
    return hostReference;
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
    const alterationOptions = Object.create(options);
    alterationOptions.scope = this.getLexicalScope();
    let newValue = this.run(0, ["§->", ["§void"], actualAlterationVAKON], alterationOptions);
    const hostType = this.engine.getRootScope().Valaa[typeName];
    const fieldPrototypeEntry = hostType.hostObjectPrototype[propertyName];
    if ((fieldPrototypeEntry != null) && fieldPrototypeEntry.writableFieldName) {
      newValue = this._preProcessNewReference(newValue, fieldPrototypeEntry, hostType);
      // TODO(iridian): Make this solution semantically consistent host field access.
      // Now stupidly trying to setField even if the field is not a primaryField.
      this.setField(fieldPrototypeEntry.writableFieldName, newValue, options);
      return newValue;
    }
    options.head = this;
    this.engine.create("Property", {
      owner: this.getId().coupleWith("properties"),
      name: propertyName,
      value: expressionFromProperty(newValue, propertyName),
    }, options);
    return newValue;
  }

  _preProcessNewReference (newValue: VRef, fieldPrototypeEntry: Object, hostType: Object) {
    if (fieldPrototypeEntry.fieldName === "owner"
        && !((newValue instanceof ValaaReference) && newValue.getCoupledField())) {
      const defaultCoupledField = hostType[defaultOwnerCoupledField];
      if (defaultCoupledField) {
        return getHostRef(newValue).coupleWith(defaultCoupledField);
      }
    }
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
          return this._obtainMediaInterpretation(options, vExplicitOwner, typeName);
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
      const isExpandedTransient = !(valueEntry instanceof ValaaReference);
      if (isExpandedTransient) {
        valueType = dataFieldValue(valueEntry, "typeName");
      } else {
        state = (options.transaction || this.engine.discourse).getState();
        valueType = state.getIn(["Expression", valueEntry.rawId()]);
      }
      if (valueType === "Identifier") {
        ({ ret, valueEntry } = this._extractPointerValue(options, vExplicitOwner, valueEntry));
      } else if ((valueType === "Literal") || (valueType === "KueryExpression")) {
        const fieldName = (valueType === "Literal") ? "value" : "vakon";
        const vakon = isExpandedTransient
            ? dataFieldValue(valueEntry, fieldName)
            : state.getIn([valueType, valueEntry.rawId(), fieldName]);
        if ((vakon == null) || (typeof vakon !== "object")) return vakon;
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

  _mediaInterpretations: WeakMap<Object, { [mime: string]: Object }>;

  static toMediaInfoFields = VALK.fromVAKON({
    bvobId: ["§->", "content", false, "contentHash"],
    contentHash: ["§->", "content", false, "contentHash"],
    name: ["§->", "name"],
    sourceURL: ["§->", "sourceURL"],
    type: ["§->", "mediaType", false, "type"],
    subtype: ["§->", "mediaType", false, "subtype"],
  });

  /* (re-)assigns options.mediaInfo */
  resolveMediaInfo (options: VALKOptions = {}) {
    const mediaInfo = Object.assign({},
        options.mediaInfo || this.get(Vrapper.toMediaInfoFields, options));
    function setMediaInfoMIME (mime) {
      const split = mime.split("/");
      mediaInfo.type = split[0];
      mediaInfo.subtype = split[1];
    }
    // First try explicitly requested mime
    const explicitMime = options.mime || ((options.mediaInfo || {}).mime);
    if (explicitMime) {
      setMediaInfoMIME(explicitMime);
      mediaInfo.mime = mediaInfo.explicitMime;
    }
    // Secondly accept Media.$V.mediaType-based mime
    if (!mediaInfo.type || !mediaInfo.subtype) {
      // Thirdly try to determine mime from file type
      const fileNameMediaType = mediaTypeFromFilename(mediaInfo.name);
      if (fileNameMediaType) Object.assign(mediaInfo, fileNameMediaType);
      else {
        // Fourthly fall back to option.mimeFallback / option.mediaInfo.mimeFallback
        setMediaInfoMIME((options && options.mimeFallback)
            || mediaInfo.mimeFallback
        // Fifthly use octet-stream
            || "application/octet-stream");
      }
    }
    if (!mediaInfo.mime) mediaInfo.mime = `${mediaInfo.type}/${mediaInfo.subtype}`;
    mediaInfo.mediaRef = this.getId(options);
    return mediaInfo;
  }

  _obtainMediaInterpretation (options: VALKOptions, vExplicitOwner: ?Vrapper, typeName: ?string) {
    let mediaInfo;
    let mostMaterializedTransient;
    let wrap;
    const vrapper = this;
    let interpretationsByMime;
    try {
      const activeTypeName = typeName || this.getTypeName(options);
      if (activeTypeName !== "Media") {
        invariantify(this.hasInterface("Media"),
            "Vrapper._obtainMediaInterpretation only available for objects with Media interface",
            "\n\ttype:", activeTypeName,
            "\n\tobject:", this);
      }
      mostMaterializedTransient = this.getTransient(Object.assign(Object.create(options), {
        mostMaterialized: true, require: false, withOwnField: "content",
      }));
      if (!mostMaterializedTransient) return undefined;

      // Integrations are cached by transient and thus flushed if it changes via adding or removing
      // of properties, change of mediaType etc. This does _not_ include the change of Media
      // property values themselves as they don't affect the Media transient itself. The change of
      // decoders will also not refresh the caches.
      // TODO(iridian): Re-evaluate this if ever we end up having Media properties affect the
      // interpretation. In that case the change of a property should flush this cache.
      interpretationsByMime =
          (this._mediaInterpretations || (this._mediaInterpretations = new WeakMap()))
              .get(mostMaterializedTransient);
      if (interpretationsByMime) {
        const mime = options.mime
            || (mediaInfo = this.resolveMediaInfo(Object.create(options))).mime;
        const cachedInterpretation = mime && interpretationsByMime[mime];
        if (cachedInterpretation
            && (mime || !options.mimeFallback
                || (cachedInterpretation === interpretationsByMime[options.mimeFallback]))) {
          return (options.synchronous !== false)
              ? cachedInterpretation
              : Promise.resolve(cachedInterpretation);
        }
      }
      options.mediaInfo = mediaInfo || (mediaInfo = this.resolveMediaInfo(Object.create(options)));
      let decodedContent = options.decodedContent;
      if (decodedContent === undefined) {
        const name = this.get("name", options);
        wrap = new Error(`_obtainMediaInterpretation('${name}').connection.decodeMediaContent(as ${
          String(mediaInfo && mediaInfo.mime)})`);
        decodedContent = this._withActiveConnectionChainEagerly(Object.create(options), [
          connection => connection.decodeMediaContent(mediaInfo),
        ], function errorOnDecodeMediaContent (error) {
          _setInterPretationByMimeCacheEntry(error);
          return errorOnObtainMediaInterpretation(error);
        });
        if ((options.synchronous === true) && isPromise(decodedContent)) {
          throw new Error(`Media interpretation not immediately available for '${
              mediaInfo.name || "<unnamed>"}'`);
        }
        if ((options.synchronous === false) || isPromise(decodedContent)) {
          return (async () => {
            options.decodedContent = await decodedContent;
            options.synchronous = true;
            return this._obtainMediaInterpretation(options, vExplicitOwner, activeTypeName);
          })();
        }
        // else: decodedContent is synchronously available and synchronous !== false.
        // Proceed to integration.
      }
      let vScope = vExplicitOwner || this.get("owner", Object.create(options));
      while (vScope && !vScope.hasInterface("Scope")) {
        vScope = vScope.get("owner", Object.create(options));
      }
      if (!vScope) vScope = this;
      const interpretation = this.engine._integrateDecoding(decodedContent, vScope, mediaInfo,
          options);
      _setInterPretationByMimeCacheEntry(interpretation);
      return interpretation;
    } catch (error) {
      _setInterPretationByMimeCacheEntry(error);
      wrap = new Error(`_obtainMediaInterpretation('${this.get("name", options)}' as ${
          String(mediaInfo && mediaInfo.mime)})`);
      return errorOnObtainMediaInterpretation(error);
    }
    function errorOnObtainMediaInterpretation (error) {
      const wrapped = vrapper.wrapErrorEvent(error, wrap,
        "\n\tid:", vrapper.getId(options).toString(),
        "\n\toptions:", ...dumpObject(options),
        "\n\tvExplicitOwner:", ...dumpObject(vExplicitOwner),
        "\n\tmediaInfo:", ...dumpObject(mediaInfo),
        "\n\tmostMaterializedTransient:", ...dumpObject(mostMaterializedTransient),
        "\n\tconnection.isActive:", ...dumpObject(
          vrapper._partitionConnection && vrapper._partitionConnection.isActive()),
        "\n\tvrapper:", ...dumpObject(vrapper),
      );
      throw wrapped;
    }
    function _setInterPretationByMimeCacheEntry (interpretation: any) {
      if (!mediaInfo.mime || !mostMaterializedTransient) return;
      if (!interpretationsByMime) {
        vrapper._mediaInterpretations
            .set(mostMaterializedTransient, interpretationsByMime = {});
      }
      interpretationsByMime[mediaInfo.mime] = interpretation;
      if (!options.mediaInfo && !options.mime
          && (!options.mimeFallback || (mediaInfo.mime === options.mimeFallback))) {
        // Set default integration lookup
        interpretationsByMime[""] = interpretation;
      }
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
      this.setField("value", expressionFromProperty(newValue, this), options);
      if (typeof newValue !== "object") {
        // TODO(iridian): Could set the cachedExtractvalueEntry for non-object types.
      }
      return newValue;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .alterValue(), with:`,
          "\n\talterationVAKON:", dumpify(alterationVAKON));
    }
  }

  // Bvob and Media content management


  /**
   * Returns raw bvob content of this Bvob as an ArrayBuffer object.
   *
   * @param {*} bvobContent
   * @param {VALKOptions} [options={}]
   * @returns
   *
   * @memberof Vrapper
   */
  bvobContent (): ArrayBuffer {
    try {
      invariantify(this._typeName === "Blob",
          "Vrapper.bvobContent only available for objects of Bvob type",
          "\n\ttype:", this._typeName,
          "\n\tobject:", this);
      const buffer = this.engine.getProphet().tryGetCachedBvobContent(this.getRawId());
      if (typeof buffer !== "undefined") return buffer;
      throw new Error(`Cannot locate Bvob buffer directly from caches (with id '${
          this.getRawId()}'`);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .bvobContent()`);
    }
  }

  /**
   * Eagerly returns a URL for accessing the content of this Media with optionally provided media
   * type. The content is a retrieved and decoded like described by the Media interpretation
   * process. Unlike full interpretation the content is not integrated in any specific context.
   * TODO(iridian): Should the integration be included as an option? How will the interpretation
   * infrastructure be used outside VS/JS/VSX/JSX
   * If the partition of the Media is not yet acquired, returns a promise which resolves to the URL
   * after the corresponding partition is acquired.
   *
   * @param {VALKOptions} [options={}]
   * @returns
   *
   * @memberof Vrapper
   */
  mediaURL (options: VALKOptions = {}) {
    let mediaInfo;
    const vrapper = this;
    const wrap = new Error("mediaURL");
    try {
      this.requireActive(options);
      invariantify(this.hasInterface("Media"),
          "Vrapper.mediaURL only available for objects with Media interface",
          "\n\ttype:", this._typeName,
          "\n\tobject:", this);
      mediaInfo = this.resolveMediaInfo(Object.create(options));
      const ret = this._withActiveConnectionChainEagerly(Object.create(options), [
        connection => connection.getMediaURL(mediaInfo),
      ], errorOnMediaURL);
      if (options.synchronous !== undefined) {
        if (!options.synchronous) return Promise.resolve(ret);
        if (isPromise(ret)) {
          throw new Error(`Media URL not immediately available for '${
              (mediaInfo && mediaInfo.name) || "<unnamed>"}'`);
        }
      }
      return ret;
    } catch (error) { return errorOnMediaURL(error); }
    function errorOnMediaURL (error) {
      throw vrapper.wrapErrorEvent(error, wrap, "\n\tinfo:", ...dumpObject(mediaInfo));
    }
  }

  /**
   * Eagerly returns an interpretation of this Media with optionally
   * provided media type. Returns a fully integrated decoded content
   * associated with this resource and the provided media type.
   *
   * If the interpretation is not immediately available or if the
   * partition of the Media is not acquired, returns a promise for
   * acquiring the partition and performing this operation instead.
   *
   * If options.synchronous equals true and this would return a
   * promise, throws instead.
   * If options.synchronous equals false always returns a promise.
   *
   * @param {VALKOptions} [options={}]
   * @returns
   *
   * @memberof Vrapper
   */
  interpretContent (options: VALKOptions = {}) {
    return this._obtainMediaInterpretation(options);
  }

  static toMediaPrepareBvobInfoFields = VALK.fromVAKON({
    name: ["§->", "name"],
    type: ["§->", "mediaType", false, "type"],
    subtype: ["§->", "mediaType", false, "subtype"],
  });

  /**
   * Prepares given content for use within the partition of this
   * resource in the form of a newly created Bvob object.
   * Returns a promise which resolves to a `createBvob` function once
   * the partition is connected and the content has been optimistically
   * persisted. Calling createBvob will then create and return a new
   * Bvob resource which represents the given content and which can be
   * assigned to some Media.content.
   *
   * The semantics of optimistic persistence depends on the partition
   * authority scheme and its configuration. valaa-memory doesn't
   * support Media content (or stores them in memory). valaa-local
   * optimistically and fully persists in the local Scribe. Typical
   * remote partitions optimistically persist on the local Scribe and
   * fully persist on the remote authority once online.
   *
   * In general only the partition of this resource matters. However
   * if this resource is a Media then its name and mediaType fields are
   * used as debug information. Even then the final resulting bvob
   * can be used with any media.
   *
   * @param {*} bvobContent
   * @param {VALKOptions} [options={}]
   * @returns a function callback which creates and returns a Bvob
   * using the transaction specified in options.transaction.
   *
   * @memberof Vrapper
   */
  prepareBvob (content: any, options: VALKOptions = {}) {
    let mediaInfo;
    const vrapper = this;
    const wrap = new Error("prepareBvob()");
    try {
      this.requireActive(options);
      if (this.hasInterface("Media")) {
        mediaInfo = this.get(Vrapper.toMediaPrepareBvobInfoFields, Object.create(options));
      }
      return this._withActiveConnectionChainEagerly(Object.create(options), [
        connection => connection.prepareBvob(content, mediaInfo),
        ({ contentHash, persistProcess }) => (persistProcess || contentHash),
        (contentHash) => {
          if (!contentHash || (typeof contentHash !== "string")) {
            throw new Error(`Invalid contentHash '${typeof contentHash}', truthy string expected`);
          }
          const engine = this.engine;
          function ret (innerOptions: VALKOptions = Object.create(options)) {
            innerOptions.id = contentHash;
            const callerValker = this && this.__callerValker__;
            if (callerValker) innerOptions.transaction = callerValker;
            return engine.create("Blob", undefined, innerOptions);
          }
          ret._valkCaller = true;
          return ret;
        },
      ], errorOnPrepareBvob);
    } catch (error) { return errorOnPrepareBvob(error); }
    function errorOnPrepareBvob (error) {
      throw vrapper.wrapErrorEvent(error, wrap,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo));
    }
  }

  recurseConnectedPartitionMaterializedFieldResources (fieldNames: Array<string>,
      options: Kuery = {}) {
    const activeConnections = this.engine.getProphet().getActiveConnections();
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
          (Iterable.isKeyed(fieldValue) ? [fieldValue]
              : iterableFromAny(fieldValue || undefined))) {
        // TODO(iridian): Replace with tryRawIdFrom or similar
        const rawId = getRawIdFrom(fieldEntry);
        const typeName = rawId && state.getIn(["Resource", rawId]);
        const fieldTransient = typeName && state.getIn([typeName, rawId]);
        if (fieldTransient && !results.has(fieldTransient)) {
          const vrapper = this.engine.getVrapperByRawId(rawId);
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
        while ((ghostPath = ghostPath && ghostPath.previousGhostStep())) {// eslint-disable-line
          currentRawId = ghostPath.headRawId();
          listenedRawIds.push(currentRawId);
        }
        do {// eslint-disable-line
          currentObject = table.get(currentRawId);
          if (!currentObject) {
            this.errorEvent(`\n\tregisterComplexHandlers(): cannot find currentObject for "${
                currentRawId}":${this._typeName}: live notifications will likely be broken`);
            break;
          } else {
            const prototypeRef = currentObject.get("prototype");
            if (!prototypeRef) break;
            currentRawId = prototypeRef.rawId();
            ghostPath = prototypeRef.tryGhostPath();
            listenedRawIds.push(currentRawId);
          }
        } while (!ghostPath);
      } while (ghostPath);
      this.refreshHandlers(targetEventHandlers, listenedRawIds, idHandlers);
    } catch (error) {
      throw this.wrapErrorEvent(error, `registerComplexHandlers`,
          "\n\trawId:", currentRawId,
          "\n\tcurrentObject:", ...dumpObject(currentObject),
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
    const ghostVRef = createGhostVRefInInstance(this[HostRef],
        vInstance.getTransient({ transaction }));
    // TODO(iridian): Verify and return null if this object has no ghost in instance, ie. if this
    // object is not a sub-component in the direct prototype of vInstance
    return this.engine.getVrapper(ghostVRef, { state });
  }

  onEventCREATED (passage: Passage, story: Story) {
    this._updateTransient(story.state);
    if (this._fieldSubscriptions) {
      const transient = this.getTransient({ typeName: passage.typeName, state: story.state });
      for (const key of transient.keys()) {
        this.notifyMODIFIEDHandlers(key, passage, story);
      }
    }
  }

  onEventMODIFIED (passage: Passage, story: Story) {
    if (this._debug) {
      console.log(`${this.debugId()}.onEventMODIFIED()`, story, this);
    }
    try {
      this._updateTransient(story.state);
      if (passage.sets && passage.sets.name) {
        this._refreshDebugId(
            this.getTransient({ typeName: passage.typeName, state: story.state }),
            { state: story.state });
      }
      if (passage.actualAdds) {
        for (const fieldName of passage.actualAdds.keys()) {
          this.notifyMODIFIEDHandlers(fieldName, passage, story);
        }
      }
      if (passage.actualRemoves) {
        for (const fieldName of passage.actualRemoves.keys()) {
          if (!passage.actualAdds || !passage.actualAdds.has(fieldName)) {
            // Only fire modified event once per property.
            this.notifyMODIFIEDHandlers(fieldName, passage, story);
          }
        }
      }
      if (passage.actualMoves) {
        for (const fieldName of passage.actualMoves.keys()) {
            // Only fire modified event once per property, so filter out
            // entries that were already actualAdded or actualRemoved.
            if ((!passage.actualAdds || !passage.actualAdds.has(fieldName))
              && (!passage.actualRemoves || !passage.actualRemoves.has(fieldName))) {
            this.notifyMODIFIEDHandlers(fieldName, passage, story);
          }
        }
      }
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .onEventMODIFIED()`);
    }
  }

  // eslint-disable-next-line camelcase
  onEventFIELDS_SET (passage: Passage, story: Story) {
    return this.onEventMODIFIED(passage, story);
  }

  // eslint-disable-next-line camelcase
  onEventADDED_TO (passage: Passage, story: Story) {
    return this.onEventMODIFIED(passage, story);
  }

  // eslint-disable-next-line camelcase
  onEventREMOVED_FROM (passage: Passage, story: Story) {
    return this.onEventMODIFIED(passage, story);
  }

  // eslint-disable-next-line camelcase
  onEventREPLACED_WITHIN (passage: Passage, story: Story) {
    return this.onEventMODIFIED(passage, story);
  }

  onEventDESTROYED (passage: Passage, story: Story) {
    (this._destroyedHandlers || []).forEach(handler => handler(story.timed));
    this._phase = DESTROYED;
    return this.engine.addDelayedRemoveCog(this, story);
  }

  addDESTROYEDHandler (handler: Function) {
    if (!this._destroyedHandlers) this._destroyedHandlers = [];
    this._destroyedHandlers.push(handler);
  }

  notifyMODIFIEDHandlers (fieldName: string, passage: Passage, story: Story) {
    const subscriptions = this._fieldSubscriptions && this._fieldSubscriptions.get(fieldName);
    const filterSubscriptions = this._filterSubscriptions;
    if (!subscriptions && !filterSubscriptions) return undefined;
    const fieldUpdate = new FieldUpdate(this, fieldName, passage,
        { state: story.state, previousState: story.previousState }, undefined, vProtagonist);
    return this.engine.addDelayedFieldUpdate(
        fieldUpdate, subscriptions, filterSubscriptions, story);
  }

  _notifyMODIFIEDHandlers (fieldUpdate: FieldUpdate, specificFieldHandlers: any,
      filterHandlers: any) {
    const fieldName = fieldUpdate.fieldName();
    const passageCounter = fieldUpdate.getPassage()._counter;
    for (const subscription of (subscriptions || [])) {
      try {
        if (!(subscription._seenPassageCounter >= passageCounter)) {
          subscription._seenPassageCounter = passageCounter;
          subscription._triggerUpdateByFieldUpdate(fieldUpdate);
        }
      } catch (error) {
        outputError(this.wrapErrorEvent(error,
                new Error(`_notifyMODIFIEDHandlers('${fieldName}')`),
                "\n\tfield update:", fieldUpdate,
                "\n\tfailing field subscription:", ...dumpObject(subscription),
                "\n\tstate:", ...dumpObject(fieldUpdate.getState().toJS())),
            "Exception caught during Vrapper._notifyMODIFIEDHandlers.subscriptions");
      }
    }
    if (filterSubscriptions) {
      const fieldIntro = this.getTypeIntro().getFields()[fieldName];
      for (const subscription of filterSubscriptions) {
        try {
          if (!(subscription._seenPassageCounter >= passageCounter)) {
            subscription._seenPassageCounter = passageCounter;
            subscription._tryTriggerUpdateByFieldUpdate(fieldIntro, fieldUpdate);
          }
        } catch (error) {
          outputError(this.wrapErrorEvent(error,
                  new Error(`_notifyMODIFIEDHandlers('${fieldName}')`),
                  "\n\tfield update:", fieldUpdate,
                  "\n\tfailing filter subscription:", ...dumpObject(subscription),
                  "\n\tstate:", ...dumpObject(fieldUpdate.getState().toJS())),
              "Exception caught during Vrapper._notifyMODIFIEDHandlers.filterSubscriptions");
        }
      }
    }
  }

  /**
   * Adds a new subscription for modifications on fields filtered by
   * given liveOperation.
   *
   * @param {(boolean | string | (fieldIntro: Object) => boolean | Kuery)} filter
   * @param {(update: FieldUpdate) => void} callback       called on any updates on filtered fields
   * @param {Subscription} [subscription=new Subscription()]
   * @returns {Subscription}
   *
   * @memberof Vrapper
   */
  subscribeToMODIFIED (filter: boolean | string | (fieldIntro: Object) => boolean | Kuery,
      callback: (update: FieldUpdate) => void,
      subscription: Subscription = new Subscription(),
      options: VALKOptions = {}): Subscription {
    try {
      this.requireActive({ allowActivating: true });
      if (filter instanceof Kuery) {
        return subscription.initializeKuery(this, this, filter, callback, options);
      }
      return subscription.initializeFilter(this, filter, callback);
    } catch (error) {
      throw this.wrapErrorEvent(error, `subscribeToMODIFIED()`,
          "\n\tfilter:", ...(filter instanceof Kuery ? dumpKuery(filter) : dumpObject(filter)),
          "\n\tsubscription:", ...dumpObject(subscription),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _fieldSubscriptions: Map<string, Set<Subscription>>;

  _addFieldSubscription (fieldName: string, subscription: Subscription) {
    let currentSubscriptions;
    try {
      if (this._phase === NONRESOURCE) return undefined;
      this.requireActive({ allowActivating: true });
      if (!this._fieldSubscriptions) this._fieldSubscriptions = new Map();
      currentSubscriptions = this._fieldSubscriptions.get(fieldName);
      if (!currentSubscriptions) {
        currentSubscriptions = new Set();
        this._fieldSubscriptions.set(fieldName, currentSubscriptions);
      }
      subscription._seenPassageCounter = this.engine._currentPassageCounter;
      currentSubscriptions.add(subscription);
      return currentSubscriptions;
    } catch (error) {
      throw this.wrapErrorEvent(error, `_addFieldSubscription('${fieldName}')`,
          "\n\tsubscription:", ...dumpObject(subscription),
          "\n\tcurrent field subscriptions:", ...dumpObject(currentSubscriptions),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _filterSubscriptions: Set<Subscription>;

  _addFilterSubscription (filter: Function | boolean,
      subscription: Subscription) {
    try {
      if (this._phase === NONRESOURCE) return undefined;
      this.requireActive();
      if (!this._filterSubscriptions) this._filterSubscriptions = new Set();
      subscription._seenPassageCounter = this.engine._currentPassageCounter;
      this._filterSubscriptions.add(subscription);
      return this._filterSubscriptions;
    } catch (error) {
      throw this.wrapErrorEvent(error, "_addFilterSubscription()",
          "\n\tfilter:", ...dumpObject(filter),
          "\n\tsubscription:", ...dumpObject(subscription),
          "\n\tcurrent filter subscriptions:", ...dumpObject(this._filterSubscriptions),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _tryElevateFieldValueFrom (state: State, name: string, value: any, vIdOwner: Vrapper) {
    if (!vIdOwner || (vIdOwner === this)) return value;
    const options = { state };
    const elevator = Object.create(this.engine.discourse);
    elevator.state = state;
    return tryElevateFieldValue(elevator, value, {
      name,
      intro: this.getFieldIntro(name),
      sourceTransient: vIdOwner.getTransient(options),
      elevationInstanceId: this.getId(options),
    });
  }

  static infiniteLoopTester = Symbol("InfiniteLoopTest");

  _setUpScopeFeatures (options: VALKOptions) {
    // Refers all Scope.properties:Property objects in this._lexicalScope to enable scoped script
    // access which uses the owner._lexicalScope as the scope prototype if one exists.

    this._scopeOwnerSubscription = this.subscribeToMODIFIED("owner", (ownerUpdate: FieldUpdate) => {
      const parent = ownerUpdate.value() || this.engine;
      if (!this._lexicalScope) {
        this._initializeScopes(parent);
      } else {
        const dummy = {};
        this._lexicalScope[Vrapper.infiniteLoopTester] = dummy;
        const parentScope = parent.getLexicalScope(true);
        const loopedDummy = parentScope[Vrapper.infiniteLoopTester];
        delete this._lexicalScope[Vrapper.infiniteLoopTester];
        if (dummy === loopedDummy) {
          this.errorEvent("INTERNAL ERROR: Vrapper.owner listener detected cyclic owner loop:",
              "\n\tself:", ...dumpObject(this),
              "\n\tparent:", ...dumpObject(parent));
        } else {
          Object.setPrototypeOf(this._lexicalScope, parentScope);
          Object.setPrototypeOf(this._nativeScope, parent.getNativeScope(true));
        }
      }
      // TODO(iridian, 2019-01) 'this' is critical but very dubious.
      // When a ValaaScript top-level module lambda function accesses
      // the global 'this' identifier it will resolve to the
      // _lexicalScope.this of the context resource.
      // This is very hard to debug as there is no abstraction layer
      // between: ValaaScript transpiler will omit code for 'this' access
      // for lambda functions expecting that 'this' is found in the
      // scope.
      this._lexicalScope.this = this;
    }, new Subscription().registerWithSubscriberInfo(`Vrapper(${this.debugId()}).scope.owner`)
    ).triggerUpdate(options);
    if (!this._lexicalScope) {
      throw this.wrapErrorEvent(new Error("Vrapper owner is not immediately available"),
          "_setUpScopeFeatures",
          "\n\tthis:", ...dumpObject(this));
    }
    this._scopeNameSubscriptions = {};
    this._scopePropertiesSub = this.subscribeToMODIFIED("properties", (update: FieldUpdate) => {
      update.actualAdds().forEach(vActualAdd => {
        // TODO(iridian): Perf opt: this uselessly creates a subscription in each Property Vrapper.
        // We could just as well have a cog which tracks Property.name changes and
        // updates their owning Scope Vrapper._lexicalScope's.
        // Specifically: it is the call to actualAdds() which does this.
        this._scopeNameSubscriptions[vActualAdd.getRawId()] = vActualAdd.subscribeToMODIFIED("name",
        nameUpdate => {
          const newName = nameUpdate.value();
          if ((newName === "this") || (newName === "self")) {
            this.warnEvent(`Property name '${newName
                }' is a reserved word and is omitted from scope`);
            return;
          }
          const passage = nameUpdate.getPassage();
          if (passage && !isCreatedLike(passage)) {
            for (const propertyName of Object.keys(this._lexicalScope)) {
              if (this._lexicalScope[propertyName] === vActualAdd) {
                delete this._lexicalScope[propertyName];
                delete this._nativeScope[propertyName];
                break;
              }
            }
          }
          if (!newName) return;
          if (this._lexicalScope.hasOwnProperty(newName)) { // eslint-disable-line
            if (vActualAdd === this._lexicalScope[newName]) return;
            console.warn(`Overriding existing Property '${newName}' in Scope ${this.debugId()}`);
            /*
                "\n\tnew value:", ...dumpObject(vActualAdd),
                "\n\tprevious value:", ...dumpObject(this._lexicalScope[newName]),
                "\n\tfull Scope object:", ...dumpObject(this));
            */
          }
          this._lexicalScope[newName] = vActualAdd;
          Object.defineProperty(this._nativeScope, newName, {
            configurable: true,
            enumerable: true,
            get: () => vActualAdd.extractValue(undefined, this),
            set: (value) => vActualAdd.setField("value", expressionFromProperty(value, newName),
                { scope: this._lexicalScope }),
          });
        }, new Subscription().registerWithSubscriberInfo(
            `Vrapper(${this.debugId()}).properties(${vActualAdd.getRawId()}).name`)
        ).triggerUpdate(update.valkOptions());
      });
      update.actualRemoves().forEach(vActualRemove => {
        const removedRawId = vActualRemove.getRawId();
        const subscription = this._scopeNameSubscriptions[removedRawId];
        if (subscription) {
          subscription.unregister();
          delete this._scopeNameSubscriptions[removedRawId];
        }
        const propertyName = vActualRemove.get("name", update.previousStateOptions());
        if (this._lexicalScope[propertyName].getRawId() === removedRawId) {
          delete this._lexicalScope[propertyName];
          delete this._nativeScope[propertyName];
        }
      });
    }, new Subscription().registerWithSubscriberInfo(`Vrapper(${this.debugId()}).properties`)
    ).triggerUpdate(options);
  }
}

Vrapper.prototype[ValaaPrimitiveTag] = true;
Vrapper.prototype[UnpackedHostValue] = null;

let vrapperEventHandlers;

function getVrapperEventHandlers () {
  if (!vrapperEventHandlers) {
    vrapperEventHandlers = new Map();
    const prototype = new Vrapper(null, vRef("dummy"), "Dummy");
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
  propertyValue: createApplicatorWithNamespaceFieldFirstOptionsSecond,
  alterProperty: createApplicatorWithNamespaceFieldFirstOptionsThird,
  deleteProperty: createApplicatorWithNamespaceFieldFirstOptionsSecond,
  extractValue: createApplicatorWithOptionsFirst,
  bvobContent: createApplicatorWithOptionsThird,
  mediaURL: createApplicatorWithOptionsFirst,
  mediaContent: createApplicatorWithOptionsFirst,
  interpretContent: createApplicatorWithOptionsFirst,
  prepareBvob: createApplicatorWithOptionsSecond,
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
          ...args.reduce((accum, arg, index) =>
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

function createApplicatorWithNamespaceFieldFirstOptionsSecond (vrapper: Vrapper, methodName: string,
    valker: Valker, transient: any, scope: any, namespaceFieldLookup: Object) {
  if (!namespaceFieldLookup) return createApplicatorWithOptionsSecond(vrapper, methodName, valker);
  return (fieldName: any, options: Object = {}, ...rest) => {
    try {
      const fieldSymbol = namespaceFieldLookup[fieldName];
      if (!fieldSymbol) {
        throw new Error(`${debugId(vrapper, { brief: true })
            } does not implement host field '${fieldName}'`);
      }
      options.transaction = valker;
      return vrapper[methodName](fieldSymbol, options, ...rest);
    } catch (error) {
      throw wrapError(error, `During ${vrapper.debugId()}\n .getVALKMethod(${
              methodName}), with:`,
          "\n\targ#0:", dumpify(fieldName),
          "\n\targ#1, options:", ...dumpObject(options),
          "\n\tknown host fields:", ...dumpObject(namespaceFieldLookup),
      );
    }
  };
}

function createApplicatorWithNamespaceFieldFirstOptionsThird (vrapper: Vrapper, methodName: string,
    valker: Valker, transient: any, scope: any, namespaceFieldLookup: Object) {
  if (!namespaceFieldLookup) return createApplicatorWithOptionsThird(vrapper, methodName, valker);
  return (fieldName: any, second: any, options: Object = {}, ...rest) => {
    try {
      const fieldSymbol = namespaceFieldLookup[fieldName];
      if (!fieldSymbol) {
        throw new Error(`${debugId(vrapper, { brief: true })
            } does not implement host field '${fieldName}'`);
      }
      options.transaction = valker;
      return vrapper[methodName](fieldSymbol, second, options, ...rest);
    } catch (error) {
      throw wrapError(error, `During ${vrapper.debugId()}\n .getVALKMethod(${
              methodName}), with:`,
          "\n\targ#0:", dumpify(fieldName),
          "\n\targ#1:", dumpify(second),
          "\n\targ#2, options:", ...dumpObject(options),
          "\n\tknown host fields:", ...dumpObject(namespaceFieldLookup),
      );
    }
  };
}
