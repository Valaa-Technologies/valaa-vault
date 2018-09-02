// @flow

import { VRef } from "~/raem/ValaaReference";

import { dumpObject } from "~/tools";

import Oracle from "./Oracle";
import OraclePartitionConnection from "./OraclePartitionConnection";

export async function _receiveTruthOf (connection: OraclePartitionConnection,
    group: Object, eventId: number, event: Object): Promise<Object> {
  const finalizers = connection.getScribeConnection().createEventFinalizers(
      event, eventId, group.retrieveMediaContent || connection.getRetrieveMediaContent());

  const lastAuthorizedEventId = connection._lastAuthorizedEventId;
  const pendingIndex = eventId - lastAuthorizedEventId - 1;
  if (pendingIndex >= 0 && !connection._downstreamTruthQueue[pendingIndex]) {
    connection._downstreamTruthQueue[pendingIndex] = { event, eventId, finalizers };
    const pendingMultiPartitionEvent = await _unwindSinglePartitionEvents(connection);
    if (pendingMultiPartitionEvent) {
      _tryConfirmPendingMultiPartitionTruths(connection._prophet, pendingMultiPartitionEvent);
    }
  }
  return event;
}

const _maxOnConnectRetrievalRetries = 3;

export function _createReceiveTruthBatch (connection: OraclePartitionConnection,
    batchName: string, retrieveMediaContent: Function) {
  const retrievals = {};
  const batch = {
    name: batchName,
    retrievals,
    retrieveMediaContent (mediaId: VRef, mediaInfo: Object) {
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
    },
    analyzeRetrievals (): Object {
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
    },
  };
  batch.receiveTruth = connection._receiveTruthOf.bind(connection, batch);
  batch.finalize = (truthReceiveResults => truthReceiveResults);
  return batch;
}

/**
 * Evaluates and confirms all unblocked pending truths to all followers, starting from given
 * initialMultiPartitionEventCandidate.
 *
 * @param {Object} initialMultiPartitionEventCandidate
 *
 * @memberof Oracle
 */
async function _tryConfirmPendingMultiPartitionTruths (oracle: Oracle,
    initialMultiPartitionEventCandidate: Object) {
  const retryConnections = new Set();
  let eventCandidate = initialMultiPartitionEventCandidate;
  while (eventCandidate) {
    // At this point all partition connection pending event heads are either null or a previously
    // blocked multipartition event.
    const connectionsWithCandidateAsHead = [];
    let isBlocked;
    for (const partitionRawId of Object.keys(eventCandidate.partitions)) {
      const { connection } = oracle._partitionConnections[partitionRawId] || {};
      if (!connection) continue;
      const partitionData = eventCandidate.partitions[partitionRawId];
      if (_nextPendingDownstreamTruthId(connection) === partitionData.eventId) {
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
        const entry = await _takeNextPendingDowstreamTruth(unblockedConnection, true);
        if (entry.purgedCommands) purgedCommands.push(...entry.purgedCommands);
      }

      try {
        oracle._confirmTruthToAllFollowers(eventCandidate,
            purgedCommands.length ? purgedCommands : []);
      } finally {
        for (unblockedConnection of connectionsWithCandidateAsHead) {
          const entry = _registerNextPendingDownstreamTruth(unblockedConnection);
          if (entry.purgedCommands) {
            oracle.errorEvent("TODO(iridian): implement purging by multi-partition command", entry);
          }
        }
      }

      for (unblockedConnection of connectionsWithCandidateAsHead) {
        if (await _unwindSinglePartitionEvents(unblockedConnection)) {
          // Has a multi-partition event as head: retry it.
          retryConnections.add(unblockedConnection);
        }
      }
    }
    const retrySomeConnection = retryConnections.values().next().value;
    if (!retrySomeConnection) return;
    eventCandidate = _nextPendingDownstreamTruth(retrySomeConnection);
  }
}

/**
 * @returns the next pending event if it exists and is thus a multipartition event. This event
 * is still in the pending queue.
 *
 * @memberof OraclePartitionConnection
 */
async function _unwindSinglePartitionEvents (connection: OraclePartitionConnection) {
  while (connection._downstreamTruthQueue[0] && !connection._downstreamTruthQueue[0]._locked) {
    if (Object.keys(connection._downstreamTruthQueue[0].event.partitions || {}).length > 1) {
      return connection._downstreamTruthQueue[0].event;
    }
    const entry = await _takeNextPendingDowstreamTruth(connection);
    connection._prophet._confirmTruthToAllFollowers(entry.event, entry.purgedCommands);
  }
  return undefined;
}

function _nextPendingDownstreamTruthId (connection: OraclePartitionConnection) {
  const entry = connection._downstreamTruthQueue[0];
  return entry && !entry._locked && entry.eventId;
}

function _nextPendingDownstreamTruth (connection: OraclePartitionConnection) {
  const entry = connection._downstreamTruthQueue[0];
  return entry && !entry._locked && entry.event;
}

function _registerNextPendingDownstreamTruth (connection: OraclePartitionConnection) {
  const entry = connection._downstreamTruthQueue.shift();
  connection._lastAuthorizedEventId = entry.eventId;
  return entry;
}

/*
function _unlockNextPendingDownstreamTruth (connection: OraclePartitionConnection) {
  const entry = connection._downstreamTruthQueue[0];
  if (entry) entry._locked = false;
}
*/

async function _takeNextPendingDowstreamTruth (connection: OraclePartitionConnection,
    lockButDontRegisterYet: boolean = false) {
  const entry = connection._downstreamTruthQueue[0];
  entry._locked = true;
  const result = await connection.getScribeConnection()
      .recordTruth(entry, connection._preAuthorizeCommand);
  if (result) entry.purgedCommands = result.purgedCommands;
  else {
    // else what?
  }
  try {
    await Promise.all(entry.finalizers.map(finalize =>
        finalize({ retryTimes: 4, delayBaseSeconds: 5 }))); // last retry after 30 secs
  } catch (error) {
    connection.outputErrorEvent(connection.wrapErrorEvent(error, `_takeNextPendingDownstreamTruth`,
        "\n\t",
        "\n\t-----------------------------------------------------------------------------------",
        "\n\t--WARNING--WARNING--WARNING--WARNING--WARNING--WARNING--WARNING--WARNING--WARNING--",
        "\n\t-----------------------------------------------------------------------------------",
        "\n\t- Media retrieval failed, event log playback CONTINUES, however                   -",
        "\n\t- some Media MIGHT NOT BE IMMEDIATELY AVAILABLE                                   -",
        "\n\t- affected partition:", connection.getName(), connection.partitionRawId(),
        "\n\t-----------------------------------------------------------------------------------",
        "\n\t-----------------------------------------------------------------------------------",
        "\n\t",
    ));
  }
  if (!lockButDontRegisterYet) _registerNextPendingDownstreamTruth(connection);
  return entry;
}
