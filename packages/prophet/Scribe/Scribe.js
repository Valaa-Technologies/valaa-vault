// @flow

import type ValaaURI from "~/raem/ValaaURI";

import Prophet, { NarrateOptions } from "~/prophet/api/Prophet";

import DecoderArray from "~/prophet/prophet/DecoderArray";

import type MediaDecoder from "~/tools/MediaDecoder";
import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";

import { dumpObject, invariantifyObject } from "~/tools";
import type { DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

import { _decodeBvobContent } from "./_contentOps";
import {
  BvobInfo, _initializeSharedIndexedDB, _persistBvobContent, _readBvobBuffers,
  _addBvobPersistReferences, _removeBvobPersistReferences,
} from "./_databaseOps";
import ScribePartitionConnection from "./ScribePartitionConnection";

/**
 * Scribe handles all localhost-based Bvob and Media operations.
 * This includes in-memory caches, indexeddb storage (and eventually cross-browser-tab operations)
 * as well as possible service worker interactions.
 *
 * As a rule of thumb, all Bvob operations ie. operations which manipulate ArrayBuffer-based data
 * are handled by Scribe itself and all Media operations which manipulate native object data are
 * handled by ScribePartitionConnection objects.
 *
 * @export
 * @class Scribe
 * @extends {Prophet}
 */
export default class Scribe extends Prophet {
  _sharedDb: IndexedDBWrapper;
  _bvobLookup: { [bvobId: string]: BvobInfo; };
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
    if (!this._bvobLookup) {
      this.warnEvent("Initializing bvob content lookups...");
      this._bvobLookup = _initializeSharedIndexedDB(this);
    }
    return this._bvobLookup;
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

  // bvob content ops

  static initialPreCachedPersistRefCount = 1;

  preCacheBvob (bvobId: string, newInfo: Object, retrieveBvobContent: Function) {
    const bvobInfo = this._bvobLookup[bvobId];
    try {
      if (bvobInfo) {
        if ((bvobInfo.byteLength !== newInfo.byteLength)
            && (bvobInfo.byteLength !== undefined) && (newInfo.byteLength !== undefined)) {
          throw new Error(`byteLength mismatch between new bvob (${newInfo.byteLength
              }) and existing bvob (${bvobInfo.byteLength}) while precaching bvob "${bvobId}"`);
        }
        return undefined;
      }
      return Promise.resolve(retrieveBvobContent(bvobId))
      .then(buffer => (buffer !== undefined)
          && this._persistBvobContent(buffer, bvobId, Scribe.initialPreCachedPersistRefCount));
    } catch (error) {
      throw this.wrapErrorEvent(error, `preCacheBvob('${bvobId}')`,
          "\n\tbvobInfo:", ...dumpObject(bvobInfo));
    }
  }

  tryGetCachedBvobContent (bvobId: string): ?ArrayBuffer {
    const bvobInfo = this._bvobLookup[bvobId || ""];
    return bvobInfo && bvobInfo.buffer;
  }

  readBvobContent (bvobId: string): ?ArrayBuffer {
    const bvobInfo = this._bvobLookup[bvobId || ""];
    try {
      return _readBlobContent(this, blobId, blobInfo);
    } catch (error) {
      throw this.wrapErrorEvent(error, `readBvobContent('${bvobId}')`,
          "\n\tbvobInfo:", ...dumpObject(bvobInfo));
    }
  }

  decodeBvobContent (bvobId: string, decoder: MediaDecoder, contextInfo?: Object) {
    const bvobInfo = this._bvobLookup[bvobId || ""];
    let alreadyWrapped;
    try {
      if (!bvobInfo) throw new Error(`Cannot find Bvob info '${bvobId}'`);
      return _decodeBvobContent(this, bvobInfo, decoder, contextInfo, onError);
    } catch (error) { throw onError.call(this, error); }
    function onError (error) {
      if (alreadyWrapped) return error;
      alreadyWrapped = true;
      return this.wrapErrorEvent(error, `decodeBvobContent('${bvobId}', ${decoder.getName()})`,
          "\n\tdecoder:", ...dumpObject(decoder),
          "\n\tcontext info:", ...dumpObject(contextInfo),
          "\n\tbvobInfo:", ...dumpObject(bvobInfo));
    }
  }

  _persistBvobContent (buffer: ArrayBuffer, bvobId: string, initialPersistRefCount: number = 0):
      ?Promise<any> {
    const bvobInfo = this._bvobLookup[bvobId || ""];
    try {
      if ((typeof bvobId !== "string") || !bvobId) {
        throw new Error(`Invalid bvobId '${bvobId}', expected non-empty string`);
      }
      invariantifyObject(buffer, "_persistBvobContent.buffer",
          { instanceof: ArrayBuffer, allowEmpty: true });
      return _persistBvobContent(this, buffer, bvobId, bvobInfo, initialPersistRefCount);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_persistBvobContent('${bvobId}')`,
          "\n\tbuffer:", ...dumpObject(buffer),
          "\n\tbvobInfo:", ...dumpObject(bvobInfo));
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

  /**
   * Removes a bvob buffer in-memory reference count as an immediate
   * increment of bvobId.inMemoryRefCount. If as a result the ref count
   * reaches zero frees the cached buffer and all cached decodings and
   * returns true.
   * Otherwise returns false.
   *
   * Note that The inMemoryRefCount is not persisted.
   *
   * @param {string} bvobId
   * @returns {boolean}
   * @memberof Scribe
   */
  _removeContentInMemoryReference (bvobId: string): boolean {
    const bvobInfo = this._bvobLookup[bvobId || ""];
    try {
      if (!bvobInfo) throw new Error(`Cannot find Bvob info '${bvobId}'`);
      if (--bvobInfo.inMemoryRefCount) return false;
      delete bvobInfo.buffer;
      delete bvobInfo.decodings;
      return true;
    } catch (error) {
      throw this.wrapErrorEvent(error, `_removeContentInMemoryReference('${bvobId}')`,
          "\n\tbvobInfo:", ...dumpObject(bvobInfo));
    }
  }

  async _addContentPersistReference (mediaInfo: Object) {
    const bvobInfo = this._bvobLookup[mediaInfo.bvobId || ""];
    try {
      if (!bvobInfo) throw new Error(`Cannot find Bvob info '${mediaInfo.bvobId}'`);
      return await _addContentPersistReference(this, mediaInfo, blobInfo);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_addContentPersistReference('${mediaInfo.bvobId}')`,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tbvobInfo:", ...dumpObject(bvobInfo));
    }
  }

  async _removeContentPersistReference (bvobId: string) {
    const bvobInfo = this._bvobLookup[bvobId || ""];
    try {
      if (!bvobInfo) throw new Error(`Cannot find Bvob info '${bvobInfo.bvobId}'`);
      return await _removeContentPersistReference(this, blobId, blobInfo);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_removeContentPersistReference('${bvobId}')`,
          "\n\tbvobInfo:", ...dumpObject(bvobInfo));
    }
  }
}
