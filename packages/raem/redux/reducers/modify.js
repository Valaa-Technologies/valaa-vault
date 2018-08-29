import { List, OrderedMap, OrderedSet, Set, is } from "immutable";
import { GraphQLObjectType } from "graphql/type";

import { isCreatedLike } from "~/raem/command";
import { getRawIdFrom } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";

import getObjectField, { fillFieldInfoAndResolveAliases }
    from "~/raem/tools/denormalized/getObjectField";
import { elevateFieldRawSequence, takeToCurrentObjectOwnerTransient }
    from "~/raem/tools/denormalized/FieldInfo";
import { addCoupleCouplingPassages, addUncoupleCouplingPassages, getCoupling }
    from "~/raem/tools/denormalized/couplings";
import { universalizePartitionMutation,
    setModifiedObjectPartitionAndUpdateOwneeObjectIdPartitions }
    from "~/raem/tools/denormalized/partitions";
import { isFrozen, universalizeFreezePartitionRoot, freezeOwnlings }
    from "~/raem/tools/denormalized/freezes";
import { createMaterializeGhostPathAction } from "~/raem/tools/denormalized/ghost";
import { separatePartialSequence, combineAsPartialSequence, shouldAddAsPartialRemove }
    from "~/raem/tools/denormalized/partialSequences";

import Bard from "~/raem/redux/Bard";

import { dumpify, dumpObject, invariantify, invariantifyString, wrapError } from "~/tools";

// TODO(iridian): Well. MODIFIED is stupid, it should be four (or more) different actions:
// FIELDS_SET, ADDED_TO, REMOVED_FROM, REPLACED_WITHIN, SPLICED.
// Having them be part of the same action doesn't really give any added value. If grouping is
// needed TRANSACTED can be used. I guess the design predates TRANSACTED, however even before there
// were no use cases for a modification that contains different modalities. Lament.
// TODO(iridian): The above-mentioned action types have now been introduced but the actual execution
// path still uses the unified MODIFIED pathway. Validators exclude multiples of sets, adds, removes
// and splices from being specified in a command now, but maybe there's more to do.
/**
 *  Elementary modify operation, for changing the properties of a Resource object.
 *  Sub-operation order is not specified; two sub-operations shall not modify the same field.
 *  Fully exposed to the internal denormalized representation and thus a huge attack surface.
 *  Should eventually be removed from public API or at the very least very strictly validated.
 */
export default function modifyResource (bard: Bard) {
  try {
    const objectId = bard.getPassageObjectId();
    bard.shouldUpdateCouplings = !bard.passage.dontUpdateCouplings;
    bard.denormalized = {};
    bard.fieldsTouched = new Set();
    bard.tryGoToTransientOfRawId(objectId.rawId(), bard.passage.typeName);
    if (!bard.objectTransient) {
      const materializeGhostSubCommand = createMaterializeGhostPathAction(
          bard.state, objectId.getGhostPath(), bard.passage.typeName);
      bard.updateState(bard.subReduce(bard.state, materializeGhostSubCommand));
      bard.goToTransientOfRawId(objectId.rawId());
    }
    bard.goToResourceTypeIntro();

    bard.passage.id = bard.objectId;
    invariantify(OrderedMap.isOrderedMap(bard.objectTransient),
        "object Transient must be an OrderedMap");
    let mutatesPartition = false;
    const wasFrozen = isFrozen(bard, bard.objectTransient); // transient modifications are allowed.
    const newResource = bard.objectTransient.withMutations(mutableObject => {
      if (bard.passage.sets) {
        mutatesPartition =
            processUpdate(bard, bard.passage.sets, handleSets, "MODIFIED.sets", mutableObject)
            || mutatesPartition;
      }
      if (bard.passage.removes) {
        mutatesPartition =
            processUpdate(bard, bard.passage.removes, handleRemoves, "MODIFIED.removes",
                mutableObject)
            || mutatesPartition;
      }
      if (bard.passage.adds) {
        mutatesPartition =
            processUpdate(bard, bard.passage.adds, handleAdds, "MODIFIED.adds", mutableObject)
            || mutatesPartition;
      }
      if (bard.passage.splices) {
        mutatesPartition =
            processUpdate(bard, bard.passage.splices, handleSplices, "MODIFIED.splices",
                mutableObject)
            || mutatesPartition;
      }
      if (bard.refreshPartition) {
        setModifiedObjectPartitionAndUpdateOwneeObjectIdPartitions(bard, mutableObject);
        bard.refreshPartition = false;
      }
      return mutableObject;
    });
    if (mutatesPartition) {
      if (wasFrozen) {
        throw new Error(`Cannot modify frozen ${bard.objectId.rawId()}:${bard.passage.typeName}`);
      }
      universalizePartitionMutation(bard, bard.objectId);
    }
    return bard.updateStateWith(state =>
        state.setIn([bard.objectTypeIntro.name, bard.objectId.rawId()], newResource));
  } catch (error) {
    throw wrapError(error, `During ${bard.debugId()}\n .modifyResource(), with:`,
        "\n\tpassage:", bard.passage,
        "\n\ttransient:", bard.objectTransient,
        "\n\tbard:", bard);
  }
}

