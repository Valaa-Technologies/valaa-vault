// @flow

import { GraphQLObjectType, isAbstractType } from "graphql/type";
import { Iterable } from "immutable";

import VALK, { packedSingular } from "~/raem/VALK";
import type { VALKOptions } from "~/raem/VALK"; // eslint-disable-line no-duplicate-imports
import type { Passage, Story } from "~/raem/redux/Bard";
import { getHostRef, HostRef, UnpackedHostValue } from "~/raem/VALK/hostReference";

import { addedTo, fieldsSet, isCreatedLike, removedFrom, replacedWithin } from "~/raem/events";
import VRL, { vRef, invariantifyId, getRawIdFrom, tryCoupledFieldFrom } from "~/raem/VRL";
import { naiveURI } from "~/raem/ValaaURI";
import { formVPath } from "~/raem/VPath";

import dataFieldValue from "~/raem/tools/denormalized/dataFieldValue";

import { Transient } from "~/raem/state";
import type { State } from "~/raem/state"; // eslint-disable-line no-duplicate-imports
import { tryElevateFieldValue } from "~/raem/state/FieldInfo";
import { getObjectRawField } from "~/raem/state/getObjectField";

import { createGhostVRLInInstance, isMaterialized, createMaterializeGhostAction }
    from "~/raem/tools/denormalized/ghost";
import { AbsentChroniclesError, addConnectToChronicleToError }
    from "~/raem/tools/denormalized/partitions";

import isResourceType from "~/raem/tools/graphql/isResourceType";
import isAbsentTypeName from "~/raem/tools/graphql/isAbsentTypeName";

import { ValoscriptPrimitiveKind /* , NativeIdentifierTag */ } from "~/script";

import { Discourse, Connection } from "~/sourcerer";
import { ChronicleEventResult } from "~/sourcerer/api/types";

import { createModuleGlobal } from "~/tools/mediaDecoders/JavaScriptDecoder";

import VALEK, { Valker, Kuery, dumpKuery, expressionFromProperty } from "~/engine/VALEK";

import Cog, { extractMagicMemberEventHandlers } from "~/engine/Cog";
import debugId from "~/engine/debugId";
import LiveUpdate from "~/engine/Vrapper/LiveUpdate";
import Subscription from "~/engine/Vrapper/Subscription";
import universalizeCommandData from "~/engine/Vrapper/universalizeCommandData";

import { OwnerDefaultCouplingTag, PropertyDescriptorsTag } from "~/engine/valosheath";

import { arrayFromAny, iterableFromAny, dumpify, dumpObject,
  invariantify, invariantifyObject, invariantifyString,
  isPromise, isSymbol, thenChainEagerly,
} from "~/tools";
import { mediaTypeFromFilename } from "~/tools/MediaTypeData";

export { LiveUpdate, Subscription };

const INACTIVE = "Inactive";
const ACTIVATING = "Activating";
const ACTIVE = "Active";
const UNAVAILABLE = "Unavailable";
const IMMATERIAL = "Immaterial";
const NONRESOURCE = "NonResource";

function isNonActivateablePhase (candidate: string) {
  return (candidate === UNAVAILABLE) || (candidate === IMMATERIAL) || (candidate === NONRESOURCE);
}

