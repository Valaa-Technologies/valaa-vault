// @flow

import { OrderedMap, is } from "immutable";

import { isCreatedLike } from "~/raem/events";
import ValaaReference, { getRawIdFrom } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";

import { elevateFieldRawSequence, takeToCurrentObjectOwnerTransient } from "~/raem/state/FieldInfo";
import getObjectField, { fillFieldInfoAndResolveAliases }
    from "~/raem/state/getObjectField";
import { separatePartialSequence, combineAsPartialSequence, shouldAddAsPartialRemove }
    from "~/raem/state/partialSequences";

import { addCoupleCouplingPassages, addUncoupleCouplingPassages, getCoupling }
    from "~/raem/tools/denormalized/couplings";
import { universalizePartitionMutation,
    setModifiedObjectPartitionAndUpdateOwneeObjectIdPartitions }
    from "~/raem/tools/denormalized/partitions";
import { isFrozen, universalizeFreezePartitionRoot, freezeOwnlings }
    from "~/raem/tools/denormalized/freezes";
import { createMaterializeTransientAction } from "~/raem/tools/denormalized/ghost";

import Bard from "~/raem/redux/Bard";

import { invariantify, wrapError } from "~/tools";

// TODO(iridian): Well. MODIFIED is stupid, it should be four (or more)
// different actions: FIELDS_SET, ADDED_TO, REMOVED_FROM, REPLACED_WITHIN.
// Having them be part of the same action doesn't really give any added
// value. If grouping is needed TRANSACTED can be used. I guess the
// design predates TRANSACTED, however even before there were no use
// cases for a modification that contains different modalities. Lament.
// TODO(iridian): The above-mentioned action types have now been
// introduced but the actual execution path still uses the unified
// MODIFIED pathway. Validators exclude multiples of sets, adds and
// removes from being specified in a command now, but maybe there's
// more to do.
// NOTE(iridian-2018-11): MODIFIED is now externally hidden as of event version "0.2".
/**
 *  Elementary modify operation, for changing the properties of a Resource object.
 *  Sub-operation order is not specified; two sub-operations shall not modify the same field.
 *  Fully exposed to the internal denormalized representation and thus a huge attack surface.
 *  Should eventually be removed from public API or at the very least very strictly validated.
 */
export default function modifyResource (bard: Bard) {
  const passage = bard.passage;
  try {
    bard.shouldUpdateCouplings = !(passage.local || {}).dontUpdateCouplings;
    bard.denormalized = {};
    bard.fieldsTouched = new Set();
    bard.goToTransientOfPassageObject(); // no-require, non-ghost-lookup
    if (!bard.objectTransient) { // ghost, inactive transient or fail
      const materializeGhostSubCommand = createMaterializeTransientAction(
          bard, passage.id.getGhostPath(), passage.typeName);
      bard.updateState(bard.subReduce(bard.state, materializeGhostSubCommand));
      bard.goToTransientOfRawId(passage.id.rawId());
      passage.id = bard.objectId;
      if (!passage.id) throw new Error("INTERNAL ERROR: no bard.objectId");
    }
    bard.goToResourceTransientTypeIntro(bard.objectTransient);

    invariantify(OrderedMap.isOrderedMap(bard.objectTransient),
        "object Transient must be an OrderedMap");
    let isPrimaryMutation = false;
    const wasFrozen = isFrozen(bard, bard.objectTransient); // transient modifications are allowed.
    const newResource = bard.objectTransient.withMutations(mutableObject => {
      if (passage.sets) {
        isPrimaryMutation = processUpdate(bard,
            passage.sets, handleSets, "FIELDS_SET.sets", mutableObject)
                || isPrimaryMutation;
      }
      if (passage.removes) {
        isPrimaryMutation = processUpdate(bard,
            passage.removes, handleRemoves, "REMOVED_FROM.removes", mutableObject)
                || isPrimaryMutation;
      }
      if (passage.adds) {
        isPrimaryMutation = processUpdate(bard,
            passage.adds, handleAdds, "ADDED_TO.adds", mutableObject)
                || isPrimaryMutation;
      }
      if (bard.refreshPartition) {
        setModifiedObjectPartitionAndUpdateOwneeObjectIdPartitions(bard, mutableObject);
        bard.refreshPartition = false;
      }
      return mutableObject;
    });
    if (isPrimaryMutation) {
      if (wasFrozen) {
        throw new Error(`Cannot modify frozen ${passage.id.rawId()}:${passage.typeName}`);
      }
      universalizePartitionMutation(bard, passage.id);
    }
    return bard.updateStateWith(state =>
        state.setIn([bard.objectTypeIntro.name, passage.id.rawId()], newResource));
  } catch (error) {
    throw wrapError(error, `During ${bard.debugId()}\n .modifyResource(), with:`,
        "\n\tpassage:", passage,
        "\n\ttransient:", bard.objectTransient,
        "\n\tbard:", bard);
  }
}

