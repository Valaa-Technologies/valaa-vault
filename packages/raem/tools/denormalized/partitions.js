// @flow

import type { VRef } from "~/raem/ValaaReference"; // eslint-disable-line no-duplicate-imports

import Bard, { getActionFromPassage } from "~/raem/redux/Bard";
import { tryHostRef } from "~/raem/VALK/hostReference";
import { ValaaURI, naiveURI } from "~/raem/ValaaURI";
import { Resolver, Transient } from "~/raem/state";

import traverseMaterializedOwnlings
    from "~/raem/tools/denormalized/traverseMaterializedOwnlings";

import { dumpObject, invariantifyArray, unwrapError, wrapError } from "~/tools";

export class MissingPartitionConnectionsError extends Error {
  constructor (message, missingPartitions: (ValaaURI | Promise<any>)[]) {
    super(message);
    invariantifyArray(missingPartitions, "MissingPartitionConnectionsError.missingPartitions",
        { elementInvariant: value => value });
    this.missingPartitions = missingPartitions;
  }
}

export function asyncConnectToPartitionsIfMissingAndRetry (call, onError) {
  if ((typeof call !== "function") || !call.apply) throw new Error("call is not a function");
  return function autoConnectingCall (...args: any[]) {
    return tryCall.call(this, call, onError, ...args);
  };
}

function tryCall (call: any, onError, ...args: any[]) {
  try {
    return call.apply(this, args);
  } catch (error) {
    if (!(unwrapError(error) instanceof MissingPartitionConnectionsError)) {
      if (onError) return onError(error, ...args);
      throw error;
    }
    try {
      return connectToMissingPartitionsAndThen(error,
          () => tryCall.call(this, call, onError, ...args));
    } catch (innerError) {
      const wrappedError = wrapError(innerError,
        `During @asyncConnectToPartitionsIfMissingAndRetry(${call.name}):`,
        "\n\thint: use partitions:addConnectToPartitionToError to add it",
        "\n\tcall:", ...dumpObject(call),
        "\n\targs:", ...dumpObject(args));
      if (onError) return onError(wrappedError, ...args);
      throw wrappedError;
    }
  }
}

export function tryConnectToMissingPartitionsAndThen (error, callback, explicitConnectToPartition) {
  const original = error.originalError || error;
  if (!original.missingPartitions) return false;
  return connectToMissingPartitionsAndThen(error, callback, explicitConnectToPartition);
}

export function connectToMissingPartitionsAndThen (error, callback, explicitConnectToPartition) {
  const original = error.originalError || error;
  const connectToPartition = original.connectToPartition || explicitConnectToPartition;
  if (!connectToPartition) {
    throw wrapError(error, "caught MissingPartitionConnectionsError",
        "but no error.connectToPartition found: cannot try connecting");
  }
  if (!original.missingPartitions || !original.missingPartitions.length) {
    throw wrapError(error, "caught MissingPartitionConnectionsError",
            "but error.missingPartitions is missing or empty: cannot try connecting");
  }
  const ret = Promise.all(original.missingPartitions.map(missingPartition =>
      ((typeof missingPartition === "string")
          ? connectToPartition(missingPartition)
          : missingPartition) // a promise for an already existing connection process
  )).then(() => callback());
  ret.operationInfo = { lensRole: "pendingConnectionsLens", params: original.missingPartitions };
  return ret;
}

export function addConnectToPartitionToError (error, connectToPartition) {
  (error.originalError || error).connectToPartition = connectToPartition;
  return error;
}


/**
 * Partition system
 *
 * The partition of a Resource is the innermost owning object (or self)
 * which has Partition.partitionAuthorityURI defined. For all non-ghost
 * Resource's the partition is also cached in the
 * id:ValaaReference.getPartitionURI. For ghosts the partition can be
 * fetched from the ghost host.
 */

