// @flow
import { OrderedMap } from "immutable";

import denormalizedFromJS from "~/raem/tools/denormalized/denormalizedFromJS";
import { GraphQLObjectType } from "graphql/type";

import Bard from "~/raem/redux/Bard";
import isResourceType from "~/raem/tools/graphql/isResourceType";
import fieldInitialValue from "~/raem/tools/graphql/fieldInitialValue";
import { processUpdate, handleSets } from "~/raem/redux/reducers/modify";
import { IdData, RawId, getRawIdFrom, tryCoupledFieldFrom, tryGhostPathFrom, obtainVRef }
    from "~/raem/ValaaReference";
import { addCoupleCouplingPassages } from "~/raem/tools/denormalized/couplings";
import { createMaterializeGhostPathAction } from "~/raem/tools/denormalized/ghost";
import Transient from "~/raem/tools/denormalized/Transient";
import { duplicateFields } from "~/raem/redux/reducers/duplicate";
import { setCreatedObjectPartition, universalizePartitionMutation }
    from "~/raem/tools/denormalized/partitions";

import { invariantify, invariantifyString, wrapError } from "~/tools";

export class CreateBard extends Bard {
  getDenormalizedTable: Function;
  fieldsTouched: Set;
  shouldUpdateCouplings: boolean;
}

export class DuplicateBard extends CreateBard {
  _fieldsToPostProcess: [IdData, string, Object, any][];
  _duplicationRootId: RawId;
  _duplicationRootGhostHostId: ?RawId;
  _duplicationRootPrototypeId: RawId;
  _duplicateIdByOriginalRawId: Object;
}


export function prepareCreateOrDuplicateObjectTransientAndId (bard: CreateBard, typeName: string) {
  // typeName can be falsy if this is a DUPLICATED action
  bard.goToTransientOfActionObject({ typeName, require: false, nonGhostLookup: true });
  if (bard.objectTransient) {
    // The object already exists in the denormalized state.
    // In general this is an error but there are specific circumstances below where it is valid.
    // 1. Bvob (and Data, non-implemented atm) object creation is idempotent thus we can return.
    if (bard.passage.typeName === "Blob") return bard.state;
    // 2. The same TRANSACTED can create same Resource twice. Usually this is the result of some
    // sub-actions, like how ghost materialization can arrive and materialize the same
    // owner/prototype Resource multiple times through multiple paths.
    const preActionBard = bard.fork({ state: bard.preActionState });
    if (!preActionBard.tryGoToTransientOfRawId(bard.objectId.rawId())) {
      // Object didn't exist before this action, so we can just ignored this CREATED.
      return bard.state;
    }
    // 3. Inactive object stub transients are created in denormalized state by various
    // cross-partition references. Such a stub contains "id" and any possible already-related
    // transientField fields. These stubs are merged to the newly created Resource on creation.
    invariantify(bard.objectId.isInactive(),
        `${bard.passage.type}: Resource already exists with id: ${
            bard.objectId.rawId()}:${bard.passage.typeName}`, bard.objectTransient);
    bard.objectId.setInactive(false);
  } else if (bard.objectId.isGhost()) {
    // Materializing a potentially immaterial ghost
    invariantify(bard.passage.type === "CREATED",
        "action.type must be CREATED if action.id is a ghost path");
    invariantifyString(bard.passage.typeName, "CREATED.typeName required");
    bard.updateState(
        bard.subReduce(bard.state,
            createMaterializeGhostPathAction(bard.state, bard.objectId.getGhostPath(),
                bard.passage.typeName)));
    bard.goToTransientOfRawId(bard.objectId.rawId());
    bard.objectId = bard.objectTransient.get("id");
  } // else a regular, plain create/duplicate/instantiate
  return undefined;
}

export function convertLegacyOwnerField (bard: CreateBard, initialState: Object) {
  if (!bard.passage.owner) return initialState;
  bard.errorEvent(`\n\tDEPRECATED: ${bard.passage.type}.owner",
      "\n\tprefer: ${bard.passage.type}.initialState.owner`);
  const actualInitialState = initialState || {};
  actualInitialState.owner = obtainVRef(bard.passage.owner.id, bard.passage.owner.property);
  return actualInitialState;
}

export function prepareDenormalizedRoot (bard: CreateBard) {
  const ret = {};
  bard.getDenormalizedTable = typeName => (ret[typeName] || (ret[typeName] = {}));
  return ret;
}

export function mergeDenormalizedStateToState (bard: CreateBard, denormalizedRoot: Object) {
  return bard.updateStateWith(state => state.mergeDeep(denormalizedFromJS(denormalizedRoot)));
}

