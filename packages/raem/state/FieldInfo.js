// @flow

import { OrderedSet } from "immutable";

import VRL, { tryCoupledFieldFrom } from "~/raem/VRL";

import GhostPath, { createGhostRawId, GhostElevation } from "~/raem/state/GhostPath";
import { PartialRemovesTag } from "~/raem/state/partialSequences";
import Resolver from "~/raem/state/Resolver";
import Transient, { createImmaterialTransient, PrototypeOfImmaterialTag }
    from "~/raem/state/Transient";

export type FieldInfo = {
  name: string,
  intro: Object, // The graphql Field introspection object has no explicit type.
  coupledField: ?string,
  defaultCoupledField: ?string,
  sourceTransient: ?Transient,
  elevationInstanceId: ?VRL,
};

export function tryElevateFieldValue (resolver: Resolver, value: VRL | VRL[],
    fieldInfo: FieldInfo) {
  const elevation = value && _tryFieldGhostElevation(fieldInfo);
  if (!elevation) return value;
  const elevator = Object.create(resolver);
  const typeName = fieldInfo.intro.namedType.name;
  return !fieldInfo.intro.isSequence
      ? _elevateReference(elevator, value, fieldInfo, elevation, typeName)
      : value.map(entry =>
          _elevateReference(elevator, entry, fieldInfo, elevation, typeName));
}

export function elevateFieldReference (resolver: Resolver, reference: VRL, fieldInfo: FieldInfo,
    elevation: ?GhostElevation = _tryFieldGhostElevation(fieldInfo), typeName: ?string,
    verbosity: ?number) {
  if (!elevation) return reference;
  return _elevateReference(Object.create(resolver), reference, fieldInfo, elevation,
      typeName || fieldInfo.intro.namedType.name, verbosity);
}

export function elevateFieldRawSequence (resolver: Resolver, rawSequence: OrderedSet,
    fieldInfo: FieldInfo, object: Transient = fieldInfo.sourceTransient, verbosity: ?number) {
  if (!object) return rawSequence;
  const elevator = Object.create(resolver);
  elevator.objectTypeName = "TransientFields";
  return _elevateRawSequence(elevator, object, rawSequence, Object.create(fieldInfo), verbosity);
}

function _tryFieldGhostElevation (fieldInfo: FieldInfo) {
  return (fieldInfo && fieldInfo.sourceTransient && !(fieldInfo.intro && fieldInfo.intro.isLeaf)
          && _getFieldGhostElevation(fieldInfo, fieldInfo.elevationInstanceId))
      || undefined;
}

export function _getFieldGhostElevation (fieldInfo: FieldInfo, elevationInstanceId: VRL) {
  const sourceId = fieldInfo.sourceTransient.get("id");
  if (elevationInstanceId.rawId() === sourceId.rawId()) return undefined;
  return sourceId.getGhostPath()
      .obtainGhostElevation(elevationInstanceId.getGhostPath());
}

export function _elevateReference (elevator: Resolver, reference: VRL, fieldInfo: FieldInfo,
    elevation: GhostElevation, typeName: string, verbosity: ?number) {
  elevator.tryGoToTransient(reference, typeName);
  let elevatedId;
  if (elevator.objectId.isInactive()) {
    // TODO(iridian): Following assumption has not been fully reasoned,
    // evaluate thoroughly: If reference is to a resource in an
    // inactive partition there will be no elevation.
    // Reasoning:
    // 1. both the elevation base and the elevation instance are in
    //    an active partition, otherwise elevation would have already
    //    failed,
    // 2. reference target partition is inactive partition and thus
    //    must a separate partition,
    // 3. reference target itself
    // target is an outside resource and thus needs no elevation.
    // Counter-argument: if the outside resource is in an inactive
    // prototype of an elevation base?
    elevatedId = elevator.objectId;
  } else {
    const referencePath = elevator.objectId.getGhostPath();
    elevatedId = elevation.getElevatedIdOf(referencePath);
    if (!elevatedId || (typeof verbosity === "number")) {
      elevatedId = _elevateObjectId(
          elevator, elevation.basePath, elevation.instancePath, verbosity);
      elevation.setElevatedIdOf(referencePath, elevatedId);
    } else if (typeof verbosity === "number") {
      console.log("  ".repeat(verbosity), "Found existing elevated id:", elevatedId.toString(),
          "\n ", "  ".repeat(verbosity), "in elevation:", elevation.toString(),
          "\n ", "  ".repeat(verbosity), "for path:", referencePath.toString());
    }
  }
  const coupledField = tryCoupledFieldFrom(reference);
  return !coupledField ? elevatedId : elevatedId.coupleWith(coupledField);
}

