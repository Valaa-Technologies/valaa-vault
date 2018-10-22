// @flow

import { isTransactedLike, UniversalEvent } from "~/raem/command";
import { getRawIdFrom } from "~/raem/ValaaReference";

import type {
  MediaInfo, NarrateOptions, ChronicleOptions, ChronicleEventResult, ReceiveEvents,
  RetrieveMediaBuffer,
} from "~/prophet/api/Prophet";

import { dumpObject, thenChainEagerly, vdon } from "~/tools";

import ScribePartitionConnection from "./ScribePartitionConnection";

export const vdoc = vdon({
  "...": { heading:
    "Event ops manage truth and command events",
  },
  0: [
    `Event ops are detail of ScribePartitionConnection.`,
  ],
});

/*
#     #
##    #    ##    #####   #####     ##     #####  ######
# #   #   #  #   #    #  #    #   #  #      #    #
#  #  #  #    #  #    #  #    #  #    #     #    #####
#   # #  ######  #####   #####   ######     #    #
#    ##  #    #  #   #   #   #   #    #     #    #
#     #  #    #  #    #  #    #  #    #     #    ######
*/

export async function _narrateEventLog (connection: ScribePartitionConnection,
    options: NarrateOptions, ret: Object) {
  const localResults = await _narrateLocalLogs(connection,
      connection.getReceiveTruths(options.receiveTruths),
      (options.commands !== false) && connection.getReceiveCommands(options.receiveCommands),
      options.firstEventId, options.lastEventId, options.retrieveMediaBuffer);

  Object.assign(ret, localResults);

  if ((options.remote === false) || !connection.getUpstreamConnection()) return ret;

  if ((options.rechronicleOptions !== false) && (localResults.scribeCommandQueue || []).length) {
    // Resend all cached commands to remote on the side. Do not wait for success or results.
    connection.chronicleEventLog(localResults.scribeCommandQueue, options.rechronicleOptions || {});
  }

  const upstreamNarration = connection.getUpstreamConnection().narrateEventLog({
    ...options,
    receiveTruths: connection.getReceiveTruths(options.receiveTruths),
    firstEventId: Math.max(options.firstEventId || 0, connection.getFirstUnusedTruthEventId()),
  });

  if ((options.fullNarrate !== true)
      && ((ret.scribeEventLog || []).length || (ret.scribeCommandQueue || []).length)) {
    connection.logEvent(1, "Initiated async upstream narration, local narration results:", ret);
  } else {
    const upstreamResults = await _waitForRemoveNarration(connection, upstreamNarration, options);
    connection.logEvent(1, "Awaited upstream narration, local narration results:", ret,
        "\n\tupstream results:", upstreamResults);
    Object.assign(ret, upstreamResults);
  }
  return ret;
}

async function _narrateLocalLogs (connection: ScribePartitionConnection,
    receiveTruths: ReceiveEvents, receiveCommands: ReceiveEvents,
    firstEventId: ?number = connection.getFirstTruthEventId(),
    firstUnusedActionId: ?number = Math.max(
        connection.getFirstUnusedTruthEventId(), connection.getFirstUnusedCommandEventId()),
    retrieveMediaBuffer: ?RetrieveMediaBuffer,
): Promise<{ scribeEventLog: any, scribeCommandQueue: any }> {
  const eventUpperBound = Math.min(connection.getFirstUnusedTruthEventId(), firstUnusedActionId);
  const truths = ((firstEventId < eventUpperBound)
          && await connection._readEvents({ firstEventId, lastEventId: eventUpperBound - 1 }))
      || [];
  const ret = {
    scribeEventLog: await Promise.all(await receiveTruths(truths, retrieveMediaBuffer)),
  };
  if (!receiveCommands) return ret;

  const lastEventId = Math.min(connection.getFirstUnusedCommandEventId(), firstUnusedActionId) - 1;
  const commands = ((eventUpperBound >= firstUnusedActionId)
      && await connection._readCommands({ firstEventId: eventUpperBound, lastEventId })) || [];
  ret.scribeCommandQueue = await Promise.all(await receiveCommands(commands, retrieveMediaBuffer));
  return ret;
}

