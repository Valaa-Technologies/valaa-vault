// @flow

import Prophet from "~/prophet/api/Prophet";

import DecoderArray from "~/prophet/prophet/DecoderArray";

import type MediaDecoder from "~/tools/MediaDecoder";
import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";

import { dumpObject, invariantifyObject } from "~/tools";
import type { DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

import ScribePartitionConnection from "./ScribePartitionConnection";

import { _decodeBvobContent } from "./_contentOps";
import {
  BvobInfo, _initializeSharedIndexedDB, _writeBvobBuffer, _readBvobBuffers,
  _adjustBvobBufferPersistRefCounts,
} from "./_databaseOps";

/**
 * Scribe handles all localhost-based Bvob and Media operations.
 * This includes in-memory caches, indexeddb storage (and eventually cross-browser-tab operations)
 * as well as possible service worker interactions.
 *
 * As a basic principles all Bvob operations ie. operations which manipulate ArrayBuffer-based data
 * are shared between all partitions and thus handled by Scribe itself. All Media operations which
 * associate metadata to bvods are partition specific and handled by ScribePartitionConnection's.
 *
 * @export
 * @class Scribe
 * @extends {Prophet}
 */
export default class Scribe extends Prophet {

  static PartitionConnectionType = ScribePartitionConnection;

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
    super({ ...rest });
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
      this.warnEvent(1, "Initializing bvob content lookups...");
      this._bvobLookup = _initializeSharedIndexedDB(this);
    }
    return this._bvobLookup;
  }

  getDatabaseAPI (): DatabaseAPI { return this._databaseAPI; }
  getDecoderArray () { return this._decoderArray; }

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

  preCacheBvob (bvobId: string, newInfo: Object, retrieveBvobContent: Function,
      initialPersistRefCount: number = 0) {
    const bvobInfo = this._bvobLookup[bvobId];
    try {
      if (bvobInfo) {
        // This check produces false positives: if byteLengths match there is no error even if
        // the contents might still be inconsistent.
        if ((bvobInfo.byteLength !== newInfo.byteLength)
            && (bvobInfo.byteLength !== undefined) && (newInfo.byteLength !== undefined)) {
          throw new Error(`byteLength mismatch between new bvob (${newInfo.byteLength
              }) and existing bvob (${bvobInfo.byteLength}) while precaching bvob "${bvobId}"`);
        }
        return undefined;
      }
      return Promise.resolve(retrieveBvobContent(bvobId))
          .then(buffer => (buffer !== undefined)
              && this._writeBvobBuffer(buffer, bvobId, initialPersistRefCount));
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
      if (!bvobInfo) throw new Error(`Can't find Bvob info '${bvobId}'`);
      return _readBvobBuffers(this, [bvobInfo])[0];
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
      return _decodeBvobContent(this, bvobInfo, decoder, contextInfo, onError.bind(this));
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

  _writeBvobBuffer (buffer: ArrayBuffer, bvobId: string, initialPersistRefCount: number = 0):
      ?Promise<any> {
    const bvobInfo = this._bvobLookup[bvobId || ""];
    try {
      if ((typeof bvobId !== "string") || !bvobId) {
        throw new Error(`Invalid bvobId '${bvobId}', expected non-empty string`);
      }
      invariantifyObject(buffer, "_writeBvobBuffer.buffer",
          { instanceof: ArrayBuffer, allowEmpty: true });
      return _writeBvobBuffer(this, buffer, bvobId, bvobInfo, initialPersistRefCount);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_writeBvobBuffer('${bvobId}')`,
          "\n\tbuffer:", ...dumpObject(buffer),
          "\n\tbvobInfo:", ...dumpObject(bvobInfo));
    }
  }

  /**
   * Adjusts a bvob in-memory buffer reference counts as an immediate
   * modification to bvobId.inMemoryRefCount. If as a result the ref
   * count reaches zero frees the cached buffer and all cached
   * decodings.
   *
   * Note that The inMemoryRefCount is not persisted.
   *
   * Note that even if inMemoryRefCount is positive the content might
   * not be in memory yet before the pending read operation has
   * finished. In such a case the pending read operation promise can be
   * found in bvobInfo.pendingBuffer, and the function will return a
   * promise.
   *
   * @param {string} bvobId
   * @returns {boolean}
   * @memberof Scribe
   */
  _adjustInMemoryBvobBufferRefCounts (adjusts: { [bvobId: string]: number }): Object[] {
    const readBuffers = [];
    try {
      const ret = Object.keys(adjusts).map(bvobId => {
        const bvobInfo = this._bvobLookup[bvobId];
        if (!bvobInfo) throw new Error(`Cannot find Bvob info '${bvobId}'`);
        return [bvobInfo, adjusts[bvobId]];
      }).map(([bvobInfo, adjust]) => {
        bvobInfo.inMemoryRefCount = (bvobInfo.inMemoryRefCount || 0) + adjust;
        if (!(bvobInfo.inMemoryRefCount > 0)) {
          delete bvobInfo.buffer;
          delete bvobInfo.decodings;
          bvobInfo.inMemoryRefCount = 0;
        }
        if (bvobInfo.inMemoryRefCount && !(bvobInfo.buffer || bvobInfo.pendingBuffer)) {
          readBuffers.push(bvobInfo);
        }
        return bvobInfo;
      });
      if (!readBuffers.length) return ret;
      return Promise.all(_readBvobBuffers(this, readBuffers).map(info => info.pendingBuffer))
          .then(() => ret)
          .catch(onError.bind(this));
    } catch (error) { throw onError.call(this, error); }
    function onError (error) {
      return this.wrapErrorEvent(error,
          `_adjustInMemoryBvobBufferRefCounts(${Object.keys(adjusts || {}).length} adjusts)`,
          "\n\tbvob buffer reads:", ...dumpObject(readBuffers),
          "\n\tadjusts:", ...dumpObject(adjusts),
      );
    }
  }

  async _adjustBvobBufferPersistRefCounts (adjusts: { [bvobId: string]: number }): Object[] {
    try {
      Object.keys(adjusts).forEach(bvobId => {
        if (!this._bvobLookup[bvobId]) throw new Error(`Cannot find Bvob info '${bvobId}'`);
      });
      return await _adjustBvobBufferPersistRefCounts(this, adjusts);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          `_adjustBvobBufferPersistRefCounts(${Object.keys(adjusts || {}).length} adjusts)`,
          "\n\tadjusts:", ...dumpObject(adjusts),
      );
    }
  }
}