export function recurseCreateOrDuplicate (bard: CreateBard, initialState: Object,
    preOverrides?: Object) {
  const rawId = bard.objectId.rawId();
  try {
    // Make the objectId available for all VRef connectors within this Bard.
    bard.setState(bard.state
        .setIn(["ResourceStub", rawId], bard.typeName)
        .setIn(["Resource", rawId], bard.typeName)
        .setIn([bard.typeName, rawId],
            OrderedMap([["id", bard.objectId], ["typeName", bard.typeName]])));
    bard.objectTransient = bard.objectTransient.withMutations(mutableTransient => {
      bard.objectTransient = mutableTransient;
      bard.goToObjectTypeIntro();
      const objectTypeIntro: GraphQLObjectType = bard.objectTypeIntro;
      if (typeof objectTypeIntro.getInterfaces !== "function") {
        bard.error(`Cannot instantiate interface type: ${bard.typeName}`);
      }
      (objectTypeIntro.getInterfaces() || []).forEach(classInterface => {
        bard.getDenormalizedTable(classInterface.name)[rawId] = bard.typeName;
      });

      const isResource = isResourceType(objectTypeIntro);
      if (preOverrides) {
        bard.fieldsTouched = new Set();
        bard.shouldUpdateCouplings = false;
        processUpdate(bard, preOverrides, handleSets,
            `${bard.passage.type}.processFields.preOverrides`, bard.objectTransient);
        // Allow duplication to process the fields
        delete bard.fieldsTouched;
      }
      if (initialState) {
        bard.fieldsTouched = new Set();
        // TODO(iridian): Valaa Data coupling processing unimplemented. See schema/Data.js
        bard.shouldUpdateCouplings = isResource;
        processUpdate(bard, initialState, handleSets,
            `${bard.passage.type}.processFields.initialState`, bard.objectTransient);
      }

      if (isResource) {
        bard.refreshPartition = false;
        setCreatedObjectPartition(bard.objectTransient);
        if (!bard.passage.noSubMaterialize) universalizePartitionMutation(bard, bard.objectId);
      }

      if (bard._duplicationRootId) {
        duplicateFields(Object.create(bard), mutableTransient, objectTypeIntro.getFields());
      } else if (!bard.objectTransient.get("prototype")) {
        // Only fields of resources without prototypes ever get initial values
        _setDefaultFields(bard, mutableTransient, objectTypeIntro.getFields());
      }

      _connectNonGhostObjectIdGhostPathToPrototype(bard, rawId);
    });
    bard.getDenormalizedTable(bard.typeName)[rawId] = bard.objectTransient;
  } catch (error) {
    throw wrapError(error, `During ${bard.debugId()}\n .recurseCreateOrDuplicate(), with:`,
        "\n\tobject:", bard.objectTransient,
        "\n\tinitialState:", initialState);
  }
}

function _setDefaultFields (bard, mutableTransient: Transient, fieldIntros: Array) {
  for (const fieldName of Object.keys(fieldIntros)) {
    const fieldIntro = fieldIntros[fieldName];
    let fieldValue = bard.objectTransient.get(fieldIntro.name);
    if (typeof fieldValue === "undefined") {
      fieldValue = fieldInitialValue(fieldIntro);
      if (typeof fieldValue !== "undefined") mutableTransient.set(fieldIntro.name, fieldValue);
    }
  }
}

function _connectNonGhostObjectIdGhostPathToPrototype (bard: CreateBard, rawId: RawId) {
  const prototypeId = !bard.objectId.isGhost() && bard.objectTransient.get("prototype");
  let newGhostPath;
  try {
    if (prototypeId) {
      invariantify(prototypeId.getCoupledField() !== "materializedGhosts",
          "object with prototype ghostInstance must have an active ghost path in id");
      newGhostPath = bard.fork().goToTransientOfId(prototypeId, "ResourceStub")
          .get("id").getGhostPath();
      if (prototypeId.getCoupledField() === "instances") {
        newGhostPath = newGhostPath.withNewInstanceStep(rawId);
      }
      // else the prototype is a direct prototype: inherit prototype ghost path directly.
      bard.objectId.connectGhostPath(newGhostPath);
    }
  } catch (error) {
    throw bard.wrapErrorEvent(error, `_connectNonGhostObjectIdGhostPathToPrototype`,
        "\n\trawId:", rawId,
        "\n\tbard.objectId:", bard.objectId.toString(),
        "\n\tprototypeId:", prototypeId && prototypeId.toString(),
        "\n\tnewGhostPath:", newGhostPath && newGhostPath.toString(),
    );
  }
}

export function prepareDuplicationContext (bard: DuplicateBard) {
  bard._fieldsToPostProcess = [];
  bard._duplicateIdByOriginalRawId = {};
  bard._denormalizedRoot = prepareDenormalizedRoot(bard);
}

