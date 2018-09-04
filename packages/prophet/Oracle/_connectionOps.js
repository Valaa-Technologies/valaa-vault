// @flow

import type { UniversalEvent } from "~/raem/command";
import type ValaaURI from "~/raem/ValaaURI";

import type { NarrateOptions } from "~/prophet/api/Prophet";
import PartitionConnection from "~/prophet/api/PartitionConnection";

import { invariantifyNumber, vdon } from "~/tools";

import Oracle from "./Oracle";
import OraclePartitionConnection from "./OraclePartitionConnection";

export const vdoc = vdon({
  "...": { heading:
    "Connection ops acquires connections and narrates the initial events",
  },
  0: [],
});


export function _acquirePartitionConnection (oracle: Oracle, partitionURI: ValaaURI,
    partitionRawId: string, options: NarrateOptions):
        ?OraclePartitionConnection | Promise<OraclePartitionConnection> {
  // Synchronous reject or return full connection section
  let entry = oracle._partitionConnections[partitionRawId];
  if (entry && options.createNewPartition && (entry.connection._lastAuthorizedEventId !== -1)) {
    throw new Error(`Partition already exists when trying to create a new partition '${
        String(partitionURI)}'`);
  }
  if (entry && (!entry.pendingConnection || entry.pendingConnection.fullConnection
      || options.allowPartialConnection)) {
    // TODO(iridian): Shouldn't we narrate here? Now just returning.
    return entry.connection;
  }
  if (options.onlyTrySynchronousConnection) return undefined;

  // Asynchronous pending connection section
  if (entry) {
    entry.connection.acquireConnection();
    return entry.pendingConnection;
  }
  if (options.dontCreateNewConnection) return undefined;

  // Asynchronous create new connection section
  entry = oracle._partitionConnections[partitionRawId] = {
    connection: new OraclePartitionConnection({
      prophet: oracle, partitionURI, debugLevel: oracle.getDebugLevel(),
    }),
    pendingConnection: undefined,
  };
  entry.pendingConnection = entry.connection.connect(options).then(() => {
    // fullConnection allows promise users to inspect the promise for completion synchronously:
    // standard promises interface doesn't support this functionality.
    entry.pendingConnection.fullConnection = entry.connection;
    delete entry.pendingConnection;
    return entry.connection;
  });
  entry.pendingConnection.operationInfo = { connection: entry.connection };
  return entry.pendingConnection;
}


export async function _connect (connection: OraclePartitionConnection,
    initialNarrateOptions: Object, onConnectData: Object) {
  const scribeConnection = await connection._prophet._upstream.acquirePartitionConnection(
      connection.partitionURI(), { callback: connection.createReceiveTruth("scribeUpstream") });
  connection.transferIntoDependentConnection("scribeUpstream", scribeConnection);
  connection.setUpstreamConnection(scribeConnection);

  // Handle step 1. of the acquirePartitionConnection first narration logic (defined
  // in PartitionConnection.js) and begin I/O bound scribe event log narration in parallel to
  // the authority proxy/connection creation.

  _connectToAuthorityProphet(connection);

  const ret = await connection.narrateEventLog(initialNarrateOptions);

  const actionCount = Object.values(ret).reduce(
    (acc, log) => acc + (Array.isArray(log) ? log.length : 0), 0);

  if (!actionCount && (onConnectData.createNewPartition === false)) {
    throw new Error(`No actions found when connecting to an existing partition '${
        connection.partitionURI().toString()}'`);
  } else if (actionCount && (onConnectData.createNewPartition === true)) {
    throw new Error(`Existing actions found when trying to create a new partition '${
        connection.partitionURI().toString()}'`);
  }

  if ((onConnectData.requireLatestMediaContents !== false)
      && (ret.mediaRetrievalStatus || { latestFailures: [] }).latestFailures.length) {
    throw new Error(`Failed to connect to partition: encountered ${
            onConnectData.mediaRetrievalStatus.latestFailures.length
        } latest media content retrieval failures (and acquirePartitionConnection.${
        ""}options.requireLatestMediaContents does not equal false).`);
  }

  connection._isConnected = true;
  return ret;
}