export function universalizePartitionMutation (bard: Bard, id: VRef) {
  let partitionURI;
  let partitionsUpdate;
  const ref = tryHostRef(id);
  try {
    const eventMeta = bard.event.meta;
    if (!eventMeta.isBeingUniversalized || !ref) return undefined;
    if (ref.isInactive()) throw new Error(`Cannot modify an inactive resource <${ref.toString()}>`);
    let smallestNonGhostId = ref;
    partitionURI = smallestNonGhostId.getPartitionURI();
    if (!partitionURI && smallestNonGhostId.isGhost()) {
      const hostRawId = smallestNonGhostId.getGhostPath().headHostRawId();
      const resolver = Object.create(bard);
      resolver.goToTransientOfRawId(hostRawId, "Resource");
      smallestNonGhostId = resolver.objectId;
      partitionURI = smallestNonGhostId.getPartitionURI();
    }
    // Resources without partitions are allowed but they must be
    // subsequently used in a transaction and assigned partition to be
    // valid.
    // TODO(iridian): Actually add the validations for detecting
    // dangling partitionless resources.
    if (!partitionURI) return undefined;
    partitionURI = String(partitionURI);
    let partitionInfo = (eventMeta.partitions || {})[partitionURI];

    // Fill the meta.partitionURI and meta.partitions properly
    // Invariant rules:
    // 1. if action.meta doesn't have partitionURI explicitly defined
    // then its partitionURI is implicitly the same as the explicitly
    // defined meta.partitionURI of its nearest parent passage.
    // 2. meta.partitions contains all partitionURI's of its children
    // and itself as keys, each with their corresponding partition info
    // structure as values. The partition info corresponding to a
    // partitionURI is shared between all actions.

    let enclosingPassage = bard.passage;
    let enclosingPartitionURI;
    while (enclosingPassage) {
      enclosingPartitionURI = (enclosingPassage.meta || {}).partitionURI;
      if (enclosingPartitionURI) break;
      enclosingPassage = enclosingPassage.parentPassage;
    }
    if (enclosingPartitionURI === partitionURI) return undefined;
    if (!partitionInfo) {
      partitionInfo = {}; // bard.createMutationPartitionInfo(partitionURI);
    }
    let targetMeta = eventMeta;
    if (enclosingPartitionURI) {
      const action = getActionFromPassage(bard.passage);
      // only modify non-virtual actions
      targetMeta = action && (action.meta || (action.meta = {}));
      // do fill all parents
      const enclosingPartitionInfo = enclosingPassage.meta.partitions[enclosingPartitionURI];
      let parentMeta;
      let parentFiller = bard.passage.parentPassage;
      for (; // eslint-disable-line no-cond-assign
          !(parentMeta = parentFiller.meta) || !parentMeta.partitionURI;
          parentFiller = parentFiller.parentPassage) {
        if (!parentMeta) {
          const parentAction = getActionFromPassage(parentFiller);
          if (!parentAction) continue;
          parentMeta = (parentAction.meta = {});
        }
        parentMeta.partitionURI = enclosingPartitionURI;
        parentMeta.partitions = {
          [enclosingPartitionURI]: enclosingPartitionInfo,
          [partitionURI]: partitionInfo,
        };
      }
      for (; parentFiller && !parentFiller.meta.partitions[partitionURI];
          parentFiller = parentFiller.parentPassage) {
        parentFiller.meta.partitions[partitionURI] = partitionInfo;
      }
    }
    if (targetMeta) {
      targetMeta.partitionURI = partitionURI;
      (targetMeta.partitions || (targetMeta.partitions = {}))[partitionURI] = partitionInfo;
      // TODO(iridian): handle the case where a purged prophecy
      // recomposition results in some partitions being removed.
    }
    return partitionURI;
  } catch (error) {
    throw bard.wrapErrorEvent(error, "universalizePartitionMutation",
        "\n\tbard:", ...dumpObject(bard),
        "\n\tid:", id,
        "\n\tref:", ...dumpObject(ref),
        "\n\tpartitionURI:", partitionURI,
        "\n\tpartitionsUpdate:", ...dumpObject(partitionsUpdate));
  }
}

export function resolvePartitionURI (resolver: Resolver, resourceId: VRef) {
  return (!resourceId.isGhost()
          ? resourceId
          : resolver.bindObjectId([resourceId.getGhostPath().headHostRawId()], "Resource"))
      .getPartitionURI();
}

export function setCreatedObjectPartition (mutableTransient: Transient) {
  const transientId = mutableTransient.get("id");
  const partitionURI = determineNewObjectPartition(mutableTransient, transientId);
  if (!partitionURI) return;
  const currentURI = transientId.getPartitionURI();
  if (partitionURI.toString() !== (currentURI && currentURI.toString())) {
    transientId.setPartitionURI(partitionURI);
  }
}

export function setModifiedObjectPartitionAndUpdateOwneeObjectIdPartitions (
    bard: Bard, mutableTransient: Transient) {
  const transientId = mutableTransient.get("id");
  const partitionURI = determineNewObjectPartition(mutableTransient, transientId);
  const oldPartitionURI = transientId.getPartitionURI();
  if ((partitionURI && partitionURI.toString()) !==
      (oldPartitionURI && oldPartitionURI.toString())) {
    mutableTransient.set("id", transientId.immutateWithPartitionURI(partitionURI));
    bard.setState(_updateOwnlingPartitions(bard, mutableTransient, partitionURI, oldPartitionURI));
  }
}

export function determineNewObjectPartition (mutableTransient: Transient, transientId: VRef) {
  const authorityURI = mutableTransient.get("partitionAuthorityURI");
  if (transientId.isGhost()) {
    // Materializing or modifying ghost.
    if (authorityURI) {
      throw new Error(`Ghost objects cannot be partitions; ${
          ""}while trying to set partitionAuthorityURI <${authorityURI}> for ${
              transientId}`);
    }
    transientId.clearPartitionURI();
    return undefined;
  }
  let partitionURI;
  const ownerId = mutableTransient.get("owner");
  if (authorityURI) {
    partitionURI = naiveURI.createPartitionURI(authorityURI, transientId.rawId());
  } else if (ownerId) {
    partitionURI = ownerId.getPartitionURI();
  } else {
    // Don't set partition: this might be a resource which part of a TRANSACTED and has its owner
    // subsequently set.
  }
  return partitionURI;
}

function _updateOwnlingPartitions (bard: Bard, transient: Transient,
    newPartitionURI: ValaaURI, oldPartitionURI: ValaaURI) {
  return bard.getState().withMutations(mutableState => {
    const partitionerBard = Object.create(bard);
    traverseMaterializedOwnlings(partitionerBard, transient, entryId => {
      // skip ghosts: their partition is specified in the host.
      if (entryId.isGhost()
          // specifying "Resource" only traverses actives Resource's.
          || !partitionerBard.tryGoToTransientOfRawId(entryId.rawId(), "Resource")
          || (partitionerBard.objectId.getPartitionURI() !== oldPartitionURI)) return null;
      mutableState.setIn([partitionerBard.objectTypeName, entryId.rawId(), "id"],
              entryId.immutateWithPartitionURI(newPartitionURI));
      return partitionerBard.objectTransient;
    });
  });
}
