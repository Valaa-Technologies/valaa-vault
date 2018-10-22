// @flow

import type { UniversalEvent } from "~/raem/command";
import { VRef, obtainVRef } from "~/raem/ValaaReference";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type {
  MediaInfo, NarrateOptions, ChronicleOptions, ChronicleEventResult, ConnectOptions,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/prophet/api/Prophet";

import { dumpObject, thenChainEagerly } from "~/tools";

import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";

import {
  MediaEntry, _prepareBvob, _determineEventMediaPreOps, _requestMediaContents
} from "./_contentOps";
import {
  _initializeConnectionIndexedDB, _updateMediaEntries, _readMediaEntries, _destroyMediaInfo,
  _writeEvents, _readEvents, _writeCommands, _readCommands, _deleteCommands,
} from "./_databaseOps";
import {
  _narrateEventLog, _chronicleEventLog, _receiveEvents,
} from "./_eventOps";

export default class ScribePartitionConnection extends PartitionConnection {
  // Info structures

  // If not eventLogInfo firstEventId is not 0, it means the oldest
  // stored event is a snapshot with that id.
  _truthLogInfo: { firstEventId: number, firstUnusedEventId: number };
  _commandQueueInfo: { firstEventId: number, firstUnusedEventId: number };

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
    this._truthLogInfo = { firstEventId: 0, firstUnusedEventId: 0 };
    this._commandQueueInfo = { firstEventId: 0, firstUnusedEventId: 0 };
  }

  connect (options: ConnectOptions) {
    return this._syncedConnection || (this._syncedConnection = thenChainEagerly(
        _initializeConnectionIndexedDB(this), [
          () => this._readMediaEntries(),
          (mediaEntries) => {
            this._pendingMediaLookup = mediaEntries;
            for (const [mediaRawId, info] of Object.entries(this._pendingMediaLookup)) {
              this._prophet._persistedMediaLookup[mediaRawId] = info;
            }
          },
          () => this._prophet._upstream && this.setUpstreamConnection(
              this._prophet._upstream.acquirePartitionConnection(this.getPartitionURI(), {
                ...options, narrateOptions: false,
                // Don't provide options.receiveTruths here.
                receiveTruths: this.getReceiveTruths(),
              })),
          () => this.narrateEventLog(options.narrateOptions),
          () => (this._syncedConnection = this),
        ],
        errorOnConnect.bind(this),
    ));
    function errorOnConnect (error) {
      throw this.wrapErrorEvent(error, new Error(`connect`),
          "\n\toptions:", ...dumpObject(options));
    }
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

  getFirstTruthEventId () { return this._truthLogInfo.firstEventId; }
  getFirstUnusedTruthEventId () { return this._truthLogInfo.firstUnusedEventId; }

  getFirstCommandEventId () { return this._commandQueueInfo.firstEventId; }
  getFirstUnusedCommandEventId () { return this._commandQueueInfo.firstUnusedEventId; }

  async narrateEventLog (options: NarrateOptions = {}):
      Promise<{ scribeEventLog: any, scribeCommandQueue: any }> {
    if (!options) return undefined;
    const ret = {};
    try {
      return await _narrateEventLog(this, options, ret);
    } catch (error) {
      throw this.wrapErrorEvent(error, "narrateEventLog()",
          "\n\toptions:", ...dumpObject(options),
          "\n\tcurrent ret:", ...dumpObject(ret));
    }
  }

  chronicleEventLog (eventLog: UniversalEvent[], options: ChronicleOptions = {}):
      Promise<{ eventResults: ChronicleEventResult[] }> {
    const contextError = new Error("chronicleEventLog"); // perf issue?
    try {
      return _chronicleEventLog(this, eventLog, options, errorOnScribeChronicleEventLog.bind(this));
    } catch (error) { return errorOnScribeChronicleEventLog.call(this, error); }
    function errorOnScribeChronicleEventLog (error) {
      throw this.wrapErrorEvent(error, contextError,
          "\n\teventLog:", ...dumpObject(eventLog),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  receiveTruths (truths: UniversalEvent[], retrieveMediaBuffer?: RetrieveMediaBuffer,
      downstreamReceiveTruths: ReceiveEvents,
      type: ("receiveTruths" | "receiveCommands") = "receiveTruths",
  ) {
    if (!truths.length) return truths;
    const errorId = `${type}([${truths[0].eventId}, ${truths[truths.length - 1].eventId}])`;
    try {
      return _receiveEvents(this, truths, retrieveMediaBuffer, downstreamReceiveTruths,
          type, errorOnReceiveTruths.bind(this, new Error(errorId)));
    } catch (error) {
      throw errorOnReceiveTruths.call(this, new Error(errorId), error);
    }
    function errorOnReceiveTruths (wrapper, error) {
      throw this.wrapErrorEvent(error, wrapper,
          "\n\ttruths:", ...dumpObject(truths),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  receiveCommands (commands: UniversalEvent[], retrieveMediaBuffer?: RetrieveMediaBuffer,
      downstreamReceiveCommands: ReceiveEvents) {
    return this.receiveTruths(commands, retrieveMediaBuffer, downstreamReceiveCommands,
        "receiveCommands");
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

  async _writeEvents (eventLog: UniversalEvent[]) {
    if (!eventLog || !eventLog.length) return undefined;
    try {
      return await _writeEvents(this, eventLog);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          `_writeEvents([${eventLog[0].eventId},${eventLog[eventLog.length - 1].eventId}])`,
          "\n\teventLog:", ...dumpObject(eventLog));
    }
  }

  async _readEvents (options: Object) {
    try {
      return await _readEvents(this, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_readEvents()`,
          "\n\toptions", ...dumpObject(options));
    }
  }

  async _writeCommands (commandLog: UniversalEvent[]) {
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
