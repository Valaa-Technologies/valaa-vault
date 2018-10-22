// @flow

import Command, { isTransactedLike } from "~/raem/command";
import { getActionFromPassage } from "~/raem/redux/Bard";
import { MissingPartitionConnectionsError } from "~/raem/tools/denormalized/partitions";
import { createPartitionURI } from "~/raem/ValaaURI";

import type { ClaimResult } from "~/prophet/api/Prophet";

import { dumpObject, outputError, thenChainEagerly } from "~/tools";

import FalseProphet, { Proclamation } from "./FalseProphet";
import { _rejectLastProphecyAsHeresy } from "./_prophecyOps";
import FalseProphetPartitionConnection from "./FalseProphetPartitionConnection";

// Handle a proclamation towards upstream.
export function _proclaim (falseProphet: FalseProphet, proclamation: Proclamation,
    { timed, transactionInfo } = {}): ClaimResult {
  const prophecy = falseProphet._fabricateProphecy(proclamation, "proclaim", timed,
      transactionInfo);
  // falseProphet.warnEvent("\n\tclaim", proclamation.commandId, proclamation,
  //    ...falseProphet._dumpStatus());
  let getFinalStory;
  let getCommandOf;
  if (!timed) {
    try {
      const operation = { prophecy };
      _extractSubOpsFromClaim(falseProphet, getActionFromPassage(prophecy.story), operation);
      _initiateSubOpConnectionValidation(falseProphet, operation);
      operation.finalStory = _processClaim(falseProphet, operation);
      getFinalStory = () => operation.finalStory;
      getCommandOf = (partitionURI) => operation.partitionCommands[String(partitionURI)];
    } catch (error) {
      try {
        _rejectLastProphecyAsHeresy(falseProphet, prophecy.story);
      } catch (innerError) {
        outputError(innerError, `Caught an exception in the exception handler of${
            ""} a proclaim; the resulting purge threw exception of its own:`);
      }
      throw falseProphet.wrapErrorEvent(error, new Error(`proclaim()`),
          "\n\tproclamation:", ...dumpObject(proclamation),
          "\n\tprophecy (purged from corpus):", ...dumpObject(prophecy));
    }
  } else {
    getFinalStory = () => prophecy && prophecy.story;
  }
  let result;
  try {
    result = falseProphet._revealProphecyToAllFollowers(prophecy);
    result.getFinalStory = getFinalStory;
    result.getCommandOf = getCommandOf;
    result.getStoryPremiere = () => thenChainEagerly(null, [
      // Returns a promise which will resolve to the content received from the backend
      // but only after all the local follower reactions have been resolved as well
      // TODO(iridian): Exceptions from follower reactions can't reject the proclaim, but we should
      // catch and handle and/or expose them to the proclaim originator somehow.
      () => result.getFollowerReactions(),
      // TODO(iridian): Exceptions from upstream signal failure and possible heresy: we should
      // catch and have logic for either retrying the operation or for full rejection.
      // Nevertheless flushing the corpus is needed.
      () => result.getFinalStory(),
    ], errorOnClaim.bind(null, new Error("proclaim.getStoryPremiere()")));
    return result;
  } catch (error) { return errorOnClaim.call(new Error("proclaim.finalizeResult()"), error); }
  function errorOnClaim (errorWrap, error) {
    falseProphet.wrapErrorEvent(error, wrappingError,
        "\n\tproclamation:", ...dumpObject(proclamation),
        "\n\tprophecy:", ...dumpObject(prophecy),
        "\n\tresult:", ...dumpObject(result));
  }
}

// Re-proclaim on application refresh commands which were cached but not yet resolved.
// The command is already universalized and there's no need to collect handler return values.
export function _repeatClaim (falseProphet: FalseProphet, command: Command) {
  if (falseProphet._prophecyByCommandId[command.commandId]) return undefined; // dedup
  // falseProphet.warnEvent("\n\trepeatClaim", command.commandId, command,
  //    ...falseProphet._dumpStatus());
  const prophecy = falseProphet._fabricateProphecy(command,
      `re-proclaim ${command.commandId.slice(0, 13)}...`);
  falseProphet._revealProphecyToAllFollowers(prophecy);
  return prophecy;
}