async function _waitForRemoveNarration (connection: ScribePartitionConnection,
    upstreamNarration: Object, options: NarrateOptions,
): Object {
  // Handle step 2 of the opportunistic narration if local narration
  // didn't find any truths by waiting for the upstream narration.
  const upstreamResults = await upstreamNarration;
  for (const key of Object.keys(upstreamResults)) {
    const resultEntries = upstreamResults[key];
    if (!Array.isArray(resultEntries)) continue;
    for (let i = 0; i !== resultEntries.length; ++i) {
      const entry = resultEntries[i];
      if (!entry.getLocallyReceivedEvent) continue;
      try {
        await entry.getLocallyReceivedEvent();
      } catch (error) {
        entry.localPersistError = error;
        const wrapped = connection.wrapErrorEvent(error,
            `narrateEventLog.upstreamResults[${key}][${i}]`,
            "\n\toptions:", ...dumpObject(options),
            "\n\tupstreamResults:", ...dumpObject(upstreamResults));
        if (error.blocksNarration) throw wrapped;
        connection.outputErrorEvent(wrapped);
      }
    }
  }
  return upstreamResults;
}

/*
 #####
#     #  #    #  #####    ####   #    #     #     ####   #       ######
#        #    #  #    #  #    #  ##   #     #    #    #  #       #
#        ######  #    #  #    #  # #  #     #    #       #       #####
#        #    #  #####   #    #  #  # #     #    #       #       #
#     #  #    #  #   #   #    #  #   ##     #    #    #  #       #
 #####   #    #  #    #   ####   #    #     #     ####   ######  ######
*/

export function _chronicleEventLog (connection: ScribePartitionConnection,
    eventLog: UniversalEvent[], options: ChronicleOptions = {}, onError: Function
): Promise<{ eventResults: ChronicleEventResult[] }> {
  if (!eventLog || !eventLog.length) return { eventResults: eventLog };
  if (options.preAuthorized === true) {
    return {
      eventResults: connection.getReceiveTruths(options.receiveTruths)(eventLog,
          // pre-authorized medias must be preCached, throw on any retrieveMediaBuffer calls.
          options.retrieveMediaBuffer || _throwOnMediaContentRetrieveRequest.bind(null, connection),
      ).map((receivedEvent, index) => ({
        event: eventLog[index],
        getLocallyReceivedEvent: () => receivedEvent,
        getTruthEvent: () => eventLog[index],
      })),
    };
  }
  const commandReception = connection.getReceiveCommands(options.receiveCommands)(
      eventLog, options.retrieveMediaBuffer);
  const localReception = thenChainEagerly(commandReception, [
    (receivedCommands) => Promise.all(receivedCommands),
    (results) => results,
  ], onError);
  options.receiveCommands = null;
  const chronicling = thenChainEagerly(localReception,
      (events) => connection.getUpstreamConnection().chronicleEventLog(events, options),
      onError);
  return {
    eventResults: eventLog.map((event, index) => ({
      event,
      getLocallyReceivedEvent: () => thenChainEagerly(localReception,
          (events) => events[index],
          onError),
      getTruthEvent: () => thenChainEagerly(chronicling,
          (results) => results.eventResults[index].getTruthEvent(),
          onError),
    })),
  };
}

/*
 #####
#     #   ####   #    #  #    #   ####   #    #
#        #    #  ##  ##  ##  ##  #    #  ##   #
#        #    #  # ## #  # ## #  #    #  # #  #
#        #    #  #    #  #    #  #    #  #  # #
#     #  #    #  #    #  #    #  #    #  #   ##
 #####    ####   #    #  #    #   ####   #    #
*/

