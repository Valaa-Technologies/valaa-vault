// @flow

import type Command from "~/raem/command";
import { createPartitionURI, getValaaURI } from "~/raem/ValaaURI";
import { MissingPartitionConnectionsError } from "~/raem/tools/denormalized/partitions";

import type { ClaimResult } from "~/prophet/api/Prophet";
import Prophecy from "~/prophet/api/Prophecy";

import { dumpObject, invariantifyObject, thenChainEagerly } from "~/tools";

import Oracle from "./Oracle";

export function _claim (oracle: Oracle, command: Command, options: Object): ClaimResult {
  const operation: any = {
    command, options, authorities: {},
    localFinalizes: null, isLocallyPersisted: false, pendingClaim: null,
  };
  operation.partitionProcesses = _resolveCommandPartitionDatas(oracle, operation);

  const authorityURIs = Object.keys(operation.authorities);
  if (!authorityURIs.length) throw new Error("command is missing authority information");
  else if (authorityURIs.length > 1) {
    throw new Error(`Valaa Oracle: multi-authority commands not supported, with authorities: "${
        authorityURIs.join(`", "`)}"`);
  }

  operation.authorityPersistProcesses = _getOngoingAuthorityPersists(oracle, operation);

  oracle._claimOperationQueue.push(operation);
  const pendingOperationClaim = operation.pendingClaim = (async () => {
    let remoteAuthority;
    try {
      await Promise.all(operation.authorityPersistProcesses);
      while (oracle._claimOperationQueue[0] !== operation) {
        if (!oracle._claimOperationQueue[0].pendingClaim) oracle._claimOperationQueue.shift();
        else {
          try {
            await oracle._claimOperationQueue[0].pendingClaim;
          } catch (error) {
            // Silence errors which arise from other claim processes.
          }
        }
      }

      let partitionDatas;
      try {
        partitionDatas = await Promise.all(operation.partitionProcesses);
      } catch (error) { throw oracle.wrapErrorEvent(error, "claim.partitionProcesses"); }

      try {
        await Promise.all(
            partitionDatas
            // Get eventId and scribe persist finalizer for each partition
            .map(([partitionData, connection]) => {
              if (connection.isFrozen()) {
                throw new Error(`Trying to claim a command against a frozen partition ${
                    connection.getName()}`);
              }
              const { eventId, finalizeLocal } = connection.claimCommandEvent(command);
              partitionData.eventId = eventId;
              return finalizeLocal;
            })
            // Finalize the command on each scribe partition only after we have successfully
            // resolved an eventId for each partition.
            .map(finalizeLocal => finalizeLocal(command)));
      } catch (error) { throw oracle.wrapErrorEvent(error, "claim.claimCommandEvent"); }

      remoteAuthority = operation.authorities[authorityURIs[0]];
      if (oracle.getDebugLevel() === 1) {
        oracle.logEvent(1, `${remoteAuthority
          ? "Queued a remote command locally"
          : "Done claiming a local event"} of authority "${authorityURIs[0]}":`,
          "of partitions:", ...[].concat(
              ...partitionDatas.map(([pdata, conn]) => [conn.getName(), pdata.eventId])));
      } else if (oracle.getDebugLevel() >= 2) {
        oracle.warnEvent(2, `Done ${remoteAuthority
                ? "queuing a remote command locally"
                : "claiming a local event"} of authority "${authorityURIs[0]}":`,
            "\n\tpartitions:", ...partitionDatas.map(([, conn]) => conn.getName()),
            "\n\tcommand:", command);
      }

      if (!remoteAuthority) {
        const event = { ...command };
        try {
          partitionDatas.map(([, connection]) =>
              connection._receiveTruthOf("localAuthority", event));
        } catch (error) { throw oracle.wrapErrorEvent(error, "claim.local.onConfirmTruth"); }
        return command;
      }
      let ret;
      try {
        ret = await remoteAuthority.claim(command, operation.options).getFinalEvent();
      } catch (error) { throw oracle.wrapErrorEvent(error, "claim.remoteAuthority.claim"); }
      if (oracle.getDebugLevel() === 1) {
        oracle.logEvent(1, `Done claiming remote command of authority`, remoteAuthority,
            "and of partitions:", ...[].concat(
              ...partitionDatas.map(([pdata, conn]) => [conn.getName(), pdata.eventId])));
      } else if (oracle.getDebugLevel() === 2) {
        oracle.warnEvent(2, `Done claiming remote command"`, ret);
      }
      return ret;
    } catch (error) {
      throw oracle.wrapErrorEvent(error, "claim",
          "\n\t(command, options):", ...dumpObject(command), ...dumpObject(options),
          "\n\toperation:", ...dumpObject(operation),
          "\n\tremoteAuthority:", remoteAuthority,
          "\n\tthis:", oracle);
    } finally {
      operation.pendingClaim = null;
    }
  })();
  return {
    prophecy: new Prophecy(command),
    getFinalEvent: () => pendingOperationClaim,
  };
}

