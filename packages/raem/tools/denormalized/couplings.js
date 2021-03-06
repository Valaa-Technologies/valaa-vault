// @flow

import { IdData } from "~/raem/VRL";

import { getTransientTypeName } from "~/raem/state/Transient";
import getObjectField from "~/raem/state/getObjectField";

import dataFieldValue from "~/raem/tools/denormalized/dataFieldValue";

import { unspecifiedPlural, unspecifiedSingular } from "~/raem/tools/graphql/coupling";

import Bard from "~/raem/redux/Bard";

import { dumpify, dumpObject } from "~/tools";

export function getCoupling (fieldIntro) {
  if (fieldIntro.coupling && typeof fieldIntro.coupling !== "string") {
    return fieldIntro.coupling;
  }
  if (!fieldIntro.namedType) {
    throw new Error(`No getNamedType found for field '${fieldIntro.name}'`);
  }
  return fieldIntro.isLeaf || !fieldIntro.isResource
      ? null
      : fieldIntro.isSequence ? unspecifiedPlural() : unspecifiedSingular();
}

export const COUPLE_COUPLING = "coupling";
export const UNCOUPLE_COUPLING = "uncoupling";
export const DESTROY_COUPLING = "destroying a coupling";

/**
 *  Adds coupling side effect sub-actions to bard.passage.passages.
 *  These side effects primarily include updating coupled fields.
 *
 * @export
 * @returns
 */
export function addCoupleCouplingPassages (bard: Bard, fieldIntro,
    newEntry: IdData | Array<IdData>, entryIsSequence = fieldIntro.isSequence) {
  checkAndAddCouplingPassages(bard, fieldIntro, newEntry, entryIsSequence, COUPLE_COUPLING);
}

/**
 *  Adds uncoupling side effect sub-actions to bard.passage.passages.
 *  These side effects primarily include updating coupled fields.
 *
 * @export
 * @returns
 */
export function addUncoupleCouplingPassages (bard: Bard, fieldIntro,
    currentEntry: IdData | Array<IdData>, entryIsSequence = fieldIntro.isSequence) {
  checkAndAddCouplingPassages(bard, fieldIntro, currentEntry, entryIsSequence, UNCOUPLE_COUPLING);
}

/**
 *  Adds destroy coupling side effect sub-actions to bard.passage.passages.
 *  These side effects primarily include updating coupled fields.
 *  DestroyCoupling (unlike the regular uncouple) will throw an error if the fieldIntro coupling has
 *  'preventsDestroy' set.
 *
 * @export
 * @returns
 */
export function addDestroyCouplingPassages (bard: Bard, fieldIntro,
    currentEntry: IdData | Array<IdData>, entryIsSequence = fieldIntro.isSequence) {
  checkAndAddCouplingPassages(bard, fieldIntro, currentEntry, entryIsSequence, DESTROY_COUPLING);
}

function checkAndAddCouplingPassages (bard: Bard, fieldIntro,
    entryOrList: IdData | Array<IdData>, entryIsSequence, actionType) {
  try {
    // console.log(`checkAndAddCouplingPassages '${fieldIntro.name}', remote:`,
    //      dumpify(entryOrList, { sliceAt: 100 }), entryIsSequence, actionType,
    //      dumpify(fieldIntro.coupling, { sliceAt: 100 }));
    if (typeof fieldIntro.coupling === "string" || !entryOrList) return;
    const coupling = getCoupling(fieldIntro);
    if (!coupling) return;

    if (!entryIsSequence) {
      addCouplingPassages(bard, fieldIntro, entryOrList, coupling, actionType);
    } else {
      entryOrList.forEach(entry => {
        addCouplingPassages(bard, fieldIntro, entry, coupling, actionType, fieldIntro.namedType);
      });
    }
  } catch (error) {
    throw bard.wrapErrorEvent(error, 1, () => [
      `checkAndAddCouplingPassages(${actionType}, ${
            dataFieldValue(bard.objectTransient, "id")}.${fieldIntro.name})`,
      "\n\tentryOrList:", entryOrList,
      "\n\tfieldIntro:", fieldIntro,
      "\n\tbard:", bard,
    ]);
  }
}