function _elevateRawSequence (resolver: Resolver, object: Transient,
    partialRawSequence: OrderedSet, fieldInfo: FieldInfo, verbosity: ?number) {
  // TODO(iridian): Very potential optimization/caching focus: the current implementation doing
  // combined merge + elevate of the entries from prototypes is simplistic and has redundancies.
  const partialRemoves = partialRawSequence && partialRawSequence[PartialRemovesTag];
  let fullUnelevatedSequence = partialRawSequence || [];
  // Grab elevation before the recursive self-call thrashes fieldInfo.
  const elevation = _tryFieldGhostElevation(fieldInfo);
  if (partialRemoves !== null && (fieldInfo.intro.ownDefaultValue === undefined)) {
    let prototypeSequence;
    let currentObject = object;
    do {
      const prototypeId = currentObject.get("prototype");
      if (!prototypeId) break;
      currentObject = resolver.goToNonGhostTransient(prototypeId, resolver.objectTypeName);
      prototypeSequence = currentObject.get(fieldInfo.name);
    } while (prototypeSequence === undefined);

    if (prototypeSequence) {
      fieldInfo.elevationInstanceId = fieldInfo.sourceTransient.get("id");
      fieldInfo.sourceTransient = resolver.objectTransient;
      fullUnelevatedSequence = _elevateRawSequence(
          resolver, currentObject, prototypeSequence, fieldInfo, verbosity);
      if (partialRemoves !== undefined) {
        fullUnelevatedSequence = fullUnelevatedSequence.subtract(partialRemoves);
      }
      if (partialRawSequence) {
        fullUnelevatedSequence =
            // subtract so that all existing entries get reordered as per ADDED_TO contract
            fullUnelevatedSequence.subtract(partialRawSequence).union(partialRawSequence);
      }
    }
  }
  if (!elevation) return fullUnelevatedSequence;
  const elevator = Object.create(resolver);
  const typeName = fieldInfo.intro.namedType.name;
  return fullUnelevatedSequence.map(reference =>
      _elevateReference(elevator, reference, fieldInfo, elevation, typeName, verbosity));
}

