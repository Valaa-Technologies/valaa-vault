// @flow

import type { UniversalEvent } from "~/raem/command";
import { VRef } from "~/raem/ValaaReference";

import type { NarrateOptions, ChronicleOptions, ReceiveEvent } from "~/prophet/api/Prophet";

import { dumpObject, invariantifyNumber } from "~/tools";

import OraclePartitionConnection from "./OraclePartitionConnection";

export async function _narrateEventLog (connection: OraclePartitionConnection,
    options: NarrateOptions, ret: Object) {
  const upstreamConnection = await connection._upstreamConnection.getSyncedConnection();
  const collection = _createReceiveTruthCollection(connection, {
    name: options.name || "authorityNarration",
    receiveEvent: options.receiveEvent || connection._receiveEvent,
    localRetrieveMediaContent: options.retrieveMediaContent,
    remoteRequestMediaContents: connection.requestMediaContents.bind(connection),
  });
  Object.assign(ret, await upstreamConnection.narrateEventLog({
    subscribe: options.subscribe,
    receiveEvent: collection.receiveTruth,
    firstEventId: options.firstEventId,
  }));
  await collection.finalize(ret);
  ret.mediaRetrievalStatus = collection.analyzeRetrievals();
  return ret;
}

export async function _chronicleEventLog (connection: OraclePartitionConnection,
    eventLog: UniversalEvent[], options: ChronicleOptions, ret: Object) {
  let currentEventId = options.firstEventId;

  const isPastLastEvent = (candidateEventId) =>
      (typeof candidateEventId !== "undefined") &&
      (typeof options.lastEventId !== "undefined") &&
      (candidateEventId > options.lastEventId);

  const collection = _createReceiveTruthCollection(connection, {
    name: options.name || "chronicleEventLog",
    receiveEvent: options.receiveEvent || connection._receiveEvent,
    localRetrieveMediaContent: options.retrieveMediaContent,
    remoteRequestMediaContents: connection.requestMediaContents.bind(connection),
  });
  const explicitEventLogNarrations = [];
  for (const event of eventLog) {
    const eventId = connection._getOwnPartitionInfoOf(event).eventId;
    if (typeof currentEventId !== "undefined") {
      if ((eventId < currentEventId) || isPastLastEvent(eventId)) continue;
      if (eventId > currentEventId) {
        throw new Error(`got eventId ${eventId} while narrating explicit eventLog, expected ${
          currentEventId}, eventlog ids must be monotonously increasing starting at firstEventId ${
              options.firstEventId}`);
      }
    }
    explicitEventLogNarrations.push(options.receiveEvent
        ? options.receiveEvent(event)
        : collection.receiveTruth(event));
    currentEventId = eventId + 1;
  }
  await collection.finalize(explicitEventLogNarrations);
  ret.explicitEventLog = await Promise.all(explicitEventLogNarrations);
  ret.mediaRetrievalStatus = collection.analyzeRetrievals();
  return ret;
}

const _maxOnConnectRetrievalRetries = 3;

/**
 * Creates a truth Event receiver collection on this connection for performant side effect
 * grouping and returns it.
 *
 * The collection.receiveTruth will process individual truths and forwards them downstream.
 *
 * The collection postpones and groups complex operations with costly overheads together.
 * Most notably media retrievals will be postponed to the collection finalize phase (which is
 * triggered by calling collection.finalize). This allows dropping unneeded media retrievals and
 * potentially grouping all the retrievals into a single multi-part request.
 *
 * Additionally later other types of side-effect groupings can be added, like indexeddb writes
 * and persistence refcount updates: these are not yet implemented however and are done
 * one-by-one.
 *
 * @param {string}   collectionName
 * @param {Object}   { retrieveMediaContent, requestMediaContents }
 * @returns {Object} { receiveTruth, finalize, retrieveMediaContent, analyzeRetrievals }
 * @memberof OraclePartitionConnection
 */
