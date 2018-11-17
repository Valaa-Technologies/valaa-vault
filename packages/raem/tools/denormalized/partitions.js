import { VRef } from "~/raem/ValaaReference";

import Bard, { getActionFromPassage } from "~/raem/redux/Bard";
import { tryHostRef } from "~/raem/VALK/hostReference";
import ValaaURI, { createPartitionURI } from "~/raem/ValaaURI";
import Resolver from "~/raem/tools/denormalized/Resolver";
import Transient from "~/raem/tools/denormalized/Transient";
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

export function asyncConnectToPartitionsIfMissingAndRetry (call) {
  return function autoConnectingCall (...args: any[]) {
    return tryCall.call(this, call, ...args);
  };
}

function tryCall (call: any, ...args: any[]) {
  try {
    return call.apply(this, args);
  } catch (error) {
    if (!(unwrapError(error) instanceof MissingPartitionConnectionsError)) throw error;
    try {
      return connectToMissingPartitionsAndThen(error, () => tryCall.call(this, call, ...args));
    } catch (innerError) {
      throw wrapError(innerError,
        `During @asyncConnectToPartitionsIfMissingAndRetry(${call.name}):`,
        "\n\thint: use partitions:addConnectToPartitionToError to add it",
        "\n\tcall:", ...dumpObject(call),
        "\n\targs:", ...dumpObject(args));
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
      (missingPartition instanceof ValaaURI
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
  let partitions;
  try {
    const ref = tryHostRef(id);
    if (!bard.story.isBeingUniversalized || !ref) return undefined;
    if (ref.isInactive()) throw new Error("Cannot modify an inactive resource");
    let smallestNonGhostId = ref;
    partitionURI = smallestNonGhostId.getPartitionURI();
    if (!partitionURI && smallestNonGhostId.isGhost()) {
      const hostRawId = smallestNonGhostId.getGhostPath().headHostRawId();
      const resolver = Object.create(bard);
      resolver.goToTransientOfRawId(hostRawId, "Resource");
      smallestNonGhostId = resolver.objectId;
      partitionURI = smallestNonGhostId.getPartitionURI();
    }
    // Resources without partitions are allowed: they must appear and be subsequently used in a
    // transaction to be valid, otherwise they're considered dangling and are not allowed.
    // TODO(iridian): Add validations for detecting dangling partitionless resources.
    if (!partitionURI) return undefined;
    partitionURI = String(partitionURI);
    // ? String(partitionURI)
    // : `valaa-memory:?id=${smallestNonGhostId.rawId()}`;

    let matchingPassage = bard.passage;
    // Find or create the partitions with an existing matching partitionURI entry
    for (; matchingPassage; matchingPassage = matchingPassage.parentPassage) {
      const partitionHit = (matchingPassage.partitions || {})[partitionURI];
      if (!partitionHit) continue;
      partitions = Object.keys(matchingPassage.partitions) === 1
          ? matchingPassage.partitions
          : { [partitionURI]: partitionHit };
      break;
    }
    // Assign the partitions with current partitionURI to all passages in the current branch.
    for (let passage = bard.passage; passage !== matchingPassage; passage = passage.parentPassage) {
      // Absolutize to the action.partitions (passage doesn't go upstream).
      const action = getActionFromPassage(passage);
      // skip virtual passages which don't have underlying actions
      if (!action || action === Object.prototype) continue;
      if (!partitions) {
        partitions = { [partitionURI]: {} };
      }
      action.partitions = !action.partitions
          ? partitions
          : Object.assign({}, action.partitions, partitions);
    }
    return partitionURI;
  } catch (error) {
    throw bard.wrapErrorEvent(error, "universalizePartitionMutation",
        "\n\tbard:", ...dumpObject(bard),
        "\n\tid:", id,
        "\n\tpartitionURI:", partitionURI,
        "\n\tpartitions:", ...dumpObject(partitions));
  }
}

export function resolvePartitionURI (resolver: Resolver, resourceId: VRef) {
  if (!resourceId.isGhost()) return resourceId.getPartitionURI();
  return resolver.bindObjectId(resourceId.getGhostPath().headHostRawId()).getPartitionURI();
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
    mutableTransient.set("id", transientId.immutatePartitionURI(partitionURI));
    bard.setState(_updateOwnlingPartitions(bard, mutableTransient, partitionURI, oldPartitionURI));
  }
}

export function determineNewObjectPartition (mutableTransient: Transient, transientId: VRef) {
  const partitionAuthorityURIString = mutableTransient.get("partitionAuthorityURI");
  if (transientId.isGhost()) {
    // Materializing or modifying ghost.
    if (partitionAuthorityURIString) {
      throw new Error(`Ghost objects cannot be partitions; ${
          ""}while trying to set partitionAuthorityURI '${partitionAuthorityURIString}' for ${
              transientId}`);
    }
    transientId.clearPartitionURI();
    return undefined;
  }
  let partitionURI;
  const ownerId = mutableTransient.get("owner");
  if (partitionAuthorityURIString) {
    partitionURI = createPartitionURI(partitionAuthorityURIString, transientId.rawId());
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
        // specifying "Resource" and not "ResourceStub" skips inactive Resource's as a side-effect.
          || !partitionerBard.tryGoToTransientOfRawId(entryId.rawId(), "Resource")
          || (partitionerBard.objectId.getPartitionURI() !== oldPartitionURI)) return null;
      mutableState.setIn([partitionerBard.typeName, entryId.rawId(), "id"],
              entryId.immutatePartition(newPartitionURI));
      return partitionerBard.objectTransient;
    });
  });
}
