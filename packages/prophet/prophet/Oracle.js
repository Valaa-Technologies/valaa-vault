// @flow

import type Command from "~/raem/command";
import ValaaURI, { createPartitionURI, getPartitionRawIdFrom } from "~/raem/ValaaURI";
import { MissingPartitionConnectionsError } from "~/raem/tools/denormalized/partitions";

import Prophet, { ClaimResult, NarrateOptions } from "~/prophet/api/Prophet";
import Prophecy from "~/prophet/api/Prophecy";

import OraclePartitionConnection from "~/prophet/prophet/OraclePartitionConnection";

import { dumpObject, invariantifyObject, thenChainEagerly } from "~/tools";

/**
 * Oracle is the central hub for routing content and metadata streams between the downstream users,
 * upstream authorities and local caches.
 *
 * 1. Provides downstream multi-partition event synchronization and deduplication by gating
 * individual partition event downstreams until all partitions reach the same point.
 *
 * 2. Provides media blob pre-caching by gating downstream events until all required blob content
 * has been retrieved and stored in scribe.
 *
 * 3. Provides upstream media command gating by making sure all associated blob content is stored in
 * corresponding authority storage before letting the commands go further upstream.
 *
 * 4. Provides offline mode handling through scribe.
 *
 * @export
 * @class Oracle
 * @extends {Prophet}
 */
export default class Oracle extends Prophet {

  _partitionConnections: {
    [partitionRawId: string]: {
      // Set both if the connection process is on-going or fully connected.
      connection: OraclePartitionConnection,
      // Only set if connection process is on-going, null if fully connected.
      pendingConnection: ?Promise<OraclePartitionConnection>,
    }
  };

  constructor ({ scribe, authorityNexus, ...rest }: Object) {
    super({ ...rest, upstream: scribe });
    this._authorityNexus = authorityNexus;
    this._partitionConnections = {};
  }

  /**
   * Eagerly acquires and returns an existing full connection, otherwise
   * returns a promise of one. If any narration options are specified in the options, said
   * narration is also performed before the connection is considered fully connected.
   *
   * @param {ValaaURI} partitionURI
   * @param {NarrateOptions} [options={
   *   // If true and a connection (even a non-fully-connected) exists it is returned synchronously.
   *   allowPartialConnection: boolean = false,
   *   // If true does not initiate new connection and returns undefined instead of any promise.
   *   onlyTrySynchronousConnection: boolean = false,
   *   // If true does not create a new connection process is one cannot be found.
   *   dontCreateNewConnection: boolean = false,
   *   // If true requests a creation of a new partition and asserts if one exists. If false,
   *   // asserts if no commands or events for the partition can be found.
   *   createNewPartition: boolean = false,
   *   // If true, throws an error if the retrieval for the latest content for any media fails.
   *   // Otherwise allows the connection to complete successfully. But because then not all latest
   *   // content might be locally available, Media.immediateContent calls for script files might
   *   // fail and Media.readContent operations might result in making unreliable network accesses.
   *   requireLatestMediaContents: boolean = true,
   * }]
   * @returns {*}
   *
   * @memberof Oracle
   */
  acquirePartitionConnection (partitionURI: ValaaURI, options: NarrateOptions = {}): any {
    let entry;
    try {
      const partitionRawId = getPartitionRawIdFrom(partitionURI);
      entry = this._partitionConnections[partitionRawId];
      if (entry && options.createNewPartition && (entry.connection._lastAuthorizedEventId !== -1)) {
        throw new Error(`Partition already exists when trying to create a new partition '${
            partitionURI.toString()}'`);
      }
      if (entry && (!entry.pendingConnection || entry.pendingConnection.fullConnection
          || options.allowPartialConnection)) {
        // TODO(iridian): Shouldn't we narrate here? Now just returning.
        return entry.connection;
      }
      if (options.onlyTrySynchronousConnection) return undefined;
      if (entry) {
        entry.connection.acquireConnection();
        if (!options.eventLog) return entry.pendingConnection;
        const ret = thenChainEagerly(entry.pendingConnection,
            fullConnection => {
              fullConnection.narrateEventLog(options);
              ret.fullConnection = fullConnection;
              return fullConnection;
            });
        ret.operationInfo = { ...entry.pendingConnection.operationInfo };
        return ret;
      }
      if (options.dontCreateNewConnection) return undefined;
      entry = this._partitionConnections[partitionRawId] = {
        connection: new OraclePartitionConnection({
          prophet: this, partitionURI, debugLevel: this.getDebugLevel(),
        }),
        pendingConnection: undefined,
      };
      entry.pendingConnection = (async () => {
        await entry.connection.connect(options);
        // fullConnection allows promise users to inspect the promise for completion synchronously:
        // standard promises interface doesn't support this functionality.
        entry.pendingConnection.fullConnection = entry.connection;
        delete entry.pendingConnection;
        return entry.connection;
      })();
      entry.pendingConnection.operationInfo = { connection: entry.connection };
      return entry.pendingConnection || entry.connection;
    } catch (error) {
      throw this.wrapErrorEvent(error, `acquirePartitionConnection(${partitionURI.toString()})`,
          "\n\toptions:", ...dumpObject(options),
          "\n\texisting partition entry:", ...dumpObject(entry));
    }
  }

