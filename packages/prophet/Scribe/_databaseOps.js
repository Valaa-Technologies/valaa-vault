// @flow

import ValaaURI from "~/raem/ValaaURI";

import { dumpObject, vdon, wrapError } from "~/tools";
import IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";
import type MediaDecoder from "~/tools/MediaDecoder";
import { trivialCloneWith } from "~/tools/trivialClone";

import Scribe from "./Scribe";
import ScribePartitionConnection from "./ScribePartitionConnection";

export const vdoc = vdon({
  "...": { heading:
    "Database ops manage all IndexedDB reads and writes",
  },
  0: [
    `Database ops are detail of both Scribe and
    ScribePartitionConnection.`,
  ],
});

export type BvobInfo = {
  bvobId: string, // db primary key for "bvobs" and "buffers"
  persistRefCount: number, // db-backed in "bvobs"
  byteLength: number, // db-backed in "bvobs"
  inMemoryRefCount: number, // not db-backed
  buffer: ?ArrayBuffer, // db-backed in "buffers" but not always in memory
  decodings?: WeakMap<MediaDecoder, any>,
  persistProcess: ?Promise<any>,
};

export async function _initializeSharedIndexedDB (scribe: Scribe) {
  scribe._sharedDb = new IndexedDBWrapper("valaa-shared-content",
    [
      { name: "bvobs", keyPath: "bvobId" },
      { name: "buffers", keyPath: "bvobId" },
    ],
    scribe.getLogger(),
    scribe._databaseAPI,
  );
  await scribe._sharedDb.initialize();

  const contentLookup = {};
  let totalBytes = 0;
  let clearedBuffers = 0;
  let releasedBytes = 0;
  await scribe._sharedDb.transaction(["bvobs", "buffers"], "readwrite", ({ bvobs, buffers }) => {
    bvobs.openCursor().onsuccess = event => {
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
  scribe._bvobLookup = contentLookup;
  scribe.warnEvent(1, `Content lookup initialization done with ${
    Object.keys(contentLookup).length} buffers, totaling ${totalBytes} bytes.`,
      `\n\tcleared ${clearedBuffers} buffers, releasing ${releasedBytes} bytes`);
  return contentLookup;
}

export async function _initializeConnectionIndexedDB (connection: ScribePartitionConnection) {
  // TODO(iridian): Implement initialNarrateOptions
  // TODO(iridian): Load info structures from indexed_db. These are member fields described above.
  // Also create Scribe._contentLookup entries for contents referenced by the _pendingMediaLookup
  // entries, including the in-memory contents.
  // If the partition does not exist, create it and its structures.
  connection._db = new IndexedDBWrapper(connection._partitionURI.toString(), [
    { name: "events", keyPath: "eventId" },
    { name: "commands", keyPath: "eventId" },
    { name: "medias", keyPath: "mediaId" },
  ], connection.getLogger(), connection._databaseAPI);
  await connection._db.initialize();

  // Populate _eventLogInfo with first and last events
  await connection._db.transaction(["events", "commands"], "readonly", ({ events, commands }) => {
    // Get the last key in the events table and store it in eventLogInfo
    _loadEventId(events, undefined, connection._eventLogInfo, "firstEventId");
    _loadEventId(events, "prev", connection._eventLogInfo, "lastEventId");
    _loadEventId(commands, undefined, connection._commandQueueInfo, "firstEventId");
    _loadEventId(commands, "prev", connection._commandQueueInfo, "lastEventId");
  });
  return connection;

  function _loadEventId (entries, direction: ?"prev", target, eventIdTargetFieldName) {
    const req = entries.openCursor(...(direction ? [null, direction] : []));
    req.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) target[eventIdTargetFieldName] = cursor.key;
    };
  }
}

// Media reads & writes

export function _persistMediaEntry (connection: ScribePartitionConnection, newMediaEntry: Object,
    oldEntry: Object) {
  return connection._db.transaction(["medias"], "readwrite", ({ medias }) => {
    const req = medias.put(newMediaEntry);
    req.onsuccess = () => {
      const newInfo = newMediaEntry.mediaInfo;
      const oldBvobId = oldEntry && oldEntry.mediaInfo.bvobId;
      if (newInfo.bvobId !== oldBvobId) {
        // TODO(iridian): Are there race conditions here? The refcount operations are not awaited on
        if (newInfo.bvobId) {
          if (!connection._prophet._bvobLookup[newInfo.bvobId]) {
            // console.log(`Can't find Media "${newInfo.name}" Bvob info for ${newInfo.bvobId
            //    } when adding new content references`);
          } else {
            if (newMediaEntry.isInMemory) connection._prophet._addContentInMemoryReference(newInfo);
            if (newMediaEntry.isPersisted) connection._prophet._addContentPersistReference(newInfo);
          }
        }
        if (oldBvobId) {
          if (!connection._prophet._bvobLookup[oldBvobId]) {
            // console.log(`Can't find Media "${newInfo.name}" Bvob info for ${oldBvobId
            //    } when removing old content references`);
          } else {
            if (oldEntry.isInMemory) connection._prophet._removeContentInMemoryReference(oldBvobId);
            if (oldEntry.isPersisted) connection._prophet._removeContentPersistReference(oldBvobId);
          }
        }
      }
      connection._prophet._persistedMediaLookup[newMediaEntry.mediaId] = newMediaEntry;
    };
  });
}

export function _readMediaInfos (connection: ScribePartitionConnection, results: Object) {
  return connection._db.transaction(["medias"], "readwrite", ({ medias }) =>
      new Promise((resolve, reject) => {
        const req = medias.openCursor();
        req.onsuccess = event => {
          const cursor: IDBCursorWithValue = event.target.result;
          // Cursor is null when end of record set is reached
          if (!cursor) {
            resolve();
            return;
          }
          const entry = { ...cursor.value, isInMemory: true };
          if (entry.mediaInfo && entry.mediaInfo.bvobId && entry.isInMemory) {
            if (!connection._prophet._bvobLookup[entry.mediaInfo.bvobId]) {
              connection.errorEvent(`Can't find Media "${entry.mediaInfo.name
                  }" in-memory Bvob info for ${entry.mediaInfo.bvobId
                  } when reading partition media infos`);
            } else {
              connection._prophet._addContentInMemoryReference(entry.mediaInfo);
            }
          }
          results[cursor.key] = entry;
          cursor.update(entry);
          cursor.continue();
        };
        req.onerror = (evt) => reject(new Error(evt.target.error.message));
      }));
}

export function _destroyMediaInfo (connection: ScribePartitionConnection, mediaRawId: string) {
  const mediaEntry = connection._pendingMediaLookup[mediaRawId];
  if (!mediaEntry) return undefined;
  delete connection._pendingMediaLookup[mediaRawId];
  delete connection._prophet._persistedMediaLookup[mediaRawId];

  return connection._db.transaction(["medias"], "readwrite", ({ medias }) => {
    const req = medias.delete(mediaRawId);
    req.onsuccess = () => {
      const bvobId = mediaEntry.mediaInfo.bvobId;
      if (bvobId) {
        if (mediaEntry.isInMemory) connection._prophet._removeContentInMemoryReference(bvobId);
        if (mediaEntry.isPersisted) connection._prophet._removeContentPersistReference(bvobId);
      }
    };
  });
}

// Bvob reads & writes

export function _persistBvobContent (scribe: Scribe, buffer: ArrayBuffer,
    bvobId: string, bvobInfo?: BvobInfo, initialPersistRefCount: number = 0): ?Promise<any> {
  if (bvobInfo && bvobInfo.persistRefCount) return bvobInfo.persistProcess;
  // Initiate write (set persistProcess so eventual commands using the bvobId can wait
  // before being accepted) but leave the bvob persist refcount to zero. Even if the bvob is
  // never actually attached to a metadata, zero-refcount bvobs can be cleared from storage at
  // next _initializeContentLookup.
  const actualBvobInfo = scribe._bvobLookup[bvobId] = {
    bvobId,
    buffer,
    byteLength: buffer.byteLength,
    persistRefCount: initialPersistRefCount,
    inMemoryRefCount: 0,
    persistProcess: scribe._sharedDb.transaction(["bvobs", "buffers"], "readwrite",
        ({ bvobs, buffers }) => {
          bvobs.get(bvobId).onsuccess = event => {
            const existingRefCount = event.target.result && event.target.result.persistRefCount;
            actualBvobInfo.persistRefCount = existingRefCount || initialPersistRefCount;
            bvobs.put({
              bvobId,
              byteLength: actualBvobInfo.byteLength,
              persistRefCount: actualBvobInfo.persistRefCount,
            });
            if (!existingRefCount) buffers.put({ bvobId, buffer });
          };
          return bvobId;
        })
  };
  return actualBvobInfo.persistProcess;
}

export function _readBvobBuffers (scribe: Scribe, bvobInfos: BvobInfo[]):
    (Promise<ArrayBuffer> | ArrayBuffer)[] {
  const pendingReads = [];
  const ret = bvobInfos.map((bvobInfo) => {
    if (!bvobInfo) return undefined;
    if (bvobInfo.buffer) return bvobInfo.buffer;
    if (bvobInfo.pendingBuffer) return bvobInfo.pendingBuffer;
    const pendingRead = { bvobInfo };
    pendingReads.push(pendingRead);
    return (bvobInfo.pendingBuffer = new Promise((resolve_, reject_) => {
      pendingRead.resolve = resolve_;
      pendingRead.reject = reject_;
    }));
  });
  if (pendingReads.length) {
    scribe._sharedDb.transaction(["buffers"], "readonly", ({ buffers }) => {
      pendingReads.forEach(pendingRead => {
        const bvobInfo = pendingRead.bvobInfo;
        const req = buffers.get(bvobInfo.bvobId);
        req.onerror = (error) => {
          delete bvobInfo.pendingBuffer;
          pendingRead.reject(error);
        };
        req.onsuccess = () => {
          delete bvobInfo.pendingBuffer;
          if (!req.result || !req.result.buffer) {
            pendingRead.reject(new Error(`Cannot find bvob '${bvobInfo.bvobId}' from IndexedDB`));
          } else {
            if (bvobInfo.inMemoryRefCount) bvobInfo.buffer = req.result.buffer;
            pendingRead.resolve(req.result.buffer);
          }
        };
      });
    });
  }
  return ret;
}

export function _addBvobPersistReferences (scribe: Scribe, bvobInfos: BvobInfo[]) {
  // Check if recently created file does not need in-memory buffer persist but bvobInfo still
  // has it and delete the buffer.
  return scribe._sharedDb.transaction(["bvobs"], "readwrite", ({ bvobs }) => {
    bvobInfos.forEach(bvobInfo => {
      if (!bvobInfo.inMemoryRefCount && bvobInfo.buffer) delete bvobInfo.buffer;
      const req = bvobs.get(bvobInfo.bvobId);
      req.onsuccess = () => {
        bvobInfo.persistRefCount = (req.result && req.result.persistRefCount) || 0;
        ++bvobInfo.persistRefCount;
        bvobs.put({
          bvobId: bvobInfo.bvobId,
          byteLength: bvobInfo.byteLength,
          persistRefCount: bvobInfo.persistRefCount,
        });
      };
    });
  });
}

export function _removeBvobPersistReferences (scribe: Scribe, bvobInfos: BvobInfo[]) {
  return scribe._sharedDb.transaction(["bvobs"], "readwrite", ({ bvobs }) => {
    bvobInfos.forEach(bvobInfo => {
      const req = bvobs.get(bvobInfo.bvobId);
      req.onsuccess = () => {
        if (!req.result) {
          scribe.errorEvent(`While removing content buffer persist reference, cannot find ${
              ""}IndexedDB.valaa-shared-content.bvobs entry ${bvobInfo.bvobId}`);
          return;
        }
        bvobInfo.persistRefCount = req.result.persistRefCount;
        --bvobInfo.persistRefCount;
        if (!(bvobInfo.persistRefCount > 0)) { // a bit of defensive programming vs NaN...
          bvobInfo.persistRefCount = 0;
        }
        bvobs.put({
          bvobId: bvobInfo.bvobId,
          byteLength: bvobInfo.byteLength,
          persistRefCount: bvobInfo.persistRefCount,
        });
        /* Only removing bvob infos and associated buffers on start-up.
        if (!bvobInfo.persistRefCount) {
          bvobs.delete(bvobInfo.bvobId);
          buffers.delete(bvobInfo.bvobId);
        }
        */
      };
    });
  });
}

// Events & commands reads & writes

export function _writeEvent (connection: ScribePartitionConnection, eventId: number,
  event: Object) {
  try {
    return connection._db.transaction(["events"], "readwrite", ({ events }) => {
      const req = events.get(eventId);
      req.onsuccess = reqEvent => {
        if (reqEvent.target.result) {
          if (reqEvent.target.result.commandId === event.commandId) return;
          throw connection.wrapErrorEvent(
            new Error(`Mismatching existing event commandId when persisting event`),
            `_writeEvent(${eventId})`,
            "\n\texisting commandId:", reqEvent.target.result.commandId,
            "\n\tnew event commandId:", event.commandId,
            "\n\texisting event:", ...dumpObject(reqEvent.target.result),
            "\n\tnew event:", ...dumpObject(event));
        }
        const eventJSON = _serializeEventAsJSON(event);
        eventJSON.eventId = eventId;
        events.put(eventJSON);
      };
    });
  } catch (error) {
    throw wrapError(error, `during _writeEvent(${connection}, ${eventId}, ${event})`);
  }
}

function _serializeEventAsJSON (event) {
  return trivialCloneWith(event, (value) => {
    try {
      if ((typeof value !== "object") || (value === null)) return value;
      if (typeof value.toJSON === "function") return value.toJSON();
      if ((value instanceof ValaaURI) || (value instanceof URL)) return value.toString();
      return undefined;
    } catch (error) {
      throw wrapError(error, "During serializeEventAsJSON.trivialClone.customizer",
          "\n\tvalue:", ...dumpObject({ value }));
    }
  });
}

export function _readEvents (connection: ScribePartitionConnection, options: Object) {
  const range = connection._db.getIDBKeyRange(options);
  if (range === null) return undefined;
  return connection._db.transaction(["events"], "readonly",
      ({ events }) => new Promise(_getAllShim.bind(null, events, range)));
}

export function _writeCommand (connection: ScribePartitionConnection, eventId: number,
    command: Object) {
  // invariantify(command.isCommand, "writeCommand.command.isCommand must be specified");
  return connection._db.transaction(["commands"], "readwrite", ({ commands }) =>
      new Promise((resolve, reject) => {
        const commandJSON = _serializeEventAsJSON(command);
        commandJSON.eventId = eventId;
        const req = commands.add(commandJSON);
        req.onsuccess = () => { resolve(eventId); };
        req.onerror = (evt => reject(new Error(evt.target.error.message)));
      }));
}


export function _readCommands (connection: ScribePartitionConnection, options: Object) {
  const range = connection._db.getIDBKeyRange(options);
  if (range === null) return undefined;
  return connection._db.transaction(["commands"], "readonly",
      ({ commands }) => new Promise(_getAllShim.bind(null, commands, range)));
}

export function _deleteCommand (connection: ScribePartitionConnection, eventId: number) {
  return connection._db.transaction(["commands"], "readwrite", ({ commands }) =>
      new Promise((resolve, reject) => {
        const req = commands.delete(eventId);
        req.onsuccess = () => resolve();
        req.onerror = (evt => reject(new Error(evt.target.error.message)));
      }));
}

export function _deleteCommands (connection: ScribePartitionConnection,
    fromEventId: string, toEventId: string) {
  return connection._db.transaction(["commands"], "readwrite", ({ commands }) =>
      new Promise((resolve, reject) => {
        const req = commands.delete(connection.database.IDBKeyRange.bound(fromEventId, toEventId));
        req.onsuccess = () => resolve();
        req.onerror = (evt => reject(new Error(evt.target.error.message)));
      }));
}

function _getAllShim (database, range: IDBKeyRange, resolve: Function, reject: Function) {
  let req;
  if (typeof database.getAll !== "undefined") {
    req = database.getAll(range);
    req.onsuccess = () => _resolveWith(req.result);
  } else {
    console.warn("Using openCursor because getAll is not implemented (by Edge?)");
    const result = [];
    req = database.openCursor(range);
    req.onsuccess = () => {
      const nextCursor = event.target.result;
      if (nextCursor) {
        result.push(nextCursor.value);
        nextCursor.continue();
      } else {
        // complete
        console.log("Cursor processing complete, result:", result);
        _resolveWith(result);
      }
    };
  }
  function _resolveWith (results) {
    resolve(results.map(event => {
      delete event.eventId;
      return event;
    }));
  }
  req.onerror = (evt => reject(new Error(evt.target.error.message)));
}