/**
 * Applies the contents of given updatesByField to all contained fields
 * against given mutableObject.
 *
 * @export
 * @param {Bard} bard
 * @param {any} updatesByField
 * @param {any} handleFieldUpdate
 * @param {any} operationDescription
 * @param {any} mutableObject
 * @returns
 */
export function processUpdate (bard: Bard, updatesByField, handleFieldUpdate,
    operationDescription, mutableObject) {
  const sortedKeys = Object.keys(updatesByField || {}).sort();
  let isPrimaryMutation = false;
  const isBeingUniversalized = bard.story.isBeingUniversalized;
  for (const fieldName of sortedKeys) {
    const fieldUpdate = updatesByField[fieldName];
    if (fieldUpdate === undefined) {
      if (isCreatedLike(bard.passage)) continue;
      bard.error(`Invalid ${operationDescription}, trying to update ${
          bard.objectTypeIntro.name}.${fieldName
          } with 'undefined' (use MODIFIED.removes instead)`);
      return false;
    }
    const fieldInfo = {
      name: fieldName,
      elevationInstanceId: bard.objectId,
      intro: undefined,
      skipAliasPostProcess: true
    };
    let oldLocalValue;
    let updateCoupling;
    try {
      fillFieldInfoAndResolveAliases(
          bard.objectTransient, bard.objectTypeIntro.getFields(), fieldInfo);
      if (!isCreatedLike(bard.passage)) {
        oldLocalValue = mutableObject.get(fieldInfo.name);
      }
      updateCoupling = bard.shouldUpdateCouplings && getCoupling(fieldInfo.intro);
      if (!validateFieldUpdate(bard, fieldInfo.intro, fieldUpdate, operationDescription)) continue;
      if (fieldInfo.intro.isPersisted && !fieldInfo.intro.isOwned) {
        // don't mark owning relation updates as primary, so that
        // frozen resources can still be moved
        isPrimaryMutation = true;
      }
      bard.fieldsTouched.add(fieldInfo.name);
      const newValue = handleFieldUpdate(
          bard, fieldInfo, fieldUpdate, oldLocalValue, updateCoupling, updatesByField);
      if (isBeingUniversalized && (newValue instanceof ValaaReference)) {
        updatesByField[fieldInfo.name] = newValue.toJSON();
        // Remove alias original
        if (fieldInfo.name !== fieldName) delete updatesByField[fieldName];
      }

      if (newValue === undefined) mutableObject.delete(fieldInfo.name);
      else mutableObject.set(fieldInfo.name, newValue);
    } catch (error) {
      const aliasInfo = fieldInfo.name !== fieldName ? ` (via its alias '${fieldName}')` : "";
      throw wrapError(error, `During ${bard.debugId()}\n .${operationDescription} on field ${
              bard.objectTypeIntro.name}.${fieldInfo.name}${aliasInfo}, with:`,
          "\n\told value:", oldLocalValue,
          "\n\tfield update:", fieldUpdate,
          "\n\tupdate coupling:", updateCoupling,
          "\n\tbard:", bard);
    }
  }
  return isPrimaryMutation;
}

export function validateFieldUpdate (bard: Bard, fieldIntro, fieldUpdate, operationDescription) {
  let ret = true;
  if (fieldIntro.deprecated || fieldIntro.isGenerated) {
    if (!fieldUpdate || (Array.isArray(fieldUpdate) && !fieldUpdate.length)) {
      // bard.warn(`Skipping ${operationDescription} on a deprecated/generated field ${
      //    bard.objectTypeIntro.name}.${fieldIntro.name} with defaulty value:`, fieldUpdate);
      bard.info(`Skipping ${operationDescription} on a deprecated/generated field (name ${
          bard.objectTypeIntro.name}.${fieldIntro.name
              } hidden to allow browser log collapsing) with defaulty value`);
      ret = false;
    } else if (fieldIntro.isGenerated) { // If generated, we'll be throwing an error below
      bard.info(`Performing ${operationDescription} on a generated field ${
          bard.objectTypeIntro.name}.${fieldIntro.name} with non-defaulty value:`, fieldUpdate);
      ret = false;
    } else {
      bard.errorEvent(`Performing ${operationDescription} on a deprecated field ${
          bard.objectTypeIntro.name}.${fieldIntro.name} with non-defaulty value`, fieldUpdate);
    }
  }
  return ret;
}

