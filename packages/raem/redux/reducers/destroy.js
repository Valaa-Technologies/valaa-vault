// @flow

import GhostPath from "~/raem/state/GhostPath";
import Transient from "~/raem/state/Transient";

import { addDestroyCouplingPassages } from "~/raem/tools/denormalized/couplings";
import { universalizeChronicleMutation } from "~/raem/tools/denormalized/partitions";

import Bard from "~/raem/redux/Bard";

import { invariantifyObject, dumpObject } from "~/tools";

const allowedHiddenFields = { typeName: true };

export default function destroy (bard: Bard) {
  let transient, rawId, objectTypeIntro;
  const passage = bard.passage;
  try {
    rawId = passage.id.rawId();
    transient = bard.goToTransientOfPassageObject("Resource", true, true); // require, ghost-lookup
    objectTypeIntro = bard.goToResourceTransientTypeIntro(transient);
    const chronicleURI = universalizeChronicleMutation(bard, passage.id);
    bard.destroyedResourceChronicle = chronicleURI;
    const resourceFieldIntros = objectTypeIntro.getFields();
    transient.forEach((fieldValue, fieldName) => {
      // Need to process non-default fields only ie. those in store: only they can have couplings.
      if (!fieldValue) return;
      if ((fieldName !== "owner") || !passage.meta || (passage.meta.updateCouplings !== false)) {
        const fieldIntro = resourceFieldIntros[fieldName];
        if (!fieldIntro) {
          if (allowedHiddenFields[fieldName]) return;
          invariantifyObject(fieldIntro, "destroy.fieldIntro", {},
              "\n\ttype", objectTypeIntro.name,
              "\n\tfieldName:", fieldName);
        }
        addDestroyCouplingPassages(bard, fieldIntro, fieldValue);
      }
    });
    bard.obtainResourceChapter(rawId).destroyed = true;
    removeGhostElevationsFromPrototypeChain(bard, passage.id.getGhostPath(), transient);
    bard.updateStateWithPassages();
    const destroyedTypeName = bard.schema.destroyedType.name;
    return bard.updateStateWith(state => {
      const destroyedTransient = state.getIn([objectTypeIntro.name, rawId]);
      if (passage.id.isGhost()) {
        if (!destroyedTransient) return state; // redundant ghost immaterialization
        return (objectTypeIntro.getInterfaces() || [])
            .reduce((subState, interface_) => subState.deleteIn([interface_.name, rawId]), state)
            .deleteIn([objectTypeIntro.name, rawId]);
      }
      return (objectTypeIntro.getInterfaces() || [])
          .reduce(
              (subState, interface_) => subState.setIn([interface_.name, rawId], destroyedTypeName),
              state)
          .deleteIn([objectTypeIntro.name, rawId])
          .setIn([destroyedTypeName, rawId], destroyedTransient.set("typeName", destroyedTypeName));
    });
  } catch (error) {
    throw bard.wrapErrorEvent(error, 1, () => [
      `destroy(${rawId})`,
      "\n\tid:", passage.id,
      "\n\towner:", transient && transient.get("owner"),
      "\n\ttransient:", ...dumpObject(transient),
      "\n\tintro type:", objectTypeIntro.name,
    ]);
  }
}

/**
 * Clears the destroyed object GhostElevation's from the caches of its prototypes.
 *
 * @param {Bard} bard
 * @param {GhostPath} destroyedPath
 * @param {Transient} object
 * @returns
 */
function removeGhostElevationsFromPrototypeChain (bard: Bard, destroyedPath: GhostPath,
    object: Transient) {
  const prototypeId = object.get("prototype");
  if (!prototypeId) return;
  const prototype = bard.goToTransient(prototypeId, "Resource");
  prototype.get("id").getGhostPath().removeGhostElevation(destroyedPath);
  removeGhostElevationsFromPrototypeChain(bard, destroyedPath, prototype);
}