export function addCouplingPassages (bard: Bard, fieldIntro, remote: IdData, coupling,
    actionType, remoteType_) {
  /*
  console.log("addCouplingPassages", actionType, `'${fieldIntro.name}', remote:`,
      dumpify(remote, { sliceAt: 100 }), "coupling", dumpify(coupling, { sliceAt: 100 }));
  */
  if (!remote /* || remote.isAbsent() */) return;
  const remoteRef = bard.obtainReference(remote);
  let coupledField = remoteRef.getCoupledField();
  let remoteType = remoteType_ || fieldIntro.namedType;
  let remoteFieldIntro = remoteType.getFields()[coupledField];
  let reverseCoupling;
  let remoteTransient;
  try {
    if (coupling.coupledField) {
      if (coupledField) {
        bard.errorEvent(`Overriding dynamic coupledField for an outgoing reference field '${
            fieldIntro.name}' which should be falsy (got '${coupledField
            }') with the static coupling.coupledField definition '${coupling.coupledField}'`);
      }
      coupledField = coupling.coupledField;
    } else if (!coupledField) {
      coupledField = coupling.defaultCoupledField;
    }
    if (!remoteFieldIntro) {
      remoteType = bard.schema.tryAffiliatedTypeOfField(coupledField);
      if (!remoteType) {
        if (remoteRef.isAbsent()) {
          throw new Error(`Can't find affiliated type for an absent remote reference coupled to '${
              coupledField}'`);
        }
        remoteTransient = Object.create(bard).tryGoToMostMaterializedTransient(
            remoteRef, "TransientFields", true, false, "typeName");
        remoteType = bard.schema.getType((remoteTransient && remoteTransient.get("typeName"))
            || bard.schema.absentType.name);
      }
      remoteFieldIntro = remoteType.getFields()[coupledField];
      if (!remoteFieldIntro) {
        throw new Error(`No introspection found for remote field ${remoteType.name}.${coupledField
            } when ${actionType} <${remote}> via near field ${
            bard.interfaceIntro.name}.${fieldIntro.name} of <${bard.objectId}>`);
      }
    }
    if (typeof remoteType.getFields !== "function") {
      bard.error("Invalid fieldType when looking for", dumpify(fieldIntro), ":",
          dumpify(remoteType));
      return;
    }
    reverseCoupling = remoteFieldIntro.coupling
        || (coupling.whenUnmatched && coupling.whenUnmatched(remoteFieldIntro.isSequence));
    if (!reverseCoupling) {
      throw new Error(`No 'coupling' descriptor found for remote field '${coupledField}`);
    }
    if (actionType === COUPLE_COUPLING) {
      bard.addPassage(
          reverseCoupling.createCoupleToRemoteAction(
              remoteRef.getObjectId(), remoteType.name, coupledField, bard.objectId,
              fieldIntro.name));
    } else {
      if (coupling.preventsDestroy && (actionType === DESTROY_COUPLING)) {
        // Check if remote is in other chronicle as they can't prevent destroy, otherwise throw.
        const chronicleURI = remoteRef.getChronicleURI();
        // Missing chronicleURI means the reference is a chronicle-internal reference: throw.
        if (!chronicleURI || (chronicleURI === bard.destroyedResourceChronicle)) {
          const nameBard = Object.create(bard);
          const name = bard.interfaceIntro.getFields().name
              ? `'${getObjectField(nameBard, bard.objectTransient, "name")}' `
              : bard.objectId.rawId();
          remoteTransient = remoteTransient
              || Object.create(bard).goToTransient(remoteRef, remoteType.name);
          const remoteName = bard.schema
                  .getType(getTransientTypeName(remoteTransient, bard.schema))
                  .getFields().name
              ? `'${getObjectField(nameBard, remoteTransient, "name")}' `
              : remoteRef.rawId();
          const remoteChapter = bard.obtainResourceChapter(remoteRef.rawId());
          (remoteChapter.preventsDestroys || (remoteChapter.preventsDestroys = [])).push({
            // Flips the perspective: from the perspective of remote side, this side is the remote.
            name: remoteName,
            typeName: remoteType.name,
            remoteName: name,
            remoteTypeName: bard.interfaceIntro.name,
            remoteFieldName: fieldIntro.name,
          });
        }
      }
      bard.addPassage(
          reverseCoupling.createUncoupleFromRemoteAction(
              remoteRef.getObjectId(), remoteType.name, coupledField, bard.objectId,
              fieldIntro.name));
    }
  } catch (error) {
    throw bard.wrapErrorEvent(error, 1, () => [
      `addCouplingPassages(when ${actionType} via near field '${fieldIntro.name
          }' to remote field '${remoteType && remoteType.name}.${coupledField}')`,
      "\n\tcoupling:", coupling,
      "\n\ttarget:", ...dumpObject(remote),
      "\n\treverse coupling:", ...dumpObject(reverseCoupling),
      "\n\tbard:", ...dumpObject(bard),
    ]);
  }
}
