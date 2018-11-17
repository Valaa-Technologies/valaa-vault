// @flow
import { getRawIdFrom } from "~/raem/ValaaReference";
import Transient from "~/raem/tools/denormalized/Transient";
import GhostPath from "~/raem/tools/denormalized/GhostPath";
import { addDestroyCouplingPassages } from "~/raem/tools/denormalized/couplings";
import { universalizePartitionMutation } from "~/raem/tools/denormalized/partitions";

import Bard from "~/raem/redux/Bard";

import wrapError from "~/tools/wrapError";
import { invariantifyObject } from "~/tools/invariantify";

const allowedHiddenFields = { typeName: true };

export default function destroy (bard: Bard) {
  let transient: Object;
  try {
    transient = bard.goToTransientOfActionObject({ require: true, typeName: "Resource" });
    const objectTypeIntro = bard.goToResourceTypeIntro();
    const partitionURI = universalizePartitionMutation(bard, bard.objectId);
    bard.destroyedResourcePartition = partitionURI && partitionURI.toString();
    const resourceFieldIntros = objectTypeIntro.getFields();
    transient.forEach((fieldValue, fieldName) => {
      // Need to process non-default fields only ie. those in store: only they can have couplings.
      if (!fieldValue) return;
      if ((fieldName !== "owner") || !(bard.passage.local || {}).dontUpdateCouplings) {
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
    const rawId = getRawIdFrom(bard.passage.id);
    bard.obtainResourceChapter(rawId).destroyed = true;
    removeGhostElevationsFromPrototypeChain(bard, bard.passage.id.getGhostPath(), transient);
    bard.updateStateWithPassages();
    bard.updateStateWith(state => (objectTypeIntro.getInterfaces() || [])
        .reduce((innerState, classInterface) => innerState.deleteIn([classInterface.name, rawId]),
            state));
    return bard.updateStateWith(state => state.deleteIn([objectTypeIntro.name, rawId]));
  } catch (error) {
    throw wrapError(error, `During ${bard.debugId()}\n .destroy(), with:`,
        "\n\towner:", transient && transient.get("owner"));
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
  const prototype = bard.goToTransientOfId(prototypeId, "Resource");
  prototype.get("id").getGhostPath().removeGhostElevation(destroyedPath);
  removeGhostElevationsFromPrototypeChain(bard, destroyedPath, prototype);
}
