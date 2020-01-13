// @flow
/**
 * Ghost system is a mechanism for prototypically instantiating components in such a manner that
 * updates on the original component and its sub-components' properties will be transparently
 * reflected on the instanced component and its sub-components, 'ghosts', except when such
 * sub/component properties have local modifications.
 *
 * These updates are not limited to just flat immediate leaf member value changes either but new
 * sub-component constructions, destructions and coupling modifications on the prototype parent will
 * be reflected in the instanced component and its ghost sub-components as well.
 *
 * To fully specify the relationship between ghost instantiation and updates we must first define
 * deep copying. A deep copy of an object will recursively copy all sub-components and then update
 * all references inside that instance which point into the object being copied or to any of its
 * sub-components into references to their respective counterparts inside the instance. In other
 * words: the copy is equal in structure and behaviour to the original except for component id's.
 *
 * Ghost instancing emulates deep copying. Any (almost) event log which uses ghost instancing can be
 * trivially mapped into an event log which only uses deep copying so that when a prototypeless ie.
 * flats snapshot are requested they are isomorphic between both event logs. This is done with:
 *
 * Rule of ghost event log isomorphism, ie. 'ghostbuster' rule: If all mutation events against
 * prototypes, ie. of objects that are instantiated anywhere in the event log, are repositioned
 * before said instantiation events themselves and if then all instantiation events are replaced
 * with deep copy events, the resulting object graph shall be isomorphic with the flattened object
 * graph of the original event log.
 *
 * In other words, ghost system behaves so that any prototype mutations are treated as-if they had
 * actually happened before any instantiations of said prototype.
 *
 * Non-validated event logs can be constructed which use ghost instancing and for which this
 * property is not possible: typically (invariably?) this relates to cyclic dependencies such as
 * prototype objects directly referencing their instances. These type of event logs, circular or
 * other, are undefined behaviour as of the initial draft of the ghost system (note: circular
 * systems might have large potential for powerful abstractions such as infinite sets and procedural
 * generators)
 *
 * A ghost is thus defined as a sub-component of an instance component, which acts as a selectively
 * mutable proxy to a corresponding sub-component of the instance prototype component.
 *
 * 1. Ghost id: Resource.id of a ghost is the always deterministic
 *   derivedId(ghostPrototypeId, "instance", instanceId).
 *
 * 2. Ghost prototype: Resource.prototype of the ghost is the proxy target sub-component.
 * The coupled field of the prototype is target sub-component's Resource.materializedGhosts.
 *
 * 3. Ghost partition: Resource.partition of the ghost is the instance component itself.
 * This means that the instance is a transitive Resource.owner of the ghost (directly or through
 * intermediate ghosts). The coupled field of these owner properties is Resource.ghostOwnlings.
 * This ownership tree of the instance component thus initially reflects the ownership tree of the
 * prototype component but might change if the ghosts are mutated.
 *
 * 4. Ghost access: Whenever accessing fields of an instance or any of its sub-component ghosts, all
 * resource id's which belong to the prototype or any of its must be translated (or attempted)
 * into ghost id's of the ghost partition. This makes it possible to use the prototypically accessed
 * id references of original sub-components in conjunction with explicit references to ghost and
 * non-ghost instance sub-components.
 *
 * Initially a ghost is a virtual resource: no creation events need to be made for ghosts. Only
 * when a ghost is mutated will it need to be instantiated. If front-end libraries use accessor
 * wrappers to resource (and they should), they need to observe for such changes to update their
 * references.
 */
import { Action, created, destroyed, transacted } from "~/raem/events";
import VRL, { vRef } from "~/raem/VRL";
import { GhostPath, Resolver } from "~/raem/state";
import type { State, Transient } from "~/raem/state"; // eslint-disable-line no-duplicate-imports

import isInactiveTypeName from "~/raem/tools/graphql/isInactiveTypeName";

import { dumpify, dumpObject, invariantify, invariantifyObject, wrapError } from "~/tools";

export function createGhostVRLInInstance (prototypeId: VRL,
    instanceTransient: Transient): VRL {
  const ghostPath = prototypeId.getGhostPath().withNewGhostStep(
      instanceTransient.get("prototype").rawId(),
      instanceTransient.get("id").rawId());
  return vRef(ghostPath.headRawId(), null, ghostPath);
}