/**
 * Vrapper is a proxy for accessing a specific ValOS Resource in the
 * backend. With the Engine, these Vrapper instances form the interface
 * between ValOS backend content (through the backing FalseProphet
 * in-memory shadow repository) and between local presentation and
 * computation layers.
 *
 * 1. Vrapper as a singular, shared proxy object to single ValOS resource.
 *
 * There is zero or one Vrapper objects per one ValOS resource,
 * identified and shared by the resource raw id. Vrapper proxies for
 * resources which don't have already are created on-demand; see
 * Engine.getVrapper.
 *
 * By default all Vrapper operations are executed in the context of
 * the most recent state known by ('main line state') the backing
 * FalseProphet.
 *
 * Transactions can have differing states for this same resource. To
 * make it possible to share the same Vrapper object possible, all
 * operations accept options: { discourse: Discourse }. This can be
 * used to override the operation execution context and must be used
 * whenever operations are being performed inside a transactional
 * context; see FalseProphetDiscourse.acquireFabricator.
 *
 * 2. Vrapper lifecycle and active operations.
 *
 * The Vrapper can be in multiple different phases, depending on the
 * current status of associated chronicle connections as well as
 * whether the resource or any of its prototypes are destroyed.
 *
 * Active-operations are operations like kueries, mutations but also
 * introspection calls represented by Vrapper member functions which
 * all require that the backing FalseProphet has full knowledge of the
 * proxied, non-destroyed resource and all of its non-destroyed
 * prototypes. This means all chronicles of the prototype chain must be
 * fully connected and no resource in the prototype chain can be
 * destroyed.
 *
 * The lifecycle phases:
 *
 * 2.1. Inactive: the chronicle of some prototype chain Resource is
 *   absent and the connection is not being acquired (note: Resource
 *   itself is considered part of the prototype chain here) or some
 *   prototype chain resource is destroyed.
 *   isInactive() returns true and getPhase() returns "Inactive".
 *   Active-operations will throw AbsentChroniclesError.
 *   Calling activate() will transfer the Vrapper into 'Activating' by
 *   acquiring the connections to all the chronicles of all the
 *   Resource's in the prototype chain.
 *
 * 2.2. Activating: all chronicles of prototype chain Resource's are
 *   being connected or already have a connection.
 *   isActivating() returns true and getPhase() returns "Activating".
 *   Active-operations will throw AbsentChroniclesError.
 *   Calling activate() will return a Promise which resolves once
 *   Vrapper enters 'Active' state, or throws if the Vrapper enters
 *   'Unavailable' state but won't cause other changes.
 *
 * 2.3. Active: all chronicles of this resource and all of its
 *   prototype chain resources have an active connection and no
 *   prototype chain resource is destroyed.
 *   isActive() returns true and getPhase() returns "Active".
 *   Active-operations can be synchronously accessed.
 *
 * 2.4. Immaterial: the Resource belongs to an active chronicle but has
 *   not been created yet, has been purged or has been destroyed.
 *   isImmaterial() returns true and getPhase() returns "Immaterial".
 *   Active-operations will throw an exception.
 *
 * 2.5. Unavailable: the connection for a prototype chain Resource
 *   chronicle couldn't be acquired.
 *   isUnavailable() returns true and getPhase() returns "Unavailable".
 *   Active-operations will throw an exception describing the cause of
 *   unavailability.
 *
 * 2.6. NonResource: the Vrapper is a degenerate proxy to a
 *   non-Resource ValOS object; Bvob or Data.
 *   isUnavailable() returns true and getPhase() returns "NonResource".
 *   Such Vrapper's like their associated backend objects are
 *   essentially immutable. They have no lifecycle and many operations
 *   (usually those with side-effects) are not available for them.
 *   They cannot have listeners associated with them and they are not
 *   cached by Engine (this means that these objects can in fact have
 *   multiple different Vrapper objects per same id).
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

  constructor (engine: ?Object, id: VRL, typeName: string, immediateRefresh?: [any, any]) {
    invariantifyId(id, "Vrapper.constructor.id");
    invariantifyString(typeName, "Vrapper.constructor.typeName");
    super({ engine, name: `Vrapper/${id.rawId()}:${typeName}` });
    Vrapper.vrapperIndex += 1;
    this.vrapperIndex = Vrapper.vrapperIndex;
    this[HostRef] = id;
    this._setTypeName(typeName);
    if (typeName === "Blob" || !this.engine || !isResourceType(this.getTypeIntro())) {
      this._phase = NONRESOURCE;
      return;
    }
    this._phase = INACTIVE;
    this.engine.addCog(this);
    if (!id.isGhost() && !id.getChronicleURI()) {
      if (!id.isAbsent()) {
        throw new Error(
            `Cannot create an active non-ghost Vrapper without id.chronicleURI: <${id}>`);
      }
      this.logEvent(1, () => [
        "non-ghost Vrapper encountered without a chronicleURI and which thus cannot be",
        "activated directly. This is most likely ghost prototype path root resource which",
        "needs to have all intervening chronicles activated first",
      ]);
    } else if (immediateRefresh) {
      this.refreshPhase(...immediateRefresh);
    }
  }

  getPhase () { return this._phase; }
  isInactive () { return this._phase === INACTIVE; }
  isActivating () { return this._phase === ACTIVATING; }
  isActive () { return this._phase === ACTIVE; }
  isUnavailable () { return this._phase === UNAVAILABLE; }
  isImmaterial () { return this._phase === IMMATERIAL; }

  isResource () {
    return this._phase !== NONRESOURCE;
  }

  isChronicleRoot () {
    const chronicleURI = this[HostRef].getChronicleURI();
    if (!chronicleURI) return false;
    return naiveURI.getChronicleId(chronicleURI) === this[HostRef].rawId();
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
        coupledField === "inheritors" ? "<==>"
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

  getValospaceType () {
    return this.engine.getRootScope().valos[this.getTypeName()];
  }

  getFieldIntro (fieldName: string): Object { return this.getTypeIntro().getFields()[fieldName]; }


  /**
   * Returns a newly initiated or an already existing activation
   * process if the current phase is Inactive or Activating. Returns
   * falsy if already Active.
   * Otherwise the resource itself is inactivateable and throws.
   *
   * @param {Object} [state]
   * @returns
   *
   * @memberof Vrapper
   */
  activate (options?: Object) {
    let blocker = (options && options.initialBlocker)
        || this.refreshPhase(options && options.state);
    if (!blocker) return undefined;
    if (this._activationProcess) return this._activationProcess;
    if (this._phase !== INACTIVE
        && !(this._phase === IMMATERIAL && options && options.allowImmaterial)) {
      throw new Error(`Cannot activate non-inactive ${this.debugId()}`);
    }
    this._phase = ACTIVATING;
    const operationInfo = { pendingConnection: null };
    this._activationProcess = (async () => {
      try {
        while (blocker) {
          const blockerPhase = blocker.getPhase();
          if (isNonActivateablePhase(blockerPhase)) {
            if ((blockerPhase === IMMATERIAL) && (options && options.allowImmaterial)) {
              await blocker.untilCreated();
            } else {
              throw new Error(
                  `Cannot activate ${blocker.debugId()} because it is ${blocker.getPhase()}`);
            }
          } else if (!blocker._connection || !blocker._connection.isActive()) {
            await (operationInfo.pendingConnection = blocker.getConnection())
                .asActiveConnection();
          } else if (blocker === this) {
            throw new Error(
                `Connection is active but blocker is still this ${this._phase} Vrapper itself`);
          }
          blocker = this.refreshPhase();
        }
        operationInfo.pendingConnection = null;
        return this;
      } catch (error) {
        this._phase =
            (blocker !== this) ? INACTIVE
            : this.isActivating() ? UNAVAILABLE
            : this._phase; // no change.
        throw this.wrapErrorEvent(error, 1, "activate.process",
            "\n\tthis:", ...dumpObject(this),
            "\n\tblocker:", ...dumpObject(blocker));
      } finally {
        delete this._activationProcess;
      }
    })();
    this._activationProcess.operationInfo = operationInfo;
    return this._activationProcess;
  }

  untilCreated () {
    return this._untilCreated || (this._untilCreated = new Promise(resolve => {
      this._resolveCreated = () => {
        this._resolveCreated = null;
        this._untilCreated = null;
        resolve();
      };
    }));
  }

  /**
   * Returns true if the Resource is active after the purge.
   *
   * @param {*} passage
   * @returns {boolean}
   * @memberof Vrapper
   */
  purgePassage (passage): boolean {
    if (isCreatedLike(passage)) {
      this._phase = IMMATERIAL;
    }
    return this._phase === ACTIVE;
  }

  /**
   * Refreshes the Vrapper state to Active phase if the resource and
   * all of its prototypes (and their connections) have been activated.
   * Will *not* initiate an activation process by itself.
   * Returns undefined if successful ie. the phase is now Active,
   * otherwise returns the Vrapper blocking the synchronous activation
   * (which might be this Vrapper itself).
   * Finally, if the activation is blocked by a fully inactive
   * prototype the VRL id of that prototype is returned.
   * The blocking cause can be inspected by blocker.getPhase(): if the
   * phase is Inactive or Activating, the cause is a non-full chronicle
   * connection. Otherwise the cause is a non-activateable phase
   * (Immaterial, Unavailable, NonResource).
   * Unavailable indicates an error on the chronicle connection sync
   * which can be extracted with
   * `Promise.resolve(conn.asActiveConnection()).catch(onError);`
   *
   * @param {Object} state
   * @param {Transient} transient
   * @returns
   *
   * @memberof Vrapper
   */
  refreshPhase (refreshingState?: Object, refreshingTransient?: Transient) {
    if (this._phase === ACTIVE) return undefined;
    if ((this._phase === NONRESOURCE) && (this._phase === UNAVAILABLE)) {
      return this;
    }
    const resolver = this.engine.discourse.maybeForkWithState(refreshingState);
    const transient = refreshingTransient
        || resolver.tryGoToTransient(this[HostRef], this._typeName);
    if (!transient) {
      this._phase = this[HostRef].isGhost() ? INACTIVE : IMMATERIAL;
      return this;
    }
    this._updateTransient(resolver.state, transient);
    const id = transient.get("id");
    if (!id.getChronicleURI() && !id.isGhost() && (this._typeName !== "Blob")) {
      if (id.isAbsent()) return this;
      throw new Error(`Cannot update an active non-ghost Vrapper id with no chronicleURI: <${
          id}>, (current id: <${this[HostRef]}>)`);
    }
    this[HostRef] = id;
    const connection = this.tryConnection();
    const newTypeName = transient.get("typeName");
    if (!connection || !connection.isActive()) {
      if (id.isAbsent()) return this;
    } else if (!newTypeName ? id.isAbsent() : isAbsentTypeName(newTypeName)) {
      this._phase = IMMATERIAL;
      return this;
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
      const blocker = prototypeVrapper.refreshPhase(refreshingState);
      if (blocker) return blocker;
    }
    this._phase = ACTIVE;
    this._activationProcess = undefined;
    this._postActivate(resolver, transient, newTypeName);
    return undefined;
  }

  _postActivate (resolver: Object, transient: Transient, newTypeName: string) {
    try {
      if (!this._typeName || isAbsentTypeName(this._typeName)) {
        const ref = this[HostRef];
        if (ref.isAbsent()) {
          this.warnEvent("Activating id explicitly! Should have been activated by reducers");
          ref.setAbsent(false);
        }
        this._setTypeName((newTypeName && !isAbsentTypeName(newTypeName))
            ? newTypeName
            : resolver.tryGoToTransient(
              ref, "TransientFields", true, false, true, "typeName").get("typeName"));
      }
      this.setName(`Vrapper/${this.getRawId()}:${this._typeName}`);
      if (!this.isInactive()) {
        this.registerComplexHandlers(this.engine._storyHandlerRoot, resolver.state);
      }
      this._refreshDebugId(transient, { state: resolver.state });
      if (this.hasInterface("Scope")) this._setUpScopeFeatures(resolver);
    } catch (error) {
      const wrappedError = this.wrapErrorEvent(error, 1,
          new Error("_postActivate()"),
          "\n\tid:", ...dumpObject(this[HostRef]),
          "\n\tid.getChronicleURI:", ...dumpObject(this[HostRef].getChronicleURI()),
          "\n\ttransient:", ...dumpObject(transient.toJS()),
          "\n\tconnection:", ...dumpObject(this._connection),
          "\n\tthis:", ...dumpObject(this),
          "\n\tresolver.state:", ...dumpObject(resolver.state.toJS()),
          "\n\tengine.discourse.state:", ...dumpObject(this.engine.discourse.getState().toJS()));
      // throw wrappedError;
      this.outputErrorEvent(
          wrappedError,
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
    if (this._phase === ACTIVE) return;
    const blocker = (options && options.activate)
        ? this.activate(options)
        : this.refreshPhase(options && options.state);
    const phase = this._phase;
    if (!blocker || (options && options.allowActivating && (phase === ACTIVATING))) return;
    if (this.isImmaterial() && options) {
      // TODO(iridian): While this takes care of the situation where
      // a Resource is destroyed in the main line but not destroyed in
      // a transaction, the reverse scenario is not handled: if a
      // resource is destroyed in transaction but not in main line,
      // requireActive will keep on passing. This is a lesser issue as
      // any illegal operations will still be caught by FalseProphet
      // and backend validations. But nevertheless the lack of symmetry
      // and dirty caching is unclean. Caching is hard.
      const resolver = options.discourse
          || (!options.state && this.engine.discourse)
          || Object.create(this.engine.discourse).setState(options.state);
      if (resolver.tryGoToTransient(this[HostRef], this._typeName)) return;
    }
    const error =
        !this.isResource() ?
            new Error(`Cannot operate on a non-Resource ${this.debugId()}`)
        : this.isImmaterial() ?
            new Error(`Cannot operate on a non-Created ${this.debugId()}`)
        : this.isUnavailable() ?
            new Error(`Cannot operate on an Unavailable ${this.debugId()}`)
        : addConnectToChronicleToError(new AbsentChroniclesError(
                `Missing or not fully narrated connection for ${this.debugId()}`,
                [this.activate()]),
            this.engine.discourse.connectToAbsentChronicle);
    throw this.wrapErrorEvent(error, 1, "requireActive",
        "\n\toptions:", ...dumpObject(options),
        "\n\tphase was:", phase,
        "\n\tactivation blocker is",
            (blocker === this) ? "this object itself" : "some prototype of this",
        "\n\tthis[HostRef]:", ...dumpObject(this[HostRef]),
        "\n\tthis._connection:", ...dumpObject(this._connection),
        "\n\tblocker:", ...dumpObject(blocker),
        "\n\tblocker._connection:", ...dumpObject(blocker._connection),
        "\n\tthis:", ...dumpObject(this));
  }

  tryConnection (options: Object = {}): ?Connection {
    options.require = false;
    options.newConnection = false;
    const ret = this.getConnection(options);
    return ret && ret.isActive() ? ret : undefined;
  }

  getConnection (options:
      { require?: boolean, discourse?: Discourse, newConnection?: boolean }
          = { require: true }): ?Connection {
    if (this._connection) return this._connection;
    let chronicleURI;
    let nonGhostOwnerRawId;
    try {
      if (!this.isResource()) {
        throw new Error(`Non-resource Vrapper's cannot have chronicle connections`);
      }
      chronicleURI = this[HostRef].getChronicleURI();
      const discourse = options.discourse || this.engine.discourse;
      if (!chronicleURI) {
        nonGhostOwnerRawId = this[HostRef].getGhostPath().headHostRawId() || this[HostRef].rawId();
        const transient = discourse.tryGoToTransientOfRawId(nonGhostOwnerRawId, "Resource");
        if (transient) {
          chronicleURI = transient && transient.get("id").getChronicleURI();
          if (!chronicleURI) {
            const authorityURI = transient.get("authorityURI")
                || transient.get("partitionAuthorityURI");
            chronicleURI = authorityURI
                && naiveURI.createChronicleURI(authorityURI, transient.get("id").rawId());
          }
        }
      }
      this._connection = chronicleURI
          && discourse.acquireConnection(chronicleURI, {
            newChronicle: false, newConnection: options.newConnection, require: options.require,
          });
      if (!this._connection) {
        if (!options.require) return undefined;
        throw new Error(`Failed to acquire the connection of ${this.debugId()}`);
      }
      if (!this._connection.isActive()) {
        this._connection.asActiveConnection().catch(onError.bind(this,
            new Error(`getConnection.acquire.asActiveConnection()`)));
      }
      return this._connection;
    } catch (error) {
      return onError.call(this, new Error(`getConnection(${
          options.require ? "require" : "optional"})`), error);
    }
    function onError (wrapper, error) {
      throw this.wrapErrorEvent(error, 1, wrapper,
          "\n\toptions:", ...dumpObject(options),
          "\n\tthis[HostRef]:", this[HostRef],
          "\n\tthis._transient:", this._transient,
          "\n\tchronicleURI:", chronicleURI,
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _withActiveConnectionChainEagerly (options: VALKOptions,
      chainOperations: ((prev: any) => any)[], onError?: Function) {
    return thenChainEagerly(
        this.getConnection(options).asActiveConnection(options.synchronous),
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
  getId (options?: VALKOptions): VRL {
    const transient = options ? this.getTransient(options) : this._transient;
    return transient ? transient.get("id") : this[HostRef];
  }

  getURI (): string {
    return `${this.getConnection().getChronicleURI()}#${this.getRawId()}`;
  }

  /**
   * Returns the unique raw id string of this resource.
   * This id string should not be used as an id in outgoing kueries because it might belong to a
   * immaterial ghost or a resource outside known chronicles. So in other words, while rawId
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
      else if (targetId.isAbsent()) {
        targetText = `<in absent '${targetId.getChronicleURI()}'>`;
      } else {
        const target = this.get("target", options);
        targetText = (target && debugId(target, options)) || "<target not found>";
      }
      this.__debugId = `${debugId(transient)}->${targetText}`;
    }
  }

  getTransient (options: ?{
    state?: Object, discourse?: Discourse, typeName?: string, mostMaterialized?: any,
    withOwnField?: string,
  } = {}) {
    const explicitState = options.state
        || (options.discourse ? options.discourse.getState()
            : options.withOwnField ? this.engine.discourse.getState()
            : undefined);
    const state = explicitState || this._transientStaledIn;
    let ret = !state && this._transient;
    if (!ret) {
      const discourse = options.discourse || this.engine.discourse;
      const typeName = options.typeName || this.getTypeName(options);
      ret = state.getIn([typeName, this.getRawId()]);
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
    }
    return ret;
  }

  isGhost () { return this[HostRef].isGhost(); }

  isMaterialized (discourse: ?Discourse) {
    const state = (discourse || this.engine.discourse).getState();
    this.requireActive({ state });
    return isMaterialized(state, this.getId());
  }

  materialize (discourse: ?Discourse): ChronicleEventResult {
    const innerDiscourse = (discourse || this.engine.discourse);
    this.requireActive({ state: innerDiscourse.getState() });
    return innerDiscourse.chronicleEvent(
        createMaterializeGhostAction(innerDiscourse, this.getId(), this._typeName));
  }

  _updateTransient (state: ?Object, object: ?Object) {
    // TODO(iridian): Storing the transient in the vrapper is silly and useless premature
    // optimization. With the transactions it can't really be used anyway, so yeah. Get rid of it
    // and just store the id VRL in the Vrapper.
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
      this._hostGlobal.valos = this._hostGlobal.Valaa = this._nativeScope;
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
      return this.run(this[HostRef], kuery, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, "do",
          "\n\tkuery:", ...dumpKuery(kuery),
          "\n\toptions:", ...dumpObject(options));
    }
  }

  run (head: any, kuery: Kuery, options: VALKOptions = {}) {
    const discourse = options.discourse;
    if (this._phase === ACTIVE) {
      if (options.scope === undefined) options.scope = this.getLexicalScope();
      if (discourse && discourse._steppers.kuerySubscription
          && !options.state && !(kuery instanceof Kuery)) {
        return discourse.tryUnpack(Object.create(discourse)
            .advance(discourse.tryPack(head), kuery, options.scope));
      }
    } else if (!discourse && !options.state && this.isResource()) {
      this.requireActive();
    }
    return super.run(head, kuery, options);
  }


  setField (fieldName: string, value: any, options: VALKOptions = {}) {
    let commandValue;
    try {
      const { discourse, id } = this._primeTransactionAndOptionsAndId(options);
      commandValue = universalizeCommandData(value, options);
      return discourse.chronicleEvent(fieldsSet({ id, typeName: this._typeName,
        sets: { [fieldName]: commandValue },
      }));
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `setField(${fieldName})`,
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
      const { discourse, id } = this._primeTransactionAndOptionsAndId(options);
      commandValue = universalizeCommandData(value, options);
      return discourse.chronicleEvent(addedTo({ id, typeName: this._typeName,
        adds: { [fieldName]: arrayFromAny(commandValue || undefined) },
      }));
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `addToField(${fieldName})`,
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
      const { discourse, id } = this._primeTransactionAndOptionsAndId(options);
      commandValue = universalizeCommandData(value, options);
      return discourse.chronicleEvent(removedFrom({ id, typeName: this._typeName,
        removes: { [fieldName]: (commandValue === null) ? null : arrayFromAny(commandValue) },
      }));
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `removeFromField(${fieldName})`,
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
      const { discourse, id } = this._primeTransactionAndOptionsAndId(options);
      universalRemovedValues = arrayFromAny(
          universalizeCommandData(
                  replacedValues.filter(replacedValue => !addedValues.has(replacedValue)), options)
              || undefined);
      universalAddedValues = arrayFromAny(
          universalizeCommandData(withValues, options)
              || undefined);
      return discourse.chronicleEvent(replacedWithin({ id, typeName: this._typeName,
        removes: { [fieldName]: universalRemovedValues },
        adds: { [fieldName]: universalAddedValues },
      }));
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `replaceInField(${fieldName})`,
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

  _primeTransactionAndOptionsAndId (options: VALKOptions): { discourse: Discourse, id: VRL } {
    const discourse = options.discourse || this.engine.discourse;
    this.requireActive(options);
    let id = discourse.bindObjectId(this.getId(), this._typeName);
    options.head = this;
    let chronicleURI = id.getChronicleURI();
    if (!chronicleURI && id.isGhost()) {
      chronicleURI = discourse.bindObjectId([id.getGhostPath().headHostRawId()], "Resource")
          .getChronicleURI();
      id = id.immutateWithChronicleURI(chronicleURI);
    }
    options.chronicleURI = chronicleURI;
    return { discourse, id };
  }

  /**
   * Creates an object using this as sub-kuery head.
   * Note! The created resource thus does not have this resource as owner unless explicitly
   * specified in the initialState.owner.
   * Use \see emplaceSet and \see emplaceAddTo to add ownership at the same time.
   *
   * @param {any} typeName
   * @param {any} [initialState={}]
   * @param {{ discourse?: Object, scope: ?} [options=Object]
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
        && !initialState.authorityURI && !initialState.partitionAuthorityURI) {
      initialState.owner = this.get("owner", Object.create(options));
    }
    return this.create(typeName, initialState, options);
  }

  destroy (options: { discourse?: Discourse } = {}) {
    this.requireActive(options);
    return (options.discourse || this.engine.discourse).destroy({ id: this.getId(options) });
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
    let discourse;
    try {
      discourse = (options.discourse || this.engine.discourse).acquireFabricator("emplace");
      options.discourse = discourse;
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
      discourse.releaseFabricator();
      return vFieldValue;
    } catch (error) {
      discourse.releaseFabricator({ rollback: error });
      throw this.wrapErrorEvent(error, 1,
          `emplace${isSet ? "SetField" : "AddToField"}(${fieldName})`,
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
    const typePrototype = this.engine.getValospaceTypePrototype(typeName);
    const fieldDescriptor = typePrototype[PropertyDescriptorsTag][propertyName];

    if (fieldDescriptor != null) {
      if (fieldDescriptor.isHostField) {
        const namespace = fieldDescriptor.namespace;
        if (namespace) {
          // console.log("hostref", fieldDescriptor, fieldDescriptor.isHostField, namespace);
          return ((this._namespaceProxies || (this._namespaceProxies = {}))[namespace]
              || (this._namespaceProxies[namespace]
                  = this.engine.getRootScope().valos.$valosNamespace._createProxy(this)));
        }
        const ret = this.get(fieldDescriptor.kuery, options);
        // console.log("hostref", fieldDescriptor.kuery, ret);
        return ret;
      }
      if (fieldDescriptor.value !== undefined) return fieldDescriptor.value;
    }
    return typePrototype[propertyName];
  }

  _getProperty (propertyName: string | Symbol, options: VALKOptions) {
    if (typeof propertyName !== "string") return undefined;
    const ret = this._lexicalScope && this._lexicalScope.hasOwnProperty(propertyName)
    // FIXME(iridian): If a property gets renamed inside a transaction
    // and a new property gets created with (or renamed to) the same
    // name we get a cache issue here: _lexicalScope only updates on
    // actual Engine events which have not yet landed. Similar issues
    // might arise with heresy rollbacks.
        && this._lexicalScope[propertyName];
    if (ret && !ret.isImmaterial()) return ret;
    // New properties which don't exist in _lexicalScope still work as
    // they get kueried here.
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
    const hostType = this.engine.getRootScope().valos[typeName];
    const fieldDescriptor = hostType.prototype[PropertyDescriptorsTag][propertyName];
    let ret;
    const writableFieldName = (fieldDescriptor != null) && fieldDescriptor.writableFieldName;
    if (writableFieldName) {
      ret = this._preProcessNewReference(
          this.get(["§->", writableFieldName, actualAlterationVAKON], alterationOptions),
          fieldDescriptor, hostType);
      // TODO(iridian): Make this solution semantically consistent host field access.
      // Now stupidly trying to setField even if the field is not a primaryField.
      this.setField(writableFieldName, ret, options);
    } else {
      options.head = this;
      ret = this.run(0, ["§->", ["§void"], actualAlterationVAKON], alterationOptions);
      this.engine.create("Property", {
        owner: this.getId().coupleWith("properties"),
        name: propertyName,
        value: expressionFromProperty(ret, propertyName),
      }, options);
    }
    return ret;
  }

  _preProcessNewReference (newValue: VRL, fieldPrototypeEntry: Object, hostType: Object) {
    if (fieldPrototypeEntry.fieldName === "owner"
        && !((newValue instanceof VRL) && newValue.getCoupledField())) {
      const defaultCoupledField = hostType[OwnerDefaultCouplingTag];
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
   * If the property is a a pointer to a valoscript Media
   * this compiles and evaluates the pointed valoscript program once (with its program-level
   * side-effects) and returns the resulting value of the evaluation (the last statement if it is
   * an expression statement).
   * All further calls will return this same evaluated value until the program is touched or the
   * evaluation context (surrounding Engine) is flushed.
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
      throw this.wrapErrorEvent(error, 1, "extractValue",
          "\n\toptions:", ...dumpObject(options),
          "\n\tvExplicitOwner:", ...dumpObject(vExplicitOwner));
    }
  }

  extractPropertyValue (options: VALKOptions, vExplicitOwner: ?Vrapper, explicitValueEntry?: any) {
    let valueEntry;
    let ret;
    try {
      const kuerySubscription = options.discourse && options.discourse._steppers.kuerySubscription;
      if (kuerySubscription) {
        kuerySubscription.attachKueryFieldHook(this, "value", true);
      }
      valueEntry = explicitValueEntry;
      if (!valueEntry) {
        const thisTransient = this.getTransient(options);
        valueEntry = thisTransient.get("value");
        if (!valueEntry) {
          // immaterial property kludge
          valueEntry = getObjectRawField(
              options.discourse || this.engine.discourse, thisTransient, "value");
          if (!valueEntry) return undefined;
        }
      }
      if (!this._extractedPropertyValues) this._extractedPropertyValues = new WeakMap();
      if (this._extractedPropertyValues.has(valueEntry)) {
        return this._extractedPropertyValues.get(valueEntry);
      }
      let state;
      let valueType;
      const isExpandedTransient = !(valueEntry instanceof VRL);
      if (isExpandedTransient) {
        valueType = dataFieldValue(valueEntry, "typeName");
      } else {
        state = (options.discourse || this.engine.discourse).getState();
        valueType = state.getIn(["Expression", valueEntry.rawId()]);
      }
      if (valueType === "Identifier") {
        ({ ret, valueEntry } =
            this._extractPointerValue(options, vExplicitOwner, valueEntry));
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
      if (valueEntry !== undefined) {
        this._extractedPropertyValues.set(valueEntry, ret);
      }
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, () => [
        `extractPropertyValue()`,
        "\n\toptions:", ...dumpObject(options),
        "\n\tvalueEntry:", ...dumpObject(valueEntry),
        "\n\tret:", ...dumpObject(ret),
      ]);
    }
  }

  static toValueReference = VALK.fromVAKON(["§->", "value", "reference"]);

  _extractPointerValue (options: VALKOptions = {}, vExplicitOwner: ?Vrapper,
      valueEntry: Transient) {
    this.requireActive(options);
    const target = this.get(Vrapper.toValueReference, Object.create(options));
    if (!target) {
      console.warn(`Vrapper(${this.debugId()
          }).extractValue: Cannot resolve pointed resource from Property.value:`, valueEntry);
      return { ret: undefined, valueEntry: undefined };
    }
    return { ret: target, valueEntry };
  }

  _mediaInterpretations: WeakMap<Object, { [contentType: string]: Object }>;

  static toMediaInfoFields = VALK.fromVAKON({
    // bvobId: ["§->", "content", false, "contentHash"],
    contentHash: ["§->", "content", false, "contentHash"],
    name: ["§->", "name"],
    sourceURL: ["§->", "sourceURL"],
    contentType: ["§->", "mediaType", false, "contentType"],
    // type: ["§->", "mediaType", false, "type"],
    // subtype: ["§->", "mediaType", false, "subtype"],
  });

  /* (re-)assigns options.mediaInfo */
  resolveMediaInfo (options: VALKOptions = {}) {
    const mediaInfo = Object.assign({},
        options.mediaInfo || this.get(Vrapper.toMediaInfoFields, options));
    /*
    function _setMediaInfoTypeAndSubtype (contentType) {
      const split = contentType.split("/");
      mediaInfo.type = split[0];
      mediaInfo.subtype = split[1];
    }
    */
    // First always use explicitly requested contentType
    if (options.contentType) mediaInfo.contentType = options.contentType;
    // Secondly accept Media.$V.mediaType-based contentType
    else if (!mediaInfo.contentType) {
      // Thirdly try to determine contentType from file type
      const nameBasedMediaType = mediaTypeFromFilename(mediaInfo.name);
      if (nameBasedMediaType) Object.assign(mediaInfo, nameBasedMediaType);
      else {
        // Fourthly fall back to option.fallbackContentType / option.mediaInfo.fallbackContentType
        mediaInfo.contentType = (options && options.fallbackContentType)
            || mediaInfo.fallbackContentType
        // Fifthly use octet-stream
            || "application/octet-stream";
      }
    }
    /*
    if (!mediaInfo.contentType) {
      mediaInfo.contentType = `${mediaInfo.type}/${mediaInfo.subtype}`;
    }
    */
    mediaInfo.mediaVRL = this.getId(options);
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
      const kuerySubscription = options.discourse && options.discourse._steppers.kuerySubscription;
      if (kuerySubscription) {
        kuerySubscription.attachFilterHook(this, true, true);
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
        const contentType = options.contentType || options.mime
            || (mediaInfo = this.resolveMediaInfo(Object.create(options))).contentType;
        const cachedInterpretation = contentType && interpretationsByMime[contentType];
        if (cachedInterpretation
            && (contentType || !options.fallbackContentType
                || (cachedInterpretation === interpretationsByMime[options.fallbackContentType]))) {
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
          String(mediaInfo && mediaInfo.contentType)})`);
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
          String((mediaInfo || {}).contentType)})`);
      return errorOnObtainMediaInterpretation(error);
    }
    function errorOnObtainMediaInterpretation (error) {
      const wrapped = vrapper.wrapErrorEvent(error, 1, wrap,
        "\n\tid:", vrapper.getId(options).toString(),
        "\n\toptions:", ...dumpObject(options),
        "\n\tvExplicitOwner:", ...dumpObject(vExplicitOwner),
        "\n\tmediaInfo:", ...dumpObject(mediaInfo),
        "\n\tmostMaterializedTransient:", ...dumpObject(mostMaterializedTransient),
        "\n\tconnection.isActive:", ...dumpObject(
          vrapper._connection && vrapper._connection.isActive()),
        "\n\tvrapper:", ...dumpObject(vrapper),
      );
      throw wrapped;
    }
    function _setInterPretationByMimeCacheEntry (interpretation: any) {
      if (!(mediaInfo || {}).contentType || !mostMaterializedTransient) return;
      if (!interpretationsByMime) {
        vrapper._mediaInterpretations
            .set(mostMaterializedTransient, interpretationsByMime = {});
      }
      interpretationsByMime[mediaInfo.contentType] = interpretation;
      if (!options.mediaInfo && !options.contentType
          && (!options.fallbackContentType
              || (mediaInfo.contentType === options.fallbackContentType))) {
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
      const [specific, contentType] = specificWithFragment.split("#");
      if (specific !== "mediaType" || !contentType) continue;
      ret = { contentType };
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
      throw this.wrapErrorEvent(error, 1, () => [
        `alterValue()`,
        "\n\talterationVAKON:", dumpify(alterationVAKON),
      ]);
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
      const buffer = this.engine.getSourcerer().tryGetCachedBvobContent(this.getRawId());
      if (typeof buffer !== "undefined") return buffer;
      throw new Error(`Cannot locate Bvob buffer directly from caches (with id '${
          this.getRawId()}'`);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `bvobContent()`);
    }
  }

  /**
   * Eagerly returns a URL for accessing the content of this Media with
   * optionally provided media type. The content is a retrieved and
   * decoded like described by the Media interpretation process. Unlike
   * full interpretation the content is not integrated in any specific
   * context.
   * TODO(iridian): Should the integration be included as an option?
   * How will the interpretation infrastructure be used outside VS/JS/VSX/JSX
   * If the chronicle of the Media is not yet acquired, returns a
   * promise which resolves to the URL after the corresponding
   * chronicle is acquired.
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
      throw vrapper.wrapErrorEvent(error, 1, wrap, "\n\tinfo:", ...dumpObject(mediaInfo));
    }
  }

  /**
   * Eagerly returns an interpretation of this Media with optionally
   * provided media type. Returns a fully integrated decoded content
   * associated with this resource and the provided media type.
   *
   * If the interpretation is not immediately available or if the
   * chronicle of the Media is not acquired, returns a promise for
   * acquiring the chronicle and performing this operation instead.
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
    if (options.mime) {
      console.error("DEPRECATED: interpretContent.mime",
          "\n\tprefer: interpretContent.contentType");
      options.contentType = options.mime;
      delete options.mime;
    }
    if (options.mimeFallback) {
      console.error("DEPRECATED: interpretContent.mimeFallback",
          "\n\tprefer: interpretContent.fallbackContentType");
      options.fallbackContentType = options.mimeFallback;
      delete options.mimeFallback;
    }
    return this._obtainMediaInterpretation(options);
  }

  static toMediaPrepareBvobInfoFields = VALK.fromVAKON({
    name: ["§->", "name"],
    contentType: ["§->", "mediaType", false, "contentType"],
  });

  /**
   * Prepares given content for use within the chronicle of this
   * resource in the form of a newly created Bvob object.
   * Returns a promise which resolves to a `createBvob` function once
   * the chronicle is connected and the content has been optimistically
   * persisted. Calling createBvob will then create and return a new
   * Bvob resource which represents the given content and which can be
   * assigned to some Media.content.
   *
   * The semantics of optimistic persistence depends on the chronicle
   * authority scheme and its configuration. valaa-memory doesn't
   * support Media content (or stores them in memory). valaa-local
   * optimistically and fully persists in the local Scribe. Typical
   * remote chronicles optimistically persist on the local Scribe and
   * fully persist on the remote authority once online.
   *
   * In general only the chronicle of this resource matters. However
   * if this resource is a Media then its name and mediaType fields are
   * used as debug information. Even then the final resulting bvob
   * can be used with any media.
   *
   * @param {*} bvobContent
   * @param {VALKOptions} [options={}]
   * @returns a function callback which creates and returns a Bvob
   * using the transaction specified in options.discourse.
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
            if (callerValker) innerOptions.discourse = callerValker;
            return engine.create("Blob", undefined, innerOptions);
          }
          ret._valkThunk = true;
          return ret;
        },
      ], errorOnPrepareBvob);
    } catch (error) { return errorOnPrepareBvob(error); }
    function errorOnPrepareBvob (error) {
      throw vrapper.wrapErrorEvent(error, 1, wrap,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo));
    }
  }

  recurseConnectedChronicleMaterializedFieldResources (fieldNames: Array<string>,
      options: Kuery = {}) {
    const activeConnections = this.engine.getSourcerer().getActiveConnections();
    const result = [];
    for (const chronicleId of Object.keys(activeConnections)) {
      const vRoot = this.engine.tryVrapper(chronicleId);
      if (vRoot) {
        result.push(...(vRoot.recurseMaterializedFieldResources(fieldNames, options)));
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
        || (options.discourse && options.discourse.getState())
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
      throw this.wrapErrorEvent(error, 1, `registerComplexHandlers`,
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
 * Returns or finds an existing chronicle proxy of this object in the
 * given chronicle.
 * Given chronicle p proxy x of prototype object o as x = pProxy(o, p),
 * the following hold:
 * 1. primary proxy object rules:
 * 1.1. x.id = derivedId(o.id, { proxyChronicle: p.id })
 * 1.2. x.prototype = p.id
 * Thus obtaining the proxy object is idempotent in its chronicle,
 * after first creation.
 * Unlike with chronicle instances the member couplings of the proxy
 * object are not processed at all. This means that any property
 * accesses have to perform a further obtainProxyIn translation
 * to obtain similar proxy objects.
 * Chronicle proxies and chronicle instances are disjoint even for same prototypes.
 * @param {any} chronicle
 * @param {any} discourse If given, the proxy lookup and possible
 *   creation are performed in the discourse context. Otherwise, the
 *   lookup and creation are immediately performed against the
 *   backing engine and its false prophet.
 */
  getGhostIn (vInstance: Vrapper, discourse: ?Discourse) {
    this.requireActive({ discourse });
    const state = (discourse || this.engine.discourse).getState();
    const ghostVRL = createGhostVRLInInstance(this[HostRef],
        vInstance.getTransient({ discourse }));
    // TODO(iridian): Verify and return null if this object has no ghost in instance, ie. if this
    // object is not a sub-component in the direct prototype of vInstance
    return this.engine.getVrapper(ghostVRL, { state });
  }

  getSubResource (subPath, options: { contextChronicleURI: string, discourse: ?Discourse } = {}) {
    this.requireActive(options);
    if (!options.contextChronicleURI) {
      options.contextChronicleURI = this.getConnection().getChronicleURI(options);
    }
    const subVRID = formVPath(this[HostRef].vrid(), subPath);
    return this.engine.tryVrapper(subVRID, options)
        || vRef(subVRID, undefined, undefined, options.contextChronicleURI)
            .setAbsent();
  }

  onEventCREATED (passage: Passage, story: Story) {
    this._updateTransient(story.state);
    if (this._resolveCreated) this._resolveCreated();
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
      throw this.wrapErrorEvent(error, 1, `onEventMODIFIED()`);
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
    (this._destroyedHooks || []).forEach(hook => hook(story.timed));
    this._phase = IMMATERIAL;
    return this.engine.addDelayedRemoveCog(this, story);
  }

  addDESTROYEDHandler (hook: Function) {
    if (!this._destroyedHooks) this._destroyedHooks = [];
    this._destroyedHooks.push(hook);
  }

  notifyMODIFIEDHandlers (fieldName: string, passage: Passage, story: Story) {
    let fieldUpdate = this._fieldSubscriptions && this._fieldSubscriptions.get(fieldName);
    if (!fieldUpdate && !this._filterHooks) return undefined;
    if (!fieldUpdate) {
      fieldUpdate = new Subscription(this, story).initializeField(fieldName);
    }
    if (fieldUpdate._passage) {
      if (!fieldUpdate._passages) fieldUpdate._passages = [fieldUpdate._passage];
      fieldUpdate._passages.push(passage);
    }
    fieldUpdate._passage = passage;
    return this.engine.addDelayedFieldUpdate(fieldUpdate, story);
  }

  /**
   * Adds a new subscription for modifications on fields filtered by
   * given liveOperation.
   *
   * @param {(boolean | string | (fieldIntro: Object) => boolean | Kuery)} liveOperation
   * @returns {Subscription}
   *
   * @memberof Vrapper
   */
  obtainSubscription (liveOperation: boolean | string | (fieldIntro: Object) => boolean | Kuery,
      options: ?VALKOptions, obtainDiscourse: ?Function, head: any): Subscription {
    try {
      if ((head !== this) && (head !== undefined)) {
        // console.log("mismatching head", typeof liveOperation, ++Vrapper.mismatchingHead);
        return super.obtainSubscription(liveOperation, options, obtainDiscourse, head);
      }
      let ret;
      const opType = typeof liveOperation;
      if ((opType === "string") || (opType === "boolean") || isSymbol(liveOperation)) {
        ret = this.obtainFieldSubscription(liveOperation, options, obtainDiscourse);
      } else {
        if (this._phase === NONRESOURCE) return undefined;
        // this.requireActive({
        //  state: options && options.state, allowActivating: true, /* activate: true, */
        // });
        if (!this._kuerySubscriptions) this._kuerySubscriptions = new Map();
        ret = this._kuerySubscriptions.get(liveOperation);
        if (!ret || !ret.matchesKueryOptions(options, obtainDiscourse)) {
          /*
          ++Vrapper.cacheMissComplex;
          if (ret) {
            console.log("kuery", typeof liveOperation, "scope miss", ++Vrapper.scopeMissComplex,
                "/", Vrapper.cacheMissComplex + Vrapper.cacheHitComplex, this.debugId());
          }
          */
          const subscription = new Subscription(this, options, obtainDiscourse)
              .initializeKuery(liveOperation, this);
          if (!ret) {
            this._kuerySubscriptions.set(liveOperation, subscription);
          }
          return subscription;
        }
        /*
        console.log("KUERY HIT", typeof liveOperation, ++Vrapper.cacheHitComplex, "/",
            Vrapper.cacheMissComplex + Vrapper.cacheHitComplex, this.debugId(),
            "\n\tkuery:", JSON.stringify((liveOperation.toVAKON && liveOperation.toVAKON())
                || liveOperation));
        */
      }
      if (options) {
        const targetOptions = ret.getOptions();
        if (options.state && (targetOptions.state !== undefined)) {
          targetOptions.state = options.state;
        }
        if (options.discourse && (targetOptions.discourse !== undefined)) {
          targetOptions.discourse = options.discourse;
        }
      }
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `obtainSubscription()`,
          "\n\tliveOperation:", ...(liveOperation instanceof Kuery
              ? dumpKuery(liveOperation) : dumpObject(liveOperation)),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _kuerySubscriptions: Map<any, Subscription>;

  static mismatchingHead = 0;
  static cacheHitComplex = 0;
  static cacheMissComplex = 0;
  static scopeMissComplex = 0;

  _fieldSubscriptions: Map<string, Subscription>;

  static cacheHitFields = 0;
  static cacheMissFields = 0;

  obtainFieldSubscription (fieldName: string, options: ?VALKOptions): ?Subscription {
    let fieldSubscription;
    try {
      if (this._phase === NONRESOURCE) return undefined;
      // this.requireActive({
      //   state: options && options.state, allowActivating: true, /* activate: true, */
      // });
      if (!this._fieldSubscriptions) this._fieldSubscriptions = new Map();
      fieldSubscription = this._fieldSubscriptions.get(fieldName);
      if (!fieldSubscription) {
        // console.log("field", fieldName, "cache miss", ++Vrapper.cacheMissFields);
        fieldSubscription = new Subscription(this, options)
            .initializeField(fieldName);
        this._fieldSubscriptions.set(fieldName, fieldSubscription);
      } else {
        // console.log("FIELD HIT", fieldName, ++Vrapper.cacheHitFields);
      }
      return fieldSubscription;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `obtainFieldSubscription('${fieldName}')`,
          "\n\tfieldSubscription:", ...dumpObject(fieldSubscription),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _filterHooks: Map<Subscription, any>;

  _addFilterHook (subscription: Subscription, /* filter: boolean | Function, */ ...hookData) {
    try {
      if (this._phase === NONRESOURCE) return undefined;
      this.requireActive();
      if (!this._filterHooks) this._filterHooks = new Map();
      subscription._seenPassageCounter = this.engine._currentPassageCounter;
      this._filterHooks.set(subscription, hookData);
      return this._filterHooks;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, "_addFilterHook()",
          "\n\tsubscription:", ...dumpObject(subscription),
          "\n\thookData:", ...dumpObject(hookData),
          "\n\tfilterHandlers:", ...dumpObject(this._filterHooks),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  triggerFilterHooks (fieldUpdate: LiveUpdate, passageCounter: ?number) {
    if (!this._filterHooks) return;
    const fieldIntro = this.getTypeIntro().getFields()[fieldUpdate._fieldName];
    for (const [subscription, [filter, isStructural]] of this._filterHooks) {
      try {
        if (filter && ((typeof filter !== "function") || filter(fieldIntro))) {
          subscription.triggerFilterUpdate(isStructural, fieldUpdate, passageCounter);
        }
      } catch (error) {
        this.outputErrorEvent(
            this.wrapErrorEvent(error, 1,
                new Error(`Subscription.triggerFilterHooks('${fieldUpdate._fieldName
                    }').filterHook(${subscription.debugId()}, [${filter}, ${isStructural}])`),
                "\n\tlive update:", fieldUpdate,
                "\n\tlive update options:", fieldUpdate.getOptions(),
                "\n\tfailing filter subscription:", ...dumpObject(subscription),
                "\n\tstate:", ...dumpObject(fieldUpdate.getState().toJS())),
            1,
            `Exception caught during Subscription.triggerFilterHooks('${fieldUpdate._fieldName}')`);
      }
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

  _setUpScopeFeatures (resolver: Object) {
    // Refers all Scope.properties:Property objects in this._lexicalScope to enable scoped script
    // access which uses the owner._lexicalScope as the scope prototype if one exists.
    this._scopeOwnerSub = this.obtainSubscription("owner", { state: resolver.getState() });
    this._scopeOwnerSub.addListenerCallback(this, `Vrapper_scope_owner`, (ownerUpdate) => {
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
      // When a valoscript top-level module lambda function accesses
      // the global 'this' identifier it will resolve to the
      // _lexicalScope.this of the context resource.
      // This is very hard to debug as there is no abstraction layer
      // between: valoscript transpiler will omit code for 'this' access
      // for lambda functions expecting that 'this' is found in the
      // scope.
      // TODO(iridian, 2019-03): Requiring 'this' to be provided by
      // this code is likely a bug. See TODO note in parseRules:108.
      this._lexicalScope.this = this;
      this._lexicalScope.self = this._lexicalScope;
    });
    if (!this._lexicalScope) {
      throw this.wrapErrorEvent(new Error("Vrapper owner is not immediately available"), 1,
          "_setUpScopeFeatures",
          "\n\tthis:", ...dumpObject(this));
    }
    this._scopeNameSubs = {};
    this._scopeSub = this.obtainSubscription("properties", { state: resolver.getState() });
    this._scopeSub.addListenerCallback(
        this, `Vrapper_properties`, this._onPropertiesUpdate.bind(this));
  }

  _onPropertiesUpdate (fieldUpdate: LiveUpdate) {
    fieldUpdate.actualAdds().forEach(vActualAdd => {
      // TODO(iridian): Perf opt: this uselessly creates a
      // subscription in each Property Vrapper. We could just as
      // well have a cog which tracks Property.name and value changes
      // and updates thee owning Scope Vrapper._lexicalScope's.
      // Specifically: it is the call to actualAdds() which does this.
      // TODO(iridian, 2019-03): Property renames are going to be
      // disabled very shortly. This whole sequence can be dropped.
      const propertyRawId = vActualAdd.getRawId();
      /*
      const structuralName = (propertyRawId.match(/\.:(.*)$/) || [])[1];
      if (structuralName) {
        if ((structuralName === "this") || (structuralName === "self")) {
          this.warnEvent(`Structural property name '${
              structuralName}' is a reserved word and is omitted from scope`);
          return;
        }
        this._defineProperty(decodeURIComponent(structuralName), vActualAdd);
        return;
      }
      */
      const nameSub = this._scopeNameSubs[propertyRawId] = vActualAdd
          .obtainSubscription("name", { state: fieldUpdate.getState() });
      nameSub.addListenerCallback(this, `Vrapper_properties_name`, nameUpdate => {
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
          throw this.wrapErrorEvent(
              new Error(`Overriding existing Property '${newName}'`),
              1,
              new Error(`onPropertiesUpdate in Scope ${this.debugId()}`),
              "\n\tnew value:", ...dumpObject(vActualAdd),
              "\n\tprevious value:", ...dumpObject(this._lexicalScope[newName]),
              "\n\tfull Scope object:", ...dumpObject(this),
              new Error().stack);
          */
        }
        this._defineProperty(newName, vActualAdd);
      });
    });

    fieldUpdate.actualRemoves().forEach(vActualRemove => {
      const removedRawId = vActualRemove.getRawId();
      const subscription = this._scopeNameSubs[removedRawId];
      if (subscription) {
        subscription.removeListenerCallback(this, "Vrapper_properties_name");
        delete this._scopeNameSubs[removedRawId];
      }
      const propertyName = vActualRemove.get("name", fieldUpdate.previousStateOptions());
      if (this._lexicalScope[propertyName].getRawId() === removedRawId) {
        delete this._lexicalScope[propertyName];
        delete this._nativeScope[propertyName];
      }
    });
  }

  _defineProperty (name: string, vProperty) {
    this._lexicalScope[name] = vProperty;
    Object.defineProperty(this._nativeScope, name, {
      configurable: true,
      enumerable: true,
      get: () => vProperty.extractValue(undefined, this),
      set: (value) => vProperty
          .setField("value", expressionFromProperty(value, name), { scope: this._lexicalScope }),
    });
  }
}

Vrapper.prototype[ValoscriptPrimitiveKind] = "Vrapper";
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
  recurseConnectedChronicleMaterializedFieldResources: createApplicatorWithOptionsSecond,
};

function createApplicatorWithNoOptions (vrapper: Vrapper, methodName: string) {
  return (...args: any[]) => {
    try {
      return vrapper[methodName](...args);
    } catch (error) {
      throw vrapper.wrapErrorEvent(error, 1, () => [
        `getVALKMethod(${methodName})`,
        ...args.reduce((accum, arg, index) =>
                accum.concat([`\n\targ#${index}:`]).concat(dumpify(arg)), []),
      ]);
    }
  };
}

function createApplicatorWithOptionsFirst (vrapper: Vrapper, methodName: string, valker: Valker) {
  return (options: Object = {}, ...rest) => {
    try {
      options.discourse = valker;
      return vrapper[methodName](options, ...rest);
    } catch (error) {
      throw vrapper.wrapErrorEvent(error, 1, () => [
        `getVALKMethod(${methodName})`,
        "\n\targ#0, options:", ...dumpObject(options),
      ]);
    }
  };
}

function createApplicatorWithOptionsSecond (vrapper: Vrapper, methodName: string, valker: Valker) {
  return (first: any, options: Object = {}, ...rest) => {
    try {
      options.discourse = valker;
      return vrapper[methodName](first, options, ...rest);
    } catch (error) {
      throw vrapper.wrapErrorEvent(error, 1, () => [
        `getVALKMethod(${methodName})`,
        "\n\targ#0:", dumpify(first),
        "\n\targ#1, options:", ...dumpObject(options),
      ]);
    }
  };
}

function createApplicatorWithOptionsThird (vrapper: Vrapper, methodName: string, valker: Valker) {
  return (first: any, second: any, options: Object = {}, ...rest) => {
    try {
      options.discourse = valker;
      return vrapper[methodName](first, second, options, ...rest);
    } catch (error) {
      throw vrapper.wrapErrorEvent(error, 1, () => [
        `getVALKMethod(${methodName})`,
        "\n\targ#0:", dumpify(first),
        "\n\targ#1:", dumpify(second),
        "\n\targ#2, options:", ...dumpObject(options),
      ]);
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
      options.discourse = valker;
      return vrapper[methodName](fieldSymbol, options, ...rest);
    } catch (error) {
      throw vrapper.wrapErrorEvent(error, 1, () => [
        `getVALKMethod(${methodName})`,
        "\n\targ#0:", dumpify(fieldName),
        "\n\targ#1, options:", ...dumpObject(options),
        "\n\tknown host fields:", ...dumpObject(namespaceFieldLookup),
      ]);
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
      options.discourse = valker;
      return vrapper[methodName](fieldSymbol, second, options, ...rest);
    } catch (error) {
      throw vrapper.wrapErrorEvent(error, 1, () => [
        `getVALKMethod(${methodName})`,
        "\n\targ#0:", dumpify(fieldName),
        "\n\targ#1:", dumpify(second),
        "\n\targ#2, options:", ...dumpObject(options),
        "\n\tknown host fields:", ...dumpObject(namespaceFieldLookup),
      ]);
    }
  };
}