export function postProcessDuplicationContext (bard: DuplicateBard) {
  mergeDenormalizedStateToState(bard, bard._denormalizedRoot);
  const passageDenormalizedOverrides = prepareDenormalizedRoot(bard);
  addDuplicateNonOwnlingFieldPassagesToBard(bard);
  const ret = mergeDenormalizedStateToState(bard, passageDenormalizedOverrides);
  return ret;
}

export function addDuplicateNonOwnlingFieldPassagesToBard (bard: DuplicateBard) {
  const coupledReferences = [];
  bard.objectId = undefined;
  let objectTable;
  const dataTable = bard.state.getIn("Data");
  let objectId, objectTypeName, fieldIntro, originalFieldValue; // eslint-disable-line
  bard.objectId = null;
  for (const postProcessEntry of bard._fieldsToPostProcess) {
    [objectId, objectTypeName, fieldIntro, originalFieldValue] = postProcessEntry;
    const objectRawId = getRawIdFrom(objectId);
    if (bard.objectId !== objectId) {
      bard.objectId = objectId;
      objectTable = bard.getDenormalizedTable(objectTypeName);
      bard.objectTransient = objectTable[objectRawId]
          || bard.state.getIn([objectTypeName, objectRawId]);
    }
    objectTable[objectRawId] = bard.objectTransient =
        bard.objectTransient.set(fieldIntro.name,
            (fieldIntro.isResource
                ? _duplicateNonOwnlingResource
                : _duplicateData)(originalFieldValue, fieldIntro.isSequence, true));
    if (coupledReferences.length) {
      addCoupleCouplingPassages(bard, fieldIntro, coupledReferences, true);
      coupledReferences.length = 0;
    }
  }

  function _duplicateNonOwnlingResource (originalData: any, isSequence: ?boolean,
      addCouplings: ?boolean) {
    if (originalData === null) return null;
    if (isSequence === true) {
      return originalData.map(entry => _duplicateNonOwnlingResource(entry, false, addCouplings));
    }
    const duplicateId = bard._duplicateIdByOriginalRawId[getRawIdFrom(originalData)];
    let ret;
    if (duplicateId) {
      const currentCoupledField = tryCoupledFieldFrom(originalData);
      ret = !currentCoupledField
          ? duplicateId
          : duplicateId.coupleWith(currentCoupledField);
    } else {
      const ghostPath = tryGhostPathFrom(originalData);
      if (ghostPath && ghostPath.previousStep() && bard._duplicationRootGhostHostId) {
        invariantify(ghostPath.headHostRawId() !== bard._duplicationRootId,
            "DUPLICATED: duplicating ghost objects which have internal references to " +
            "non-materialized ghost ownlings inside the same host is not yet implemented");
      }
      ret = originalData;
    }
    if (addCouplings) coupledReferences.push(ret);
    // else; // TODO(iridian): Implement Data referentiality.
    return ret;
  }

  let dataFieldTable;
  let dataFieldTypeName;
  let dataFieldTypeIntro;

  function _duplicateData (originalData: any, isSequence: ?boolean) {
    if (originalData === null) return null;
    if (isSequence === true) {
      return originalData.map(_duplicateData);
    }
    let typeName;
    let dataTransient;
    let typeIntro;
    if (originalData instanceof OrderedMap) {
      // Expanded data
      dataTransient = originalData;
      typeName = dataTransient.get("typeName");
      typeIntro = (typeName === dataFieldTypeName)
          ? dataFieldTypeIntro
          : bard.schema.getType(typeName);
    } else {
      const dataRawId = getRawIdFrom(originalData);
      typeName = dataTable.get(dataRawId);
      if (typeName !== dataFieldTypeName) {
        dataFieldTable = bard.state.getIn(typeName);
        dataFieldTypeName = typeName;
        dataFieldTypeIntro = bard.schema.getType(typeName);
      }
      typeIntro = dataFieldTypeIntro;
      dataTransient = dataFieldTable.get(dataRawId);
    }
    let adjustments;
    const fields = typeIntro.getFields();
    for (const fieldName of Object.keys(fields)) {
      const dataFieldIntro = fields[fieldName];
      if (dataFieldIntro.isComposite !== true) continue;
      const originalValue = dataTransient.get(fieldName);
      const adjustedValue = dataFieldIntro.isResource
          ? _duplicateNonOwnlingResource(originalValue, dataFieldIntro.isSequence, false)
          : _duplicateData(originalValue, dataFieldIntro.isSequence);
      if (adjustedValue !== originalValue) {
        (adjustments || (adjustments = {}))[fieldName] = adjustedValue;
      }
    }
    if (typeof adjustments === "undefined") return originalData;
    return dataTransient.merge(OrderedMap(adjustments));
  }
}