export function _receiveEvents (
    connection: ScribePartitionConnection,
    actions: UniversalEvent,
    retrieveMediaBuffer: RetrieveMediaBuffer = connection.readMediaContent.bind(connection),
    downstreamReceiveTruths: ReceiveEvents,
    type: "receiveTruths" | "receiveCommands",
    onError: Function,
) {
  const receivingTruths = (type === "receiveTruths");
  let actionIdLowerBound = receivingTruths
      ? connection.getFirstUnusedTruthEventId() : connection.getFirstUnusedCommandEventId();
  const mediaPreOps = {};
  const newActions = [];
  const receivedActions = actions.map((action, index) => {
    // FIXME(iridian): If type === "receiveCommands" perform command eviction on unordered commands
    if (typeof action.eventId !== "number") {
      throw new Error(`Expected eventId to be a number for received event #${index}, got: ${
          typeof action.eventId}`);
    }
    if (action.eventId < actionIdLowerBound) return null;
    if (action.eventId > actionIdLowerBound) {
      throw new Error(`Expected eventId to be the first free event id (${
          actionIdLowerBound}) for received event #${index}, got: ${action.eventId}`);
    }
    ++actionIdLowerBound;
    _determineEventPreOps(connection, action).forEach(({ mediaId, preOp }) => {
      if (mediaId) mediaPreOps[mediaId] = preOp;
    });
    newActions.push(action);
    return action;
  });
  if (!newActions.length) return receivedActions;

  const requestOptions = { retryTimes: 4, delayBaseSeconds: 5, retrieveMediaBuffer };

  const preOpsProcess = connection.isLocallyPersisted()
      && Promise.all(Object.keys(mediaPreOps).map(key => mediaPreOps[key](requestOptions)));

  if (downstreamReceiveTruths) {
    // Send the truths downstream after all of their media
    // retrievals have been persisted to the bvob cache, but before
    // media infos or event logs have been persisted.
    // This is acceptable because the media info/event log state is
    // reflected in the in-memory structures.
    // If browser dies before truths are written to indexeddb, the
    // worst case is that bvobs which have no persist refcount will
    // be cleared at startup and need to be re-downloaded.
    // This is tolerable enough so we can send truths downstream
    // immediately and have the UI start responding to the incoming
    // changes.
    // This delivery is unordered: downstream must handle ordering.
    thenChainEagerly(preOpsProcess,
        () => downstreamReceiveTruths(newActions, retrieveMediaBuffer),
        onError);
  }
  (receivingTruths ? connection._truthLogInfo : connection._commandQueueInfo)
      .firstUnusedEventId = newActions[newActions.length - 1].eventId + 1;
  return !preOpsProcess
      ? receivedActions
      : thenChainEagerly(preOpsProcess, [
        (updatedEntries) => connection._updateMediaEntries(updatedEntries),
        () => connection[receivingTruths ? "_writeEvents" : "_writeCommands"](newActions),
        () => receivedActions,
      ], onError);
}

function _determineEventPreOps (connection: ScribePartitionConnection, event: Object,
    rootEvent: Object = event) {
  if (isTransactedLike(event)) {
    return [].concat(
        ...event.actions
        .map(action => _determineEventPreOps(connection, action, rootEvent))
        .filter(notFalsy => notFalsy));
  } else if (event.typeName === "MediaType") {
    connection._prophet._mediaTypes[getRawIdFrom(event.id)] = event.initialState;
  } else if ((event.initialState !== undefined) || (event.sets !== undefined)) {
    if (getRawIdFrom(event.id) === connection.getPartitionRawId()) {
      const newName = (event.initialState || event.sets || {}).name;
      if (newName) connection.setName(`'${newName}'/${connection.getPartitionURI().toString()}`);
    }
    if (event.typeName === "Media") {
      return connection._determineEventMediaPreOps(event, rootEvent);
    }
  }
  return [];
}

export function _throwOnMediaContentRetrieveRequest (connection: ScribePartitionConnection,
    mediaInfo: MediaInfo) {
  throw connection.wrapErrorEvent(
      new Error(`Cannot retrieve media '${mediaInfo.name}' content through partition '${
        connection.getName()}'`),
      "retrieveMediaBuffer",
      "\n\tdata not found in local bvob cache and no remote content retriever is specified",
      ...(connection.isRemoteAuthority()
          ? ["\n\tlocal/transient partitions don't have remote storage backing"] : []),
      "\n\tmediaInfo:", ...dumpObject(mediaInfo));
}
