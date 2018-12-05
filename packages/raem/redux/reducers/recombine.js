// @flow

import {
  DuplicateBard, prepareDuplicationContext, postProcessDuplicationContext,
} from "~/raem/redux/reducers/construct";

export default function recombine (bard: DuplicateBard) {
  // Execute first pass, scan-and-duplicate-hierarchy by reducing all contained DUPLICATEDs
  prepareDuplicationContext(bard);
  bard.setPassages((bard.passage.actions || []).map(action => {
    const passage = bard.createPassageFromAction(action);
    const duplicateOf = passage.duplicateOf = bard.obtainReference(action.duplicateOf);
    if (!action.id
        || (action.initialState && (action.initialState.owner || action.initialState.source))
        || (action.preOverrides && (action.preOverrides.owner || action.preOverrides.source))) {
      // If the directive updates the owner we mark the new id as null:
      // this will omit the entry from the corresponding ownling field
      // side during first pass reduction.
      // Once the DUPLICATED directive itself is reduced it will set
      // the lookup id value properly and add a coupling aggregate
      // event for adding itself to the owner ownling field.
      // See duplicateFields.js:~120 with "const newFieldEntry"
      bard._duplicateIdByOriginalRawId[duplicateOf.rawId()] = null;
    } else {
      // If the DUPLICATED action has an id and is not relocated then
      // pre-initialize the lookup: this will maintain the relative
      // position of the duplicated resource in its owning field as no
      // coupling transient event will be emitted.
      if (bard.tryGoToTransientOfRawId(
          passage.id.rawId(), "ResourceStub", false, passage.id.tryGhostPath())) {
        // Existing duplicate target means an existing inactive resource
        // with incoming references etc.
        passage.id = bard.objectId;
        if (!passage.id) throw new Error("INTERNAL ERROR: no bard.objectId");
      }
      bard._duplicateIdByOriginalRawId[duplicateOf.rawId()] = passage.id;
    }
    return passage;
  }));
  bard.initiatePassageAggregation();
  bard.updateStateWithPassages();
  postProcessDuplicationContext(bard);

  // Second pass, fill-lateral-references-and-couplings by reducing
  // the aggregated sub-stories.
  return bard.updateStateWithPassages(bard.passage,
      bard.finalizeAndExtractAggregatedPassages());
}