export function createMaterializeGhostAction (resolver: Resolver, ghostId: VRL,
    concreteTypeName: string, isVirtualAction: boolean = false): ?Action {
  try {
    if (!ghostId.isGhost()) {
      throw new Error(`${concreteTypeName || "Resource"} does not exist: <${String(ghostId)}>`);
    }
    const actions = [];
    const typeIntro = concreteTypeName && resolver.schema.getType(concreteTypeName);
    if (concreteTypeName && (!typeIntro || !typeIntro.getInterfaces)) {
      throw new Error(`Cannot create materialize action for non-concrete type ${concreteTypeName}`);
    }
    _createMaterializeGhostAction(resolver, resolver.getState(), ghostId.getGhostPath(),
        ghostId, concreteTypeName, isVirtualAction, actions);
    return !actions.length ? undefined
        : actions.length === 1 ? actions[0] : transacted({ actions });
  } catch (error) {
    throw resolver.wrapErrorEvent(error, 1, () => [
      `createMaterializeGhostAction()`,
      "\n\tghostId:", ...dumpObject(ghostId),
    ]);
  }
}

export function createImmaterializeGhostAction (resolver: Resolver, ghostId: VRL): ?Action {
  const actions = [];
  _createImmaterializeGhostAction(resolver.getState(), ghostId.rawId(), actions);
  return !actions.length ? undefined
      : actions.length === 1 ? actions[0]
      : transacted({ actions });
}

export function createMaterializeGhostPathAction (resolver: Resolver, ghostObjectPath: GhostPath,
    concreteTypeName: string, isVirtualAction: ?boolean = false,
): ?Action {
  const actions = [];
  invariantify(ghostObjectPath.isGhost(), "materializeGhostPathAction.ghostObjectPath.isGhost");
  _createMaterializeGhostAction(resolver, resolver.getState(),
      ghostObjectPath, undefined, concreteTypeName, isVirtualAction, actions);
  return !actions.length ? undefined : actions.length === 1 ? actions[0] : transacted({ actions });
}

/**
 * Like createMaterializeGhostAction but allows creation of
 * an inactive transient for non-ghost resources as well.
 *
 * @export
 * @param {Resolver} resolver
 * @param {GhostPath} ghostObjectPath
 * @param {string} externalType
 * @returns {?Action}
 */
export function createInactiveTransientAction (resolver: Resolver, id: VRL): ?Action {
  const actions = [];
  _createMaterializeGhostAction(resolver, resolver.getState(), id.getGhostPath(),
      id, undefined, true, actions);
  return !actions.length ? undefined : actions.length === 1 ? actions[0] : transacted({ actions });
}

