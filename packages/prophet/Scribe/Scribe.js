// @flow

import type ValaaURI from "~/raem/ValaaURI";

import Prophet, { NarrateOptions } from "~/prophet/api/Prophet";

import DecoderArray from "~/prophet/prophet/DecoderArray";

import type MediaDecoder from "~/tools/MediaDecoder";
import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";

import { dumpObject, invariantifyObject, invariantifyString } from "~/tools";
import type { DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

import { _decodeBlobContent } from "./_contentOps";
import {
  BlobInfo, _initializeSharedIndexedDB, _persistBlobContent, _readBlobContent,
  _addContentPersistReference, _removeContentPersistReference,
} from "./_databaseOps";
import ScribePartitionConnection from "./ScribePartitionConnection";

/**
 * Scribe handles all localhost-based Blob and Media operations.
 * This includes in-memory caches, indexeddb storage (and eventually cross-browser-tab operations)
 * as well as possible service worker interactions.
 *
 * As a rule of thumb, all Blob operations ie. operations which manipulate ArrayBuffer-based data
 * are handled by Scribe itself and all Media operations which manipulate native object data are
 * handled by ScribePartitionConnection objects.
 *
 * @export
 * @class Scribe
 * @extends {Prophet}
 */
export default class Scribe extends Prophet {
  _sharedDb: IndexedDBWrapper;
  _blobLookup: { [blobId: string]: BlobInfo; };
  _mediaTypes: { [mediaTypeId: string]: { type: string, subtype: string, parameters: any }};

  // Contains the media infos for most recent action for which media retrieval is successful and
  // whose media info is successfully persisted.
  // See ScribePartitionConnection._pendingMediaLookup.
  _persistedMediaLookup: { [mediaId: string]: Object };
  _totalCommandCount: number;
  _databaseAPI: DatabaseAPI;

  constructor ({ commandCountCallback, databaseAPI, ...rest }: Object) {
    super({ upstream: null, ...rest });
    this._mediaTypes = {};
    this._persistedMediaLookup = {};
    this._totalCommandCount = 0;
    this._partitionCommandCounts = {};
    this._commandCountCallback = commandCountCallback;
    this._databaseAPI = databaseAPI;
    this._decoderArray = new DecoderArray({
      name: `Decoders of ${this.getName()}`,
      logger: this.getLogger(),
    });
  }

  // Idempotent: returns a promise until the initialization is complete. await on it.
  initialize () {
    if (!this._blobLookup) {
      this.warnEvent("Initializing blob content lookups...");
      this._blobLookup = _initializeSharedIndexedDB(this);
    }
    return this._blobLookup;
  }

  getDecoderArray () { return this._decoderArray; }

  // connection ops

  async acquirePartitionConnection (partitionURI: ValaaURI,
      initialNarrateOptions: NarrateOptions): ScribePartitionConnection {
    const ret = new ScribePartitionConnection({
      prophet: this,
      partitionURI,
      processEvent: initialNarrateOptions.callback,
      databaseAPI: this._databaseAPI,
    });
    await ret.connect(initialNarrateOptions);
    return ret;
  }

  // command ops

  setConnectionCommandCount (connectionName: Object, value: number = 1) {
    const previous = this._partitionCommandCounts[connectionName] || 0;
    this._partitionCommandCounts[connectionName] = value;
    this._totalCommandCount += (value - previous);
    if (this._commandCountCallback) {
      this._commandCountCallback(this._totalCommandCount, this._partitionCommandCounts);
    }
  }

  // blob content ops

  static initialPreCachedPersistRefCount = 1;

  preCacheBlob (blobId: string, newInfo: Object, readBlobContent: Function) {
    const blobInfo = this._blobLookup[blobId];
    try {
      if (!blobInfo) {
        return Promise.resolve(readBlobContent(blobId)).then(buffer => (buffer !== undefined)
            && this._persistBlobContent(buffer, blobId, Scribe.initialPreCachedPersistRefCount));
      }
      if ((blobInfo.byteLength !== newInfo.byteLength)
          && (blobInfo.byteLength !== undefined) && (newInfo.byteLength !== undefined)) {
        throw new Error(`byteLength mismatch between new blob (${newInfo.byteLength
            }) and existing blob (${blobInfo.byteLength}) while precaching blob "${blobId}"`);
      }
      return undefined;
    } catch (error) {
      throw this.wrapErrorEvent(error, `preCacheBlob('${blobId}')`,
          "\n\tblobInfo:", ...dumpObject(blobInfo));
    }
  }

  tryGetCachedBlobContent (blobId: string): ?ArrayBuffer {
    const blobInfo = this._blobLookup[blobId || ""];
    return blobInfo && blobInfo.buffer;
  }

  readBlobContent (blobId: string): ?ArrayBuffer {
    const blobInfo = this._blobLookup[blobId || ""];
    try {
      return _readBlobContent(this, blobId, blobInfo);
    } catch (error) {
      throw this.wrapErrorEvent(error, `readBlobContent('${blobId}')`,
          "\n\tblobInfo:", ...dumpObject(blobInfo));
    }
  }

  decodeBlobContent (blobId: string, decoder: MediaDecoder, contextInfo: Object) {
    const blobInfo = this._blobLookup[blobId || ""];
    let handled;
    try {
      return _decodeBlobContent(this, blobId, blobInfo, decoder, contextInfo, onError);
    } catch (error) { throw (handled ? error : onError.call(this, error)); }
    function onError (error) {
      handled = true;
      return this.wrapErrorEvent(error, `decodeBlobContent('${blobId}', ${decoder.getName()})`,
          "\n\tdecoder:", ...dumpObject(decoder),
          "\n\tcontext info:", ...dumpObject(contextInfo),
          "\n\tblobInfo:", ...dumpObject(blobInfo));
    }
  }

  _persistBlobContent (buffer: ArrayBuffer, blobId: string, initialPersistRefCount: number = 0):
      ?Promise<any> {
    const blobInfo = this._blobLookup[blobId || ""];
    try {
      invariantifyObject(buffer, "_persistBlobContent.buffer",
          { instanceof: ArrayBuffer, allowEmpty: true });
      invariantifyString(blobId, "_persistBlobContent.blobId");
      return _persistBlobContent(this, buffer, blobId, blobInfo, initialPersistRefCount);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_persistBlobContent('${blobId}')`,
          "\n\tbuffer:", ...dumpObject(buffer),
          "\n\tblobInfo:", ...dumpObject(blobInfo));
    }
  }

  async _addContentInMemoryReference (mediaInfo: Object) {
    const blobInfo = this._blobLookup[mediaInfo.blobId || ""];
    try {
      if (!blobInfo || blobInfo.inMemoryRefCount++) return undefined;
      return await this.readBlobContent(mediaInfo.blobId);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_addContentInMemoryReference('${mediaInfo.blobId}')`,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tblobInfo:", ...dumpObject(blobInfo));
    }
  }

  _removeContentInMemoryReference (blobId: string) {
    const blobInfo = this._blobLookup[blobId || ""];
    try {
      if (blobInfo && !--blobInfo.inMemoryRefCount) {
        delete blobInfo.buffer;
        delete blobInfo.decodings;
      }
    } catch (error) {
      throw this.wrapErrorEvent(error, `_removeContentInMemoryReference('${blobId}')`,
          "\n\tblobInfo:", ...dumpObject(blobInfo));
    }
  }

  async _addContentPersistReference (mediaInfo: Object) {
    const blobInfo = this._blobLookup[mediaInfo.blobId || ""];
    // TODO(iridian): What's going on here? Why can the content ref increase be ignored?
    if (!blobInfo) return undefined;
    try {
      return await _addContentPersistReference(this, mediaInfo, blobInfo);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_addContentPersistReference('${mediaInfo.blobId}')`,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tblobInfo:", ...dumpObject(blobInfo));
    }
  }

  async _removeContentPersistReference (blobId: string) {
    const blobInfo = this._blobLookup[blobId || ""];
    // TODO(iridian): What's going on here? Why can the content ref decrease be ignored?
    if (!blobInfo) return undefined;
    try {
      return await _removeContentPersistReference(this, blobId, blobInfo);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_removeContentPersistReference('${blobId}')`,
          "\n\tblobInfo:", ...dumpObject(blobInfo));
    }
  }
}
