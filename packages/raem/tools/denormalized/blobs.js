import Bard from "~/raem/redux/Bard";
import getObjectField from "~/raem/tools/denormalized/getObjectField";

export function bardCreateBvobReferenceData (bard, referrerFieldName) {
  return {
    referrerId: bard.objectId,
    referrerFieldName,
    referrerName: getObjectField(Object.create(bard), bard.objectTransient, "name"),
  };
}

export function addBvobReferenceRegisterToRootCommand (bard: Bard, bvobId: string,
    referrerFieldName: string) {
  if (!bard.story.isBeingUniversalized) return;
  const adds = bard.rootAction.addedBvobReferences
      || (bard.rootAction.addedBvobReferences = {});
  (adds[bvobId] || (adds[bvobId] = [])).push(
      bardCreateBvobReferenceData(bard, referrerFieldName));
}

export function addBvobReferenceUnregisterToRootCommand (bard: Bard, bvobId: string,
    referrerFieldName: string) {
  if (!bard.story.isBeingUniversalized) return;
  const removes = bard.rootAction.removedBvobReferences
      || (bard.rootAction.removedBvobReferences = {});
  (removes[bvobId] || (removes[bvobId] = [])).push(
      bardCreateBvobReferenceData(bard, referrerFieldName));
}
