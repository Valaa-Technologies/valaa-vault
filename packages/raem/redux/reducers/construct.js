// @flow
import { OrderedMap } from "immutable";
import { GraphQLObjectType } from "graphql/type";

import VRL, { RawId, tryGhostPathFrom } from "~/raem/VRL";

import denormalizedFromJS from "~/raem/state/denormalizedFromJS";
import Transient, { createTransient } from "~/raem/state/Transient";

import Bard from "~/raem/redux/Bard";
import { processUpdate, handleSets } from "~/raem/redux/reducers/modify";
import { duplicateFields } from "~/raem/redux/reducers/duplicate";

import isResourceType from "~/raem/tools/graphql/isResourceType";
import fieldInitialValue from "~/raem/tools/graphql/fieldInitialValue";
import { addCoupleCouplingPassages } from "~/raem/tools/denormalized/couplings";
import { createMaterializeGhostAction } from "~/raem/tools/denormalized/ghost";
import { setCreatedObjectPartition, universalizePartitionMutation }
    from "~/raem/tools/denormalized/partitions";

import { dumpObject, invariantify, invariantifyString } from "~/tools";

export class CreateBard extends Bard {
  getDenormalizedTable: Function;
  fieldsTouched: Set;
  updateCouplings: boolean; // default value (ie. if undefined) is true.
}

export class DuplicateBard extends CreateBard {
  _fieldsToPostProcess: [VRL, string, Object, any][];
  _duplicationRootId: RawId;
  _duplicationRootGhostHostId: ?RawId;
  _duplicationRootPrototypeId: RawId;
  _duplicateIdByOriginalRawId: Object;
}


export function prepareCreateOrDuplicateObjectTransientAndId (bard: CreateBard, typeName?: string) {
  // typeName can be falsy if this is a DUPLICATED action
  bard.goToTransientOfPassageObject("TransientFields"); // no-require, non-ghost
  const passage = bard.passage;
  if (bard.objectTransient) {
    // The object already exists in the denormalized state.
    // In general this is an error but there are specific circumstances
    // below where it is valid.
    // 1. Bvob (and Data, non-implemented atm) object creation is
    //    idempotent thus we can return.
    if (typeName === "Blob") return bard.state;
    // 2. The same TRANSACTED can create same Resource twice. Usually
    //    this is the result of some sub-actions, like how ghost
    //    materialization can arrive and materialize the same owner or
    //    prototype Resource multiple times through separate diamond
    //    paths.
    const preActionBard = Object.create(bard);
    preActionBard.state = bard.preActionState;
    if (!preActionBard.tryGoToTransientOfRawId(passage.id.rawId())) {
      // Object didn't exist before this action so we can just ignore
      // this CREATED.
      return bard.state;
    }
    // 3. Inactive object stub transients are created in denormalized
    //    state by various cross-partition references. Such a stub
    //    contains "id" and any possible already-related transientField
    //    fields. These stubs are merged to the newly created Resource
    //    on creation.
    _mergeWithInactiveStub(bard, passage, typeName);
  } else if (passage.id.isGhost()) {
    // Materializing a potentially immaterial ghost
    invariantify(passage.type === "CREATED",
        "action.type must be CREATED if action.id is a ghost path");
    invariantifyString(typeName, "CREATED.typeName required");
    bard.updateState(
        bard.subReduce(bard.state,
            createMaterializeGhostAction(bard, passage.id, typeName, true)));
    bard.goToTransientOfRawId(passage.id.rawId());
    passage.id = bard.objectTransient.get("id");
    if (!passage.id) throw new Error("INTERNAL ERROR: no bard.objectTransient.get('id')");
  } else {
    // regular, plain create/duplicate/instantiate
    bard.objectId = passage.id;
    bard.objectTypeName = typeName;
    bard.objectTransient = createTransient(passage);
  }
  if (passage.id.isInactive()) passage.id.setInactive(false);
  return undefined;
}