function _extractSubOpsFromClaim (falseProphet: FalseProphet, proclamation: Proclamation,
    operation: Object) {
  operation.proclamation = proclamation;
  operation.partitionCommands = {};
  operation.subOperations = [];
  const missingConnections = [];
  if (!proclamation.partitions) {
    throw new Error("proclamation is missing partition information");
  }
  const remotes = [];
  const locals = [];
  const memorys = [];
  Object.keys(proclamation.partitions).forEach((partitionURIString) => {
    const connection = falseProphet._connections[partitionURIString];
    if (!connection) {
      missingConnections.push(createPartitionURI(partitionURIString));
      return;
    }
    const commandEvent = extractCommandOf(falseProphet, proclamation, partitionURIString,
        connection);
    operation.partitionCommands[partitionURIString] = commandEvent;
    (connection.isRemoteAuthority() ? remotes
        : connection.isLocallyPersisted() ? locals
        : memorys).push({ connection, commandEvent });
  });
  if (remotes.length) operation.subOperations.push({ name: "remotes", partitions: remotes });
  if (locals.length) operation.subOperations.push({ name: "locals", partitions: locals });
  if (memorys.length) operation.subOperations.push({ name: "memory", partitions: memorys });
  if (missingConnections.length) {
    throw new MissingPartitionConnectionsError(`Missing active partition connections: '${
        missingConnections.map(c => c.toString()).join("', '")}'`, missingConnections);
  }
}

function extractCommandOf (falseProphet: FalseProphet, proclamation: Proclamation,
    partitionURIString: string, connection: FalseProphetPartitionConnection) {
  let ret;
  try {
    if (!(proclamation.partitions || {})[partitionURIString]) return undefined;
    ret = { ...proclamation };
    delete ret.partitions;
    if (!ret.version) {
      // TODO(iridian): Fix @valos/raem so that it doesn't generate these in the first place.
      delete ret.commandId;
    }
    if (Object.keys(proclamation.partitions).length !== 1) {
      if (!isTransactedLike(proclamation)) {
        throw new Error("Non-TRANSACTED-like multipartition commands are not supported");
      }
      ret.actions = proclamation.actions.map(action =>
          extractCommandOf(falseProphet, action, partitionURIString, connection))
              .filter(notFalsy => notFalsy);
      if (!ret.actions.length) {
        throw new Error(`INTERNAL ERROR: No TRANSACTED-like.actions found for current partition ${
            ""}in a multi-partition TRANSACTED-like proclamation`);
      }
    }
    return ret;
  } catch (error) {
    throw falseProphet.wrapErrorEvent(error,
        new Error(`extractCommandOf(${connection.getName()})`),
        "\n\tclaim:", ...dumpObject(proclamation),
        "\n\tclaim partitions:", ...dumpObject(proclamation.partitions),
        "\n\tcurrent ret:", ...dumpObject(ret),
    );
  }
}

function _initiateSubOpConnectionValidation (falseProphet: FalseProphet, operation: Object) {
  operation.subOperations.forEach(subOperation =>
    subOperation.partitions.forEach(partition => {
      partition.connection = thenChainEagerly(partition.connection.getSyncedConnection(),
        (syncedConnection) => {
          if (partition.connection.isFrozen()) {
            throw new Error(`Trying to proclaim to a frozen partition ${
              partition.connection.getName()}`);
          }
          // Perform other partition validation
          // TODO(iridian): extract partition content
          return (partition.connection = syncedConnection);
        },
      );
    })
  );
}

async function _processClaim (falseProphet: FalseProphet, operation: Object) {
  falseProphet._claimOperationQueue.push(operation);
  for (const subOperation of operation.subOperations) {
    try {
      await _processClaimSubOp(falseProphet, subOperation);
    } catch (error) {
      throw falseProphet.wrapErrorEvent(error,
          new Error(`proclaim._processClaimSubOp(${subOperation.name})`),
          "\n\toperation:", ...dumpObject(operation),
          "\n\tsubOperation.partitions:", ...dumpObject(subOperation.partitions),
          "\n\tthis:", falseProphet);
    }
  }
  return operation.prophecy.story;
}

async function _processClaimSubOp (falseProphet: FalseProphet, subOperation: Object) {
  try {
    // wait for connections to sync and validate their post-sync
    // conditions (started in _initiateSubOpConnectionValidation)
    await Promise.all(subOperation.partitions.map(partition => partition.connection));
  } catch (error) {
    throw falseProphet.wrapErrorEvent(error, "proclaim.subOp.connection");
  }

  // Persist the proclamation and add refs to all associated event bvobs.
  // This is necessary for proclamation reattempts so that the bvobs
  // are not garbage collected on browser refresh. Otherwise they can't
  // be reuploaded if their upload didn't finish before refresh.
  // TODO(iridian): Implement.

  // Wait for remote bvob persists to complete.
  // TODO(iridian): Implement.
  // await Promise.all(operation.authorityPersistProcesses);

  // Maybe determine eventId's beforehand?

  // Get eventId and scribe persist finalizer for each partition
  const truths = [];
  for (const { connection, commandEvent } of subOperation.partitions) {
    let eventChronichling;
    try {
      eventChronichling = (await connection.chronicleEventLog(
          [commandEvent], { reduced: true })).eventResults[0];
      truths.push(eventChronichling.getTruthEvent());
    } catch (error) {
      throw falseProphet.wrapErrorEvent(error,
          new Error(`proclaim.process.subOp["${connection.getName()}"].chonicleEventLog`),
          "\n\tcommandEvent:", ...dumpObject(commandEvent),
          "\n\tevent chronichling:", ...dumpObject(eventChronichling),
      );
    }
  }
  await Promise.all(truths);
}

