// @flow

import type { EventBase } from "~/raem/command";
import { VRef, obtainVRef } from "~/raem/ValaaReference";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import {
  MediaInfo, NarrateOptions, ChronicleOptions, ChronicleRequest, ConnectOptions,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/prophet/api/types";

import { dumpObject, thenChainEagerly } from "~/tools";

import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";

import {
  MediaEntry, _prepareBvob, _determineEventMediaPreOps, _requestMediaContents
} from "./_contentOps";
import {
  _initializeConnectionIndexedDB, _updateMediaEntries, _readMediaEntries, _destroyMediaInfo,
  _writeTruths, _readTruths, _writeCommands, _readCommands, _deleteCommands,
} from "./_databaseOps";
import {
  _narrateEventLog, _chronicleEvents, _receiveEvents,
} from "./_eventOps";

export default class ScribePartitionConnection extends PartitionConnection {
  // Info structures

  // If not eventLogInfo eventIdBegin is not 0, it means the oldest
  // stored event is a snapshot with that id.
  _truthLogInfo: { eventIdBegin: number, eventIdEnd: number };
  _commandQueueInfo: { eventIdBegin: number, eventIdEnd: number };

  // Contains the media infos for most recent actions seen per media.
  // This lookup is updated whenever the media retrievers are created for the action, which is
  // before any medias are downloaded and before media info is persisted.
  // See Scribe._persistedMediaLookup for contrast.
  _pendingMediaLookup: { [mediaRawId: string]: MediaEntry };

  // Contains partition specific bvob state data.
  _pendingBvobLookup: { [bvobId: string]: {
    localPersistProcess: Promise<Object>,
    prepareBvobUpstreamProcess: Promise<Object>,
  } } = {};

  _db: IndexedDBWrapper;

  constructor (options: Object) {
    super(options);
    this._truthLogInfo = { eventIdBegin: 0, eventIdEnd: 0 };
    this._commandQueueInfo = { eventIdBegin: 0, eventIdEnd: 0 };
  }

  getStatus () {
    return {
      indexedDB: { truthLog: this._truthLogInfo, commandQueue: this._commandQueueInfo },
      ...super.getStatus(),
    };
  }

  _connect (options: ConnectOptions, onError: Function) {
    // ScribePartitionConnection can be synced even if the upstream connection isn't, as long as
    // there are any events in the local cache and the optimistic narration is possible.
    if (this._prophet._upstream) {
      this.setUpstreamConnection(this._prophet._upstream.acquirePartitionConnection(
          this.getPartitionURI(), {
            // Set the permanent receiver without options.receiveTruths and disable narration;
            // perform the initial optimistic narrateEventLog with options.receiveTruths below.
            ...options, narrateOptions: false, receiveTruths: this.getReceiveTruths(),
          }));
    }

    return thenChainEagerly(this.isLocallyPersisted() && _initializeConnectionIndexedDB(this), [
      (isIndexedDBConnected) => (!isIndexedDBConnected ? {} : this._readMediaEntries()),
      (mediaEntries) => {
        this._pendingMediaLookup = mediaEntries;
        for (const [mediaRawId, info] of Object.entries(this._pendingMediaLookup)) {
          this._prophet._persistedMediaLookup[mediaRawId] = info;
        }
      },
      () => this.narrateEventLog(options.narrateOptions),
      (narration) => {
        if (!narration) return narration;
        const actionCount = Object.values(narration).reduce(
            (s, log) => s + (Array.isArray(log) ? log.length : 0),
            options.eventIdBegin || 0);
        if (!actionCount && (options.newPartition === false)) {
          throw new Error(`No events found when connecting to an expected existing partition '${
            this.getPartitionURI().toString()}'`);
        } else if (actionCount && (options.newPartition === true)) {
          throw new Error(`Existing events found when trying to create a new partition '${
            this.getPartitionURI().toString()}'`);
        }
        if ((options.requireLatestMediaContents !== false)
            && (narration.mediaRetrievalStatus || { latestFailures: [] }).latestFailures.length) {
          // FIXME(iridian): This error temporarily demoted to log error
          this.outputErrorEvent(new Error(`Failed to connect to partition: encountered ${
                narration.mediaRetrievalStatus.latestFailures.length
              } latest media content retrieval failures (and ${
              ""}options.requireLatestMediaContents does not equal false).`));
        }
        return narration;
      },
    ], onError);
  }

  disconnect () {
    const adjusts = {};
    for (const info of Object.values(this._pendingMediaLookup)) {
      if (info.isInMemory) adjusts[info.contentId] = -1;
      delete this._prophet._persistedMediaLookup[info.mediaId];
    }
    this._prophet._adjustInMemoryBvobBufferRefCounts(adjusts);
    this._pendingMediaLookup = {};
    super.disconnect();
  }

  getFirstTruthEventId () { return this._truthLogInfo.eventIdBegin; }
  getFirstUnusedTruthEventId () { return this._truthLogInfo.eventIdEnd; }

  getFirstCommandEventId () { return this._commandQueueInfo.eventIdBegin; }
  getFirstUnusedCommandEventId () { return this._commandQueueInfo.eventIdEnd; }

  narrateEventLog (options: NarrateOptions = {}):
      Promise<{ scribeEventLog: any, scribeCommandQueue: any }> {
    if (!options) return undefined;
    const ret = {};
    return _narrateEventLog(this, options, ret)
        .catch(errorOnNarrateEventLog.bind(this, new Error("narrateEventLog()")));
    function errorOnNarrateEventLog (wrapper, error) {
      throw this.wrapErrorEvent(error, wrapper,
          "\n\toptions:", ...dumpObject(options),
          "\n\tcurrent ret:", ...dumpObject(ret));
    }
  }

  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}): ChronicleRequest {
    const contextError = new Error("chronicleEvents");
    try {
      return _chronicleEvents(this, events, options, errorOnScribechronicleEvents.bind(this));
    } catch (error) { return errorOnScribechronicleEvents.call(this, error); }
    function errorOnScribechronicleEvents (error) {
      throw this.wrapErrorEvent(error, contextError,
          "\n\teventLog:", ...dumpObject(events),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  receiveTruths (truths: EventBase[], retrieveMediaBuffer?: RetrieveMediaBuffer,
      downstreamReceiveTruths: ReceiveEvents,
      type: ("receiveTruths" | "receiveCommands") = "receiveTruths",
  ) {
    if (!truths.length) return truths;
    let errorId;
    try {
      errorId = `${type}([${truths[0].eventId}, ${truths[truths.length - 1].eventId}])`;
      return _receiveEvents(this, truths, retrieveMediaBuffer, downstreamReceiveTruths,
          type, errorOnReceiveTruths.bind(this, new Error(errorId)));
    } catch (error) {
      throw errorOnReceiveTruths.call(this, new Error(errorId || `${type}()`), error);
    }
    function errorOnReceiveTruths (wrapper, error) {
      throw this.wrapErrorEvent(error, wrapper,
          "\n\ttruths:", ...dumpObject(truths), truths,
          "\n\tthis:", ...dumpObject(this));
    }
  }

  receiveCommands (commands: EventBase[], retrieveMediaBuffer?: RetrieveMediaBuffer,
      downstreamReceiveCommands: ReceiveEvents) {
    return this.receiveTruths(commands, retrieveMediaBuffer, downstreamReceiveCommands,
        "receiveCommands");
  }

  _clampCommandQueueByTruthEvendIdEnd () {
    if (this._truthLogInfo.eventIdEnd > this._commandQueueInfo.eventIdBegin) {
      if (this._commandQueueInfo.eventIdBegin !== this._commandQueueInfo.eventIdEnd) {
        _deleteCommands(this, this._commandQueueInfo.eventIdBegin,
            Math.min(this._commandQueueInfo.eventIdEnd, this._truthLogInfo.eventIdEnd));
      }
      this._commandQueueInfo.eventIdBegin = this._truthLogInfo.eventIdEnd;
      this._commandQueueInfo.eventIdEnd =
          Math.max(this._commandQueueInfo.eventIdBegin, this._commandQueueInfo.eventIdEnd);
    }
  }

  _determineEventMediaPreOps (mediaEvent: Object, rootEvent: Object) {
    const mediaId = obtainVRef(mediaEvent.id);
    let pendingEntry = this._pendingMediaLookup[mediaId.rawId()];
    try {
      return _determineEventMediaPreOps(this, mediaEvent, rootEvent, mediaId, pendingEntry);
    } catch (error) {
      if (!pendingEntry) pendingEntry = this._pendingMediaLookup[mediaId.rawId()];
      throw this.wrapErrorEvent(error, `_initiateMediaRetrievals(${
              ((pendingEntry || {}).mediaInfo || {}).name || ""}/${mediaId.rawId()})`,
          "\n\tmediaId:", mediaId,
          "\n\tmediaEvent:", ...dumpObject(mediaEvent),
          "\n\tpendingEntry:", ...dumpObject(pendingEntry),
          "\n\troot event:", ...dumpObject(rootEvent),
          "\n\tthis:", ...dumpObject(this),
      );
    }
  }

  requestMediaContents (mediaInfos: MediaInfo[]): any[] {
    try {
      return _requestMediaContents(this, mediaInfos, errorOnRequestMediaContents.bind(this));
    } catch (error) { throw errorOnRequestMediaContents.call(this, error); }
    function errorOnRequestMediaContents (error: Object, mediaInfo: MediaInfo = error.mediaInfo) {
      throw this.wrapErrorEvent(error, new Error(`requestMediaContents(${this.getName()}`),
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tmediaInfos:", ...dumpObject(mediaInfos),
      );
    }
  }

  prepareBvob (content: any, mediaInfo?: MediaInfo):
      { buffer: ArrayBuffer, contentId: string, persistProcess: ?Promise<any> } {
    const errorWrap = new Error(`prepareBvob(${
        mediaInfo && mediaInfo.name ? `of Media "${mediaInfo.name}"` : typeof content})`);
    try {
      return _prepareBvob(this, content, mediaInfo, errorOnPrepareBvob.bind(this));
    } catch (error) { return errorOnPrepareBvob.call(this, error); }
    function errorOnPrepareBvob (error) {
      throw this.wrapErrorEvent(error, errorWrap,
          "\n\tcontent:", ...dumpObject({ content }),
          "\n\tmediaInfo:", ...dumpObject(mediaInfo));
    }
  }

  _getMediaEntry (mediaId: VRef, require_ = true) {
    let currentStep;
    try {
      // Fetch from lookups - traverse media prototype chain.
      do {
        const mediaRawId = currentStep ? currentStep.headRawId() : mediaId.rawId();
        const ret = this._pendingMediaLookup[mediaRawId]
            || this._prophet._persistedMediaLookup[mediaRawId];
        if (ret) return ret;
        currentStep = currentStep ? currentStep.previousStep() : mediaId.previousGhostStep();
      } while (currentStep);
      if (require_) throw new Error(`Media entry for ${mediaId.toString()} not found`);
      return undefined;
    } catch (error) {
      throw this.wrapErrorEvent(error, `_getMediaEntry(..., require = ${require_})`,
          "\n\tmediaId:", ...dumpObject(mediaId));
    }
  }

  async _updateMediaEntries (updates: MediaEntry[]) {
    try {
      return await _updateMediaEntries(this, updates);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_updateMediaEntries(${updates.length} updates)`,
          "\n\tupdates:", ...dumpObject(updates));
    }
  }

  async _readMediaEntries () {
    const ret = {};
    try {
      await _readMediaEntries(this, ret);
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, `_readMediaEntries()`,
          "\n\tret:", ret);
    }
  }

  async _destroyMediaInfo (mediaRawId: string) {
    try {
      return await _destroyMediaInfo(this, mediaRawId);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_destroyMediaInfo('${mediaRawId}')`);
    }
  }

  async _writeTruths (eventLog: EventBase[]) {
    if (!eventLog || !eventLog.length) return undefined;
    try {
      return await _writeTruths(this, eventLog);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          `_writeTruths([${eventLog[0].eventId},${eventLog[eventLog.length - 1].eventId}])`,
          "\n\teventLog:", ...dumpObject(eventLog));
    }
  }

  async _readTruths (options: Object) {
    try {
      return await _readTruths(this, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_readTruths()`,
          "\n\toptions", ...dumpObject(options));
    }
  }

  async _writeCommands (commandLog: EventBase[]) {
    try {
      return await _writeCommands(this, commandLog);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          `_writeCommands([${commandLog[0].eventId},${commandLog[commandLog.length - 1].eventId}])`,
          "\n\tcommandLog:", ...dumpObject(commandLog));
    }
  }

  async _readCommands (options: Object) {
    try {
      return await _readCommands(this, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_readCommands()`,
          "\n\toptions", ...dumpObject(options));
    }
  }

  async _deleteCommands (fromEventId: string, toEventId: string = fromEventId) {
    try {
      return await _deleteCommands(this, fromEventId, toEventId);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_deleteCommands(${fromEventId}, ${toEventId})`);
    }
  }
}
