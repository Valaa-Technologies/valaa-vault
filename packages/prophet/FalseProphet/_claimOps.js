// @flow

import type Command from "~/raem/command";
import { getActionFromPassage } from "~/raem/redux/Bard";
import { MissingPartitionConnectionsError } from "~/raem/tools/denormalized/partitions";
import { createPartitionURI } from "~/raem/ValaaURI";

import type { ClaimResult } from "~/prophet/api/Prophet";

import { dumpObject, outputError, thenChainEagerly } from "~/tools";

import FalseProphet from "./FalseProphet";
import { _rejectLastProphecyAsHeresy } from "./_prophecyOps";

// Handle a restricted command claim towards upstream.
export function _claim (falseProphet: FalseProphet, restrictedCommand: Command,
    { timed, transactionInfo } = {}): ClaimResult {
  const prophecy = falseProphet._fabricateProphecy(restrictedCommand, "claim", timed,
      transactionInfo);
  // falseProphet.warnEvent("\n\tclaim", restrictedCommand.commandId, restrictedCommand,
  //    ...falseProphet._dumpStatus());
  let getBackendFinalEvent;
  if (!timed) {
    try {
      const operation = {};
      _extractSubOpsFromClaim(falseProphet, prophecy.story, operation);
      _initiateSubOpConnectionValidation(falseProphet, operation.orderedSubOps);
      operation.finalEvent = _processClaimSubOps(falseProphet, operation);
      getBackendFinalEvent = () => operation.finalEvent;
    } catch (error) {
      try {
        _rejectLastProphecyAsHeresy(falseProphet, prophecy.story);
      } catch (innerError) {
        outputError(innerError, `Caught an exception in the exception handler of${
            ""} a claim; the resulting purge threw exception of its own:`);
      }
      throw falseProphet.wrapErrorEvent(error, `claim():`,
          "\n\trestrictedCommand:", ...dumpObject(restrictedCommand),
          "\n\tprophecy (purged from corpus):", ...dumpObject(prophecy));
    }
  } else {
    getBackendFinalEvent = () => prophecy && prophecy.story;
  }
  let result;
  const onPostError = (error) => falseProphet.wrapErrorEvent(error, `claim().finalEvent:`,
      "\n\trestrictedCommand:", ...dumpObject(restrictedCommand),
      "\n\tprophecy:", ...dumpObject(prophecy),
      "\n\tresult:", ...dumpObject(result));
  try {
    result = falseProphet._revealProphecyToAllFollowers(prophecy);
    result.getBackendFinalEvent = getBackendFinalEvent;
    result.getFinalEvent = () => thenChainEagerly(null, [
      // Returns a promise which will resolve to the content received from the backend
      // but only after all the local follower reactions have been resolved as well
      // TODO(iridian): Exceptions from follower reactions can't reject the claim, but we should
      // catch and handle and/or expose them to the claim originator somehow.
      () => result.getFollowerReactions(),
      // TODO(iridian): Exceptions from upstream signal failure and possible heresy: we should
      // catch and have logic for either retrying the operation or for full rejection.
      // Nevertheless flushing the corpus is needed.
      () => result.getBackendFinalEvent(),
    ], onPostError);
    return result;
  } catch (error) {
    throw onPostError(error);
  }
}

// Re-claim on application refresh commands which were cached but not yet resolved.
// The command is already universalized and there's no need to collect handler return values.
export function _repeatClaim (falseProphet: FalseProphet, universalCommand: Command) {
  if (falseProphet._prophecyByCommandId[universalCommand.commandId]) return undefined; // dedup
  // falseProphet.warnEvent("\n\trepeatClaim", universalCommand.commandId, universalCommand,
  //    ...falseProphet._dumpStatus());
  const prophecy = falseProphet._fabricateProphecy(universalCommand,
      `re-claim ${universalCommand.commandId.slice(0, 13)}...`);
  falseProphet._revealProphecyToAllFollowers(prophecy);
  return prophecy;
}

function _extractSubOpsFromClaim (falseProphet: FalseProphet, claim: Command,
    operation: Object) {
  operation.command = getActionFromPassage(claim);
  operation.orderedSubOps = [];
  const missingConnections = [];
  if (!claim.partitions) {
    throw new Error("command is missing partition information");
  }
  Object.keys(claim.partitions).forEach((partitionURIString) => {
    const connection = falseProphet._connections[partitionURIString];
    if (!connection) {
      missingConnections.push(createPartitionURI(partitionURIString));
      return;
    }
    operation.orderedSubOps.push({
      connection,
      partitionInfo: claim.partitions[partitionURIString],
      commandEvent: {}, // FIXME(iridian): Command event splitting implementation missing.
    });
  });
  if (missingConnections.length) {
    throw new MissingPartitionConnectionsError(`Missing active partition connections: '${
        missingConnections.map(c => c.toString()).join("', '")}'`, missingConnections);
  }
}

