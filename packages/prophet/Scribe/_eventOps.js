// @flow

import { isTransactedLike, EventBase, Truth } from "~/raem/events";
import { getRawIdFrom } from "~/raem/VRL";

import {
  MediaInfo, NarrateOptions, ChronicleOptions, ChronicleRequest, ChronicleEventResult,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/prophet/api/types";

import { dumpObject, mapEagerly, thenChainEagerly, vdon } from "~/tools";

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

  const upstreamNarration = thenChainEagerly(null, connection.addChainClockers(2,
      "scribe.narrate.remote.ops", [
    function _waitActiveUpstream () {
      return connection.getUpstreamConnection().getActiveConnection();
    },
    function _narrateUpstreamEventLog (connectedUpstream) {
      return connectedUpstream.narrateEventLog({
        ...options,
        receiveTruths: connection.getReceiveTruths(options.receiveTruths),
        eventIdBegin: Math.max(options.eventIdBegin || 0, connection.getFirstUnusedTruthEventId()),
      });
    },
  ]));

  if ((options.fullNarrate !== true)
      && (options.newPartition
          || (ret.scribeTruthLog || []).length || (ret.scribeCommandQueue || []).length)) {
    connection.clockEvent(2, () => ["scribe.narrate.local.done",
      "Initiated async upstream narration, local narration results:", ret,
    ]);
  } else {
    const upstreamResults = await _waitForRemoteNarration(connection, upstreamNarration, options);
    connection.clockEvent(2, () => ["scribe.narrate.remote.done",
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
): Promise<{ scribeTruthLog: any, scribeCommandQueue: any }> {
  const ret = {};
  let currentEventId = eventIdBegin;
  if (receiveTruths) {
    const truthEventIdEnd = Math.min(connection.getFirstUnusedTruthEventId(), eventIdEnd);
    connection.clockEvent(2, () => ["scribe.narrate.local.truths.read",
        `_readTruths(${currentEventId}, ${truthEventIdEnd})`]);
    const truths = ((currentEventId < truthEventIdEnd) && await connection._readTruths({
      eventIdBegin: currentEventId, eventIdEnd: truthEventIdEnd
    })) || [];
    currentEventId = truthEventIdEnd;
    connection.clockEvent(2, () => ["scribe.narrate.local.truths.receive",
        `receiveTruths(${truths.length})`]);
    ret.scribeTruthLog = !truths.length ? truths
        : await Promise.all(await receiveTruths(truths, retrieveMediaBuffer));
  }
  if (receiveCommands) {
    const commandEventIdEnd = Math.min(connection.getFirstUnusedCommandEventId(), eventIdEnd);
    connection.clockEvent(2, () => ["scribe.narrate.local.commands.read",
      `_readCommands(${currentEventId}, ${commandEventIdEnd})`]);
    const commands = ((currentEventId < commandEventIdEnd) && await connection._readCommands({
      eventIdBegin: currentEventId, eventIdEnd: commandEventIdEnd,
    })) || [];
    const commandIdBegin = connection._commandQueueInfo.eventIdBegin;
    commands.forEach(command => {
      connection._commandQueueInfo.commandIds[command.aspects.log.index - commandIdBegin]
          = command.aspects.command.id;
    });
    connection.clockEvent(2, () => ["scribe.narrate.local.commands.receive",
      `receiveCommands(${commands.length})`]);
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
  connection.clockEvent(2, () => ["scribe.narrate.remote.ops.await"]);
  const upstreamResults = await upstreamNarration;
  connection.clockEvent(2, () => ["scribe.narrate.remote.results.await"]);
  for (const key of Object.keys(upstreamResults)) {
    const resultEntries = (upstreamResults[key] = await upstreamResults[key]);
    if (!Array.isArray(resultEntries)) continue;
    for (let i = 0; i !== resultEntries.length; ++i) {
      const entry = resultEntries[i];
      // WTF is this? getLocalEvent is a chronicleEvents
      // eventResults[0].getLocalEvent thing
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
  const resultBase = new ScribeEventResult(null, { _events: events, onError });
  // the 'mostRecentReceiveEventsProcess' is a kludge to sequentialize
  // the chronicling process so that waiting for possible media ops
  // doesn't mess up the order.
  const receiveEventsLocallyProcess = options.isTruth
      ? connection.getReceiveTruths(options.receiveTruths)(
        // pre-authorized medias must be preCached, throw on any retrieveMediaBuffer calls.
          events, options.retrieveMediaBuffer || _throwOnMediaRequest.bind(null, connection))
      : connection.getReceiveCommands(options.receiveCommands)(
          events, options.retrieveMediaBuffer);

  connection._mostRecentReceiveEventsProcess = resultBase.receivedEventsProcess = thenChainEagerly(
      connection._mostRecentReceiveEventsProcess, [
        () => receiveEventsLocallyProcess,
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
    const receiveTruths = connection.getReceiveTruths(options.receiveTruths);
    options.receiveTruths = receiveTruths;
    options.receiveCommands = null;
    let upstreamEventResults, newLocallyReceivedEvents;
    resultBase._forwardResults = thenChainEagerly(resultBase.receivedEventsProcess, [
      function _chronicleReceivedEventsUpstream (receivedEvents) {
        newLocallyReceivedEvents = receivedEvents.filter(notNull => notNull);
        if (!newLocallyReceivedEvents.length) return ({ eventResults: [] });
        return connection.getUpstreamConnection()
            .chronicleEvents(newLocallyReceivedEvents, options);
      },
      function _syncToChronicleResultTruthEvents ({ eventResults }) {
        upstreamEventResults = eventResults;
        return mapEagerly(upstreamEventResults,
            result => result.getTruthEvent(),
            (error, head, index, getTruthResults, entries, callback, onRejected) => {
              if (error.isSchismatic === false) {
                // For non-schismatic errors just swallow the error but
                // leave content to local cache
                return mapEagerly(entries, callback, onRejected, index + 1, getTruthResults);
              }
              // Discard all commands from failing command onwards from the queue.
              // Downstream will handle reformations and re-chronicles.
              // No need to wait for delete to finish, in-memory queue gets flushed.
              const discardedAspects = events[index || 0].aspects;
              connection._deleteQueuedCommandsOnwardsFrom(
                  discardedAspects.log.index, discardedAspects.command.id);
              // Eat the error, forward the already-confirmed events for receiveTruths.
              return getTruthResults;
            });
      },
      function _receiveConfirmedTruthsLocally (getTruthResults) {
        const confirmedTruths = getTruthResults && getTruthResults.filter(notNull => notNull);
        return confirmedTruths && confirmedTruths.length && receiveTruths(confirmedTruths);
      },
      () => (resultBase._forwardResults = upstreamEventResults),
    ], function errorOnScribeChronicleEvents (error) {
      if ((newLocallyReceivedEvents || []).length) {
        const discard = newLocallyReceivedEvents[0].aspects;
        connection._deleteQueuedCommandsOnwardsFrom(discard.log.index, discard.command.id);
      }
      throw connection.wrapErrorEvent(error, new Error("chronicleEvents()"),
          "\n\teventLog:", ...dumpObject(events),
          "\n\toptions:", ...dumpObject(options),
      );
    });
  }
  return {
    eventResults: events.map((event, index) => {
      const ret = Object.create(resultBase); ret.event = event; ret.index = index; return ret;
    }),
  };
}

class ScribeEventResult extends ChronicleEventResult {
  getLocalEvent (): EventBase {
    return thenChainEagerly(this.receivedEventsProcess,
        receivedEvents => receivedEvents[this.index],
        this.onError);
  }
  getPersistedEvent (): Truth {
    // TODO(iridian): Right now getLocalEvent will wait for full media
    // sync, including uploads. This is because the upload sync is
    // buried deep down the chain inside _retryingTwoWaySyncMediaContent
    return this.getLocalEvent();
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
    retryTimes: 4, delayBaseSeconds: 5, blockOnBrokenDownload: false,
    retrieveMediaBuffer: receivingTruths && retrieveMediaBuffer,
    prepareBvob: (content, mediaInfo) => connection.prepareBvob(
        content, { ...mediaInfo, prepareBvobToUpstream: !receivingTruths }),
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
  let writeEventsProcess;
  if (!receivingTruths) {
    connection._commandQueueInfo.eventIdEnd += newActions.length;
    writeEventsProcess = persist
        && Promise.all(connection._commandQueueInfo.writeQueue.push(...newActions));
    newActions.forEach(action =>
        connection._commandQueueInfo.commandIds.push(action.aspects.command.id));
    connection._triggerCommandQueueWrites();
  } else {
    const lastTruth = newActions[newActions.length - 1];
    connection._truthLogInfo.eventIdEnd = lastTruth.aspects.log.index + 1;
    writeEventsProcess = persist
        && Promise.all(connection._truthLogInfo.writeQueue.push(...newActions));
    connection._triggerTruthLogWrites(lastTruth.aspects.command.id);
  }

  const newActionIndex = receivedActions.length - newActions.length;
  return thenChainEagerly(writeEventsProcess, [
    writtenEvents => {
      (writtenEvents || []).forEach(
          (event, index) => { receivedActions[newActionIndex + index] = event; });
      return mediaContentSyncs;
    },
    syncedMediaEntries => syncedMediaEntries && connection._updateMediaEntries(syncedMediaEntries),
    () => receivedActions,
  ], (error, stepIndex, head) => {
    error.isSchismatic = true;
    if ((error.originalError || error).cacheConflict) error.isReviseable = true;
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
      if (newName) connection.setPartitionName(newName);
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
