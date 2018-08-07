// @flow

import type { PartitionURI } from "~/raem/tools/PartitionURI";

import Prophet, { NarrateOptions } from "~/prophet/api/Prophet";

import ScribePartitionConnection from "~/prophet/prophet/ScribePartitionConnection";
import DecoderArray from "~/prophet/prophet/DecoderArray";

import type MediaDecoder from "~/tools/MediaDecoder";
import IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";

import { dumpObject, invariantifyObject, invariantifyString, thenChainEagerly }
    from "~/tools";
import type { DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

type BlobInfo = {
  blobId: string, // db primary key for "blobs" and "buffers"
  persistRefCount: number, // db-backed in "blobs"
  byteLength: number, // db-backed in "blobs"
  inMemoryRefCount: number, // not db-backed
  buffer: ?ArrayBuffer, // db-backed in "buffers" but not always in memory
  decodings?: WeakMap<MediaDecoder, any>,
  persistProcess: ?Promise<any>,
};

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
  databaseAPI: DatabaseAPI;

  constructor ({ commandCountCallback, databaseAPI, ...rest }: Object) {
    super({ upstream: null, ...rest });
    this._mediaTypes = {};
    this._persistedMediaLookup = {};
    this._totalCommandCount = 0;
    this._partitionCommandCounts = {};
    this._commandCountCallback = commandCountCallback;
    this.databaseAPI = databaseAPI;
    this._decoderArray = new DecoderArray({
      name: `Decoders of ${this.getName()}`,
      logger: this.getLogger(),
    });
  }

  // Idempotent: returns a promise until the initialization is complete. await on it.
  initialize () {
    if (!this._blobLookup) this._blobLookup = this._initializeContentLookup();
    return this._blobLookup;
  }

  getDecoderArray () { return this._decoderArray; }

  async _initializeContentLookup () {
    this._sharedDb = new IndexedDBWrapper("valaa-shared-content",
      [
        { name: "blobs", keyPath: "blobId" },
        { name: "buffers", keyPath: "blobId" },
      ],
      this.getLogger(),
      this.databaseAPI,
    );
    await this._sharedDb.initialize();
    const contentLookup = {};
    this.warnEvent("Initializing blob content lookups...");
    let totalBytes = 0;
    let clearedBuffers = 0;
    let releasedBytes = 0;
    await this._transaction(["blobs", "buffers"], "readwrite", ({ blobs, buffers }) => {
      blobs.openCursor().onsuccess = event => {
        const cursor: IDBCursorWithValue = event.target.result;
        if (!cursor) return;
        if (cursor.value.persistRefCount <= 0) {
          if (cursor.value.byteLength) releasedBytes += cursor.value.byteLength;
          buffers.delete(cursor.key);
          cursor.delete();
          ++clearedBuffers;
        } else if (!contentLookup[cursor.key]) {
          contentLookup[cursor.key] = { ...cursor.value, inMemoryRefCount: 0 };
          if (cursor.value.byteLength) totalBytes += cursor.value.byteLength;
        }
        cursor.continue();
      };
    });
    this.warnEvent(`Content lookup initialization done with ${
            Object.keys(contentLookup).length} buffers, totaling ${totalBytes} bytes.`,
        `\n\tcleared ${clearedBuffers} buffers, releasing ${releasedBytes} bytes`);
    this._blobLookup = contentLookup;
    return contentLookup;
  }

  static initialPreCachedPersistRefCount = 1;

  preCacheBlob (blobId: string, newInfo: Object, readBlobContent: Function) {
    const blobInfo = this._blobLookup[blobId];
    if (!blobInfo) {
      return Promise.resolve(readBlobContent(blobId)).then(
          buffer => (typeof buffer !== "undefined")
              && this._persistBlobContent(buffer, blobId, Scribe.initialPreCachedPersistRefCount));
    }
    if (blobInfo.byteLength === newInfo.byteLength
        || typeof blobInfo.byteLength === "undefined"
        || typeof newInfo.byteLength === "undefined") return undefined;
    throw new Error(`byteLength mismatch between new blob (${newInfo.byteLength
        }) and existing blob (${blobInfo.byteLength}) while precaching blob "${blobId}"`);
  }

  _transaction (stores: Array<string>, mode: string = "readonly", opsCallback: Function) {
    return this._sharedDb.transaction(stores, mode, opsCallback);
  }

  async acquirePartitionConnection (partitionURI: PartitionURI,
      initialNarrateOptions: NarrateOptions): ScribePartitionConnection {
    // Oracle does connection caching and sharing, no need to have a connections structure here.
    const ret = new ScribePartitionConnection({
      prophet: this,
      partitionURI,
      processEvent: initialNarrateOptions.callback,
      databaseAPI: this.databaseAPI,
    });
    await ret.connect(initialNarrateOptions);
    return ret;
  }

  tryGetCachedBlobContent (blobId: string): ?ArrayBuffer {
    const blobInfo = this._blobLookup[blobId];
    return blobInfo && blobInfo.buffer;
  }

  readBlobContent (blobId: string): ?ArrayBuffer {
    if (!blobId) return undefined;
    const blobInfo = this._blobLookup[blobId];
    if (!blobInfo) return undefined; // maybe throw?
    if (blobInfo.buffer) return blobInfo.buffer;
    return this._transaction(["buffers"], "readonly", ({ buffers }) =>
      new Promise((resolve, reject) => {
        const req = buffers.get(blobId);
        req.onsuccess = async event => {
          if (!event.target.result) {
            reject(new Error(`Cannot find blob '${blobId}' from shared cache`));
          } else {
            const buffer = event.target.result.buffer;
            if (blobInfo.inMemoryRefCount) blobInfo.buffer = buffer;
            resolve(buffer);
          }
        };
      })
    );
  }

  decodeBlobContent (blobId: string, decoder: MediaDecoder, contextInfo: Object) {
    const blobInfo: Object = this._blobLookup[blobId || ""];
    if (!blobInfo) return undefined;
    const cacheHit = blobInfo.decodings && blobInfo.decodings.get(decoder);
    if (cacheHit) return cacheHit;
    return thenChainEagerly(this.readBlobContent(blobId), [
      (buffer) => (typeof buffer === "undefined"
          ? undefined
          : decoder.decode(buffer, contextInfo)),
      (decodedContent) => {
        if (typeof decodedContent !== "undefined") {
          if (!blobInfo.decodings) blobInfo.decodings = new WeakMap();
          blobInfo.decodings.set(decoder, decodedContent);
        }
        return decodedContent;
      },
    ], error => this.wrapErrorEvent(error, `decodeBlobContent(${blobId}, ${
            decoder.getName()})`,
        "\n\tdecoder:", ...dumpObject(decoder),
        "\n\tcontext info:", ...dumpObject(contextInfo)));
  }

  _persistBlobContent (buffer: ArrayBuffer, blobId: string, initialPersistRefCount: number = 0):
      ?Promise<any> {
    invariantifyObject(buffer, "_persistBlobContent.buffer",
        { instanceof: ArrayBuffer, allowEmpty: true });
    invariantifyString(blobId, "_persistBlobContent.blobId");
    let blobInfo = this._blobLookup[blobId];
    if (blobInfo && blobInfo.persistRefCount) return blobInfo.persistProcess;
    // Initiate write (set persistProcess so eventual commands using the blobId can wait
    // before being accepted) but leave the blob persist refcount to zero. Even if the blob is
    // never actually attached to a metadata, zero-refcount blobs can be cleared from storage at
    // next _initializeContentLookup.
    blobInfo = this._blobLookup[blobId] = {
      blobId,
      buffer,
      byteLength: buffer.byteLength,
      persistRefCount: initialPersistRefCount,
      inMemoryRefCount: 0,
      persistProcess: this._transaction(["blobs", "buffers"], "readwrite",
          ({ blobs, buffers }) => {
            blobs.get(blobId).onsuccess = event => {
              const existingRefCount = event.target.result && event.target.result.persistRefCount;
              blobInfo.persistRefCount = existingRefCount || initialPersistRefCount;
              blobs.put({
                blobId,
                byteLength: blobInfo.byteLength,
                persistRefCount: blobInfo.persistRefCount,
              });
              if (!existingRefCount) buffers.put({ blobId, buffer });
            };
            return blobId;
          })
    };
    return blobInfo.persistProcess;
  }

  async _addContentInMemoryReference (mediaInfo: Object) {
    const blobInfo = this._blobLookup[mediaInfo.blobId];
    if (!blobInfo || blobInfo.inMemoryRefCount++) return undefined;
    try {
      return await this.readBlobContent(mediaInfo.blobId);
    } catch (error) {
      throw this.wrapErrorEvent(error, "During addContentInMemoryReference()",
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tblobId:", mediaInfo.blobId,
          "\n\tblobInfo:", blobInfo);
    }
  }

  _removeContentInMemoryReference (blobId: string) {
    const blobInfo = this._blobLookup[blobId];
    if (blobInfo && !--blobInfo.inMemoryRefCount) {
      delete blobInfo.buffer;
      delete blobInfo.decodings;
    }
  }

  async _addContentPersistReference (mediaInfo: Object) {
    const blobInfo = this._blobLookup[mediaInfo.blobId];
    if (!blobInfo) return undefined;
    try {
      // Check if recently created file does not need in-memory buffer persist but blobInfo still
      // has it and delete the buffer.
      if (!blobInfo.inMemoryRefCount && blobInfo.buffer) delete blobInfo.buffer;
      return await this._transaction(["blobs"], "readwrite", ({ blobs }) => {
        blobs.get(mediaInfo.blobId).onsuccess = event => {
          blobInfo.persistRefCount = (event.target.result && event.target.result.persistRefCount)
              || 0;
          ++blobInfo.persistRefCount;
          blobs.put({
            blobId: mediaInfo.blobId,
            byteLength: blobInfo.byteLength,
            persistRefCount: blobInfo.persistRefCount,
          });
        };
      });
    } catch (error) {
      throw this.wrapErrorEvent(error, `_addContentPersistReference('${mediaInfo.blobId}')`,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tblobId:", mediaInfo.blobId,
          "\n\tblobInfo:", blobInfo);
    }
  }

  async _removeContentPersistReference (blobId: string) {
    const blobInfo = this._blobLookup[blobId];
    if (!blobInfo) return undefined;
    try {
      return await this._transaction(["blobs"], "readwrite", ({ blobs }) => {
        blobs.get(blobId).onsuccess = event => {
          if (!event.target.result) {
            this.errorEvent(`While removing content buffer persist reference, cannot find ${
                ""}IndexedDB.valaa-shared-content.blobs entry ${blobId}`);
            return;
          }
          blobInfo.persistRefCount = event.target.result.persistRefCount;
          --blobInfo.persistRefCount;
          if (!(blobInfo.persistRefCount > 0)) { // a bit of defensive programming vs NaN...
            blobInfo.persistRefCount = 0;
          }
          blobs.put({
            blobId,
            byteLength: blobInfo.byteLength,
            persistRefCount: blobInfo.persistRefCount,
          });
          /* Only removing blob infos and associated buffers on start-up.
          if (!blobInfo.persistRefCount) {
            blobs.delete(blobInfo.blobId);
            buffers.delete(blobInfo.blobId);
          }
          */
        };
      });
    } catch (error) {
      throw this.wrapErrorEvent(error, `_removeContentPersistReference('${blobId}')`,
          "\n\tblobId:", blobId,
          "\n\tblobInfo:", blobInfo);
    }
  }

  setConnectionCommandCount (connectionName: Object, value: number = 1) {
    const previous = this._partitionCommandCounts[connectionName] || 0;
    this._partitionCommandCounts[connectionName] = value;
    this._totalCommandCount += (value - previous);
    if (this._commandCountCallback) {
      this._commandCountCallback(this._totalCommandCount, this._partitionCommandCounts);
    }
  }
}
