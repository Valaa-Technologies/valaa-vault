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
import { vRef, getRawIdFrom, tryGhostPathFrom } from "~/raem/ValaaReference";
import type { VRef, IdData } from "~/raem/ValaaReference"; // eslint-disable-line no-duplicate-imports
import GhostPath from "~/raem/tools/denormalized/GhostPath";
import type { State } from "~/raem/tools/denormalized/State";
import Transient from "~/raem/tools/denormalized/Transient";

import { dumpify, dumpObject, invariantify, invariantifyObject, wrapError } from "~/tools";

export function createGhostVRefInInstance (prototypeId: VRef,
    instanceTransient: Transient): VRef {
  const ghostPath = prototypeId.getGhostPath().withNewGhostStep(
      getRawIdFrom(instanceTransient.get("prototype")),
      getRawIdFrom(instanceTransient.get("id")));
  return vRef(ghostPath.headRawId(), null, ghostPath);
}

export function tryGhostHostIdFrom (idData: IdData): ?string {
  const ghostPath = tryGhostPathFrom(idData);
  return ghostPath && ghostPath.headHostRawId();
}

export function isGhost (idDataOrTransient: IdData | Transient): boolean {
  const ghostPath = tryGhostPathFrom(idDataOrTransient && idDataOrTransient.get
      ? idDataOrTransient.get("id")
      : idDataOrTransient);
  return ghostPath ? ghostPath.isGhost() : false;
}

export function createMaterializeGhostAction (state: State, ghostId: VRef): ?Action {
  try {
    return createMaterializeGhostPathAction(state, ghostId.getGhostPath());
  } catch (error) {
    throw wrapError(error, `During createMaterializeGhostAction(), with:`,
        "\n\ttransientGhostObject:", ghostId);
  }
}

export function createImmaterializeGhostAction (state: State, ghostId: VRef): ?Action {
  const actions = [];
  _createImmaterializeGhostAction(state, ghostId.rawId(), actions);
  return !actions.length ? undefined
      : actions.length === 1 ? actions[0]
      : transacted({ actions });
}

export function createMaterializeGhostPathAction (state: State, ghostObjectPath: GhostPath,
    typeName: string): ?Action {
  const actions = [];
  invariantify(ghostObjectPath.isGhost(), "materializeGhostPathAction.ghostObjectPath.isGhost");
  _createMaterializeGhostAction(state, ghostObjectPath, typeName, actions);
  return !actions.length ? undefined
      : actions.length === 1 ? actions[0]
      : transacted({ actions });
}

function _createMaterializeGhostAction (state: State, ghostObjectPath: GhostPath, typeName: string,
    outputActions: Array<Action>): { id: string, actualType: string, ghostPath: GhostPath } {
  // TODO(iridian): This whole segment needs to be re-evaluated now with the introduction of the
  // "ghostOwnlings"/"ghostOwner" coupling introduction. Specifically: owners
  // would not need to be materialized. However, parts of the code-base still operate under the
  // assumption that if an object is materialized, all its owners will be.
  // Notably: FieldInfo:_elevateObjectId (but there might be others).
  invariantifyObject(ghostObjectPath, "_createMaterializeGhostAction.ghostObjectPath",
      { instanceof: GhostPath },
      "perhaps createMaterializeGhostAction.transientGhostObject is missing a ghost path?");
  const ghostHostPrototypeRawId = ghostObjectPath.headHostPrototypeRawId();
  const [ghostHostRawId, ghostRawId] =
      ghostObjectPath.getGhostHostAndObjectRawIdByHostPrototype(ghostHostPrototypeRawId);
  const ret = { id: null, actualType: null, ghostPath: undefined };
  const resourceTable = state.get("ResourceStub");
  const transientType = resourceTable.get(ghostRawId);
  try {
    if (transientType) {
      // Already materialized or not a ghost, possibly inside an inactive partition.
      // Nevertheless just return info without adding any side effects.
      const transient = state.getIn([transientType, ghostRawId]);
      ret.id = transient.get("id");
      ret.actualType = transientType;
      ret.ghostPath = ret.id.getGhostPath();
    } else if (!ghostHostPrototypeRawId) {
      // no host prototype means this is the Ghost path base Resource: no transient means we're
      // inside an inactive partition. Create an inactive reference for it.
      ret.id = vRef(ghostRawId);
      // TODO(iridian): Add inactive partition checks: throw if this partition is in fact active.
      ret.id.setInactive();
      ret.actualType = "InactiveResource";
      ret.ghostPath = ret.id.getGhostPath();
      outputActions.push(created({
        id: ret.id, typeName: ret.actualType, local: { noSubMaterialize: true },
      }));
    } else {
      // A regular non-root ghost Resource, but still possibly inside an inactive partition.
      // However, there is no difference between materialized reference and
      /* , owner: prototypeOwner */
      const { id: prototypeId, actualType: prototypeTypeName, ghostPath: prototypePath }
          = _createMaterializeGhostAction(state, ghostObjectPath.previousStep(), typeName,
              outputActions);
      ret.ghostPath = prototypePath
          .withNewStep(ghostHostPrototypeRawId, ghostHostRawId, ghostRawId);
      ret.id = vRef(ghostRawId, null, ret.ghostPath);
      ret.actualType = prototypeTypeName;
      const hostType = state.getIn(["ResourceStub", ghostHostRawId]);
      if (!hostType || (hostType === "InactiveResource")
          || state.getIn([hostType, ghostHostRawId, "id"]).isInactive()) {
        // FIXME(iridian): setInactive on materialized ghosts doesn't get properly cleared when the
        // partition becomes active. Fix that.
        ret.id.setInactive();
        ret.actualType = prototypeTypeName !== "InactiveResource" ? prototypeTypeName : typeName;
      }
      outputActions.push(created({
        id: ret.id,
        typeName: ret.actualType,
        initialState: {
          // owner: ret.owner && ret.owner.id.coupleWith("ghostOwnlings"),
          ghostPrototype: prototypeId,
          ghostOwner: vRef(ghostHostRawId, "ghostOwnlings"),
        },
        local: { noSubMaterialize: true },
      }));
    }
    return ret;
  } catch (error) {
    throw wrapError(error, `During createMaterializeGhostAction(${dumpify(ghostObjectPath)}:${
        ret.actualType}}), with:`,
        "\n\tghost host prototype:", ghostHostPrototypeRawId,
        "\n\tghost host:", ghostHostRawId,
        "\n\tghost id:", ghostRawId,
        "\n\tcurrent ret candidate:", ...dumpObject(ret), "owner:", ret.owner);
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
    throw wrapError(error, `During createImmaterializeGhostAction(${rawId}:Resource)`);
  }
}

export function isMaterialized (state: State, id: IdData): boolean {
  return !!state.getIn(["Resource", getRawIdFrom(id)]);
}
