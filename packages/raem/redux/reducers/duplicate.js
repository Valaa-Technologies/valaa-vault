import { OrderedSet } from "immutable";

import { VRef, vRef, expandIdDataFrom } from "~/raem/ValaaReference";

import Transient, { createTransient, getTransientTypeName, PrototypeOfImmaterialTag }
    from "~/raem/state/Transient";

import Bard from "~/raem/redux/Bard";

import { derivedId, dumpify, dumpObject, invariantify, wrapError } from "~/tools";
import {
  DuplicateBard,
  prepareCreateOrDuplicateObjectTransientAndId, recurseCreateOrDuplicate,
  prepareDuplicationContext, postProcessDuplicationContext,
} from "~/raem/redux/reducers/construct";

export default function duplicate (bard: DuplicateBard) {
  const passage = bard.passage;
  invariantify(!bard.passage.typeName, "DUPLICATED.typeName must be empty");
  if (passage.id === null) return bard.getState();

  const bailOut = prepareCreateOrDuplicateObjectTransientAndId(bard, "TransientFields");
  invariantify(!bailOut, `DUPLICATED internal error:${
      ""} should never bail out due to Bvob/re-create conditions`);
  // TODO(iridian): invariantify that the type is a Resource

  bard._duplicationRootId = passage.id.rawId();

  const isInsideRecombined = bard._fieldsToPostProcess;
  if (!isInsideRecombined) prepareDuplicationContext(bard);
  // else we're a sub-action inside a RECOMBINED operation

  const newObjectId = passage.id;
  const newObjectTransient = bard.objectTransient;

  const duplicateOf = passage.duplicateOf = bard.obtainReference(passage.duplicateOf);
  // Specifying "Resource" as opposed to "TransientFields" as this
  // requires the resource to be active: Inactive resources appear only
  // in inactive interface and type tables.
  bard.goToObjectIdTransient(duplicateOf, "Resource");
  const ghostPath = passage.id.getGhostPath();
  passage.typeName = getTransientTypeName(bard.objectTransient, bard.schema);
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
    const previousGhostStep = ghostPath.previousStep();
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
      bard.objectTransient = createTransient(
          { typeName: bard.objectTypeName, prototype: prototypeId });
    }
  }
  _createDuplicate(bard, newObjectId, passage.initialState, passage.preOverrides,
      newObjectTransient);

  return isInsideRecombined
      ? bard.getState()
      : postProcessDuplicationContext(bard);
}

function _createDuplicate (bard: DuplicateBard, duplicateId: VRef, initialState: Object,
    preOverrides?: Object, newObjectTransient: Object) {
  // Assumes that the original ie. duplicate source object is bard.objectTransient/Id
  bard._duplicateIdByOriginalRawId[bard.objectId.rawId()] = duplicateId;
  if (!newObjectTransient) {
    bard.objectTransient = bard.objectTransient.set("id", duplicateId);
  } else {
    bard.objectTransient = bard.objectTransient.merge(newObjectTransient); // shallow merge
  }
  bard.objectId = duplicateId;
  recurseCreateOrDuplicate(bard, initialState, preOverrides);
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
          fieldIntro.isOwner, fieldIntro.isDuplicateable, originalFieldValue);
      */
      if (!fieldIntro.isOwner) {
        if (fieldIntro.isDuplicateable) {
          // Non-coupling or non-owned coupling reference: delay for post-processing but discard
          // from transient for the time being.
          bard._fieldsToPostProcess.push([ownerId, typeName, fieldIntro, originalFieldValue]);
        } // else not owned, not duplicated: just discard.
        mutableTransient.remove(fieldName);
        continue;
      }
      // isOwner always implies isDuplicateable
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
      throw wrapError(error, `During ${bard.debugId()}\n .duplicateFields(${
              fieldIntro.name}), with:`,
          "\n\toriginalField:", originalFieldValue,
          "\n\tfieldIntro:", fieldIntro);
    }
  }
}

function _duplicateOwnlingField (bard: Bard, fieldIntro: Object, originalIdData: any,
    ownerId: VRef) {
  let originalOwnlingRawId;
  let originalGhostPath;
  let originalGhostProtoPath;
  let newObjectId;
  try {
    ([originalOwnlingRawId, , originalGhostPath] = expandIdDataFrom(originalIdData));
    const recombineOverriddenId = bard._duplicateIdByOriginalRawId[originalOwnlingRawId];
    if (typeof recombineOverriddenId !== "undefined") {
      if (bard.getVerbosity() >= 2) {
        bard.logEvent(`virtually recombining to sub-directive ${
          dumpify(recombineOverriddenId, { sliceAt: 40, sliceSuffix: "..." })}:${
          bard.objectTypeName} ${
          dumpify({ duplicateOf: originalIdData, initialState: { ownerId } }, { sliceAt: 380 })
        }`);
      }
      return recombineOverriddenId;
    }

    originalGhostProtoPath = originalGhostPath && originalGhostPath.previousStep();
    if (originalGhostProtoPath) {
      // ownlings are always direct non-ghostPathed instances or ghost ownlings: ie. an ownling
      // reference cannot be a cross-host reference with a ghost path.
      const newGhostPath = originalGhostProtoPath && originalGhostProtoPath
          .withNewGhostStep(bard._duplicationRootPrototypeId, bard._duplicationRootId);
      const newOwnlingRawId = newGhostPath
          ? newGhostPath.headRawId() // ghost instance id is deterministic by instantiation
          : derivedId(originalOwnlingRawId, "_duplicationRootId", bard._duplicationRootId);
      newObjectId = vRef(newOwnlingRawId, null, newGhostPath);
    }
    if (!newObjectId) {
      newObjectId = vRef(
          derivedId(originalOwnlingRawId, "_duplicationRootId", bard._duplicationRootId));
    }
    bard.tryGoToTransientOfRawId(originalOwnlingRawId, fieldIntro.namedType.name);
    if (bard.objectTransient) {
      const owner = ownerId.coupleWith(bard.objectTransient.get("owner").getCoupledField());
      // Not an immaterial ghost, ie. a material ghost or normal object: do full deep duplication
      if (bard.getVerbosity() >= 2) {
        bard.logEvent(`Sub-reducing virtual DUPLICATED ${
          dumpify(newObjectId, { sliceAt: 40, sliceSuffix: "..." })}:${bard.objectTypeName} ${
          dumpify({ duplicateOf: originalIdData, initialState: { owner } }, { sliceAt: 380 })
        }`);
      }
      _createDuplicate(bard, newObjectId, { owner });
    }
    return newObjectId;
  } catch (error) {
    throw bard.wrapErrorEvent(error, `duplicateField(${fieldIntro.name}:${
            fieldIntro.namedType.name})`,
        "\n\tfieldIntro:", ...dumpObject(fieldIntro),
        "\n\toriginalIdData:", ...dumpObject(originalIdData),
        "\n\toriginalGhostProtoPath:", originalGhostProtoPath,
        "\n\tnewObjectId:", ...dumpObject(newObjectId));
  }
}
