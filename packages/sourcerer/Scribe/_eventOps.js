// @flow

import { isTransactedLike, EventBase, Truth } from "~/raem/events";
import { getRawIdFrom } from "~/raem/VRL";

import {
  MediaInfo, NarrateOptions, ProclaimOptions, Proclamation, ProclaimEventResult,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/sourcerer/api/types";

import { dumpObject, mapEagerly, thenChainEagerly, thisChainRedirect, vdon } from "~/tools";

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

export function _narrateLocalLogs (options: NarrateOptions):
    Promise<{ scribeTruthLog: any, scribeCommandQueue: any }> {
  /* eslint-disable prefer-const */
  let {
    receiveTruths = this._pushTruthsDownstream,
    receiveCommands = this._pushCommandsDownstream,
    eventIdBegin = this.getFirstTruthEventId(),
    eventIdEnd = Math.max(this.getFirstUnusedTruthEventId(), this.getFirstUnusedCommandEventId()),
    retrieveMediaBuffer,
  } = options;
  /* eslint-enable prefer-const */
  const plog2 = (options.plog || {}).chain;
  let scribeTruthLog, scribeCommandQueue;
  if (receiveTruths) {
    const truthIndexEnd = Math.min(this.getFirstUnusedTruthEventId(), eventIdEnd);
    const plog3 = plog2 && this.opLog(3, plog2, "local-truths",
        "range:", { eventIdBegin, truthIndexEnd });
    scribeTruthLog = (eventIdBegin >= truthIndexEnd) ? []
        : Promise.resolve()
        .then(() => this._readTruths({ eventIdBegin, eventIdEnd: truthIndexEnd, plog: plog3 }))
        .then(truths => {
          eventIdBegin = truthIndexEnd; // update eventIdBegin for receiveCommands
          if (!truths || !truths.length) return [];
          plog3 && plog3.opEvent("receive-truths", `receiveTruths(${truths.length})`);
          return receiveTruths(truths, retrieveMediaBuffer);
        }).then(receivedTruths => Promise.all(receivedTruths));
  }
  if (receiveCommands) {
    const commandIndexEnd = Math.min(this.getFirstUnusedCommandEventId(), eventIdEnd);
    let plog3;
    scribeCommandQueue = (eventIdBegin >= commandIndexEnd) ? []
        // wait for truth receive to complete so that eventIdBegin is properly updated
        : Promise.resolve(scribeTruthLog)
        .then(() => {
          plog3 = plog2 && this.opLog(3, plog2, "local-commands",
              "range:", { eventIdBegin, commandIndexEnd });
          return this._readCommands({ eventIdBegin, eventIdEnd: commandIndexEnd, plog: plog3 });
        })
        .then(commands => {
          if (!commands || !commands.length) return [];
          const commandIdBegin = this._commandQueueInfo.eventIdBegin;
          commands.forEach(command => {
            this._commandQueueInfo.commandIds[command.aspects.log.index - commandIdBegin]
                = command.aspects.command.id;
          });
          plog3 && plog3.opEvent("receive-commands", `receiveCommands(${commands.length})`);
          return receiveCommands(commands, retrieveMediaBuffer);
        }).then(receivedCommands => Promise.all(receivedCommands));
  }
  return [options, {}, scribeTruthLog, scribeCommandQueue];
}

export function _integrateLocalNarrationResults (
    options, narrationResult, scribeTruthLog, scribeCommandQueue) {
  if (scribeTruthLog) narrationResult.scribeTruthLog = scribeTruthLog;
  if (scribeCommandQueue) narrationResult.scribeCommandQueue = scribeCommandQueue;
  const upstream = this.getUpstreamConnection();
  const params = [options, narrationResult];
  if (!upstream || (options.remote === false)) {
    return thisChainRedirect("_finalizeNarration", params);
  }
  params.push(upstream.asSourceredConnection());
  if ((options.reproclaimOptions === false)
      || !(scribeCommandQueue || []).length) {
    return thisChainRedirect("_narrateUpstreamEventLog", params);
  }
  params.push(_receiveEvents(
      this, scribeCommandQueue, null, null, "reproclaimCommands",
      (error) => this._errorOnScribeNarrateOpts(error, 1, params)));
  return params;
}

export function _reproclaimLocalCommandsToUpstream (
    options, narrationResult, upstream, receivedCommands) {
  // Resend all cached commands to remote on the side.
  // Do not wait for success or results, ie. don't return this sub-chain.
  upstream.proclaimEvents(receivedCommands, options.reproclaimOptions || {});
  return [options, narrationResult, upstream];
}

export function _narrateUpstreamEventLog (options, narrationResult, upstream) {
  // Initiate upstream narration in any case...
  const upstreamNarration = upstream.narrateEventLog(Object.assign(Object.create(options), {
    receiveTruths: this.getReceiveTruths(options.receiveTruths),
    eventIdBegin: Math.max(options.eventIdBegin || 0, this.getFirstUnusedTruthEventId()),
  }));
  return [options, narrationResult,
    // ...but only wait for it if requested or if we didn't find any local events
    ((options.remote === true)
        || (!(narrationResult.scribeTruthLog || []).length
            && !(narrationResult.scribeCommandQueue || []).length))
        && upstreamNarration,
  ];
}

export function _integrateUpstreamNarrationResults (options, narrationResult, upstreamNarration) {
  // Handle step 2 of the opportunistic narration if local narration
  // didn't find any truths by waiting for the upstream narration.
  const sections = upstreamNarration && Object.keys(upstreamNarration);
  if (!sections || !sections.length) return [options, narrationResult];
  return [options, narrationResult,
    mapEagerly(sections.map(section => upstreamNarration[section]),
        (eventResults, index) => (narrationResult[sections[index]] = !Array.isArray(eventResults)
            ? eventResults
            : mapEagerly(eventResults, entry => entry,
                function _onResultEventError (error, entry, entryIndex) {
                  entry.localPersistError = error;
                  const wrapped = this.wrapErrorEvent(error, 1,
                      `scribeNarrate.upstreamResults[${sections[index]}][${entryIndex}]`,
                      "\n\toptions:", ...dumpObject(options),
                      "\n\teventResults:", ...dumpObject(eventResults));
                  if (error.blocksNarration) throw wrapped;
                  this.outputErrorEvent(wrapped,
                      "Exception caught when processing narration results");
                })))
  ];
}


/*
######
#     #  #####    ####    ####   #         ##       #    #    #
#     #  #    #  #    #  #    #  #        #  #      #    ##  ##
######   #    #  #    #  #       #       #    #     #    # ## #
#        #####   #    #  #       #       ######     #    #    #
#        #   #   #    #  #    #  #       #    #     #    #    #
#        #    #   ####    ####   ######  #    #     #    #    #
*/

export function _proclaimEvents (connection: ScribeConnection,
    events: EventBase[], options: ProclaimOptions = {}, onError: Function,
): Proclamation {
  if (!events || !events.length) return { eventResults: events };
  const resultBase = new ScribeEventResult(connection, options.verbosity);
  resultBase._events = events;
  resultBase.onGetEventError = onError;
  // the 'mostRecentReceiveEventsProcess' is a kludge to sequentialize
  // the proclamation process so that waiting for possible media ops
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
              .proclaimEvents(resultBase._locallyReceivedEvents, options);
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
      throw connection.wrapErrorEvent(error, 1, new Error("proclaimEvents()"),
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

class ScribeEventResult extends ProclaimEventResult {
  getComposedEvent (): EventBase {
    return thenChainEagerly(this.receivedEventsProcess,
        receivedEvents => receivedEvents[this.index],
        this.onGetEventError);
  }
  getRecordedEvent (): Truth {
    // TODO(iridian): Right now getComposedEvent will wait for full media
    // sync, including uploads. This is because the upload sync is
    // buried deep down the chain inside _retryingTwoWaySyncMediaContent
    return !this._persistedForwardResults
        ? this.getComposedEvent()
        : thenChainEagerly(this._persistedForwardResults,
            () => this._locallyReceivedEvents[this.index],
            this.onGetEventError);
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
        throw connection.wrapErrorEvent(error, 1, `_readMediaContent(${mediaInfo.name})`,
            "\n\tmediaInfo:", ...dumpObject(mediaInfo));
      },
  );
}

export function _receiveEvents (
    connection: ScribeConnection,
    events: EventBase,
    retrieveMediaBuffer: RetrieveMediaBuffer = _readMediaContent.bind(null, connection),
    downstreamReceiveTruths: ReceiveEvents,
    type: "receiveTruths" | "receiveCommands" | "reproclaimCommands",
    onError: Function,
) {
  const isReceivingTruths = (type === "receiveTruths");
  const isReproclamation = (type === "reproclaimCommands");
  let actionIdLowerBound = (isReceivingTruths || isReproclamation)
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
        : isReproclamation
            ? ({ contentHash }) => connection.getScribe().readBvobContent(contentHash)
        : undefined,
    prepareBvob: (content, mediaInfo) => connection.prepareBvob(
        content, { ...mediaInfo, prepareBvobToUpstream: !isReceivingTruths }),
  };
  const record = connection.isLocallyRecorded();

  const mediaContentSyncs = record && Promise.all(
      Object.values(mediaPreOps).map(mediaEntry =>
          _retryingTwoWaySyncMediaContent(connection, mediaEntry, syncOptions)));

  if (downstreamReceiveTruths) {
    // Send all the truths downstream together after all of their media
    // retrievals have been persisted to the bvob cache, but before
    // media infos or event logs have been persisted.
    // This is acceptable because the media info/event log state is
    // reflected in the in-memory structures.
    // If browser dies before truths are written to indexeddb, the
    // worst case is that bvobs which have no record refcount will
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
    writeEventsProcess = record
        && Promise.all(connection._truthLogInfo.writeQueue.push(...newActions));
    connection._triggerTruthLogWrites(lastTruth.aspects.command.id);
  } else if (!isReproclamation) {
    connection._commandQueueInfo.eventIdEnd += newActions.length;
    writeEventsProcess = record
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
    connection.getScribe()._mediaTypes[getRawIdFrom(event.id)] = event.initialState;
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
