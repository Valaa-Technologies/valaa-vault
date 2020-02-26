// @flow

import Bard from "~/raem/redux/Bard";
import Transient from "~/raem/state/Transient";
import traverseMaterializedOwnlings from "~/raem/tools/denormalized/traverseMaterializedOwnlings";

export function isFrozen (bard: Bard, transient: Transient) {
  return transient.get("isFrozen");
}

export function universalizeFreezeChronicleRoot (bard: Bard, partitionRootTransient: Transient) {
  if ((bard.event.type !== "TRANSACTED") && (bard.event.type !== "FROZEN")) {
    throw new Error("Cannot freeze chronicle root entity without a TRANSACTED event");
  }
  bard.event.type = "FROZEN";
  const partitionRawId = partitionRootTransient.get("id").rawId();
  if (!bard.event.frozenPartitions) bard.event.frozenPartitions = [];
  else if (bard.event.frozenPartitions.findIndex(partitionRawId) !== -1) {
    throw new Error(`Cannot universalize chronicle root freeze again; ${
        partitionRawId} is already being frozen`);
  }
  bard.event.frozenPartitions.push(partitionRawId);
}

export function freezeOwnlings (bard: Bard, transient: Transient) {
  return bard.getState().withMutations(mutableState => {
    const freezeBard = Object.create(bard);
    traverseMaterializedOwnlings(freezeBard, transient, entryId => {
      if (freezeBard.tryGoToTransientOfRawId(entryId.rawId(), "Resource")) {
        mutableState.setIn([freezeBard.objectTypeName, entryId.rawId(), "isFrozen"], true);
        return freezeBard.objectTransient;
      }
      return null;
    });
  });
}