/**
 * Applies the contents of given updatesByField to all contained fields against given mutableObject.
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
  let mutatesPartition = false;
  for (const fieldName of sortedKeys) {
    const fieldUpdate = updatesByField[fieldName];
    if (typeof fieldUpdate === "undefined") {
      if (isCreatedLike(bard.passage)) continue;
      bard.error(`Invalid ${operationDescription}, trying to update ${
          bard.objectTypeIntro.name}.${fieldName
          } with 'undefined' (use MODIFIED.removes or MODIFIED.splices instead)`);
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
      fillFieldInfoAndResolveAliases(bard.objectTransient, bard.objectTypeIntro.getFields(),
          fieldInfo);
      if (!isCreatedLike(bard.passage)) {
        oldLocalValue = mutableObject.get(fieldInfo.name);
      }
      updateCoupling = bard.shouldUpdateCouplings && getCoupling(fieldInfo.intro);
      if (!validateFieldUpdate(bard, fieldInfo.intro, fieldUpdate, operationDescription)) continue;
      if (fieldInfo.intro.isPersisted) mutatesPartition = true;
      bard.fieldsTouched.add(fieldInfo.name);
      const newValue = handleFieldUpdate(bard, fieldInfo, fieldUpdate, oldLocalValue,
          updateCoupling);
      if (typeof newValue === "undefined") mutableObject.delete(fieldInfo.name);
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
  return mutatesPartition;
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

// TODO(iridian): Deserialization might happening in a wrong place: it might need to happen in the
// middleware, not here in reducers. However a lot of the infrastructure is the same, and every
// event being replayed from the event log has already passed deserialization the first time.

function deserializeAs (bard: Bard, value, fieldInfo, SequenceType) {
  try {
    if (!SequenceType) return obtainSingularDeserializer(fieldInfo)(value, bard);
    if (!value) return value;
    return SequenceType().withMutations(mutableSequence => {
      forEachDeserializeAndDo(bard, value, fieldInfo,
          (SequenceType.name === "OrderedSet") || (SequenceType.name === "ImmutableSet")
              ? deserialized => mutableSequence.add(deserialized)
              : deserialized => mutableSequence.push(deserialized));
    });
  } catch (error) {
    throw wrapError(error, `During ${bard.debugId()}\n .deserializeAs(${
        SequenceType ? SequenceType.name : "singular"}), with:`,
        "\n\tvalue:", value,
        "\n\tfieldInfo:", fieldInfo,
        "\n\tbard:", bard);
  }
}

function deserializeAsArray (bard: Bard, sequence, fieldInfo) {
  const ret = [];
  try {
    forEachDeserializeAndDo(bard, sequence, fieldInfo, deserialized => ret.push(deserialized));
    return ret;
  } catch (error) {
    throw wrapError(error, `During ${bard.debugId()}\n .deserializeAsArray(), with:`,
        "\n\tsequence:", sequence,
        "\n\tfieldInfo:", fieldInfo,
        "\n\taccumulated ret:", ret,
        "\n\tbard:", bard);
  }
}

function forEachDeserializeAndDo (bard: Bard, sequence, fieldInfo, operation) {
  const deserializeSingular = obtainSingularDeserializer(fieldInfo);
  sequence.forEach(serialized => operation(deserializeSingular(serialized, bard)));
}

function obtainSingularDeserializer (fieldInfo) {
  const ret = fieldInfo._valaaSingularDeserializer;
  if (ret) return ret;
  return (fieldInfo._valaaSingularDeserializer =
      fieldInfo.intro.isLeaf
          ? deserializeLeafValue
      : fieldInfo.intro.isResource
          ? createResourceVRefDeserializer(fieldInfo)
          : createSingularDataDeserializer(fieldInfo));
}

function deserializeLeafValue (serialized) { return serialized; }

function createResourceVRefDeserializer (fieldInfo) {
  function deserializeResourceVRef (serialized, bard) {
    if (!serialized) return null;
    const resourceId = bard.bindFieldVRef(serialized, fieldInfo);
    // Non-ghosts have the correct partitionURI in the Resource.id itself
    if (resourceId.partitionURI() || !resourceId.isGhost()) return resourceId;
    // Ghosts have the correct partitionURI in the host Resource.id
    const ghostPath = resourceId.getGhostPath();
    const hostId = bard.bindObjectId(ghostPath.headHostRawId());
    return resourceId.immutatePartitionURI(hostId.partitionURI());
  }
  return deserializeResourceVRef;
}

function createSingularDataDeserializer (fieldInfo) {
  const concreteTypeName = (fieldInfo.intro.namedType instanceof GraphQLObjectType)
      && fieldInfo.intro.namedType.name;
  return function deserializeSingularData (data, bard: Bard) {
    let objectIntro;
    try {
      if (data === null) return null;
      if (typeof data === "string" || Object.getPrototypeOf(data) !== Object.prototype) {
        return bard.bindObjectId(data, concreteTypeName || "Data");
      }
      const typeName = concreteTypeName || data.typeName;
      invariantifyString(typeName,
          "Serialized expanded Data must have typeName field or belong to concrete field", {},
          "\n\ttypeName:", typeName,
          "\n\tdata:", data);
      objectIntro = bard.schema.getType(typeName);
      invariantify(objectIntro, `Unknown Data type '${typeName}' in schema`);
      return OrderedMap().withMutations(mutableExpandedData => {
        const sortedFieldNames = Object.keys(data).sort();
        for (const fieldName of sortedFieldNames) {
          if (fieldName !== "typeName") {
            const intro = objectIntro.getFields()[fieldName];
            invariantify(intro, `Unknown Data field '${typeName}.${fieldName}' in schema`);
            const serializedFieldValue = data[fieldName];
            // TODO(iridian): Implement sequence field affinities.
            // Defaulting data list fields to List's
            const deserializedValue = deserializeAs(bard, serializedFieldValue, { intro },
                intro.isSequence && List);
            mutableExpandedData.set(fieldName, deserializedValue);
          } else if (!concreteTypeName) {
            mutableExpandedData.set("typeName", typeName);
          }
        }
      });
    } catch (error) {
      throw wrapError(error, `During ${bard.debugId()
              }\n.deserializeData(parent field: '${fieldInfo.name}'), with:`,
          "\n\tdata:", data,
          "\n\tobject intro:", objectIntro,
          "\n\tparent fieldInfo:", fieldInfo,
          "\n\tparent field type:", fieldInfo.intro.namedType,
          "\n\tisResource:", fieldInfo.intro.isResource,
          "\n\tbard:", bard);
    }
  };
}

function handleAdds (bard: Bard, fieldInfo, adds, oldLocalValue, updateCoupling) {
  const fieldAdds = [];
  const fieldMoves = [];
  const { valueAsSet: oldLocalValueAsSet, removeDiffs } = separatePartialSequence(oldLocalValue);
  const newLocalValueAsSet = oldLocalValueAsSet.withMutations(mutableLocal => {
    forEachDeserializeAndDo(bard, adds, fieldInfo, entry => {
      if (!oldLocalValueAsSet.has(entry)) {
        fieldAdds.push(entry);
        mutableLocal.add(entry);
      } else if (bard.shouldUpdateCouplings) {
        // reorder existing entry to end as per ADDED_TO contract unless we're in a coupling update
        fieldMoves.push(entry);
        mutableLocal.remove(entry);
        mutableLocal.add(entry);
      }
    });
  });
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
  return combineAsPartialSequence(newLocalValueAsSet, removeDiffs);
}

function handleRemoves (bard: Bard, fieldInfo, removes, oldLocalValue, updateCoupling) {
  const fieldRemoves = [];
  let ret;
  let removeDiffs;
  if (removes === null) {
    // Remove whole property
    if (!fieldInfo.intro.isSequence) fieldRemoves.push(oldLocalValue);
    else if (oldLocalValue) fieldRemoves.push(...oldLocalValue);
    ret = undefined;
  } else {
    let oldLocalValueAsSet;
    // eslint-disable-next-line
    ({ valueAsSet: oldLocalValueAsSet, removeDiffs } = separatePartialSequence(oldLocalValue));
    forEachDeserializeAndDo(bard, removes, fieldInfo, entry => {
      if (oldLocalValueAsSet.has(entry)) fieldRemoves.push(entry);
      if (removeDiffs && shouldAddAsPartialRemove(entry)) removeDiffs = removeDiffs.add(entry);
    });
    ret = oldLocalValueAsSet.subtract(fieldRemoves);
  }
  if (fieldRemoves.length) {
    (bard.passage.actualRemoves || (bard.passage.actualRemoves = new Map()))
        .set(fieldInfo.name, fieldRemoves);
  }
  if (updateCoupling) {
    addUncoupleCouplingPassages(bard, fieldInfo.intro, fieldRemoves, true);
  }
  if (fieldInfo.intro.isSequence) ret = combineAsPartialSequence(ret, removeDiffs);
  return ret;
}

export function handleSets (bard: Bard, fieldInfo, value, oldLocalValue, updateCoupling) {
  const isCreated = isCreatedLike(bard.passage);
  const isSequence = fieldInfo.intro.isSequence;
  const newValue = deserializeAs(bard, value, fieldInfo,
      isSequence && ((oldLocalValue && oldLocalValue.constructor) || OrderedSet));
  const fieldAdds = [];
  const fieldRemoves = [];
  const universalizedFieldRemoves = [];
  let oldCompleteValue;
  if (bard.story.isBeingUniversalized && !isCreated && fieldInfo.intro.isResource
      && (isSequence || (typeof oldLocalValue === "undefined"))) {
    // For universalisation we need to create the sub-events for cross-partition modifications, and
    // for that we need to have access to the actual previous value of the field. Absolutized
    // commands and events will already have sub-events present to make cross-partition updates.
    oldCompleteValue = !isSequence
        ? getObjectField(Object.create(bard), bard.objectTransient, fieldInfo.name,
            Object.create(fieldInfo))
        : elevateFieldRawSequence(bard, oldLocalValue, fieldInfo, bard.objectTransient);
  }

  if (!isSequence) {
    if (!is(newValue, oldLocalValue)) {
      if (newValue && bard.shouldUpdateCouplings) fieldAdds.push(newValue);
      // If both oldLocalValue and new value are set we must update the old value coupling even if
      // we're in a dontUpdateCouplings passage. This is because the target of the old value is
      // possibly in a different object than the originating update passage.
      if ((oldLocalValue || oldCompleteValue) && (bard.shouldUpdateCouplings || newValue)) {
        if (typeof oldLocalValue !== "undefined") {
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
    invariantify(!value || (getRawIdFrom(value) !== getRawIdFrom(bard.objectId)),
        "prototype self-recursion for %s", bard.objectTransient);
  },
  owner (bard: Bard, fieldInfo: Object, value: any, newOwnerId: any) {
    if ((newOwnerId && newOwnerId.partitionURI()) !== bard.objectId.partitionURI()) {
      bard.refreshPartition = true;
    }
    let i = 0;
    if (newOwnerId) {
      const ownerBard = bard.fork();
      for (ownerBard.tryGoToTransientOfId(newOwnerId, "Resource"); ownerBard.objectId;
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
    const oldPartitionURI = bard.objectId.partitionURI();
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

function handleSplices (bard: Bard, fieldInfo, splices, oldLocalValue, updateCoupling) {
  // Splice only affects the local values. If RemoveDiffs are enabled, splice will add any removed
  // entries to it. Elevate the full value beforehand using 'set' if you want
  // to have splice affect some inherited entries as well.
  bard.errorEvent("DEPRECATED: SPLICED\n\tprefer: REPLACED_WITHIN",
      "\n\tsplices:", ...dumpObject(splices));
  // eslint-disable-next-line
  let { valueAsSet: oldLocalValueAsSet, removeDiffs } = separatePartialSequence(oldLocalValue);
  const oldLocalValueAsList = (oldLocalValue || List()).toList();
  const oldCompleteValue =
      // non-commands will have these operations come from appropriate sub-events
      !bard.story.isBeingUniversalized ? undefined
      // for commands we need to create these sub-events as part of the universalisation
      : elevateFieldRawSequence(bard, oldLocalValue, fieldInfo, bard.objectTransient);
  const newValue = !Array.isArray(splices)
      ? oldLocalValueAsList.splice(splices.index, splices.removeNum || 0,
          ...(deserializeAsArray(bard, splices.values, fieldInfo) || []))
      : splices.reduce(
          reduceSpliceWithCaptures(bard, [], fieldInfo),
          oldLocalValueAsList);
  const fieldAdds = [];
  const fieldRemoves = [];
  const universalizedFieldRemoves = [];
  removeDiffs = _extractListAddsAndRemoves(newValue, oldLocalValueAsSet, oldCompleteValue,
      fieldAdds, fieldRemoves, universalizedFieldRemoves, removeDiffs);
  if (fieldAdds.length) {
    (bard.passage.actualAdds || (bard.passage.actualAdds = new Map()))
        .set(fieldInfo.name, fieldAdds);
  }
  if (fieldRemoves.length) {
    (bard.passage.actualRemoves || (bard.passage.actualRemoves = new Map()))
        .set(fieldInfo.name, fieldRemoves);
  }
  if (updateCoupling) {
    addCoupleCouplingPassages(bard, fieldInfo.intro, fieldAdds, true);
    addUncoupleCouplingPassages(bard, fieldInfo.intro, fieldRemoves, true);
    // TODO: universalize this
    addUncoupleCouplingPassages(bard, fieldInfo.intro, universalizedFieldRemoves, true);
  }
  return combineAsPartialSequence(newValue, removeDiffs);
}

function reduceSpliceWithCaptures (bard: Bard, captures = [], fieldInfo) {
  return function inner (list, { index, removeNum, values, captureIndex }) {
    let actualValues;
    if (typeof captureIndex !== "undefined") {
      if (captureIndex >= captures.length || captureIndex < -captures.length) {
        bard.warnEvent("propertySpliced captureIndex out of bounds (vs. captures:",
            captures, "), skipping splice",
            dumpify({ index, removeNum, captureIndex, values }));
        captures.push(List());
        return list;
      }
      actualValues = captures[captureIndex];
    } else {
      actualValues = deserializeAsArray(bard, values, fieldInfo);
    }
    if (removeNum) {
      if (captures) captures.push(list.slice(index, index + removeNum));
    }
    return list.splice(index, removeNum, ...(actualValues || []));
  };
}

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