function _mergeWithInactiveStub (bard: CreateBard, passage: Object, typeName?: string) {
  if (!passage.id.isInactive()) {
    invariantify(passage.id.isInactive(),
        `${passage.type}: Resource already exists with id: ${
          passage.id.rawId()}:${typeName}`, bard.objectTransient);
  }
  if (typeName) {
    // Inactive resource typeName is an inactive type: update it to
    // correct value for CREATEDs.
    bard.objectTransient = bard.objectTransient.set("typeName", typeName);
    bard.objectTypeName = typeName;
  }
}

export function convertLegacyOwnerField (bard: CreateBard, initialState: Object) {
  if (!bard.passage.owner) return initialState;
  throw bard.wrapErrorEvent(new Error(`\n\tDEPRECATED: ${bard.passage.type}.owner`),
      `\n\tprefer: ${bard.passage.type}.initialState.owner`);
  /*
  const actualInitialState = initialState || {};
  actualInitialState.owner = obtainVRL(bard.passage.owner.id, bard.passage.owner.property);
  return actualInitialState;
  */
}

export function prepareDenormalizedRoot (bard: CreateBard) {
  const ret = {};
  bard.getDenormalizedTable = typeName => (ret[typeName] || (ret[typeName] = {}));
  return ret;
}

export function mergeDenormalizedStateToState (bard: CreateBard, denormalizedRoot: Object) {
  return bard.updateStateWith(state => state.mergeDeep(denormalizedFromJS(denormalizedRoot)));
}

export function recurseCreateOrDuplicate (bard: CreateBard, actionTypeName: string,
    initialState: Object, preOverrides?: Object) {
  const rawId = bard.objectId.rawId();
  if (actionTypeName !== bard.objectTypeName) {
    throw new Error(`INTERNAL ERROR: mismatching requested construct typeName '${actionTypeName
        }' with bard.objectTypeName '${bard.objectTypeName}'`);
  }
  try {
    bard.goToTypeIntro(actionTypeName);
    const typeIntro: GraphQLObjectType = bard.interfaceIntro;
    let typeName = actionTypeName;
    let interfaces;
    let isResource;
    let interfaceType;
    if (typeof typeIntro.getInterfaces === "function") {
      interfaces = typeIntro.getInterfaces();
      isResource = isResourceType(typeIntro);
    } else {
      // Creation of an interface type means that this is a
      // materialization of a ghost with inactive prototypes.
      interfaces = [{ name: actionTypeName }];
      isResource = false;
      interfaceType = typeName;
      typeName = bard.schema.inactiveType.name;
    }
    // Make the objectId available for all VRL connectors within this Bard.
    bard.setState(bard.state
        .setIn(["TransientFields", rawId], typeName)
        // FIXME(iridian, 2018-12): this breaks abstractions as
        // TransientScriptFields is only introduced in @valos/script.
        // I couldn't think of correct non-abstraction which is not
        // overly engineered, so this is hard-coded now.
        .setIn(["TransientScriptFields", rawId], typeName)
        .setIn(["Resource", rawId], typeName)
        .setIn([typeName, rawId], OrderedMap([["id", bard.objectId], ["typeName", typeName]])));
    bard.objectTransient = bard.objectTransient.withMutations(mutableTransient => {
      bard.objectTransient = mutableTransient;
      interfaces.forEach(interfaceIntro => {
        bard.getDenormalizedTable(interfaceIntro.name)[rawId] = typeName;
      });

      if (preOverrides) {
        bard.fieldsTouched = new Set();
        bard.updateCouplings = false;
        processUpdate(bard, preOverrides, handleSets,
            `${bard.passage.type}.processFields.preOverrides`, bard.objectTransient);
        // Allow duplication to process the fields
        delete bard.fieldsTouched;
      }

      if (initialState) {
        bard.fieldsTouched = new Set();
        // TODO(iridian): ValOS Data coupling processing unimplemented. See schema/Data.js
        bard.updateCouplings = isResource;
        processUpdate(bard, initialState, handleSets,
            `${bard.passage.type}.processFields.initialState`, bard.objectTransient);
      }

      if (isResource) {
        bard.refreshPartition = false;
        setCreatedObjectPartition(bard.objectTransient);
        if (!(bard.passage.meta || {}).isVirtualAction) {
          universalizePartitionMutation(bard, bard.objectId);
        }
      }

      if (bard._duplicationRootId) {
        duplicateFields(Object.create(bard), mutableTransient, typeIntro.getFields());
      } else if (!interfaceType && !bard.objectTransient.get("prototype")) {
        // Only fields of resources without prototypes can ever get
        // initial values
        _setDefaultFields(bard, mutableTransient, typeIntro.getFields());
      }

      _connectNonGhostObjectIdGhostPathToPrototype(bard, bard.objectId);
    });
    bard.getDenormalizedTable(typeName)[rawId] = bard.objectTransient;
  } catch (error) {
    throw bard.wrapErrorEvent(error, 1, () => [
      `recurseCreateOrDuplicate()`,
      "\n\tobject:", ...dumpObject(bard.objectTransient),
      "\n\tinitialState:", ...dumpObject(initialState),
    ]);
  }
}