function handleAdds (bard: Bard, fieldInfo, adds, oldLocalValue, updateCoupling) {
  const fieldAdds = [];
  const fieldMoves = [];
  const { valueAsSet: oldLocalSequence, removeDiffs } = separatePartialSequence(oldLocalValue);
  const newLocalSequence = bard.deserializeAndReduceOntoField(adds, fieldInfo, (acc, entry) => {
    if (!oldLocalSequence.has(entry)) {
      fieldAdds.push(entry);
      return acc.add(entry);
    } else if (bard.shouldUpdateCouplings) {
      // reorder existing entry to end as per ADDED_TO contract unless we're in a coupling update
      fieldMoves.push(entry);
      return acc.remove(entry).add(entry);
    }
    return acc;
  }, oldLocalSequence);
  if (fieldAdds.length) {
    (bard.passage.actualAdds || (bard.passage.actualAdds = new Map()))
        .set(fieldInfo.name, fieldAdds);
  }
  if (fieldMoves.length) {
    (bard.passage.actualMoves || (bard.passage.actualMoves = new Map()))
        .set(fieldInfo.name, fieldMoves);
  }
  if (updateCoupling) {
    addCoupleCouplingPassages(bard, fieldInfo.intro, fieldAdds, true);
  }
  return combineAsPartialSequence(newLocalSequence, removeDiffs);
}

function handleRemoves (bard: Bard, fieldInfo, removes, oldLocalValue, updateCoupling) {
  const fieldRemoves = [];
  let newLocalValue;
  let removeDiffs;
  if (removes === null) {
    // Remove whole property. This is the only allowed operation for non-sequences.
    if (!fieldInfo.intro.isSequence) fieldRemoves.push(oldLocalValue);
    else if (oldLocalValue) fieldRemoves.push(...oldLocalValue);
    newLocalValue = undefined;
  } else {
    let oldLocalSequence;
    // eslint-disable-next-line
    ({ valueAsSet: oldLocalSequence, removeDiffs } = separatePartialSequence(oldLocalValue));
    newLocalValue = bard.deserializeAndReduceOntoField(removes, fieldInfo, (acc, entry) => {
      if (removeDiffs && shouldAddAsPartialRemove(entry)) removeDiffs = removeDiffs.add(entry);
      if (!acc.has(entry)) return acc;
      fieldRemoves.push(entry);
      return acc.remove(entry);
    }, oldLocalSequence);
  }
  if (fieldRemoves.length) {
    (bard.passage.actualRemoves || (bard.passage.actualRemoves = new Map()))
        .set(fieldInfo.name, fieldRemoves);
  }
  if (updateCoupling) {
    addUncoupleCouplingPassages(bard, fieldInfo.intro, fieldRemoves, true);
  }
  if (!fieldInfo.intro.isSequence) return newLocalValue;
  return combineAsPartialSequence(newLocalValue, removeDiffs);
}

export function handleSets (bard: Bard, fieldInfo, value, oldLocalValue, updateCoupling) {
  const isCreated = isCreatedLike(bard.passage);
  const isSequence = fieldInfo.intro.isSequence;
  const newValue = Object.create(bard).deserializeField(value, fieldInfo);
  const fieldAdds = [];
  const fieldRemoves = [];
  const universalizedFieldRemoves = [];
  let oldCompleteValue;
  if (bard.story.isBeingUniversalized && fieldInfo.intro.isResource) {
    if (!isCreated && (isSequence || (oldLocalValue === undefined))) {
      // For universalisation we need to create the sub-actions for
      // cross-partition modifications, and for that we need to have
      // access to the actual previous value of the field. Absolutized
      // commands and truths will already have sub-actions present to
      // make cross-partition updates.
      oldCompleteValue = !isSequence
          ? getObjectField(Object.create(bard), bard.objectTransient, fieldInfo.name,
              Object.create(fieldInfo))
          : elevateFieldRawSequence(bard, oldLocalValue, fieldInfo, bard.objectTransient);
    }
  }

  if (!isSequence) {
    if (!is(newValue, oldLocalValue)) {
      if (newValue && bard.shouldUpdateCouplings) fieldAdds.push(newValue);
      // If both oldLocalValue and new value are set we must update the old value coupling even if
      // we're in a dontUpdateCouplings passage. This is because the target of the old value is
      // possibly in a different object than the originating update passage.
      if ((oldLocalValue || oldCompleteValue) && (bard.shouldUpdateCouplings || newValue)) {
        if (oldLocalValue !== undefined) {
          fieldRemoves.push(oldLocalValue);
        } else {
          universalizedFieldRemoves.push(oldCompleteValue);
        }
      }
    }
  } else {
    _extractListAddsAndRemoves(newValue, oldLocalValue, oldCompleteValue, fieldAdds, fieldRemoves,
        universalizedFieldRemoves);
  }
  if (!isCreated) {
    if (fieldAdds.length) {
      (bard.passage.actualAdds || (bard.passage.actualAdds = new Map()))
          .set(fieldInfo.name, fieldAdds);
    }
    if (fieldRemoves.length || universalizedFieldRemoves.length) {
      (bard.passage.actualRemoves || (bard.passage.actualRemoves = new Map()))
          .set(fieldInfo.name, fieldRemoves.concat(universalizedFieldRemoves));
    }
  }
  const customHandler = customSetFieldHandlers[fieldInfo.name];
  if (customHandler) customHandler(bard, fieldInfo, value, newValue, oldLocalValue);
  if (updateCoupling) {
    addCoupleCouplingPassages(bard, fieldInfo.intro, fieldAdds, true);
    addUncoupleCouplingPassages(bard, fieldInfo.intro, fieldRemoves, true);
    // TODO: universalize this
    addUncoupleCouplingPassages(bard, fieldInfo.intro, universalizedFieldRemoves, true);
  }
  // Set will discard RemoveDiffs: all inherited values have either been made explicit by the set
  // itself or considered removed from the list.
  return newValue;
}

