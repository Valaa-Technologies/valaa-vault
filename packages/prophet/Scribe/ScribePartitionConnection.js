// @flow

import type { UniversalEvent } from "~/raem/command";
import { VRef, obtainVRef } from "~/raem/ValaaReference";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type {
  MediaInfo, NarrateOptions, ChronicleOptions, ChronicleEventResult, ConnectOptions,
  RetrieveMediaBuffer,
} from "~/prophet/api/Prophet";

import { dumpObject, thenChainEagerly } from "~/tools";

import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";
import { bufferAndContentIdFromNative } from "~/tools/textEncoding";

import { MediaEntry, _initiateMediaRetrievals, _requestMediaContents } from "./_contentOps";
import {
  _initializeConnectionIndexedDB, _updateMediaEntries, _readMediaEntries, _destroyMediaInfo,
  _writeEvents, _readEvents, _writeCommands, _readCommands, _deleteCommands,
} from "./_databaseOps";
import { _narrateEventLog, _chronicleEventLog, _recordEventLog } from "./_eventOps";

export default class ScribePartitionConnection extends PartitionConnection {
  _receiveEvent: () => void;

  // Info structures

  // If not eventLogInfo firstEventId is not 0, it means the oldest
  // stored event is a snapshot with that id.
  _eventLogInfo: { firstEventId: number, lastEventId: number };
  _commandQueueInfo: { firstEventId: number, lastEventId: number };

  // Contains the media infos for most recent actions seen per media.
  // This lookup is updated whenever the media retrievers are created for the action, which is
  // before any medias are downloaded and before media info is persisted.
  // See Scribe._persistedMediaLookup for contrast.
  _pendingMediaLookup: { [mediaRawId: string]: MediaEntry };

  _db: IndexedDBWrapper;

  constructor (options: Object) {
    super(options);
    this._eventLogInfo = { firstEventId: 0, lastEventId: -1 };
    this._commandQueueInfo = { firstEventId: 0, lastEventId: -1 };
  }

  connect (options: ConnectOptions) {
    return (this._syncedConnection = thenChainEagerly(
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
                ...options, narrate: false, receiveEvent: this.recordTruthLog.bind(this),
              })),
          () => this.narrateEventLog(options.narrate),
          () => (this._syncedConnection = this),
        ],
    ));
  }

  disconnect () {
    const adjusts = {};
    for (const info of Object.values(this._pendingMediaLookup)) {
      if (info.isInMemory) adjusts[info.contentId] = -1;
      delete this._prophet._persistedMediaLookup[info.mediaId];
    }
    this._prophet._adjustInMemoryBvobBufferRefCounts(adjusts);
    this._pendingMediaLookup = {};
    this.super.disconnect();
  }

  getFirstTruthEventId () { return this._eventLogInfo.firstEventId; }
  getFirstUnusedTruthEventId () { return this._eventLogInfo.lastEventId + 1; }

  getFirstCommandEventId () { return this._commandQueueInfo.firstEventId; }
  getFirstUnusedCommandEventId () { return this._commandQueueInfo.lastEventId + 1; }

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

  async chronicleEventLog (eventLog: UniversalEvent[], options: ChronicleOptions = {}):
      Promise<{ eventResults: ChronicleEventResult[] }> {
    try {
      return await _chronicleEventLog(this, eventLog, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, "chronicleEventLog()",
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  async _recordEventLog (eventLog: UniversalEvent[]) {
    try {
      return await _recordEventLog(this, eventLog);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          `_recordEventLog([${eventLog[0].eventId}, eventLog[eventLog.length - 1].eventId])`,
          "\n\teventLog:", ...dumpObject(eventLog),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  _initiateMediaRetrievals (mediaEvent: Object, retrieveMediaBuffer: RetrieveMediaBuffer,
      rootEvent: Object) {
    const mediaId = obtainVRef(mediaEvent.id);
    let pendingEntry = this._pendingMediaLookup[mediaId.rawId()];
    try {
      return _initiateMediaRetrievals(this, mediaEvent, retrieveMediaBuffer, rootEvent, mediaId,
          pendingEntry);
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
      return _requestMediaContents(this, mediaInfos, onError.bind(this));
    } catch (error) { throw onError.call(this, error); }
    function onError (error: Object, mediaInfo: MediaInfo = error.mediaInfo) {
      if (error.wrappedInRequestMediaContents) return error;
      const ret = this.wrapErrorEvent(error, `requestMediaContents(${this.getName()}`,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tmediaInfos:", ...dumpObject(mediaInfos),
      );
      ret.wrappedInRequestMediaContents = true;
      return ret;
    }
  }

  prepareBvob (content: any, mediaInfo?: MediaInfo):
      { buffer: ArrayBuffer, contentId: string, persistProcess: ?Promise<any> } {
    try {
      const { buffer, contentId } = bufferAndContentIdFromNative(content, mediaInfo);
      if (mediaInfo && mediaInfo.bvobId && (mediaInfo.bvobId !== contentId)) {
        this.errorEvent(`\n\tINTERNAL ERROR: bvobId mismatch when preparing bvob for Media '${
                mediaInfo.name}', CONTENT IS NOT PERSISTED`,
            "\n\tactual content id:", contentId,
            "\n\trequested bvobId:", mediaInfo.bvobId,
            "\n\tmediaInfo:", ...dumpObject(mediaInfo),
            "\n\tcontent:", ...dumpObject({ content }),
        );
        return {};
      }
      // Add optimistic Bvob upload to upstream. This is allowed to fail as long as the scribe has
      // persisted the content.
      const upstreamPrepareBvob = super.prepareBvob(buffer, mediaInfo || { bvobId: contentId });
      return {
        content, buffer, contentId,
        persistProcess: this._prophet._writeBvobBuffer(buffer, contentId),
      };
    } catch (error) {
      throw this.wrapErrorEvent(error, `prepareBvob(${typeof content})`,
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
