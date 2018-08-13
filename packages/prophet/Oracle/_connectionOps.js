// @flow

import type ValaaURI from "~/raem/ValaaURI";
import { VRef } from "~/raem/ValaaReference";

import type { NarrateOptions } from "~/prophet/api/Prophet";
import PartitionConnection from "~/prophet/api/PartitionConnection";

import { dumpObject, invariantifyNumber, thenChainEagerly, vdon } from "~/tools";

import Oracle from "./Oracle";
import OraclePartitionConnection from "./OraclePartitionConnection";

export const vdoc = vdon({
  "...": { heading:
    "Connection ops acquires connections and narrates the initial events",
  },
  0: [],
});

export function _acquirePartitionConnection (oracle: Oracle, partitionURI: ValaaURI,
    partitionRawId: string, options: Object):
        ?OraclePartitionConnection | Promise<OraclePartitionConnection> {
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
  entry = oracle._partitionConnections[partitionRawId] = {
    connection: new OraclePartitionConnection({
      prophet: oracle, partitionURI, debugLevel: oracle.getDebugLevel(),
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
}

export async function _connect (connection: OraclePartitionConnection,
    initialNarrateOptions: Object, onConnectData: Object) {
  const scribeConnection = await connection._prophet._upstream
  .acquirePartitionConnection(connection.partitionURI(),
      { callback: connection._onConfirmTruth.bind(connection, "scribeUpstream") });
  connection.transferIntoDependentConnection("scribeUpstream", scribeConnection);
  connection.setUpstreamConnection(scribeConnection);

  // Handle step 1. of the acquirePartitionConnection first narration logic (defined
  // in PartitionConnection.js) and begin I/O bound scribe event log narration in parallel to
  // the authority proxy/connection creation.

  const authorityConnection = _connectToAuthorityProphet(connection);
  if (authorityConnection) {
    connection._authorityConnection = Promise.resolve(authorityConnection).then(async conn_ => {
      connection._authorityRetrieveMediaContent = conn_.readMediaContent.bind(conn_);
      await conn_.connect();
      connection._authorityConnection = conn_;
      return conn_;
    });
  }

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

  if (ret.mediaRetrievalStatus.latestFailures.length
    && (onConnectData.requireLatestMediaContents !== false)) {
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
  return (async () => {
    const authorityConnection = await connection._authorityProphet
        .acquirePartitionConnection(connection.partitionURI(), {
          callback: connection._onConfirmTruth.bind(connection, "authorityUpstream"),
          noConnect: true,
        });
    connection.transferIntoDependentConnection("authorityUpstream", authorityConnection);
    return authorityConnection;
  })();
}

export async function _narrateEventLog (connection: OraclePartitionConnection,
    options: NarrateOptions, ret: Object, retrievals: Object) {
  let currentFirstEventId = options.firstEventId;

  if (options.retrieveMediaContent) {
    // TODO(iridian): _narrationRetrieveMediaContent should probably be a function parameter
    // instead of an object member.
    if (connection._narrationRetrieveMediaContent) {
      throw new Error(`There can be only one concurrent narrateEventLog with${
          ""} an options.retrieveMediaContent override`);
    }
    connection._narrationRetrieveMediaContent =
        _decorateRetrieveMediaContent(connection, options.retrieveMediaContent, retrievals);
  }
  const isPastLastEvent = (candidateEventId) =>
      (typeof candidateEventId !== "undefined") &&
      (typeof options.lastEventId !== "undefined") &&
      (candidateEventId > options.lastEventId);
  const rawId = connection.partitionRawId();
  if (options.eventLog && options.eventLog.length) {
    const explicitEventLogNarrations = [];
    for (const event of options.eventLog) {
      const eventId = event.partitions[rawId].eventId;
      invariantifyNumber(eventId, `event.partitions[${rawId}].eventId`, {}, "\n\tevent:",
          event);
      if (typeof currentFirstEventId !== "undefined") {
        if ((eventId < currentFirstEventId) || isPastLastEvent(eventId)) continue;
        if (eventId > currentFirstEventId) {
          throw new Error(`got eventId ${eventId} while narrating explicit eventLog, expected ${
              currentFirstEventId}, eventlog ids must be monotonous starting at firstEventId`);
        }
      }
      explicitEventLogNarrations.push(options.callback
          ? options.callback(event)
          : connection._onConfirmTruth("explicitEventLog", event));
      currentFirstEventId = eventId + 1;
    }
    ret.explicitEventLog = await Promise.all(explicitEventLogNarrations);
  }
  if (!isPastLastEvent(currentFirstEventId)) {
    Object.assign(ret, await PartitionConnection.prototype.narrateEventLog.call(connection, {
      ...options,
      firstEventId: currentFirstEventId,
      commandCallback: options.commandCallback
          || (!options.callback
              && connection._prophet._repeatClaimToAllFollowers.bind(connection._prophet))
    }));
  }

  if (connection._authorityConnection && !options.dontRemoteNarrate) {
    const authoritativeNarration = (await connection._authorityConnection)
        .narrateEventLog({ firstEventId: connection._lastAuthorizedEventId + 1 });
    if (!(ret.eventLog || []).length
        && !(ret.scribeEventLog || []).length
        && !(ret.scribeCommandQueue || []).length) {
      // Handle step 2 of the narration logic if local narration didn't find any events.
      Object.assign(ret, await authoritativeNarration);
      console.log("done", ret);
    }
  }

  ret.mediaRetrievalStatus = _analyzeRetrievals(retrievals);
  return ret;
}


const _maxOnConnectRetrievalRetries = 3;

/**
 * Creates and returns a connect-process decorator for the retrieveMediaContent callback of this
 * connection. This decorator manages all media retrievals for the duration of the initial
 * narration. Intermediate Media contents are potentially skipped so that only the latest content
 * of each Media is available.
 * The retrieval of the latest content is attempted maxOnConnectRetrievalRetries times.
 *
 * @param {Object} onConnectData
 * @returns
 */
function _decorateRetrieveMediaContent (connection: OraclePartitionConnection,
    retrieveMediaContent: Function, retrievals: Object) {
  return (mediaId: VRef, mediaInfo: Object) => {
    const mediaRetrievals
        = retrievals[mediaId.rawId()]
        || (retrievals[mediaId.rawId()] = { history: [], pendingRetrieval: undefined });
    const thisRetrieval = {
      process: undefined, content: undefined, retries: 0, error: undefined, skipped: false,
    };
    mediaRetrievals.history.push(thisRetrieval);
    return (async () => {
      try {
        if (mediaRetrievals.pendingRetrieval) await mediaRetrievals.pendingRetrieval.process;
      } catch (error) {
        // Ignore any errors of earlier retrievals.
      }
      while (thisRetrieval === mediaRetrievals.history[mediaRetrievals.history.length - 1]) {
        try {
          thisRetrieval.process = retrieveMediaContent(mediaId, mediaInfo);
          mediaRetrievals.pendingRetrieval = thisRetrieval;
          thisRetrieval.content = await thisRetrieval.process;
          return thisRetrieval.content;
        } catch (error) {
          ++thisRetrieval.retries;
          const description = `connect/retrieveMediaContent(${
              mediaInfo.name}), ${thisRetrieval.retries}. attempt`;
          if (thisRetrieval.retries <= _maxOnConnectRetrievalRetries) {
            connection.warnEvent(`${description} retrying after ignoring an exception: ${
                error.originalMessage || error.message}`);
          } else {
            thisRetrieval.error = connection.wrapErrorEvent(error, description,
                "\n\tretrievals:", ...dumpObject(retrievals),
                "\n\tmediaId:", mediaId.rawId(),
                "\n\tmediaInfo:", ...dumpObject(mediaInfo),
                "\n\tmediaRetrievals:", ...dumpObject(mediaRetrievals),
                "\n\tthisRetrieval:", ...dumpObject(thisRetrieval),
            );
            return undefined;
          }
        } finally {
          if (mediaRetrievals.pendingRetrieval === thisRetrieval) {
            mediaRetrievals.pendingRetrieval = null;
          }
        }
      }
      thisRetrieval.skipped = true;
      return undefined;
    })();
  };
}

function _analyzeRetrievals (retrievals: Object): Object {
  const ret = {
    medias: Object.keys(retrievals).length,
    successfulRetrievals: 0,
    overallSkips: 0,
    overallRetries: 0,
    intermediateFailures: [],
    latestFailures: [],
  };
  for (const mediaRetrievals of Object.values(retrievals)) {
    mediaRetrievals.history.forEach((retrieval, index) => {
      if (typeof retrieval.content !== "undefined") ++ret.successfulRetrievals;
      if (retrieval.skipped) ++ret.overallSkips;
      ret.overallRetries += retrieval.retries;
      if (retrieval.error) {
        if (index + 1 !== mediaRetrievals.history.length) {
          ret.intermediateFailures.push(retrieval.error);
        } else {
          ret.latestFailures.push(retrieval.error);
        }
      }
    });
  }
  return ret;
}

