// @flow

import { isTransactedLike, EventBase, Truth } from "~/raem/events";
import { getRawIdFrom } from "~/raem/ValaaReference";

import {
  MediaInfo, NarrateOptions, ChronicleOptions, ChronicleRequest, ChronicleEventResult,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/prophet/api/types";

import { dumpObject, thenChainEagerly, vdon } from "~/tools";

import ScribePartitionConnection from "./ScribePartitionConnection";
import { _retryingTwoWaySyncMediaContent } from "./_contentOps";

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
      options.receiveTruths, options.receiveCommands, options.eventIdBegin, options.eventIdEnd,
      options.retrieveMediaBuffer);

  Object.assign(ret, localResults);

  if ((options.remote === false) || !connection.getUpstreamConnection()) return ret;

  if ((options.rechronicleOptions !== false) && (localResults.scribeCommandQueue || []).length) {
    // Resend all cached commands to remote on the side. Do not wait for success or results.
    connection.chronicleEvents(localResults.scribeCommandQueue, options.rechronicleOptions || {});
  }

  const upstreamNarration = thenChainEagerly(
      connection.getUpstreamConnection().getActiveConnection(),
      (connectedUpstream) => connectedUpstream.narrateEventLog({
        ...options,
        receiveTruths: connection.getReceiveTruths(options.receiveTruths),
        eventIdBegin: Math.max(options.eventIdBegin || 0, connection.getFirstUnusedTruthEventId()),
      }));

  if ((options.fullNarrate !== true)
      && (options.newPartition
          || (ret.scribeEventLog || []).length || (ret.scribeCommandQueue || []).length)) {
    connection.logEvent(2, () => [
      "Initiated async upstream narration, local narration results:", ret,
    ]);
  } else {
    const upstreamResults = await _waitForRemoteNarration(connection, upstreamNarration, options);
    connection.logEvent(2, () => [
      "Awaited upstream narration, local narration results:", ret,
      "\n\tupstream results:", upstreamResults,
    ]);
    Object.assign(ret, upstreamResults);
  }
  return ret;
}

async function _narrateLocalLogs (connection: ScribePartitionConnection,
    receiveTruths: ?ReceiveEvents = connection._downstreamReceiveTruths,
    receiveCommands: ?ReceiveEvents = connection._downstreamReceiveCommands,
    eventIdBegin: ?number = connection.getFirstTruthEventId(),
    eventIdEnd: ?number = Math.max(
        connection.getFirstUnusedTruthEventId(), connection.getFirstUnusedCommandEventId()),
    retrieveMediaBuffer: ?RetrieveMediaBuffer,
): Promise<{ scribeEventLog: any, scribeCommandQueue: any }> {
  const ret = {};
  let currentEventId = eventIdBegin;
  if (receiveTruths) {
    const truthEventIdEnd = Math.min(connection.getFirstUnusedTruthEventId(), eventIdEnd);
    const truths = ((currentEventId < truthEventIdEnd) && await connection._readTruths({
      eventIdBegin: currentEventId, eventIdEnd: truthEventIdEnd
    })) || [];
    currentEventId = truthEventIdEnd;
    ret.scribeEventLog = !truths.length ? truths
        : await Promise.all(await receiveTruths(truths, retrieveMediaBuffer));
  }
  if (receiveCommands) {
    const commandEventIdEnd = Math.min(connection.getFirstUnusedCommandEventId(), eventIdEnd);
    const commands = ((currentEventId < commandEventIdEnd) && await connection._readCommands({
      eventIdBegin: currentEventId, eventIdEnd: commandEventIdEnd,
    })) || [];
    const commandIdBegin = connection._commandQueueInfo.eventIdBegin;
    commands.forEach(command => {
      connection._commandQueueInfo.commandIds[command.aspects.log.index - commandIdBegin]
          = command.aspects.command.id;
    });
    ret.scribeCommandQueue = !commands.length ? commands
        : await Promise.all(await receiveCommands(commands, retrieveMediaBuffer));
  }
  return ret;
}