export function _createReceiveTruthCollection (connection: OraclePartitionConnection,
    { name, receiveEvent, localRetrieveMediaContent, remoteRequestMediaContents }: Object): {
      receiveEvent: ReceiveEvent,
      finalize: Function,
      analyzeRetrievals: Function,
    } {
  // This is a monster.
  // However the gory syncrhonization details of the monster are mostly hidden here.
  const partitionURIString = String(connection.getPartitionURI());
  const collection = {
    name,
    retrievals: {},
    receiveEvent (truthEvent) {
      // TODO(iridian): move legacy support code to go through Oracle main
      if (!truthEvent.eventId) {
        let partitionInfo = truthEvent.partitions[partitionURIString];
        if (!partitionInfo) {
          partitionInfo = truthEvent.partitions[connection.getPartitionRawId()]
              || truthEvent.partitions[""];
          // const partitionAuthorityURI = (this._authorityConnection || {})
          // if (this._authorityConnection) {
          //  invariantifyString(partitionInfo.partitionAuthorityURI,
          //      "partitionInfo.partitionAuthorityURI", { value: this.partitionAuthorityURI})
          // }
        }
        invariantifyNumber((partitionInfo || {}).eventId,
            `event.partitions["${partitionURIString}" || "${
                this.getPartitionRawId()}" || ""].eventId`, {},
            "\n\tof event:", truthEvent);
        // FIXME(iridian): Strip away sub-events not belonging to this partition
        delete truthEvent.partitions;
        truthEvent.eventId = partitionInfo.eventId;
      }
      return receiveEvent(truthEvent, collection.retrieveMediaContent);
    },
    currentBatch: createBatch(),
  };

  function createBatch () {
    const ret = { queue: [] };
    ret.toLaunch = new Promise((launch, fail) => { ret.launch = launch; ret.fail = fail; });
    ret.pendingBatchContents = new Promise((resolve) => { ret.resolveContents = resolve; });
    ret.retrieveMediaForQueueEntry = (retrieval) => (remoteRequestMediaContents
        ? ret.pendingBatchContents.then(() => retrieval.pendingBatchEntryContent)
        : localRetrieveMediaContent(retrieval.mediaInfo.mediaId, retrieval.mediaInfo));
    return ret;
  }

  collection.finalize = async (eventLogNarrationResults) => {
    collection.eventLogNarrationResults = eventLogNarrationResults;
    for (;;) {
      // The order of the two sections defines behaviour. Having queue launch section first will
      // opportunistically keep emptying the queue and only after that wait for all existing
      // retrieves to finish.
      if (((collection.currentBatch || {}).queue || []).length) {
        // Retrieval batch launch section
        const batch = collection.currentBatch;
        collection.currentBatch = createBatch();
        batch.launch();
        await Promise.all(batch.queue.map(retrieval => retrieval.pendingRetrieveStart));
        if (remoteRequestMediaContents) {
          const issuedRetrievals = batch.queue.filter(retrieval => retrieval.pendingContent);
          Promise.resolve(remoteRequestMediaContents(issuedRetrievals.map(r => r.mediaInfo)))
              .then(batchContents => {
                batchContents.forEach((pendingBatchEntryContent, index) => {
                  issuedRetrievals[index].pendingBatchEntryContent = pendingBatchEntryContent;
                });
                batch.resolveBatchContents(batchContents);
              });
        }
      } else {
        // Pending retrieval wait section
        const pendingRetrievals = [];
        for (const ofMedia of Object.values(collection.retrievals)) {
          const pendingRetrieval = (ofMedia.ongoingRetrieval || {}).pendingContent;
          if (pendingRetrieval) pendingRetrievals.push(ofMedia.ongoingRetrieval.pendingContent);
        }
        if (!pendingRetrievals.length) break; // No retrieval queue, no pending retrievals - finish.
        try { await Promise.all(pendingRetrievals); } catch (error) {
          // Ignore retrieval failures - we're just waiting for graceful retries.
        }
      }
    }
  };

  collection.retrieveMediaContent = (mediaId: VRef, mediaInfo: Object) => {
    // This is the heart of the monster which will beat until it has received content for a
    // requested Media.
    const ofMedia = collection.retrievals[mediaId.rawId()]
        || (collection.retrievals[mediaId.rawId()] = { history: [], ongoingRetrieval: undefined });
    const thisRetrieval = {
      mediaInfo, pendingContent: undefined, content: undefined,
      retries: 0, error: undefined, skipped: false,
    };
    ofMedia.history.push(thisRetrieval);
    return (async () => {
      try {
        for (;;) {
          try {
            let retrieveStarted;
            const batch = collection.currentBatch;
            try {
              if (!batch) {
                // The old strategy - when not being batched, wait for previous retrieval to finish
                // before sending new ones, ignoring errors.
                try {
                  await (ofMedia.ongoingRetrieval || {}).pendingContent;
                } catch (error) { /* */ }
              } else {
                batch.queue.push(thisRetrieval);
                thisRetrieval.pendingRetrieveStart = new Promise(res => { retrieveStarted = res; });
                try { await batch.toLaunch; } catch (error) { /* Ignore launch errors. */ }
              }
              if (thisRetrieval !== ofMedia.history[ofMedia.history.length - 1]) break;
              thisRetrieval.pendingContent = batch
                  ? batch.retrieveMediaForQueueEntry(thisRetrieval)
                  : localRetrieveMediaContent(mediaId, mediaInfo);
              ofMedia.ongoingRetrieval = thisRetrieval;
            } finally {
              if (retrieveStarted) retrieveStarted({ retrieval: thisRetrieval });
            }
            return (thisRetrieval.content = await thisRetrieval.pendingContent);
          } catch (error) {
            ++thisRetrieval.retries;
            const description = `connect/retrieveMediaContent(${
                mediaInfo.name}), ${thisRetrieval.retries}. attempt`;
            if (thisRetrieval.retries <= _maxOnConnectRetrievalRetries) {
              connection.warnEvent(`${description} retrying after ignoring an exception: ${
                  error.originalMessage || error.message}`, ...dumpObject({ error }));
            } else {
              thisRetrieval.error = connection.wrapErrorEvent(error, description,
                  "\n\tretrievals:", ...dumpObject(collection.retrievals),
                  "\n\tmediaId:", mediaId.rawId(),
                  "\n\tmediaInfo:", ...dumpObject(mediaInfo),
                  "\n\tmediaRetrievals:", ...dumpObject(ofMedia),
                  "\n\tthisRetrieval:", ...dumpObject(thisRetrieval),
              );
              break;
            }
          }
        }
        thisRetrieval.skipped = true;
        return undefined;
      } finally {
        thisRetrieval.pendingContent = null;
        if (ofMedia.ongoingRetrieval === thisRetrieval) ofMedia.ongoingRetrieval = null;
      }
    })();
  };

  collection.analyzeRetrievals = (): Object => {
    const ret = {
      medias: Object.keys(collection.retrievals).length,
      successfulRetrievals: 0,
      overallSkips: 0,
      overallRetries: 0,
      intermediateFailures: [],
      latestFailures: [],
    };
    for (const mediaRetrievals of Object.values(collection.retrievals)) {
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
  };
  return collection;
}
