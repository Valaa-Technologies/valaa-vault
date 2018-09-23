// @flow

import type Command, { UniversalEvent } from "~/raem/command";
import { VRef, obtainVRef } from "~/raem/ValaaReference";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type { MediaInfo, NarrateOptions, ChronicleOptions, RetrieveMediaContent }
    from "~/prophet/api/Prophet";
import DecoderArray from "~/prophet/prophet/DecoderArray";

import { dumpObject, thenChainEagerly } from "~/tools";
import type { DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";
import { bufferAndContentIdFromNative } from "~/tools/textEncoding";

import {
  MediaEntry, _reprocessMedia, _getMediaURL, _readMediaContent,
} from "./_contentOps";
import {
  _initializeConnectionIndexedDB, _persistMediaEntry, _readMediaInfos, _destroyMediaInfo,
  _writeEvent, _readEvents, _writeCommand, _readCommands,
  _deleteCommand, _deleteCommands,
} from "./_databaseOps";
import {
  _narrateEventLog, _chronicleEventLog, _claimCommandEvent, _recordTruth, _reprocessAction,
  _throwOnMediaContentRetrieveRequest,
} from "./_eventOps";

export default class ScribePartitionConnection extends PartitionConnection {
  _receiveEvent: () => void;

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
    this._receiveEvent = options.receiveEvent;
    this._eventLogInfo = { firstEventId: 0, lastEventId: -1 };
    this._commandQueueInfo = { firstEventId: 0, lastEventId: -1, commandIds: [] };
    this._databaseAPI = options.databaseAPI;
    this._isFrozen = false;
    this._decoderArray = new DecoderArray({
      name: `Decoders of ${this.getName()}`,
      fallbackArray: this.getProphet().getDecoderArray(),
    });
  }

  connect (/* options: ConnectOptions */) {
    return (this._syncedConnection = thenChainEagerly(
        _initializeConnectionIndexedDB(this), [
          () => {
            this._notifyProphetOfCommandCount();
            return this._readMediaInfos();
          }, (mediaInfos) => {
            this._pendingMediaLookup = mediaInfos;
            for (const [mediaRawId, info] of Object.entries(this._pendingMediaLookup)) {
              this._prophet._persistedMediaLookup[mediaRawId] = info;
            }
            return (this._syncedConnection = this);
          },
        ],
    ));
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

  async chronicleEventLog (eventLog: UniversalEvent[], options: ChronicleOptions = {}):
      Promise<any> {
    return _chronicleEventLog(this, eventLog, options);
  }

  _notifyProphetOfCommandCount () {
    this._prophet.setConnectionCommandCount(this.getPartitionURI().toString(),
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

  requestMediaContents (mediaInfos: MediaInfo[]): any[] {
    return mediaInfos.map(mediaInfo => {
      try {
        const mediaEntry = this._getMediaEntry(mediaInfo.mediaId, !!mediaInfo.asURL);
        if (mediaInfo.asURL) {
          if ((mediaInfo.asURL === true)
              || (mediaInfo.asURL === "data")
              || ((mediaInfo.asURL === "source") && !this.isRemote())) {
            return _getMediaURL(this, mediaInfo, mediaEntry, onError.bind(this));
          }
          return undefined;
        }
        let actualInfo = mediaInfo;
        if (!actualInfo.bvobId) {
          if (!mediaEntry || !mediaEntry.mediaInfo) {
            throw new Error(`Cannot find Media info for '${String(mediaInfo.mediaId)}'`);
          }
          actualInfo = { ...mediaInfo, ...mediaEntry.mediaInfo };
        }
        if (!mediaInfo.type) {
          return _readMediaContent(this, actualInfo, mediaEntry, onError.bind(this, mediaInfo));
        }
        if (!actualInfo.bvobId) return undefined;
        if (actualInfo.sourceURL) {
          throw new Error(`Cannot explicitly decode sourceURL-content as '${mediaInfo.mime}'`);
        }
        const decoder = this._decoderArray.findDecoder(actualInfo);
        if (!decoder) {
          throw new Error(`Can't find decoder for ${actualInfo.type}/${actualInfo.subtype}`);
        }
        const name = actualInfo.name ? `'${mediaInfo.name}'` : `unnamed media`;
        return thenChainEagerly(
          this._prophet.decodeBvobContent(actualInfo.bvobId, decoder,
                { mediaName: name, partitionName: this.getName() }),
            undefined,
            onError.bind(this, mediaInfo));
      } catch (error) { throw onError.call(this, mediaInfo, error); }
    });
    function onError (mediaInfo, error) {
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
      return {
        content, buffer, contentId,
        persistProcess: this._prophet._persistBvobContent(buffer, contentId),
      };
    } catch (error) {
      throw this.wrapErrorEvent(error, `prepareBvob(${typeof content})`,
          "\n\tcontent:", ...dumpObject({ content }),
          "\n\tmediaInfo:", ...dumpObject(mediaInfo));
    }
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