async function _waitForRemoteNarration (connection: ScribePartitionConnection,
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
      if (!entry.getLocalEvent) continue;
      try {
        await entry.getLocalEvent();
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

export function _chronicleEvents (connection: ScribePartitionConnection,
    events: EventBase[], options: ChronicleOptions = {}, onError: Function,
): ChronicleRequest {
  if (!events || !events.length) return { eventResults: events };
  const resultBase = new ScribeEventResult(null, { events, onError });
  // the 'mostRecentReceiveEventsProcess' is a kludge to sequentialize the chronicling process so
  // that waiting for possible media ops doesn't mess up the order.
  const receiveEventsProcess = options.isTruth
      ? connection.getReceiveTruths(options.receiveTruths)(
        // pre-authorized medias must be preCached, throw on any retrieveMediaBuffer calls.
          events, options.retrieveMediaBuffer || _throwOnMediaRequest.bind(null, connection))
      : connection.getReceiveCommands(options.receiveCommands)(
          events, options.retrieveMediaBuffer);

  connection._mostRecentReceiveEventsProcess = resultBase.receivedEventsProcess = thenChainEagerly(
      connection._mostRecentReceiveEventsProcess, [
        () => receiveEventsProcess,
        (receivedEvents) => {
          if (connection._mostRecentReceiveEventsProcess === resultBase.receivedEventsProcess) {
            connection._mostRecentReceiveEventsProcess = null;
          }
          return (resultBase.receivedEventsProcess = receivedEvents);
        },
      ],
      onError);

  if (options.isTruth) {
    resultBase.getTruthEvent = function getTruthEvent () { return this.event; };
  } else {
    options.receiveTruths = connection.getReceiveTruths(options.receiveTruths);
    options.receiveCommands = null;
    resultBase.chroniclingProcess = thenChainEagerly(
        resultBase.receivedEventsProcess,
        (receivedEvents) => (resultBase.chroniclingProcess = connection.getUpstreamConnection()
            .chronicleEvents(receivedEvents.filter(notNull => notNull), options)),
        onError);
  }
  return {
    eventResults: events.map((event, index) => {
      const ret = Object.create(resultBase); ret.event = event; ret.index = index; return ret;
    }),
  };
}

class ScribeEventResult extends ChronicleEventResult {
  getPersistedEvent (): Truth { return this.getLocalEvent(); }
  getLocalEvent (): EventBase {
    return thenChainEagerly(this.receivedEventsProcess,
        receivedEvents => receivedEvents[this.index],
        this.onError);
  }
  getTruthEvent (): EventBase {
    return thenChainEagerly(this.chroniclingProcess, [
      ({ eventResults }) => eventResults[this.index - (this.events.length - eventResults.length)]
          .getTruthEvent(),
    ], this.onError);
  }
}

export function _throwOnMediaRequest (connection: ScribePartitionConnection,
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
    events: EventBase,
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
  const receivedActions = events.map((action, index) => {
    // FIXME(iridian): If type === "receiveCommands" perform command eviction on unordered commands
    const logIndex = action.aspects.log.index;
    if (typeof logIndex !== "number") {
      throw new Error(`Expected aspects.log.index to be a number for received event #${
          index}, got: ${typeof logIndex} instead`);
    }
    if (logIndex < actionIdLowerBound) return null;
    if (logIndex > actionIdLowerBound) {
      throw new Error(`Expected aspects.log.index to be the first free log index (${
          actionIdLowerBound}) for received event #${index}, got: ${logIndex} instead`);
    }
    ++actionIdLowerBound;
    _determineEventPreOps(connection, action).forEach(({ mediaEntry }) => {
      if (mediaEntry) mediaPreOps[mediaEntry.mediaId] = mediaEntry;
    });
    newActions.push(action);
    return action;
  });
  if (!newActions.length) return receivedActions;

  const syncOptions = {
    retryTimes: 4, delayBaseSeconds: 5,
    retrieveMediaBuffer: receivingTruths && retrieveMediaBuffer,
    prepareBvob: (content, mediaInfo) => connection.prepareBvob(
        content, { ...mediaInfo, prepareBvobUpstream: !receivingTruths }),
  };
  const persist = connection.isLocallyPersisted();

  const mediaContentSyncs = persist && Promise.all(
      Object.values(mediaPreOps).map(mediaEntry =>
          _retryingTwoWaySyncMediaContent(connection, mediaEntry, syncOptions)));

  if (downstreamReceiveTruths) {
    // Send all the truths downstream together after all of their media
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
    thenChainEagerly(mediaContentSyncs,
        () => downstreamReceiveTruths(newActions, retrieveMediaBuffer),
        onError);
  }
  let writeProcess;
  if (!receivingTruths) {
    connection._commandQueueInfo.eventIdEnd += newActions.length;
    writeProcess = persist
        && Promise.all(connection._commandQueueInfo.writeQueue.push(...newActions));
    newActions.forEach(action =>
        connection._commandQueueInfo.commandIds.push(action.aspects.command.id));
    connection._triggerCommandQueueWrites();
  } else {
    const lastTruth = newActions[newActions.length - 1];
    connection._truthLogInfo.eventIdEnd = lastTruth.aspects.log.index + 1;
    writeProcess = persist && Promise.all(connection._truthLogInfo.writeQueue.push(...newActions));
    connection._triggerTruthLogWrites(lastTruth.aspects.command.id);
  }

  const newActionIndex = receivedActions.length - newActions.length;
  return thenChainEagerly(writeProcess, [
    writtenEvents => {
      (writtenEvents || []).forEach(
          (event, index) => { receivedActions[newActionIndex + index] = event; });
      return mediaContentSyncs;
    },
    syncedMediaEntries => syncedMediaEntries && connection._updateMediaEntries(syncedMediaEntries),
    () => receivedActions,
  ], (error, stepIndex, head) => {
    if ((error.originalError || error).cacheConflict) error.revise = true;
    onError(connection.wrapErrorEvent(error,
        new Error(`_receiveEvents(${type}).${
          stepIndex === 0 ? "contentSync" : "updateMediaEntries"}`),
        "\n\tmediaPreOps:", ...dumpObject(mediaPreOps),
        "\n\treceivedActions:", ...dumpObject(receivedActions),
        (stepIndex === 0 ? "\n\twrittenEvents:" : "\n\tsyncedMediaEntries:"), ...dumpObject(head),
        "\n\tsyncOptions", ...dumpObject(syncOptions)));
  });
}

function _determineEventPreOps (connection: ScribePartitionConnection, event: Object,
    rootEvent: Object = event) {
  let ret;
  if (isTransactedLike(event)) {
    ret = [].concat(
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
      ret = connection._determineEventMediaPreOps(event, rootEvent);
    }
  }
  return ret || [];
}

// Returns a promise to the next write operation that completes and
// initiates one if no writes are currently on-going.
// If onComplete is provided it will be called with the written
// events and its return value is used to resolve the returned
// promise. Otherwise the written events will be used to resolve the
// promise directly.
// If there are new entries in the write queue and onComplete didn't
// throw an error, a new write operation will then be initiated.
export function _triggerEventQueueWrites (connection: ScribePartitionConnection, eventsInfo: Object,
    writeEvents: Function, onComplete?: Function, onError?: Function) {
  const myQueue = eventsInfo.writeQueue;
  if (!myQueue.length || eventsInfo.writeProcess) return eventsInfo.writeProcess;
  return (eventsInfo.writeProcess = thenChainEagerly(
      writeEvents([...myQueue]),
      writtenEvents => {
        if (myQueue !== eventsInfo.writeQueue) {
          const error = new Error(
              `${writeEvents.name} write queue purged, discarding all old writes`);
          myQueue.reject(error);
          throw error;
        }
        eventsInfo.writeProcess = null;
        myQueue.resolve(writtenEvents);
        const ret = !onComplete ? writtenEvents : onComplete(writtenEvents);
        _triggerEventQueueWrites(connection, eventsInfo, writeEvents, onComplete, onError);
        return ret;
      },
      error => {
        eventsInfo.writeProcess = null;
        if (!onError) throw error;
        return onError(error);
      }));
}