const customSetFieldHandlers = {
  prototype (bard: Bard, fieldInfo: Object, value: any) {
    // This is a naive check for simple self-recursion but doesn't protect against deeper cycles.
    invariantify(!value || (getRawIdFrom(value) !== bard.objectId.rawId()),
        "prototype self-recursion for %s", bard.objectTransient);
  },
  owner (bard: Bard, fieldInfo: Object, value: any, newOwnerId: any) {
    if ((newOwnerId && newOwnerId.getPartitionURI()) !== bard.objectId.getPartitionURI()) {
      bard.refreshPartition = true;
    }
    let i = 0;
    if (newOwnerId) {
      const ownerBard = Object.create(bard);
      for (ownerBard.tryGoToTransient(newOwnerId, "Resource"); ownerBard.objectId;
          takeToCurrentObjectOwnerTransient(ownerBard), ++i) {
        if (ownerBard.objectId.rawId() === bard.objectId.rawId()) {
          throw new Error(`Cyclic ownership not allowed while trying to set owner of ${
              bard.objectId} to ${newOwnerId} (which would make it its own ${
              !i ? "parent)" : `${"grand".repeat(i)}parent)`}`);
        }
      }
    }
  },
  partitionAuthorityURI (bard: Bard, fieldInfo: Object, newPartitionAuthorityURIString: ?string) {
    const newPartitionURI = newPartitionAuthorityURIString &&
        createPartitionURI(newPartitionAuthorityURIString, bard.objectId.rawId());
    const oldPartitionURI = bard.objectId.getPartitionURI();
    if ((newPartitionURI && newPartitionURI.toString()) !==
        (oldPartitionURI && oldPartitionURI.toString())) {
      bard.refreshPartition = true;
    }
  },
  isFrozen (bard: Bard, fieldInfo: Object, value: any, newValue: any, oldLocalValue: any) {
    if (typeof value !== "boolean") {
      throw new Error(`Trying to set isFrozen to a non-boolean type '${typeof value}'`);
    }
    if ((oldLocalValue !== true) && (newValue === true)) {
      if (bard.story.isBeingUniversalized && bard.objectTransient.get("partitionAuthorityURI")) {
        universalizeFreezePartitionRoot(bard, bard.objectTransient);
      }
      bard.setState(freezeOwnlings(bard, bard.objectTransient));
    }
  }
};

function _extractListAddsAndRemoves (newSeq, oldLocalValues, oldCompleteValues,
    actualAdds, fieldRemoves, universalizedRemoves, removeDiffs) {
  // TODO(iridian): Investigate whether this is actually the semantics we want.
  // TODO(iridian): Each list mutation is now O(nlogn) so that's less than ideal.
  const newLookup = newSeq && newSeq.toSetSeq();
  let ret = removeDiffs;
  if (oldLocalValues) {
    oldLocalValues.forEach(entry => {
      if (!newLookup || !newLookup.has(entry)) {
        fieldRemoves.push(entry);
        if (ret && shouldAddAsPartialRemove(entry)) ret = ret.add(entry);
      }
    });
  }
  if (newLookup) {
    newLookup.forEach(value => {
      if (!oldLocalValues || !oldLocalValues.has(value)) actualAdds.push(value);
    });
  }
  return ret;
}
