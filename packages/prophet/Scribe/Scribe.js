// @flow

import Prophet from "~/prophet/api/Prophet";

import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";

import { dumpObject, invariantifyObject, thenChainEagerly } from "~/tools";
import type { DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

import ScribePartitionConnection from "./ScribePartitionConnection";

import {
  BvobInfo, _initializeSharedIndexedDB, _writeBvobBuffer, _readBvobBuffers,
  _adjustBvobBufferPersistRefCounts,
} from "./_databaseOps";

import {
  _preCacheBvob,
} from "./_contentOps";

/**
 * Scribe handles all local event and content caching, providing both
 * new semantic functionality as well as performance improvements of
 * Prophet chain functionality.
 *
 * Main Semantic functionalities are:
 * 1. synchronous in-memory bvob caching and retrieval
 * 2. delayed, retrying command forwarding and bvob content uploading
 * 3. offline mode
 *
 * Main performance improvements are event log and media retrievals
 * from the local indexeddb cache on browser refresh and during
 * execution.
 *
 * As a basic principle all Bvob operations ie. operations which
 * manipulate ArrayBuffer-based data are shared between all partitions
 * and thus handled by Scribe object itself. All Media operations which
 * associate metadata to bvods are partition specific and handled by
 * ScribePartitionConnection's.
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

  // Contains the media infos for most recent action for which media
  // retrieval is successful and whose media info is successfully
  // persisted.
  // See ScribePartitionConnection._pendingMediaLookup.
  _persistedMediaLookup: { [mediaId: string]: Object };
  _databaseAPI: DatabaseAPI;
  _databasePrefix: string;

  constructor ({ databaseAPI, databasePrefix, ...rest }: Object) {
    super({ ...rest });
    this._mediaTypes = {};
    this._persistedMediaLookup = {};
    this._databaseAPI = databaseAPI;
    this._databasePrefix = databasePrefix || "";
  }

  // Idempotent: returns a promise until the initialization is complete. await on it.
  initiate () {
    return this._initiation || (this._initiation = thenChainEagerly(
        this.warnEvent(1, "Initializing bvob content lookups..."), [
          () => _initializeSharedIndexedDB(this),
          ({ totalBytes, clearedBuffers, releasedBytes, contentLookup }) => {
            this.warnEvent(1, () => [
              `Content lookup initialization done with ${
                  Object.keys(contentLookup).length} buffers, totaling ${totalBytes} bytes.`,
              `\n\tcleared ${clearedBuffers} buffers, releasing ${releasedBytes} bytes`,
            ]);
            this._bvobLookup = contentLookup;
            return (this._initiation = this);
          },
        ]));
  }

  getDatabaseAPI (): DatabaseAPI { return this._databaseAPI; }

  // bvob content ops

  preCacheBvob (bvobId: string, newInfo: Object, retrieveBvobContent: Function,
      initialPersistRefCount: number = 0) {
    try {
      return _preCacheBvob(this, bvobId, newInfo, retrieveBvobContent, initialPersistRefCount);
    } catch (error) {
      throw this.wrapErrorEvent(error, `preCacheBvob('${bvobId}')`,
          "\n\tbvobInfo:", ...dumpObject(this._bvobLookup[bvobId]));
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
          .catch(errorOnAdjustInMemoryBvobBufferRefCounts.bind(this));
    } catch (error) { throw errorOnAdjustInMemoryBvobBufferRefCounts.call(this, error); }
    function errorOnAdjustInMemoryBvobBufferRefCounts (error) {
      throw this.wrapErrorEvent(error,
          new Error(`_adjustInMemoryBvobBufferRefCounts(${
              Object.keys(adjusts || {}).length} adjusts)`),
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