export function _elevateObjectId (referenceElevator: Resolver, elevationBasePath: GhostPath,
    elevationInstancePath: GhostPath, verbosity: ?number): VRL {
  if (elevationBasePath === elevationInstancePath) return referenceElevator.objectId;
  let elevatedGhostPath: GhostPath = referenceElevator.objectId.getGhostPath();
  let ghostHostRawId, ghostHostPrototypeRawId;
  let newGhostRawId;
  const ownersResolver = Object.create(referenceElevator);
  let currentReferencePath = elevationBasePath;
  let instanceGhostPath;
  let mostMaterializedTransientForImmaterialGhost;
  try {
    while (ownersResolver.objectTransient[PrototypeOfImmaterialTag]) {
      // Skip to the first (grand)owner which is materialized, for two reasons.
      // 1. algorithm below does not work for immaterials, and on the other hand,
      // 2. it does not need to work because an instantiation always materializes the prototype,
      // so a pointer to immaterial resource cannot have been instanced in this execution context.
      // Note: This logic does not hold if some partitions in the target ghost path are
      // not active. But if the top partition of the ghost path is active, then all partitions in
      // the ghost path should be active as well.
      ownersResolver.goToCurrentObjectOwnerTransient();
    }
    if (typeof verbosity === "number") {
      console.log("  ".repeat(verbosity), "elevating", referenceElevator.objectId.toString(),
          "\n ", "  ".repeat(verbosity), "elevationBasePath:", elevationBasePath.toString(),
          "\n ", "  ".repeat(verbosity), "elevationInstancePath:",
              elevationInstancePath.toString());
    }
    while (true) {
      if (typeof verbosity === "number") {
        console.log("  ".repeat(verbosity + 1), "elevation phase 1 entry with current owner at",
                ownersResolver.objectId.toString(),
            "\n ", "  ".repeat(verbosity + 1), "currentReferencePath:",
                currentReferencePath.toString());
      }
      const innermostMaterializedPrototypeOwnerTransient = ownersResolver.objectTransient;
      // Phase 1: iterate through owners of the reference target and see if any of them appears as
      // an instantiation prototype in the lookup context path. Each such occurence corresponds to
      // a ghost id elevation: as long as we don't find any, keep iterating towards grandowners.
      // eslint-disable-next-line
      while (true) {
        const ownerRawId = ownersResolver.objectId.rawId();
        const alreadyElevatedStep = currentReferencePath.getInstanceStepByHostPrototype(ownerRawId);
        instanceGhostPath = undefined;
        // Delve into the innermost instance by ownerRawId in the elevation instance path which has
        // not yet been elevated.
        // eslint-disable-next-line
        for (let delvingStep = elevationInstancePath;
            delvingStep
                && (delvingStep = delvingStep.getInstanceStepByHostPrototype(ownerRawId))
                && (delvingStep !== alreadyElevatedStep);
            delvingStep = delvingStep.previousGhostStep()) {
          instanceGhostPath = delvingStep;
        }
        if (instanceGhostPath) break;
        ownersResolver.goToCurrentObjectOwnerTransient();
        if (!ownersResolver.objectId) {
          if (typeof verbosity === "number") {
            console.log("  ".repeat(verbosity), "final elevated reference",
                "\n ", "  ".repeat(verbosity), "owned by", String(elevationBasePath),
                "\n ", "  ".repeat(verbosity), "in lookup context", String(elevationInstancePath),
                "\n ", "  ".repeat(verbosity), "result:", String(referenceElevator.objectId));
          }
          return referenceElevator.objectId;
        }
        if (typeof verbosity === "number") {
          console.log("  ".repeat(verbosity + 2), "expanded owner to",
              ownersResolver.objectId.toString(),
              "\n ", "  ".repeat(verbosity + 2),
              ...(currentReferencePath.getHostRawIdByHostPrototype(ownersResolver.objectId.rawId())
                  ? ["previous owner already found in current elevation base path",
                    String(currentReferencePath)]
                  : ["previous owner not found in elevation instance path",
                    String(elevationInstancePath)]));
        }
      }
      // Phase 2: determine the instance parameters in referenceElevator.objectId/objectTransient
      currentReferencePath = instanceGhostPath;
      ghostHostRawId = currentReferencePath.headHostRawId();
      ghostHostPrototypeRawId = currentReferencePath.headHostPrototypeRawId();
      newGhostRawId = (ownersResolver.objectId.rawId() === referenceElevator.objectId.rawId())
          ? ghostHostRawId : createGhostRawId(
              referenceElevator.objectId.rawId(), ghostHostRawId, ghostHostPrototypeRawId);
      const ghostPrototypeTransient = referenceElevator.objectTransient;
      referenceElevator.tryGoToTransientOfRawId(newGhostRawId);
      if (typeof verbosity === "number") {
        console.log("  ".repeat(verbosity + 1), "elevation phase 2 to",
                newGhostRawId === ghostHostRawId ? "instance" : "ghost", newGhostRawId,
            "\n ", "  ".repeat(verbosity + 1), "ghostHostRawId:", ghostHostRawId,
            "\n ", "  ".repeat(verbosity + 1), "ghostHostPrototypeRawId:",
                ghostHostPrototypeRawId,
            "\n ", "  ".repeat(verbosity + 1), "transient:",
                referenceElevator.objectTransient
                    ? referenceElevator.objectTransient.toJS() : "is immaterial ghost",
            "\n ", "  ".repeat(verbosity + 1), "current owner id:",
                String(ownersResolver.objectId),
            "\n ", "  ".repeat(verbosity + 1), "innermost materialized prototype owner:",
                String(innermostMaterializedPrototypeOwnerTransient.get("id")));
      }
      if (referenceElevator.objectTransient) {
        elevatedGhostPath = referenceElevator.objectId.getGhostPath();
        ownersResolver.objectId = referenceElevator.objectId;
        ownersResolver.objectTransient = referenceElevator.objectTransient;
      } else {
        if (!mostMaterializedTransientForImmaterialGhost) {
          mostMaterializedTransientForImmaterialGhost = ghostPrototypeTransient;
        }
        elevatedGhostPath = elevatedGhostPath
            .withNewStep(ownersResolver.objectId.rawId(), ghostHostRawId, newGhostRawId);
        const ghostTransient = createImmaterialTransient(
            newGhostRawId, elevatedGhostPath, mostMaterializedTransientForImmaterialGhost);
        // Search for smallest possible materialized owner of the ghost to satisfy phase 1.
        // We temporarily use referenceElevator.objectId/Transient to iterate the prototype owners,
        // starting from the innermost known materialized prototype. We stop once we find
        // a materialized ghost or once the prototype equals the current ghost host prototype.
        referenceElevator.objectTransient = innermostMaterializedPrototypeOwnerTransient;
        referenceElevator.objectId = innermostMaterializedPrototypeOwnerTransient.get("id");
        for (; ; referenceElevator.goToCurrentObjectOwnerTransient()) { // eslint-disable-line
          if (referenceElevator.objectId.rawId() === ghostHostPrototypeRawId) {
            ownersResolver.goToTransientOfRawId(ghostHostRawId, "Resource");
            break;
          }
          const ghostOwnerCandidateId = createGhostRawId(
              referenceElevator.objectId.rawId(), ghostHostRawId, ghostHostPrototypeRawId);
          if (ownersResolver.tryGoToTransientOfRawId(ghostOwnerCandidateId, "Resource")) {
            break;
          }
          if (typeof verbosity === "number") {
            console.log("  ".repeat(verbosity + 2), "ghost owner candidate immaterial:",
                    ghostOwnerCandidateId,
                "\n ", "  ".repeat(verbosity + 2), "for ghost owner prototype",
                    referenceElevator.objectId.toString());
          }
        }
        referenceElevator.objectTransient = ghostTransient;
        referenceElevator.objectId = ghostTransient.get("id");
      }
      if (typeof verbosity === "number") {
        console.log("  ".repeat(verbosity + 1), "current elevated path", String(elevatedGhostPath),
            "\n ", "  ".repeat(verbosity + 1), "by ghost host", ghostHostRawId,
            "\n ", "  ".repeat(verbosity + 1), "owner:", String(ownersResolver.objectId));
      }
    }
  } catch (error) {
    throw referenceElevator.wrapErrorEvent(error, 2, `_elevateObjectId()`,
        "\n\televator:", referenceElevator,
        "\n\televationBasePath:", elevationBasePath,
        "\n\televationInstancePath:", elevationInstancePath,
        "\n\townersResolver:", ownersResolver,
        "\n\televatedGhostPath:", elevatedGhostPath,
        "\n\tnewGhostRawId:", newGhostRawId,
        );
  }
}
