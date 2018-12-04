// @flow

import Bard from "~/raem/redux/Bard";
import Transient from "~/raem/state/Transient";
import traverseMaterializedOwnlings from "~/raem/tools/denormalized/traverseMaterializedOwnlings";

export function isFrozen (bard: Bard, transient: Transient) {
  return transient.get("isFrozen");
}

export function universalizeFreezePartitionRoot (bard: Bard, partitionRootTransient: Transient) {
  if ((bard.rootAction.type !== "TRANSACTED") && (bard.rootAction.type !== "FROZEN")) {
    throw new Error("Cannot freeze partition root entity without a TRANSACTED rootAction");
  }
  bard.rootAction.type = "FROZEN";
  const partitionRawId = partitionRootTransient.get("id").rawId();
  if (!bard.rootAction.frozenPartitions) bard.rootAction.frozenPartitions = [];
  else if (bard.rootAction.frozenPartitions.findIndex(partitionRawId) !== -1) {
    throw new Error(`Cannot universalize partition root freeze again; ${
        partitionRawId} is already being frozen`);
  }
  bard.rootAction.frozenPartitions.push(partitionRawId);
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
