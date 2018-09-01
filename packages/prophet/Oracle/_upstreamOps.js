// @flow

import type Command from "~/raem/command";
import { createPartitionURI, getPartitionRawIdFrom } from "~/raem/ValaaURI";
import { MissingPartitionConnectionsError } from "~/raem/tools/denormalized/partitions";

import type { ClaimResult } from "~/prophet/api/Prophet";
import Prophecy from "~/prophet/api/Prophecy";

import { dumpObject, invariantifyObject, thenChainEagerly } from "~/tools";

import Oracle from "./Oracle";

export function _claim (oracle: Oracle, command: Command, options: Object): ClaimResult {
  const operation: any = {
    command, options, authorities: {},
    localFinalizes: null, isLocallyPersisted: false, process: null,
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
  const operationProcess = operation.process = (async () => {
    let remoteAuthority;
    try {
      await Promise.all(operation.authorityPersistProcesses);
      while (oracle._claimOperationQueue[0] !== operation) {
        if (!oracle._claimOperationQueue[0].process) oracle._claimOperationQueue.shift();
        else {
          try {
            await oracle._claimOperationQueue[0].process;
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
      oracle.warnEvent(1, `Done ${remoteAuthority
              ? "queuing a remote command locally"
              : "claiming a local event"} of authority "${authorityURIs[0]}":`,
          "\n\tpartitions:", ...partitionDatas.map(([, conn]) => conn.partitionRawId()),
          "\n\tcommand:", command);

      if (!remoteAuthority) {
        const event = { ...command };
        try {
          partitionDatas.map(([, connection]) =>
              connection._receiveTruth("locallyAuthenticated", event));
        } catch (error) { throw oracle.wrapErrorEvent(error, "claim.local.onConfirmTruth"); }
        return command;
      }
      let ret;
      try {
        ret = await remoteAuthority.claim(command, operation.options).getFinalEvent();
      } catch (error) { throw oracle.wrapErrorEvent(error, "claim.remoteAuthority.claim"); }
      oracle.warnEvent(1, `Done claiming remote command"`, ret);
      return ret;
    } catch (error) {
      throw oracle.wrapErrorEvent(error, "claim",
          "\n\t(command, options):", ...dumpObject(command), ...dumpObject(options),
          "\n\toperation:", ...dumpObject(operation),
          "\n\tremoteAuthority:", remoteAuthority,
          "\n\tthis:", oracle);
    } finally {
      operation.process = null;
    }
  })();
  return {
    prophecy: new Prophecy(command),
    getFinalEvent: () => operationProcess,
  };
}

function _resolveCommandPartitionDatas (oracle: Oracle,
    operation: { command: Command, authorities: any }) {
  const { command } = operation;
  const missingConnections = [];
  if (!command.partitions) {
    throw new Error("command is missing partition information");
  }
  const connections = Object.keys(command.partitions).map((partitionRawId) => {
    const entry = (oracle._partitionConnections || {})[partitionRawId];
    if (entry) {
      if (entry.connection && entry.connection.isFrozen()) {
        throw new Error(`Trying to claim a command against a frozen partition ${
            entry.connection.getName()}`);
      }
      const authorityURI = command.partitions[partitionRawId].partitionAuthorityURI;
      operation.authorities[String(authorityURI)]
          = oracle._authorityNexus.tryAuthorityProphet(authorityURI);
      invariantifyObject(entry.connection || entry.pendingConnection,
          `"entry" must have either "connection" or "pendingConnection"`);
      return [command.partitions[partitionRawId], entry.pendingConnection || entry.connection];
    }
    missingConnections.push(createPartitionURI(
        command.partitions[partitionRawId].partitionAuthorityURI, partitionRawId));
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
  for (const blobId of Object.keys(command.addedBlobReferences || {})) {
    for (const { referrerId } of command.addedBlobReferences[blobId]) {
      let entry;
      try {
        const partitionRawId = getPartitionRawIdFrom(referrerId.partitionURI());
        entry = oracle._partitionConnections[partitionRawId];
        invariantifyObject(entry, `partitionConnections[${partitionRawId}]`);
      } catch (error) { throw onError.call(oracle, blobId, referrerId, error); }
      const persistProcess = thenChainEagerly(entry.pendingConnection || entry.connection,
          (connectedConnection) => {
            const authorityConnection =
                connectedConnection.getDependentConnection("authorityUpstream");
            return authorityConnection && authorityConnection.getContentPersistProcess(blobId);
          },
          onError.bind(oracle, blobId, referrerId));
      if (persistProcess) ret.push(persistProcess);
    }
  }
  return ret;
  function onError (blobId, referrerId, error) {
    return oracle.wrapErrorEvent(error, "_getOngoingAuthorityPersists",
            "\n\tcurrent referrerId:", ...dumpObject(referrerId),
            "\n\tcurrent blobId:", ...dumpObject(blobId),
            "\n\tret (so far):", ...dumpObject(ret),
            "\n\tcommand:", ...dumpObject(command));
  }
}