function _connectToAuthorityProphet (connection: OraclePartitionConnection) {
  connection._authorityProphet = connection._prophet._authorityNexus
      .obtainAuthorityProphetOfPartition(connection.partitionURI());
  if (!connection._authorityProphet) return undefined;
  return (connection._authorityConnection = (async () => {
    const authorityConnection = await connection._authorityProphet
        .acquirePartitionConnection(connection.partitionURI(), {
          callback: connection.createReceiveTruth("authorityUpstream"),
          subscribeRemote: false, narrateRemote: false,
        });
    connection.transferIntoDependentConnection("authorityUpstream", authorityConnection);
    connection._retrieveMediaContentFromAuthority = (mediaId, mediaInfo) =>
        authorityConnection.readMediaContent({ mediaId, ...mediaInfo });
    connection._authorityConnection = authorityConnection;
    return authorityConnection;
  })());
}

export async function _narrateEventLog (connection: OraclePartitionConnection,
    options: NarrateOptions, ret: Object) {
  Object.assign(ret, await PartitionConnection.prototype.narrateEventLog.call(connection, {
    ...options,
    commandCallback: options.commandCallback
        || (!options.callback
            && connection._prophet._repeatClaimToAllFollowers.bind(connection._prophet))
  }));

  if ((options.narrateRemote !== false) && connection._authorityConnection) {
    const authorityConnection = await connection._authorityConnection;
    // const mediaRetrievalTransaction = connection.
    const collection = connection.createReceiveTruthCollection("initialAuthorityNarration", {
      retrieveBatchContents: authorityConnection.requestMediaContents.bind(authorityConnection),
    });
    const authorityNarration = Promise.resolve(authorityConnection.narrateEventLog({
      narrateRemote: true, subscribeRemote: options.subscribeRemote,
      firstEventId: connection._lastAuthorizedEventId + 1,
      callback: collection.receiveTruth,
    })).then(async (remoteNarration) =>
        ((await collection.finalize(remoteNarration)) || remoteNarration));
    if ((options.fullNarrate === true) || (!(ret.eventLog || []).length
        && !(ret.scribeEventLog || []).length && !(ret.scribeCommandQueue || []).length)) {
      // Handle step 2 of the opportunistic narration if local narration didn't find any events.
      const authorityResults = await authorityNarration;
      for (const key of Object.keys(authorityResults)) {
        if (Array.isArray(authorityResults[key])) {
          authorityResults[key] = await Promise.all(authorityResults[key]);
        }
      }
      ret.mediaRetrievalStatus = collection.analyzeRetrievals();
      connection.logEvent(1, "Awaited authority narration after scribe narration:", ret,
          "\n\tauthority results:", authorityResults, ", retrievals:", ret.mediaRetrievalStatus);
      Object.assign(ret, authorityResults);
    } else {
      connection.logEvent(1, "Kicked off authority narration on the side",
          ", scribe narration results:", ret);
    }
  }
  return ret;
}

export async function _chronicleEventLog (connection: OraclePartitionConnection,
    eventLog: ?UniversalEvent[], options: NarrateOptions, ret: Object) {
  let currentEventId = options.firstEventId;

  const isPastLastEvent = (candidateEventId) =>
      (typeof candidateEventId !== "undefined") &&
      (typeof options.lastEventId !== "undefined") &&
      (candidateEventId > options.lastEventId);

  const collection = connection.createReceiveTruthCollection(options.name || "chronicleEventLog",
      { retrieveMediaContent: options.retrieveMediaContent });
  const explicitEventLogNarrations = [];
  const rawId = connection.partitionRawId();
  for (const event of eventLog) {
    const eventId = event.partitions[rawId].eventId;
    invariantifyNumber(eventId, `event.partitions[${rawId}].eventId`, {}, "\n\tevent:", event);
    if (typeof currentEventId !== "undefined") {
      if ((eventId < currentEventId) || isPastLastEvent(eventId)) continue;
      if (eventId > currentEventId) {
        throw new Error(`got eventId ${eventId} while narrating explicit eventLog, expected ${
          currentEventId}, eventlog ids must be monotonously increasing starting at firstEventId ${
              options.firstEventId}`);
      }
    }
    explicitEventLogNarrations.push(options.callback
        ? options.callback(event)
        : collection.receiveTruth(event));
    currentEventId = eventId + 1;
  }
  await collection.finalize(explicitEventLogNarrations);
  ret.explicitEventLog = await Promise.all(explicitEventLogNarrations);
  ret.mediaRetrievalStatus = collection.analyzeRetrievals();
  return ret;
}