function _setDefaultFields (bard, mutableTransient: Transient, fieldIntros: Array) {
  for (const fieldName of Object.keys(fieldIntros)) {
    const fieldIntro = fieldIntros[fieldName];
    let fieldValue = bard.objectTransient.get(fieldIntro.name);
    if (fieldValue === undefined) {
      fieldValue = fieldInitialValue(fieldIntro);
      if (fieldValue !== undefined) mutableTransient.set(fieldIntro.name, fieldValue);
    }
  }
}

function _connectNonGhostObjectIdGhostPathToPrototype (bard: CreateBard, objectId: VRL) {
  const nonGhostPrototypeId = !objectId.isGhost() && bard.objectTransient.get("prototype");
  let newGhostPath;
  try {
    if (nonGhostPrototypeId) {
      invariantify(nonGhostPrototypeId.getCoupledField() !== "materializedGhosts",
          `resource with prototype coupling to 'materializedGhosts' must have an active ghost${
              ""} path in its id`);
      newGhostPath = Object.create(bard).goToTransient(nonGhostPrototypeId, "TransientFields")
          .get("id").getGhostPath();
      if (nonGhostPrototypeId.getCoupledField() === "instances") {
        newGhostPath = newGhostPath.withNewInstanceStep(objectId.rawId());
      }
      // else the prototype is a direct prototype: inherit prototype ghost path directly.
      objectId.connectGhostPath(newGhostPath);
    }
  } catch (error) {
    throw bard.wrapErrorEvent(error, `_connectNonGhostObjectIdGhostPathToPrototype`,
        "\n\tobjectId:", ...dumpObject(objectId),
        "\n\tbard.objectTransient:", ...dumpObject(bard.objectTransient),
        "\n\tnonGhostPrototypeId:", ...dumpObject(nonGhostPrototypeId),
        "\n\tnewGhostPath:", ...dumpObject(newGhostPath),
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
    const objectRawId = objectId.rawId();
    if (bard.objectId !== objectId) {
      bard.objectId = objectId;
      bard.objectTypeName = objectTypeName;
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
    const duplicateId = bard._duplicateIdByOriginalRawId[originalData.rawId()];
    let ret;
    if (duplicateId) {
      const currentCoupledField = originalData.getCoupledField();
      ret = !currentCoupledField
          ? duplicateId
          : duplicateId.coupleWith(currentCoupledField);
    } else {
      const ghostPath = tryGhostPathFrom(originalData);
      if (ghostPath && ghostPath.previousGhostStep() && bard._duplicationRootGhostHostId) {
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
      const dataRawId = originalData.rawId();
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
