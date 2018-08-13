// @flow

import type Command from "~/raem/command";
import { VRef, obtainVRef } from "~/raem/ValaaReference";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type { MediaInfo, NarrateOptions, RetrieveMediaContent } from "~/prophet/api/Prophet";
import DecoderArray from "~/prophet/prophet/DecoderArray";

import { dumpObject } from "~/tools";
import type { DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";
import { bufferAndContentIdFromNative } from "~/tools/textEncoding";

import {
  MediaEntry, _reprocessMedia, _readMediaContent, _decodeMediaContent, _getMediaURL,
} from "./_contentOps";
import {
  _initializeConnectionIndexedDB, _persistMediaEntry, _readMediaInfos, _destroyMediaInfo,
  _writeEvent, _readEvents, _writeCommand, _readCommands,
  _deleteCommand, _deleteCommands,
} from "./_databaseOps";
import {
  _narrateEventLog, _claimCommandEvent, _recordTruth, _reprocessAction,
  _throwOnMediaContentRetrieveRequest,
} from "./_eventOps";

export default class ScribePartitionConnection extends PartitionConnection {
  _processEvent: () => void;

  // Info structures

  _eventLogInfo: {
    firstEventId: number, // If not 0, the stored event is a snapshot whose last eventId is this
    lastEventId: number,
  };

  _commandQueueInfo: {
    firstEventId: number,
    lastEventId: number,
    commandIds: Array<string>,
  };

  _snapshotInfo: {}; // what goes here? Low priority.

  // Contains the media infos for most recent actions seen per media.
  // This lookup is updated whenever the media retrievers are created for the action, which is
  // before any medias are downloaded and before media info is persisted.
  // See Scribe._persistedMediaLookup for contrast.
  _pendingMediaLookup: { [mediaRawId: string]: MediaEntry };

  _db: IndexedDBWrapper;
  _databaseAPI: DatabaseAPI;

  constructor (options: Object) {
    super(options);
    this._processEvent = options.processEvent;
    this._eventLogInfo = { firstEventId: 0, lastEventId: -1 };
    this._commandQueueInfo = { firstEventId: 0, lastEventId: -1, commandIds: [] };
    this._databaseAPI = options.databaseAPI;
    this._isFrozen = false;
    this._decoderArray = new DecoderArray({
      name: `Decoders of ${this.getName()}`,
      fallbackArray: this.getProphet().getDecoderArray(),
    });
  }

  async connect () {
    await _initializeConnectionIndexedDB(this);
    this._notifyProphetOfCommandCount();
    this._pendingMediaLookup = await this._readMediaInfos();
    for (const [mediaRawId, info] of Object.entries(this._pendingMediaLookup)) {
      this._prophet._persistedMediaLookup[mediaRawId] = info;
    }
  }

  disconnect () {
    for (const info of Object.values(this._pendingMediaLookup)) {
      this._prophet._removeContentInMemoryReference(info.contentId);
      delete this._prophet._persistedMediaLookup[info.mediaId];
    }
    this._pendingMediaLookup = {};
  }

  getLastAuthorizedEventId () { return this._eventLogInfo.lastEventId; }
  getLastCommandEventId () { return this._commandQueueInfo.lastEventId; }

  _getFirstAuthorizedEventId () { return this._eventLogInfo.firstEventId; }
  _getFirstCommandEventId () { return this._commandQueueInfo.firstEventId; }

  async narrateEventLog (options: NarrateOptions = {}):
      Promise<{ scribeEventLog: any, scribeCommandQueue: any }> {
    return _narrateEventLog(this, options);
  }

  _notifyProphetOfCommandCount () {
    this._prophet.setConnectionCommandCount(this.partitionURI().toString(),
        Math.max(0,
            (this.getLastCommandEventId() + 1) - this._getFirstCommandEventId()));
  }

  claimCommandEvent (command: Command, retrieveMediaContent: RetrieveMediaContent): Object {
    return _claimCommandEvent(this, command, retrieveMediaContent);
  }

  async recordTruth (truthEntry: Object, preAuthorizeCommand: () => any) {
    if (truthEntry.eventId <= this.getLastAuthorizedEventId()) return false;
    try {
      return _recordTruth(this, truthEntry, preAuthorizeCommand);
    } catch (error) {
      throw this.wrapErrorEvent(error, "recordTruth",
          "\n\tevent:", ...dumpObject(event),
          "\n\teventId:", truthEntry.eventId,
          "\n\tthis:", ...dumpObject(this));
    }
  }

  createEventFinalizers (pendingAuthorizedEvent: Object, eventId: number,
      retrieveMediaContent: RetrieveMediaContent): Promise<any>[] {
    const shouldRetrieveMedias = (eventId > this.getLastAuthorizedEventId())
        && (eventId > this.getLastCommandEventId());
    return _reprocessAction(this, pendingAuthorizedEvent, shouldRetrieveMedias
        && (retrieveMediaContent || _throwOnMediaContentRetrieveRequest.bind(null, this)));
  }

  _reprocessMedia (mediaEvent: Object, retrieveMediaContent: RetrieveMediaContent,
      rootEvent: Object) {
    const mediaId = obtainVRef(mediaEvent.id);
    let currentEntry = this._pendingMediaLookup[mediaId.rawId()];
    try {
      return _reprocessMedia(this, mediaEvent, retrieveMediaContent, rootEvent, mediaId,
          currentEntry);
    } catch (error) {
      if (!currentEntry) currentEntry = this._pendingMediaLookup[mediaId.rawId()];
      throw this.wrapErrorEvent(error, `_reprocessMedia(${
              currentEntry && currentEntry.mediaInfo && currentEntry.mediaInfo.name}/${
              mediaId.rawId()})`,
          "\n\tmediaEvent:", ...dumpObject(mediaEvent),
          "\n\tmediaId:", mediaId,
          "\n\tcurrentEntry:", ...dumpObject(currentEntry),
          "\n\troot event:", ...dumpObject(rootEvent),
          "\n\tthis:", ...dumpObject(this),
      );
    }
  }

  // Returns the requested media content immediately as a native object if it is in in-memory cache.
  // Otherwise if the media is in a local persisted cache returns a promise to a native object.
  // Otherwise is known in the partition returns undefined.
  // Otherwise throws an error.
  readMediaContent (mediaId: VRef, mediaInfo?: MediaInfo): any {
    const mediaEntry = this._getMediaEntry(mediaId, false);
    let handled;
    const actualInfo = mediaInfo || (mediaEntry && mediaEntry.mediaInfo);
    try {
      return _readMediaContent(this, mediaId, mediaEntry, actualInfo, onError);
    } catch (error) { throw (handled ? error : onError.call(this, error)); }
    function onError (error) {
      handled = true;
      return this.wrapErrorEvent(error, `readMediaContent(${
              actualInfo && actualInfo.name ? `'${actualInfo.name}'` : `unnamed media`}`,
          "\n\tmediaId:", mediaId,
          "\n\tactualMediaInfo:", ...dumpObject(actualInfo),
          "\n\tmediaEntry:", ...dumpObject(mediaEntry),
      );
    }
  }

  decodeMediaContent (mediaId: VRef, mediaInfo?: MediaInfo): any {
    let actualInfo = mediaInfo;
    let handled;
    try {
      if (!actualInfo) {
        const mediaEntry = this._getMediaEntry(mediaId, false);
        actualInfo = mediaEntry && mediaEntry.mediaInfo;
        if (!actualInfo) throw new Error(`No media info found for ${mediaId}`);
      }
      return _decodeMediaContent(this, mediaId, actualInfo, onError);
    } catch (error) { throw (handled ? error : onError.call(this, error)); }
    function onError (error) {
      handled = true;
      return this.wrapErrorEvent(error, `decodeMediaContent(${name}`,
          "\n\tmediaId:", mediaId,
          "\n\tactualMediaInfo:", ...dumpObject(actualInfo),
      );
    }
  }


  getMediaURL (mediaId: VRef, mediaInfo?: MediaInfo): any {
    const mediaEntry = this._getMediaEntry(mediaId);
    try {
      return _getMediaURL(this, mediaId, mediaInfo, mediaEntry);
    } catch (error) {
      throw this.wrapErrorEvent(error, `getMediaURL(${
              (mediaInfo && mediaInfo.name) ? `'${mediaInfo.name}'` : `unnamed media`}`,
          "\n\tmediaId:", mediaId,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tmediaEntry:", ...dumpObject(mediaEntry),
      );
    }
  }

  prepareBlob (content: any, mediaInfo?: MediaInfo):
      { buffer: ArrayBuffer, contentId: string, persistProcess: ?Promise<any> } {
    const { buffer, contentId } = bufferAndContentIdFromNative(content, mediaInfo);
    return {
      content, buffer, contentId,
      persistProcess: this._prophet._persistBlobContent(buffer, contentId),
    };
  }

  getMediaInfo (mediaId: VRef) {
    return this._getMediaEntry(mediaId).mediaInfo;
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

  async _persistMediaEntry (newMediaEntry: Object, oldEntry: Object) {
    try {
      return await _persistMediaEntry(this, newMediaEntry, oldEntry);
    } catch (error) {
      throw this.wrapErrorEvent(error, "_persistMediaEntry",
          "\n\tnewMediaEntry:", ...dumpObject(newMediaEntry),
          "\n\toldEntry:", ...dumpObject(oldEntry));
    }
  }

  async _readMediaInfos () {
    const ret = {};
    try {
      await _readMediaInfos(this, ret);
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, `_readMediaInfos()`,
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

  async _writeEvent (eventId: number, event: Object) {
    try {
      return await _writeEvent(this, eventId, event);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_writeEvent(${eventId})`,
          "\n\tevent:", ...dumpObject(event));
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

  async _writeCommand (eventId: number, command: Object) {
    try {
      return await _writeCommand(this, eventId, command);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_writeCommand(${eventId})`,
          "\n\tcommand:", ...dumpObject(command));
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

  async _deleteCommand (eventId: number) {
    try {
      return await _deleteCommand(this, eventId);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_deleteCommand(${eventId})`);
    }
  }

  async _deleteCommands (fromEventId: string, toEventId: string) {
    try {
      return await _deleteCommands(this, fromEventId, toEventId);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_deleteCommands(${fromEventId}, ${toEventId})`);
    }
  }
}