function _resolveCommandPartitionDatas (oracle: Oracle,
    operation: { command: Command, authorities: any }) {
  const { command } = operation;
  const missingConnections = [];
  if (!command.partitions) {
    throw new Error("command is missing partition information");
  }
  const connections = Object.keys(command.partitions).map((partitionURIString) => {
    const commandPartitionSection = command.partitions[partitionURIString];
    const entry = (oracle._partitionConnections || {})[partitionURIString];
    if (entry) {
      if (entry.connection && entry.connection.isFrozen()) {
        throw new Error(`Trying to claim a command against a frozen partition ${
            entry.connection.getName()}`);
      }
      const authorityURI = oracle._authorityNexus
          .getAuthorityURIFromPartitionURI(getValaaURI(partitionURIString));
      operation.authorities[String(authorityURI)]
          = oracle._authorityNexus.tryAuthorityProphet(authorityURI);
      invariantifyObject(entry.connection || entry.pendingConnection,
          `"entry" must have either "connection" or "pendingConnection"`);
      return [commandPartitionSection, entry.pendingConnection || entry.connection];
    }
    missingConnections.push(createPartitionURI(partitionURIString));
    return [];
  });
  if (missingConnections.length) {
    throw new MissingPartitionConnectionsError(`Missing active partition connections: '${
        missingConnections.map(c => c.toString()).join("', '")}'`, missingConnections);
  }
  return connections.map(async ([commandPartitionData, potentiallyPendingConnection]) => {
    const connection = await potentiallyPendingConnection;
    return [commandPartitionData, connection];
  });
}

function _getOngoingAuthorityPersists (oracle: Oracle, { command }: Object) {
  const ret = [];
  for (const bvobId of Object.keys(command.addedBvobReferences || {})) {
    for (const { referrerId } of command.addedBvobReferences[bvobId]) {
      let entry;
      try {
        const partitionURIString = String(referrerId.getPartitionURI());
        entry = oracle._partitionConnections[partitionURIString];
        invariantifyObject(entry, `partitionConnections[${partitionURIString}]`);
      } catch (error) { throw onError.call(oracle, bvobId, referrerId, error); }
      const persistProcess = thenChainEagerly(entry.pendingConnection || entry.connection,
          (connectedConnection) => {
            const authorityConnection =
                connectedConnection.getDependentConnection("authorityUpstream");
            return authorityConnection && authorityConnection.getContentPersistProcess(bvobId);
          },
          onError.bind(oracle, bvobId, referrerId));
      if (persistProcess) ret.push(persistProcess);
    }
  }
  return ret;
  function onError (bvobId, referrerId, error) {
    return oracle.wrapErrorEvent(error, "_getOngoingAuthorityPersists",
            "\n\tcurrent referrerId:", ...dumpObject(referrerId),
            "\n\tcurrent bvobId:", ...dumpObject(bvobId),
            "\n\tret (so far):", ...dumpObject(ret),
            "\n\tcommand:", ...dumpObject(command));
  }
}
