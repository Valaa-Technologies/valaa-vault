// @flow

import { isTransactedLike, EventBase, Truth } from "~/raem/events";
import { getRawIdFrom } from "~/raem/VRL";

import {
  MediaInfo, NarrateOptions, ChronicleOptions, ChronicleRequest, ChronicleEventResult,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/sourcerer/api/types";

import { dumpObject, mapEagerly, thenChainEagerly, vdon } from "~/tools";

import ScribeConnection from "./ScribeConnection";
import { _retryingTwoWaySyncMediaContent } from "./_contentOps";

export const vdoc = vdon({
  "...": { heading:
    "Event ops manage truth and command events",
  },
  0: [
    `Event ops are detail of ScribeConnection.`,
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

export function _narrateEventLog (connection: ScribeConnection,
    options: NarrateOptions, ret: Object, onError: Function) {
  const upstream = connection.getUpstreamConnection();
  return thenChainEagerly(null, connection.addChainClockers(2, "scribe.narrate.ops", [
    _narrateLocalLogs.bind(null, connection,
        options.receiveTruths, options.receiveCommands,
        options.eventIdBegin, options.eventIdEnd,
        options.retrieveMediaBuffer),
    function _receiveLocalResults (localResults) { Object.assign(ret, localResults); },
    ...(upstream && (options.remote !== false) ? [
      function _activateUpstream () { return upstream.asActiveConnection(); },
      function _maybeInitiateRechronicleCommands () {
        if (options.rechronicleOptions === false || !(ret.scribeCommandQueue || []).length) return;
        // Resend all cached commands to remote on the side.
        // Do not wait for success or results, ie. don't return this sub-chain.
        thenChainEagerly(ret.scribeCommandQueue, [
          commands => _receiveEvents(
              connection, commands, null, null, "rechronicleCommands", onError),
          receivedCommands => connection.getUpstreamConnection()
              .chronicleEvents(receivedCommands, options.rechronicleOptions || {}),
        ], onError);
      },
      function _narrateUpstreamEventLog () {
        // Initiate upstream narration in any case...
        const upstreamNarration = upstream.narrateEventLog(Object.assign(Object.create(options), {
          receiveTruths: connection.getReceiveTruths(options.receiveTruths),
          eventIdBegin: Math.max(
              options.eventIdBegin || 0,
              connection.getFirstUnusedTruthEventId()),
        }));
        // ...but only wait for it if requested or if we didn't find any local events
        return ((options.fullNarrate === true)
                || !(options.newChronicle
                    || (ret.scribeTruthLog || []).length || (ret.scribeCommandQueue || []).length))
            && upstreamNarration;
      },
      function _processUpstreamNarrationResults (upstreamNarration) {
        // Handle step 2 of the opportunistic narration if local narration
        // didn't find any truths by waiting for the upstream narration.
        const sectionNames = upstreamNarration && Object.keys(upstreamNarration);
        if (!sectionNames || !sectionNames.length) return undefined;
        return mapEagerly(sectionNames.map(name => upstreamNarration[name]),
            (section, index) => (ret[sectionNames[index]] = !Array.isArray(section)
                ? section
                : mapEagerly(section, entry => entry,
                    function _onResultEventError (error, entry, entryIndex) {
                      entry.localPersistError = error;
                      const wrapped = connection.wrapErrorEvent(error, 1,
                          `narrateEventLog.upstreamResults[${name}][${entryIndex}]`,
                          "\n\toptions:", ...dumpObject(options),
                          "\n\tsection:", ...dumpObject(section));
                      if (error.blocksNarration) throw wrapped;
                      connection.outputErrorEvent(wrapped);
                    })));
      },
    ] : []),
    () => ret,
  ]), onError);
}

async function _narrateLocalLogs (connection: ScribeConnection,
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


/*
 #####
#     #  #    #  #####    ####   #    #     #     ####   #       ######
#        #    #  #    #  #    #  ##   #     #    #    #  #       #
#        ######  #    #  #    #  # #  #     #    #       #       #####
#        #    #  #####   #    #  #  # #     #    #       #       #
#     #  #    #  #   #   #    #  #   ##     #    #    #  #       #
 #####   #    #  #    #   ####   #    #     #     ####   ######  ######
*/

export function _chronicleEvents (connection: ScribeConnection,
    events: EventBase[], options: ChronicleOptions = {}, onError: Function,
): ChronicleRequest {
  if (!events || !events.length) return { eventResults: events };
  const resultBase = new ScribeEventResult(null, connection, { _events: events, onError });
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
    let upstreamEventResults;
    resultBase._persistedForwardResults = thenChainEagerly(resultBase.receivedEventsProcess,
        function _chronicleReceivedEventsUpstream (receivedEvents) {
          resultBase._locallyReceivedEvents = receivedEvents.filter(notNull => notNull);
          if (!resultBase._locallyReceivedEvents.length) return ({ eventResults: [] });
          return connection.getUpstreamConnection()
              .chronicleEvents(resultBase._locallyReceivedEvents, options);
        });
    resultBase._forwardResults = thenChainEagerly(resultBase._persistedForwardResults, [
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
      if ((resultBase._locallyReceivedEvents || []).length) {
        const discard = resultBase._locallyReceivedEvents[0].aspects;
        connection._deleteQueuedCommandsOnwardsFrom(discard.log.index, discard.command.id);
      }
      throw connection.wrapErrorEvent(error, 1, new Error("chronicleEvents()"),
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
  getComposedEvent (): EventBase {
    return thenChainEagerly(this.receivedEventsProcess,
        receivedEvents => receivedEvents[this.index],
        this.onError);
  }
  getPersistedEvent (): Truth {
    // TODO(iridian): Right now getComposedEvent will wait for full media
    // sync, including uploads. This is because the upload sync is
    // buried deep down the chain inside _retryingTwoWaySyncMediaContent
    return !this._persistedForwardResults
        ? this.getComposedEvent()
        : thenChainEagerly(this._persistedForwardResults,
            () => this._locallyReceivedEvents[this.index],
            this.onError);
  }
}

export function _throwOnMediaRequest (connection: ScribeConnection,
    mediaInfo: MediaInfo) {
  const error = new Error(`Cannot retrieve media '${mediaInfo.name}' content through chronicle '${
      connection.getName()}'`);
  throw connection.wrapErrorEvent(error, 1,
      "retrieveMediaBuffer",
      "\n\tdata not found in local bvob cache and no remote content retriever is specified",
      ...(connection.isRemoteAuthority()
          ? ["\n\tlocal/transient chronicles don't have remote storage backing"] : []),
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

function _readMediaContent (connection: ScribeConnection, mediaInfo: MediaInfo) {
  const actualMediaInfo = { ...mediaInfo };
  delete actualMediaInfo.contentType;
  // delete actualMediaInfo.type;
  // delete actualMediaInfo.subtype;
  return thenChainEagerly(
      connection.requestMediaContents([actualMediaInfo]),
      results => results[0],
      (error) => {
        throw this.wrapErrorEvent(error, 1, `_readMediaContent(${mediaInfo.name})`,
            "\n\tmediaInfo:", ...dumpObject(mediaInfo));
      },
  );
}

export function _receiveEvents (
    connection: ScribeConnection,
    events: EventBase,
    retrieveMediaBuffer: RetrieveMediaBuffer = _readMediaContent.bind(null, connection),
    downstreamReceiveTruths: ReceiveEvents,
    type: "receiveTruths" | "receiveCommands" | "rechronicleCommands",
    onError: Function,
) {
  const isReceivingTruths = (type === "receiveTruths");
  const isRechronicling = (type === "rechronicleCommands");
  let actionIdLowerBound = (isReceivingTruths || isRechronicling)
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
    retrieveMediaBuffer:
        isReceivingTruths ? retrieveMediaBuffer
        : isRechronicling ? ({ contentHash }) => connection._sourcerer.readBvobContent(contentHash)
        : undefined,
    prepareBvob: (content, mediaInfo) => connection.prepareBvob(
        content, { ...mediaInfo, prepareBvobToUpstream: !isReceivingTruths }),
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
  if (isReceivingTruths) {
    const lastTruth = newActions[newActions.length - 1];
    connection._truthLogInfo.eventIdEnd = lastTruth.aspects.log.index + 1;
    writeEventsProcess = persist
        && Promise.all(connection._truthLogInfo.writeQueue.push(...newActions));
    connection._triggerTruthLogWrites(lastTruth.aspects.command.id);
  } else if (!isRechronicling) {
    connection._commandQueueInfo.eventIdEnd += newActions.length;
    writeEventsProcess = persist
        && Promise.all(connection._commandQueueInfo.writeQueue.push(...newActions));
    newActions.forEach(action =>
        connection._commandQueueInfo.commandIds.push(action.aspects.command.id));
    connection._triggerCommandQueueWrites();
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
    if ((error.originalError || error).cacheConflict) error.isRevisable = true;
    return onError(connection.wrapErrorEvent(error, 1,
        new Error(`_receiveEvents(${type}).${
          stepIndex === 0 ? "contentSync" : "updateMediaEntries"}`),
        "\n\tmediaPreOps:", ...dumpObject(mediaPreOps),
        "\n\treceivedActions:", ...dumpObject(receivedActions),
        (stepIndex === 0 ? "\n\twrittenEvents:" : "\n\tsyncedMediaEntries:"), ...dumpObject(head),
        "\n\tsyncOptions", ...dumpObject(syncOptions)));
  });
}

function _determineEventPreOps (connection: ScribeConnection, event: Object,
    rootEvent: Object = event) {
  let ret;
  if (isTransactedLike(event)) {
    ret = [].concat(
        ...event.actions
        .map(action => _determineEventPreOps(connection, action, rootEvent))
        .filter(notFalsy => notFalsy));
  } else if (event.typeName === "MediaType") {
    connection._sourcerer._mediaTypes[getRawIdFrom(event.id)] = event.initialState;
  } else if ((event.initialState !== undefined) || (event.sets !== undefined)) {
    if (getRawIdFrom(event.id) === connection.getChronicleId()) {
      const newName = (event.initialState || event.sets || {}).name;
      if (newName) connection.setChronicleName(newName);
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
export function _triggerEventQueueWrites (connection: ScribeConnection, eventsInfo: Object,
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