  getFullPartitionConnections () : Object {
    const ret = {};
    Object.entries(this._partitionConnections).forEach(
        ([key, { connection, pendingConnection }]) => {
          if (!pendingConnection) ret[key] = connection;
        }
    );
    return ret;
  }

  getPendingPartitionConnections () : Object {
    const ret = {};
    Object.entries(this._partitionConnections).forEach(
        ([key, { pendingConnection }]) => {
          if (pendingConnection) ret[key] = pendingConnection;
        }
    );
    return ret;
  }

  _claimOperationQueue = [];

  // Coming from downstream
  claim (command: Command, options: Object): ClaimResult {
    const operation: any = {
      command, options, authorities: {},
      localFinalizes: null, isLocallyPersisted: false, process: null,
    };
    operation.partitionProcesses = this._resolveCommandPartitionDatas(operation);

    const authorityURIs = Object.keys(operation.authorities);
    if (!authorityURIs.length) throw new Error("command is missing authority information");
    else if (authorityURIs.length > 1) {
      throw new Error(`Valaa Oracle: multi-authority commands not supported, with authorities: "${
          authorityURIs.join(`", "`)}"`);
    }

    operation.authorityPersistProcesses = this._getOngoingAuthorityPersists(operation);

    this._claimOperationQueue.push(operation);
    const operationProcess = operation.process = (async () => {
      let remoteAuthority;
      try {
        await Promise.all(operation.authorityPersistProcesses);
        while (this._claimOperationQueue[0] !== operation) {
          if (!this._claimOperationQueue[0].process) this._claimOperationQueue.shift();
          else {
            try {
              await this._claimOperationQueue[0].process;
            } catch (error) {
              // Silence errors which arise from other claim processes.
            }
          }
        }

        let partitionDatas;
        try {
          partitionDatas = await Promise.all(operation.partitionProcesses);
        } catch (error) { throw this.wrapErrorEvent(error, "claim.partitionProcesses"); }

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
        } catch (error) { throw this.wrapErrorEvent(error, "claim.claimCommandEvent"); }

        remoteAuthority = operation.authorities[authorityURIs[0]];
        if (this.getDebugLevel()) {
          this.warnEvent(`Done ${remoteAuthority
                  ? "queuing a remote command locally"
                  : "claiming a local event"} of authority "${authorityURIs[0]}":`,
              "\n\tpartitions:", ...partitionDatas.map(([, conn]) => conn.partitionRawId()),
              "\n\tcommand:", command);
        }

        if (!remoteAuthority) {
          const event = { ...command };
          try {
            partitionDatas.map(([, connection]) =>
                connection._onConfirmTruth("locallyAuthenticated", event));
          } catch (error) { throw this.wrapErrorEvent(error, "claim.local.onConfirmTruth"); }
          return command;
        }
        let ret;
        try {
          ret = await remoteAuthority.claim(command, operation.options).getFinalEvent();
        } catch (error) { throw this.wrapErrorEvent(error, "claim.remoteAuthority.claim"); }
        if (this.getDebugLevel()) {
          this.warnEvent(`Done claiming remote command"`, ret);
        }
        return ret;
      } catch (error) {
        throw this.wrapErrorEvent(error, "claim",
            "\n\t(command, options):", ...dumpObject(command), ...dumpObject(options),
            "\n\toperation:", ...dumpObject(operation),
            "\n\tremoteAuthority:", remoteAuthority,
            "\n\tthis:", this);
      } finally {
        operation.process = null;
      }
    })();
    return {
      prophecy: new Prophecy(command),
      getFinalEvent: () => operationProcess,
    };
  }

  _getOngoingAuthorityPersists ({ command }: Object) {
    const ret = [];
    for (const blobId of Object.keys(command.addedBlobReferences || {})) {
      for (const { referrerId } of command.addedBlobReferences[blobId]) {
        let entry;
        try {
          const partitionRawId = getPartitionRawIdFrom(referrerId.partitionURI());
          entry = this._partitionConnections[partitionRawId];
          invariantifyObject(entry, `partitionConnections[${partitionRawId}]`);
        } catch (error) { throw onError.call(this, blobId, referrerId, error); }
        const persistProcess = thenChainEagerly(entry.pendingConnection || entry.connection,
            (connectedConnection) => {
              const authorityConnection =
                  connectedConnection.getDependentConnection("authorityUpstream");
              return authorityConnection && authorityConnection.getContentPersistProcess(blobId);
            },
            onError.bind(this, blobId, referrerId));
        if (persistProcess) ret.push(persistProcess);
      }
    }
    return ret;
    function onError (blobId, referrerId, error) {
      return this.wrapErrorEvent(error, "_getOngoingAuthorityPersists",
              "\n\tcurrent referrerId:", ...dumpObject(referrerId),
              "\n\tcurrent blobId:", ...dumpObject(blobId),
              "\n\tret (so far):", ...dumpObject(ret),
              "\n\tcommand:", ...dumpObject(command));
    }
  }

  _resolveCommandPartitionDatas (operation: { command: Command, authorities: any }) {
    const { command } = operation;
    const missingConnections = [];
    if (!command.partitions) {
      throw new Error("command is missing partition information");
    }
    const connections = Object.keys(command.partitions).map((partitionRawId) => {
      const entry = (this._partitionConnections || {})[partitionRawId];
      if (entry) {
        if (entry.connection && entry.connection.isFrozen()) {
          throw new Error(`Trying to claim a command against a frozen partition ${
              entry.connection.getName()}`);
        }
        const authorityURI = command.partitions[partitionRawId].partitionAuthorityURI;
        operation.authorities[String(authorityURI)]
            = this._authorityNexus.tryAuthorityProphet(authorityURI);
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

  /**
   * Evaluates and confirms all unblocked pending truths to all followers, starting from given
   * initialMultiPartitionEventCandidate.
   *
   * @param {Object} initialMultiPartitionEventCandidate
   *
   * @memberof Oracle
   */
  async _tryConfirmPendingMultiPartitionTruths (initialMultiPartitionEventCandidate: Object) {
    const retryConnections = new Set();
    let eventCandidate = initialMultiPartitionEventCandidate;
    while (eventCandidate) {
      // At this point all partition connection pending event heads are either null or a previously
      // blocked multipartition event.
      const connectionsWithCandidateAsHead = [];
      let isBlocked;
      for (const partitionRawId of Object.keys(eventCandidate.partitions)) {
        const { connection } = this._partitionConnections[partitionRawId] || {};
        if (!connection) continue;
        const partitionData = eventCandidate.partitions[partitionRawId];
        if (connection._nextPendingDownstreamTruthId() === partitionData.eventId) {
          connectionsWithCandidateAsHead.push(connection);
        } else {
          isBlocked = true;
        }
      }
      if (isBlocked) {
        for (const blockedConnection of connectionsWithCandidateAsHead) {
          retryConnections.delete(blockedConnection);
        }
      } else {
        let unblockedConnection;
        const purgedCommands = [];
        for (unblockedConnection of connectionsWithCandidateAsHead) {
          const entry = await unblockedConnection._takeNextPendingDowstreamTruth(true);
          if (entry.purgedCommands) purgedCommands.push(...entry.purgedCommands);
        }

        try {
          this._confirmTruthToAllFollowers(eventCandidate,
              purgedCommands.length ? purgedCommands : []);
        } finally {
          for (unblockedConnection of connectionsWithCandidateAsHead) {
            const entry = unblockedConnection._registerNextPendingDownstreamTruth();
            if (entry.purgedCommands) {
              this.errorEvent("TODO(iridian): implement purging by multi-partition command", entry);
            }
          }
        }

        for (unblockedConnection of connectionsWithCandidateAsHead) {
          if (await unblockedConnection._unwindSinglePartitionEvents()) {
            // Has a multi-partition event as head: retry it.
            retryConnections.add(unblockedConnection);
          }
        }
      }
      const retrySomeConnection = retryConnections.values().next().value;
      if (!retrySomeConnection) return;
      eventCandidate = retrySomeConnection._nextPendingDownstreamTruth();
    }
  }
}
