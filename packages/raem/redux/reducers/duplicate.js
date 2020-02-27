import { OrderedSet } from "immutable";

import VRL, { vRef } from "~/raem/VRL";
import derivedId from "~/raem/tools/derivedId";

import Transient, { createTransient, getTransientTypeName, PrototypeOfImmaterialTag }
    from "~/raem/state/Transient";

import Bard, { getActionFromPassage } from "~/raem/redux/Bard";

import { dumpify, dumpObject, invariantify } from "~/tools";
import {
  DuplicateBard,
  prepareCreateOrDuplicateObjectTransientAndId, recurseCreateOrDuplicate,
  prepareDuplicationContext, postProcessDuplicationContext,
} from "~/raem/redux/reducers/construct";

export default function duplicate (bard: DuplicateBard) {
  const passage = bard.passage;
  invariantify(!bard.passage.typeName, "DUPLICATED.typeName must be empty");
  if (passage.id === null) return bard.getState();

  const bailOut = prepareCreateOrDuplicateObjectTransientAndId(bard);
  invariantify(!bailOut, `DUPLICATED internal error:${
      ""} should never bail out due to Bvob/re-create conditions`);
  // TODO(iridian): invariantify that the type is a Resource

  bard._duplicationRootId = passage.id.rawId();

  const isInsideRecombined = bard._fieldsToPostProcess;
  let duplicateOf;
  if (isInsideRecombined) {
    duplicateOf = passage.duplicateOf;
  } else {
    prepareDuplicationContext(bard);
    duplicateOf = bard.correlateReference(getActionFromPassage(passage), passage, "duplicateOf");
  }
  // else we're a sub-action inside a RECOMBINED operation

  const newObjectId = passage.id;
  const newObjectTransient = bard.objectTransient;

  // Specifying "Resource" as opposed to "TransientFields" as this
  // requires the resource to be sourcered: Absent resources appear only
  // in absent interface and type tables.
  bard.goToTransient(duplicateOf, "Resource");
  const ghostPath = passage.id.getGhostPath();
  const typeName = passage.typeName = getTransientTypeName(bard.objectTransient, bard.schema);
  if (!ghostPath.isGhost()) {
    // original is not a ghost: only check if it is an instance for _duplicationRootPrototypeId
    const prototypeId = bard.objectTransient.get("prototype");
    bard._duplicationRootPrototypeId
        = (prototypeId && prototypeId.getCoupledField() === "instances")
            ? prototypeId.rawId()
            : null;
  } else {
    // original is a ghost: the duplication represents a direct instantiation of the ghost
    // prototype, using any materialized fields of the ghost as duplicate base initialState.
    // Any actually provided initialState takes precendence over any entries in this base.
    const previousGhostStep = ghostPath.previousGhostStep();
    bard._duplicationRootGhostHostId = ghostPath.headHostRawId();
    bard._duplicationRootPrototypeId = previousGhostStep.headRawId();
    const prototypeId = vRef(bard._duplicationRootPrototypeId, "instances", previousGhostStep);
    if (!bard.objectTransient[PrototypeOfImmaterialTag]) {
      bard.objectTransient = bard.objectTransient.set("prototype", prototypeId);
    } else {
      invariantify(passage.initialState.owner,
          `DUPLICATED: explicit initialState.owner required when duplicating an immaterialized ${
                ""}ghost: implicit ghost owner retrieval/materialization not implemented yet`);
      // TODO(iridian): this needed? mem-cpu tradeoff: found in prototype's...
      // ["owner"] // TODO(iridian): Retrieve and materialize correct owner for the ghost
      bard.objectTransient = createTransient({ typeName, prototype: prototypeId });
    }
  }
  _createDuplicate(bard, newObjectId, typeName, passage.initialState, passage.preOverrides,
      newObjectTransient);

  return isInsideRecombined
      ? bard.getState()
      : postProcessDuplicationContext(bard);
}

function _createDuplicate (bard: DuplicateBard, duplicateId: VRL, typeName: string,
    initialState: Object, preOverrides?: Object, newObjectTransient: Object) {
  // Assumes that the original ie. duplicate source object is bard.objectTransient/Id
  bard._duplicateIdByOriginalRawId[bard.objectId.rawId()] = duplicateId;
  if (!newObjectTransient) {
    bard.objectTransient = bard.objectTransient.set("id", duplicateId);
  } else {
    bard.objectTransient = bard.objectTransient.merge(newObjectTransient); // shallow merge
  }
  bard.objectId = duplicateId;
  bard.objectTypeName = typeName;
  recurseCreateOrDuplicate(bard, typeName, initialState, preOverrides);
}

