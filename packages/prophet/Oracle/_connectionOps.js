// @flow

import type { UniversalEvent } from "~/raem/command";

import type { ConnectOptions, NarrateOptions } from "~/prophet/api/Prophet";
import PartitionConnection from "~/prophet/api/PartitionConnection";

import { dumpObject, isPromise, vdon } from "~/tools";

import OraclePartitionConnection from "./OraclePartitionConnection";

export const vdoc = vdon({
  "...": { heading:
    "Connection ops acquires connections and narrates the initial events",
  },
  0: [],
});

export async function _connect (connection: OraclePartitionConnection,
    onConnectData: ConnectOptions) {
  const scribeConnection = await connection._prophet._upstream
      .acquirePartitionConnection(connection.getPartitionURI(),
          { receiveEvent: connection.createReceiveTruth("scribeUpstream") })
      .getSyncedConnection();

  connection.transferIntoDependentConnection("scribeUpstream", scribeConnection);
  connection.setUpstreamConnection(scribeConnection);

  // Handle step 1. of the acquirePartitionConnection first narration logic (defined
  // in PartitionConnection.js) and begin I/O bound scribe event log narration in parallel to
  // the authority proxy/connection creation.

  _connectToAuthorityProphet(connection);

  const ret = await connection.narrateEventLog(onConnectData.narrate);

  const actionCount = Object.values(ret).reduce(
    (acc, log) => acc + (Array.isArray(log) ? log.length : 0), 0);

  if (!actionCount && (onConnectData.newPartition === false)) {
    throw new Error(`No events found when connecting to an expected existing partition '${
        connection.getPartitionURI().toString()}'`);
  } else if (actionCount && (onConnectData.newPartition === true)) {
    throw new Error(`Existing events found when trying to create a new partition '${
        connection.getPartitionURI().toString()}'`);
  }
  if ((onConnectData.requireLatestMediaContents !== false)
      && (ret.mediaRetrievalStatus || { latestFailures: [] }).latestFailures.length) {
    // FIXME(iridian): This error temporarily demoted to log error
    connection.outputErrorEvent(new Error(`Failed to connect to partition: encountered ${
          ret.mediaRetrievalStatus.latestFailures.length
        } latest media content retrieval failures (and acquirePartitionConnection.${
        ""}options.requireLatestMediaContents does not equal false).`));
  }
  connection._isConnected = true;
  return ret;
}


function _connectToAuthorityProphet (connection: OraclePartitionConnection) {
  connection._authorityProphet = connection._prophet._authorityNexus
      .obtainAuthorityProphetOfPartition(connection.getPartitionURI());
  if (!connection._authorityProphet) return undefined;
  return (connection._authorityConnection = (async () => {
    const authorityConnection = await connection._authorityProphet
        .acquirePartitionConnection(connection.getPartitionURI(), {
          receiveEvent: connection.createReceiveTruth("authorityUpstream"),
          subscribe: false, narrate: false,
        })
        .getSyncedConnection();
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
    receiveCommand: options.receiveCommand
        || (!options.receiveEvent
            && connection._prophet._repeatClaimToAllFollowers.bind(connection._prophet))
  }));

  if ((options.remote !== false) && connection._authorityConnection) {
    const authorityConnection = await connection._authorityConnection;
    // const mediaRetrievalTransaction = connection.
    const collection = connection.createReceiveTruthCollection("initialAuthorityNarration", {
      retrieveBatchContents: authorityConnection.requestMediaContents.bind(authorityConnection),
    });

    const authorityNarration = Promise.resolve(authorityConnection.narrateEventLog({
      subscribe: options.subscribe, receiveEvent: collection.receiveTruth,
      firstEventId: connection._lastAuthorizedEventId + 1,
    })).then(async (remoteNarration) =>
        ((await collection.finalize(remoteNarration)) || remoteNarration));

    if ((options.fullNarrate === true) || (!(ret.eventLog || []).length
        && !(ret.scribeEventLog || []).length && !(ret.scribeCommandQueue || []).length)) {
      // Handle step 2 of the opportunistic narration if local narration didn't find any events.
      const authorityResults = await authorityNarration;
      for (const key of Object.keys(authorityResults)) {
        const resultEntry = authorityResults[key];
        if (!Array.isArray(resultEntry)) continue;
        for (let i = 0; i !== resultEntry.length; ++i) {
          const value = resultEntry[i];
          if (!isPromise(value)) continue;
          try {
            resultEntry[i] = await value;
          } catch (error) {
            const wrapped = connection.wrapErrorEvent(error,
                    `narrateEventLog.authorityResults[${key}][${i}]`,
                "\n\toptions:", ...dumpObject(options),
                "\n\tcurrent ret:", ...dumpObject(ret));
            if (error.blocksNarration) throw wrapped;
            connection.outputErrorEvent(wrapped);
            resultEntry[i] = wrapped;
          }
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