function _createMaterializeGhostAction (resolver: Resolver, state: State,
    ghostObjectPath: GhostPath, knownId: ?VRL, externalKnownType: ?string,
    isVirtualAction: boolean, outputActions: Array<Action>,
): { id: string, internallyKnownType: ?string, ghostPath: GhostPath } {
  // TODO(iridian): This whole segment needs to be re-evaluated now
  // with the introduction of the "ghostOwnlings"/"ghostOwner" coupling
  // introduction. Specifically: owners would not need to be
  // materialized. However, parts of the code-base still operate under
  // the assumption that if an object is materialized, all its owners
  // will be. Notably: FieldInfo:_elevateObjectId (but there might be
  // others).
  if (!(ghostObjectPath instanceof GhostPath)) {
    invariantifyObject(ghostObjectPath, "_createMaterializeGhostAction.ghostObjectPath",
        { instanceof: GhostPath },
        "perhaps createMaterializeGhostAction.ghostId is missing a ghost path?");
  }
  const ghostHostPrototypeRawId = ghostObjectPath.headHostPrototypeRawId();
  const [ghostHostRawId, rawId] =
      ghostObjectPath.getGhostHostAndObjectRawIdByHostPrototype(ghostHostPrototypeRawId);
  let internallyKnownType = state.getIn(["TransientFields", rawId]);
  try {
    if (internallyKnownType) {
      // Transient found: already materialized ghost or not a ghost to
      // begin with. Still possibly inside an inactive partition.
      // Return without side effects.
      const transient = state.getIn([internallyKnownType, rawId]);
      const id = transient.get("id");
      return { id, internallyKnownType, ghostPath: id.getGhostPath() };
    }
    if (!ghostHostPrototypeRawId || (ghostHostRawId === rawId)) {
      // No host prototype means this is the Ghost path base Resource
      // and ghostHostRawId equal to rawId means this is an instance.
      // In both cases a missing transient means we're either inside an
      // unconnected partition or the referred resource doesn't exist.
      // As it stands there is no theoretical way to determine the
      // actual partition id reliably, either.
      // Create an inactive reference for the resource.
      const id = knownId || vRef(rawId);
      if (knownId && !knownId.isInactive()) {
        throw new Error("Cannot materialize a non-existent resource (partition is active)");
      }
      // Also make the resource inactive, not the partition reference
      // prototype. This way only transient merging will activate it.
      id.setInactive();
      internallyKnownType = resolver.schema.inactiveType.name;
      outputActions.push(created({
        id, typeName: internallyKnownType,
        meta: { isVirtualAction },
      }));
      return { id, internallyKnownType, ghostPath: id.getGhostPath() };
    }
    // A regular non-root ghost Resource with no transient.
    // Still possibly inside an inactive partition.
    const { id: ghostPrototype, internallyKnownType: prototypeTypeName, ghostPath: prototypePath }
        = _createMaterializeGhostAction(resolver, state,
            ghostObjectPath.previousPrototypeStep(), undefined, undefined,
            true, outputActions);
    const ghostPath = prototypePath
        .withNewStep(ghostHostPrototypeRawId, ghostHostRawId, rawId);
    const knownHostType = state.getIn(["TransientFields", ghostHostRawId]);
    const hostId = knownHostType
        ? state.getIn([knownHostType, ghostHostRawId]).get("id")
        : Object.create(knownId
                ? Object.getPrototypeOf(knownId)
                : new VRL().initResolverComponent({ inactive: true }))
            .initNSS(ghostHostRawId);
    const id = Object.create(Object.getPrototypeOf(hostId)).initNSS(rawId);
    id.connectGhostPath(ghostPath);
    outputActions.push(created({
      id,
      typeName: !externalKnownType || !isInactiveTypeName(prototypeTypeName)
          ? prototypeTypeName : externalKnownType,
      initialState: { ghostPrototype, ghostOwner: hostId.getObjectId() },
      meta: { isVirtualAction },
    }));
    return { id, internallyKnownType: prototypeTypeName || externalKnownType, ghostPath };
  } catch (error) {
    throw resolver.wrapErrorEvent(error, 2, () => [
      `_createMaterializeGhostAction.detail(${dumpify(ghostObjectPath)}:${
            internallyKnownType || externalKnownType}})`,
      "\n\texternalKnownType:", externalKnownType,
      "\n\tinternallyKnownType:", internallyKnownType,
      "\n\tknownId:", knownId,
      "\n\tresource id:", rawId,
      "\n\tghost host prototype:", ghostHostPrototypeRawId,
      "\n\tghost host:", ghostHostRawId,
    ]);
  }
}

export function createImmaterializeGhostPathAction (state: State, ghostObjectPath: GhostPath):
    ?Action {
  const actions = [];
  _createImmaterializeGhostAction(state, ghostObjectPath.headRawId(), actions);
  return !actions.length ? undefined
      : actions.length === 1 ? actions[0]
      : transacted({ actions });
}

function _createImmaterializeGhostAction (state: State, rawId: string,
    outputActions: Array<Action>) {
  // FIXME(iridian): Right now immaterialization happens through DESTROYED. However this does not
  // obey ghostbuster rule: DESTROYED should destroy the ghost object for real, not just
  // immaterialize it as it does now. Also, DESTROYED doesn't affect materializedGhosts.
  try {
    const object = state.getIn(["Resource", rawId]);
    if (!object) return;
    outputActions.push(destroyed({ id: rawId }));
  } catch (error) {
    throw wrapError(error, new Error(`During createImmaterializeGhostAction("${rawId}":Resource)`));
  }
}

export function isMaterialized (state: State, id: VRL): boolean {
  return !!state.getIn(["Resource", id.rawId()]);
}