// Overwrites bard.objectTransient/Intro
export function duplicateFields (bard: DuplicateBard, mutableTransient: Transient,
    fieldIntros: Array) {
  // If we have a prototype thus default values are not needed, and are not duplicating we can skip
  // field iteration.
  const ownerId = bard.objectId;
  const typeName = bard.objectTypeName;
  for (const [fieldName, originalFieldValue] of bard.objectTransient) {
    if (!originalFieldValue || (bard.fieldsTouched && bard.fieldsTouched.has(fieldName))) continue;
    const fieldIntro = fieldIntros[fieldName];
    if (!fieldIntro || !fieldIntro.isComposite) continue;
    try {
      /*
      console.log("Duplicating field:", `${String(ownerId)}.${fieldName}`,
          fieldIntro.isOwnerOf, fieldIntro.isDuplicateable, originalFieldValue);
      */
      if (!fieldIntro.isOwnerOf) {
        if (fieldIntro.isDuplicateable) {
          // Non-coupling or non-owned coupling reference: delay for post-processing but discard
          // from transient for the time being.
          bard._fieldsToPostProcess.push([ownerId, typeName, fieldIntro, originalFieldValue]);
        } // else not owned, not duplicated: just discard.
        mutableTransient.remove(fieldName);
        continue;
      }
      // isOwnerOf always implies isDuplicateable
      let newFieldValue;
      if (!fieldIntro.isSequence) {
        newFieldValue = _duplicateOwnlingField(bard, fieldIntro, originalFieldValue, ownerId);
      } else {
        newFieldValue = [];
        for (const entry of originalFieldValue) {
          const newFieldEntry = _duplicateOwnlingField(bard, fieldIntro, entry, ownerId);
          // if newFieldEntry is null, it means that we're in a recombine operation and some
          // directive explicitly either drops a sub-section fully or restructures the ownership
          // hierarchy and it will be added back in a sub-event. Drop it from list.
          if (newFieldEntry) newFieldValue.push(newFieldEntry);
        }
        newFieldValue = OrderedSet(newFieldValue);
      }
      mutableTransient.set(fieldIntro.name, newFieldValue);
    } catch (error) {
      throw bard.wrapErrorEvent(error, 1, () => [
        `duplicateFields(${fieldIntro.name})`,
        "\n\toriginalField:", originalFieldValue,
        "\n\tfieldIntro:", fieldIntro,
      ]);
    }
  }
}

function _duplicateOwnlingField (bard: Bard, fieldIntro: Object, originalRef: VRL, ownerId: VRL) {
  let originalOwnlingRawId;
  let originalGhostPath;
  let originalGhostProtoPath;
  let newObjectId;
  try {
    originalOwnlingRawId = originalRef.rawId();
    originalGhostPath = originalRef.tryGhostPath();
    const recombineOverriddenId = bard._duplicateIdByOriginalRawId[originalOwnlingRawId];
    if (typeof recombineOverriddenId !== "undefined") {
      bard.logEvent(2, () => [
        `virtually recombining to sub-directive ${
            dumpify(recombineOverriddenId, { sliceAt: 40, sliceSuffix: "..." })}:${
            bard.objectTypeName} ${
            dumpify({ duplicateOf: originalRef, initialState: { ownerId } }, { sliceAt: 380 })}`
      ]);
      return recombineOverriddenId;
    }

    originalGhostProtoPath = originalGhostPath && originalGhostPath.previousGhostStep();
    if (originalGhostProtoPath) {
      // ownlings are always direct non-ghostPathed instances or ghost ownlings: ie. an ownling
      // reference cannot be a cross-host reference with a ghost path.
      const newGhostPath = originalGhostProtoPath && originalGhostProtoPath
          .withNewGhostStep(bard._duplicationRootPrototypeId, bard._duplicationRootId);
      const newOwnlingRawId = newGhostPath
          ? newGhostPath.headRawId() // ghost instance id is deterministic by instantiation
          : derivedId(originalOwnlingRawId, "dup", bard._duplicationRootId);
      newObjectId = vRef(newOwnlingRawId, null, newGhostPath);
    }
    if (!newObjectId) {
      newObjectId = vRef(derivedId(originalOwnlingRawId, "dup", bard._duplicationRootId));
    }
    bard.tryGoToTransientOfRawId(originalOwnlingRawId, fieldIntro.namedType.name);
    if (bard.objectTransient) {
      const owner = ownerId.coupleWith(bard.objectTransient.get("owner").getCoupledField());
      // Not an immaterial ghost, ie. a material ghost or normal object: do full deep duplication
      bard.logEvent(2, () => [`Sub-reducing virtual DUPLICATED ${
          dumpify(newObjectId, { sliceAt: 40, sliceSuffix: "..." })}:${bard.objectTypeName} ${
          dumpify({ duplicateOf: originalRef, initialState: { owner } }, { sliceAt: 380 })}`
      ]);
      _createDuplicate(bard, newObjectId, bard.objectTypeName, { owner });
    }
    return newObjectId;
  } catch (error) {
    throw bard.wrapErrorEvent(error, 1, `duplicateField(${fieldIntro.name}:${
            fieldIntro.namedType.name}/${bard.objectTypeName})`,
        "\n\tfieldIntro:", ...dumpObject(fieldIntro),
        "\n\toriginalRef:", ...dumpObject(originalRef),
        "\n\toriginalGhostProtoPath:", originalGhostProtoPath,
        "\n\tnewObjectId:", ...dumpObject(newObjectId));
  }
}