async function _initiateSubOpConnectionValidation (falseProphet: FalseProphet, operation: Object) {
  operation.orderedSubOps.forEach(subOp => {
    subOp.connection = thenChainEagerly(subOp.connection.getSyncedConnection(),
      (syncedConnection) => {
        if (subOp.connection.isFrozen()) {
          throw new Error(`Trying to claim a command to a frozen partition ${
              subOp.connection.getName()}`);
        }
        // Perform other partition validation
        // TODO(iridian): extract partition content
        return (subOp.connection = syncedConnection);
      },
    );
  });
}

async function _processClaimSubOps (falseProphet: FalseProphet, operation: Object) {
  let ret;
  try {
    falseProphet._claimOperationQueue.push(operation);
    try {
      // wait for connections to sync and validate their post-sync
      // conditions (started in _initiateSubOpConnectionValidation)
      await Promise.all(operation.orderedSubOps.map(subOp => subOp.connection));
    } catch (error) {
      throw falseProphet.wrapErrorEvent(error, "claim.subOp.connection");
    }

    // Persist the command and add refs to all associated event bvobs, so that the bvobs are not
    // garbage collected on browser refresh, so that they can be reuploaded if their upload didn't
    // finish before refresh. Because maybe the client is offline.
    // TODO(iridian): Implement.

    // Wait for remote bvob persists to complete.
    // TODO(iridian): Implement.
    // await Promise.all(operation.authorityPersistProcesses);

    // Maybe determine eventId's beforehand?

    // Get eventId and scribe persist finalizer for each partition
    for (const subOp of operation.orderedSubOps) {
      try {
        if (subOp.connection.isFrozen()) {
          throw new Error(`Trying to claim a command against a frozen partition ${
            subOp.connection.getName()}`);
        }
        const { eventId } = await subOp.connection.chronicleEventLog([subOp.commandEvent])[0];
        subOp.eventId = eventId;
      } catch (error) {
        throw falseProphet.wrapErrorEvent(error,
            `claim.process.subOp["${subOp.connection.getName()}"].chonicleEventLog`,
            "\n\tsubOp.commandEvent", ...dumpObject(subOp.commandEvent),
            "\n\tsubOp:", ...dumpObject(subOp),
        );
      }
    }
    return ret;
  } catch (error) {
    throw falseProphet.wrapErrorEvent(error, "claim._processClaimSubOps",
        "\n\t(command, options):", ...dumpObject(operation.command),
        "\n\toperation:", ...dumpObject(operation),
        "\n\tthis:", falseProphet);
  } finally {
    operation.finalEvent = ret;
  }
}

/*
while (falseProphet._claimOperationQueue[0] !== operation) {
  if (!falseProphet._claimOperationQueue[0].pendingClaim) {
    falseProphet._claimOperationQueue.shift();
  } else {
    try {
      await falseProphet._claimOperationQueue[0].pendingClaim;
    } catch (error) {
      // Silence errors which arise from other claim operations.
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
      "\n\tcommand:", operation.command);
}

if (!remoteAuthority) {
  const event = { ...operation.command };
  try {
    partitionDatas.map(([, connection]) =>
        connection._receiveTruthOf("localAuthority", event));
  } catch (error) { throw falseProphet.wrapErrorEvent(error, "claim.local.onConfirmTruth"); }
  return operation.command;
}
let ret;
try {
  ret = await remoteAuthority.claim(operation.command, operation.options).getFinalEvent();
} catch (error) { throw falseProphet.wrapErrorEvent(error, "claim.remoteAuthority.claim"); }
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
      } catch (error) { throw onError.call(falseProphet, bvobId, referrerId, error); }
      const persistProcess = thenChainEagerly(
          connection.getSyncedConnection(),
          () => {
            const authorityConnection = connection.getUpstreamConnection();
            return authorityConnection && authorityConnection.getContentPersistProcess(bvobId);
          },
          onError.bind(falseProphet, bvobId, referrerId),
      );
      if (persistProcess) ret.push(persistProcess);
    }
  }
  return ret;
  function onError (bvobId, referrerId, error) {
    return falseProphet.wrapErrorEvent(error, "_getOngoingAuthorityPersists",
            "\n\tcurrent referrerId:", ...dumpObject(referrerId),
            "\n\tcurrent bvobId:", ...dumpObject(bvobId),
            "\n\tret (so far):", ...dumpObject(ret),
            "\n\tcommand:", ...dumpObject(command));
  }
}
*/