/*
while (falseProphet._claimOperationQueue[0] !== operation) {
  if (!falseProphet._claimOperationQueue[0].pendingClaim) {
    falseProphet._claimOperationQueue.shift();
  } else {
    try {
      await falseProphet._claimOperationQueue[0].pendingClaim;
    } catch (error) {
      // Silence errors which arise from other proclaim operations.
    }
  }
}

remoteAuthority = operation.authorities[authorityURIs[0]];
if (falseProphet.getDebugLevel() === 1) {
  falseProphet.logEvent(1, `${remoteAuthority
    ? "Queued a remote command locally"
    : "Done claiming a local event"} of authority "${authorityURIs[0]}":`,
    "of partitions:", ...[].concat(
        ...partitionDatas.map(([pdata, conn]) => [conn.getName(), pdata.eventId])));
} else if (falseProphet.getDebugLevel() >= 2) {
  falseProphet.warnEvent(2, `Done ${remoteAuthority
          ? "queuing a remote command locally"
          : "claiming a local event"} of authority "${authorityURIs[0]}":`,
      "\n\tpartitions:", ...partitionDatas.map(([, conn]) => conn.getName()),
      "\n\tcommand:", operation.proclamation);
}

if (!remoteAuthority) {
  const event = { ...operation.proclamation };
  try {
    partitionDatas.map(([, connection]) =>
        connection._receiveTruthOf("localAuthority", event));
  } catch (error) {
    throw falseProphet.wrapErrorEvent(error, new Error("proclaim.local.onConfirmTruth"));
  }
  return operation.proclamation;
}
let ret;
try {
  ret = await remoteAuthority.proclaim(operation.proclamation, operation.options)
      .getStoryPremiere();
} catch (error) {
  throw falseProphet.wrapErrorEvent(error, new Error("proclaim.remoteAuthority.proclaim"));
}
if (falseProphet.getDebugLevel() === 1) {
  falseProphet.logEvent(1, `Done claiming remote command of authority`, remoteAuthority,
      "and of partitions:", ...[].concat(
        ...partitionDatas.map(([pdata, conn]) => [conn.getName(), pdata.eventId])));
} else if (falseProphet.getDebugLevel() === 2) {
  falseProphet.warnEvent(2, `Done claiming remote command"`, ret);
}
*/

/*
  const authorityURIs = Object.keys(operation.authorities);
  if (!authorityURIs.length) throw new Error("command is missing authority information");
  else if (authorityURIs.length > 1) {
    throw new Error(`Valaa FalseProphet: multi-authority commands not supported, authorities:"${
        authorityURIs.join(`", "`)}"`);
  }

// operation.authorityPersistProcesses = _getOngoingAuthorityPersists(falseProphet, operation);

function _getOngoingAuthorityPersists (falseProphet: FalseProphet, { command }: Object) {
  const ret = [];
  for (const bvobId of Object.keys(command.addedBvobReferences || {})) {
    for (const { referrerId } of command.addedBvobReferences[bvobId]) {
      let connection;
      try {
        const partitionURIString = String(referrerId.getPartitionURI());
        connection = falseProphet._connections[partitionURIString];
        invariantifyObject(connection, `partitionConnections[${partitionURIString}]`);
      } catch (error) {
        throw errorOnGetOngoingAuthorityPersists.call(falseProphet, bvobId, referrerId, error);
      }
      const persistProcess = thenChainEagerly(
          connection.getSyncedConnection(),
          () => {
            const authorityConnection = connection.getUpstreamConnection();
            return authorityConnection && authorityConnection.getContentPersistProcess(bvobId);
          },
          errorOnGetOngoingAuthorityPersists.bind(falseProphet, bvobId, referrerId),
      );
      if (persistProcess) ret.push(persistProcess);
    }
  }
  return ret;
  function errorOnGetOngoingAuthorityPersists (bvobId, referrerId, error) {
    return falseProphet.wrapErrorEvent(error, new Error("_getOngoingAuthorityPersists"),
            "\n\tcurrent referrerId:", ...dumpObject(referrerId),
            "\n\tcurrent bvobId:", ...dumpObject(bvobId),
            "\n\tret (so far):", ...dumpObject(ret),
            "\n\tcommand:", ...dumpObject(command));
  }
}
*/
