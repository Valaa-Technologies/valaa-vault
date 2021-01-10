// @flow

import Sourcerer from "~/sourcerer/api/Sourcerer";

import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";

import { dumpObject, invariantifyObject, thenChainEagerly } from "~/tools";
import type { DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

import ScribeConnection from "./ScribeConnection";

import {
  BvobInfo, _initializeSharedIndexedDB, _writeBvobBuffer, _readBvobBuffers,
  _adjustBvobBufferPersistRefCounts, _deleteDatabases,
} from "./_databaseOps";

import {
  _preCacheBvob,
} from "./_contentOps";

export { SHARED_DB_VERSION, CHRONICLE_DB_VERSION } from "./_databaseOps";

/**
 * Scribe handles all local event and content caching, providing both
 * new semantic functionality as well as performance improvements of
 * Sourcerer chain functionality.
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
 * manipulate ArrayBuffer-based data are shared between all chronicles
 * and thus handled by Scribe object itself. All Media operations which
 * associate metadata to bvods are chronicle specific and handled by
 * ScribeConnection's.
 *
 * @export
 * @class Scribe
 * @extends {Sourcerer}
 */
export default class Scribe extends Sourcerer {
  static ConnectionType = ScribeConnection;

  _sharedDb: IndexedDBWrapper;
  _bvobLookup: { [contentHash: string]: BvobInfo; };
  _mediaTypes: { [mediaTypeId: string]: { type: string, subtype: string, parameters: any }};

  // Contains the media infos for most recent action for which media
  // retrieval is successful and whose media info is successfully
  // persisted.
  // See ScribeConnection._pendingMediaLookup.
  _persistedMediaLookup: { [mediaId: string]: Object };
  _databaseAPI: DatabaseAPI;
  _databasePrefix: string;

  constructor ({ databaseAPI, databasePrefix, ...rest }: Object) {
    super({ ...rest });
    this._mediaTypes = {};
    this._persistedMediaLookup = {};
    if (!databaseAPI) throw new Error("Scribe#constructor options.databaseAPI missing");
    this._databaseAPI = databaseAPI;
    this._databasePrefix = databasePrefix || "";
  }

  // Idempotent: returns a promise until the initialization is complete. await on it.
  initiate () {
    return this._initiation || (this._initiation = thenChainEagerly(
        this.warnEvent(1, "Initializing bvob content lookups..."), [
          () => _initializeSharedIndexedDB(this),
          ({ totalBytes, clearedBuffers, releasedBytes, contentLookup, chronicleLookup }) => {
            this.warnEvent(1, () => [
              `Content lookup initialization done with ${
                  Object.keys(contentLookup).length} buffers, totaling ${totalBytes} bytes.`,
              `\n\tcleared ${clearedBuffers} buffers, releasing ${releasedBytes} bytes`,
            ]);
            this._bvobLookup = contentLookup;
            this._chronicleLookup = chronicleLookup;
            return (this._initiation = this);
          },
        ]));
  }

  async terminate (options = {}) {
    await super.terminate(options);
    if (this._sharedDb) {
      this._sharedDb.release();
      this._sharedDb = null;
    }
    if (options.deleteDatabases) await _deleteDatabases(this, options.deleteDatabases);
  }

  getDatabaseAPI (): DatabaseAPI { return this._databaseAPI; }

  getSharedDatabaseId () {
    return `${this._databasePrefix}valos-shared-content`;
  }

  getChronicleDatabaseId (chronicleURI) {
    return `${this._databasePrefix}${chronicleURI}`;
  }

  // bvob content ops

  preCacheBvob (contentHash: string, newInfo: Object, retrieveBvobContent: Function,
      initialPersistRefCount: number = 0) {
    try {
      return _preCacheBvob(this, contentHash, newInfo, retrieveBvobContent, initialPersistRefCount);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `preCacheBvob('${contentHash}')`,
          "\n\tbvobInfo:", ...dumpObject(this._bvobLookup[contentHash]));
    }
  }

  tryGetCachedBvobContent (contentHash: string): ?ArrayBuffer {
    const bvobInfo = this._bvobLookup[contentHash || ""];
    return bvobInfo && bvobInfo.buffer;
  }

  readBvobContent (contentHash: string): ?ArrayBuffer {
    const bvobInfo = this._bvobLookup[contentHash || ""];
    try {
      if (!bvobInfo) throw new Error(`Can't find Bvob info '${contentHash}'`);
      return _readBvobBuffers(this, [bvobInfo])[0];
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `readBvobContent('${contentHash}')`,
          "\n\tbvobInfo:", ...dumpObject(bvobInfo));
    }
  }

  _writeBvobBuffer (buffer: ArrayBuffer, contentHash: string, initialPersistRefCount: number = 0):
      ?Promise<any> {
    const bvobInfo = this._bvobLookup[contentHash || ""];
    try {
      if ((typeof contentHash !== "string") || !contentHash) {
        throw new Error(`Invalid contentHash '${contentHash}', expected non-empty string`);
      }
      invariantifyObject(buffer, "_writeBvobBuffer.buffer",
          { instanceof: ArrayBuffer, allowEmpty: true });
      return _writeBvobBuffer(this, buffer, contentHash, bvobInfo, initialPersistRefCount);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `_writeBvobBuffer('${contentHash}')`,
          "\n\tbuffer:", ...dumpObject(buffer),
          "\n\tbvobInfo:", ...dumpObject(bvobInfo));
    }
  }

  /**
   * Adjusts a bvob in-memory buffer reference counts as an immediate
   * modification to bvobInfo.inMemoryRefCount. If as a result the ref
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
   * @param {object} adjusts
   * @returns {boolean}
   * @memberof Scribe
   */
  _adjustInMemoryBvobBufferRefCounts (adjusts: { [contentHash: string]: number }): Object[] {
    const readBuffers = [];
    try {
      const ret = Object.keys(adjusts).map(contentHash => {
        const bvobInfo = this._bvobLookup[contentHash];
        if (!bvobInfo) throw new Error(`Cannot find Bvob info for '${contentHash}'`);
        return [bvobInfo, adjusts[contentHash]];
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
      throw this.wrapErrorEvent(error, 1,
          new Error(`_adjustInMemoryBvobBufferRefCounts(${
              Object.keys(adjusts || {}).length} adjusts)`),
          "\n\tbvob buffer reads:", ...dumpObject(readBuffers),
          "\n\tadjusts:", ...dumpObject(adjusts),
      );
    }
  }

  async _adjustBvobBufferPersistRefCounts (adjusts: { [contentHash: string]: number }): Object[] {
    try {
      Object.keys(adjusts).forEach(contentHash => {
        if (!this._bvobLookup[contentHash]) {
          throw new Error(`Cannot find Bvob info '${contentHash}'`);
        }
      });
      return await _adjustBvobBufferPersistRefCounts(this, adjusts);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1,
          `_adjustBvobBufferPersistRefCounts(${Object.keys(adjusts || {}).length} adjusts)`,
          "\n\tadjusts:", ...dumpObject(adjusts),
      );
    }
  }
}
