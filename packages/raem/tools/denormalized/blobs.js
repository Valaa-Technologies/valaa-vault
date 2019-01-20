// @flow

import Bard from "~/raem/redux/Bard";
import getObjectField from "~/raem/state/getObjectField";

// TODO(iridian): Mostly unused code - evaluate the usefulness.
// The bvob coupling system was initially put in place for Bvob
// ref-counts, but this was a poor solution because downstream events
// reach Scribe before they have a chance to be reduced. So Scribe
// needs to parse these ref-counts anyway.
// Alternatively this system could add Bvob content ref-counts into
// event aspects.
export function bardCreateBvobReferenceData (bard, referrerFieldName) {
  return {
    referrerId: bard.objectId,
    referrerFieldName,
    referrerName: getObjectField(Object.create(bard), bard.objectTransient, "name"),
  };
}

export function addBvobReferenceRegisterToRootCommand (bard: Bard, contentHash: string,
    referrerFieldName: string) {
  const meta = bard.event.meta;
  if (!meta.isBeingUniversalized) return;
  const adds = meta.addedBvobReferences || (meta.addedBvobReferences = {});
  (adds[contentHash] || (adds[contentHash] = [])).push(
      bardCreateBvobReferenceData(bard, referrerFieldName));
}

export function addBvobReferenceUnregisterToRootCommand (bard: Bard, contentHash: string,
    referrerFieldName: string) {
  const meta = bard.event.meta;
  if (!meta.isBeingUniversalized) return;
  const removes = meta.removedBvobReferences || (meta.removedBvobReferences = {});
  (removes[contentHash] || (removes[contentHash] = [])).push(
      bardCreateBvobReferenceData(bard, referrerFieldName));
}
