// @flow

import ValaaURI from "~/raem/ValaaURI";
import type { EventBase } from "~/raem/command";

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
    scribe.getDatabaseAPI(),
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
    { name: "truths", keyPath: "eventId" },
    { name: "commands", keyPath: "eventId" },
    { name: "medias", keyPath: "mediaId" },
  ], connection.getLogger(), connection._prophet.getDatabaseAPI());
  await connection._db.initialize();

  // Populate _truthLogInfo with first and last events
  await connection._db.transaction(["truths", "commands"], "readonly", ({ truths, commands }) => {
    // Get the last key in the events table and store it in eventLogInfo
    _loadEventId(truths, undefined, connection._truthLogInfo, "eventIdBegin");
    _loadEventId(truths, "prev", connection._truthLogInfo, "eventIdEnd");
    _loadEventId(commands, undefined, connection._commandQueueInfo, "eventIdBegin");
    _loadEventId(commands, "prev", connection._commandQueueInfo, "eventIdEnd");
    // Filled by narrate.
    connection._commandQueueInfo.commandIds = new Array(
        connection._commandQueueInfo.eventIdEnd - connection._commandQueueInfo.eventIdBegin);
  });
  connection._clampCommandQueueByTruthEvendIdEnd();
  return true;

  function _loadEventId (entries, direction: ?"prev", target, eventIdTargetFieldName) {
    const req = entries.openCursor(...(direction ? [null, direction] : []));
    req.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) target[eventIdTargetFieldName] = direction ? cursor.key + 1 : cursor.key;
    };
  }
}

/*
 #    #  ######  #####      #      ##
 ##  ##  #       #    #     #     #  #
 # ## #  #####   #    #     #    #    #
 #    #  #       #    #     #    ######
 #    #  #       #    #     #    #    #
 #    #  ######  #####      #    #    #
*/

export async function _updateMediaEntries (connection: ScribePartitionConnection,
    updates: Object[]) {
  if (!updates || !updates.length) return;
  const inMemoryRefCountAdjusts = {};
  const persistRefCountAdjusts = {};
  function _addAdjust (refs, bvobId, adjust) { refs[bvobId] = (refs[bvobId] || 0) + adjust; }

  await (connection._db && connection._db.transaction(["medias"], "readwrite", ({ medias }) => {
    updates.forEach(entry => {
      const currentEntryReq = medias.get(entry.mediaId);
      currentEntryReq.onsuccess = (/* event */) => {
        const updateEntryReq = medias.put(entry);
        updateEntryReq.onsuccess = () => {
          const newInfo = entry.mediaInfo;
          if (newInfo.bvobId) {
            if (connection._prophet._bvobLookup[newInfo.bvobId]) {
              if (entry.isInMemory) _addAdjust(inMemoryRefCountAdjusts, newInfo.bvobId, 1);
              if (entry.isPersisted) _addAdjust(persistRefCountAdjusts, newInfo.bvobId, 1);
            } else {
              console.log(`Can't find Media "${newInfo.name}" Bvob info for ${newInfo.bvobId
              } when adding new content references`);
            }
          }
          const currentBvobId = ((currentEntryReq.result || {}).mediaInfo || {}).bvobId;
          if (currentBvobId && currentEntryReq.result.isPersisted) {
            if (connection._prophet._bvobLookup[currentBvobId]) {
              _addAdjust(persistRefCountAdjusts, currentBvobId, -1);
            } else {
              console.log(`Can't find Media "${newInfo.name}" Bvob info for ${currentBvobId
              } when removing old content references`);
            }
          }
          entry.successfullyPersisted = true;
        };
        updateEntryReq.onerror = (failureEvent) => {
          connection.errorEvent(
              `_updateMediaEntries().put("${(entry.mediaInfo || {}).name || entry.mediaId
                  }") Failed:`, ...dumpObject(failureEvent),
              "\n\terror:", ...dumpObject(updateEntryReq.error),
              "\n\tmediaEntry:", ...dumpObject(entry));
          // Don't prevent the error from aborting the transaction, which will then roll back and
          // no refcount updates will be made either.
          // This line is thus useless and is here only for future reminder: if this error is
          // selectively ignored and the particular media update skipped
        };
      };
    });
  }));
  updates.forEach(entry => {
    if (connection.isLocallyPersisted() && !entry.successfullyPersisted) return;
    delete entry.successfullyPersisted;
    const currentScribeEntry = connection._prophet._persistedMediaLookup[entry.mediaId];
    if ((currentScribeEntry || {}).isInMemory && (currentScribeEntry.mediaInfo || {}).bvobId) {
      _addAdjust(inMemoryRefCountAdjusts, currentScribeEntry.mediaInfo.bvobId, -1);
    }
    connection._prophet._persistedMediaLookup[entry.mediaId] = entry;
  });
  connection._prophet._adjustInMemoryBvobBufferRefCounts(inMemoryRefCountAdjusts);
  await connection._prophet._adjustBvobBufferPersistRefCounts(persistRefCountAdjusts);
}

export function _readMediaEntries (connection: ScribePartitionConnection, results: Object) {
  if (!connection._db) return undefined;
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
          const bvobId = (entry.mediaInfo || {}).bvobId;
          if (bvobId && entry.isInMemory) {
            if (connection._prophet._bvobLookup[bvobId]) {
              connection._prophet._adjustInMemoryBvobBufferRefCounts({ [bvobId]: 1 });
            } else {
              connection.errorEvent(`Can't find Media "${entry.mediaInfo.name
                  }" in-memory Bvob info for ${entry.mediaInfo.bvobId
                  } when reading partition media infos`);
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
  if (!mediaEntry || !connection._db) return undefined;
  delete connection._pendingMediaLookup[mediaRawId];
  delete connection._prophet._persistedMediaLookup[mediaRawId];

  return connection._db.transaction(["medias"], "readwrite", ({ medias }) => {
    const req = medias.delete(mediaRawId);
    req.onsuccess = () => {
      const bvobId = mediaEntry.mediaInfo.bvobId;
      if (bvobId) {
        if (mediaEntry.isInMemory) {
          connection._prophet._adjustInMemoryBvobBufferRefCounts({ [bvobId]: -1 });
        }
        if (mediaEntry.isPersisted) {
          connection._prophet._adjustBvobBufferPersistRefCounts({ [bvobId]: -1 });
        }
      }
    };
  });
}

/*
 #####   #    #   ####   #####
 #    #  #    #  #    #  #    #
 #####   #    #  #    #  #####
 #    #  #    #  #    #  #    #
 #    #   #  #   #    #  #    #
 #####     ##     ####   #####
*/

export function _writeBvobBuffer (scribe: Scribe, buffer: ArrayBuffer,
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

export async function _adjustBvobBufferPersistRefCounts (
    scribe: Scribe, adjusts: { [bvobId: string]: number },
) {
  // Check if recently created file does not need in-memory buffer persist but bvobInfo still
  // has it and delete the buffer.
  const newPersistRefcounts = [];
  await scribe._sharedDb.transaction(["bvobs"], "readwrite", ({ bvobs }) => {
    Object.keys(adjusts).forEach(bvobId => {
      const adjustment = adjusts[bvobId];
      if (!adjustment) return;
      // if (!bvobInfo.inMemoryRefCount && bvobInfo.buffer) delete bvobInfo.buffer;
      const req = bvobs.get(bvobId);
      req.onsuccess = () => {
        if (!req.result) {
          scribe.errorEvent(`While adjusting content buffer persist references, cannot find ${
              ""}IndexedDB.valaa-shared-content.bvobs entry ${bvobId}, skipping`);
          return;
        }
        let persistRefCount = (req.result && req.result.persistRefCount) || 0;
        persistRefCount += adjustment;
        if (!(persistRefCount > 0)) { // a bit of defensive programming vs NaN and negatives
          persistRefCount = 0;
        }
        const updateReq = bvobs.put({ bvobId, byteLength: req.result.byteLength, persistRefCount });
        updateReq.onsuccess = () => newPersistRefcounts.push([bvobId, persistRefCount]);
        /* Only removing bvob infos and associated buffers on start-up.
        if (!bvobInfo.persistRefCount) {
          bvobs.delete(bvobInfo.bvobId);
          buffers.delete(bvobInfo.bvobId);
        }
        */
      };
    });
  });
  return newPersistRefcounts.map(([bvobId, persistRefCount]) => {
    const bvobInfo = scribe._bvobLookup[bvobId] || { bvobId };
    bvobInfo.persistRefCount = persistRefCount;
    return bvobInfo;
  });
}

/*
 ######  #    #  ######  #    #   #####
 #       #    #  #       ##   #     #
 #####   #    #  #####   # #  #     #
 #       #    #  #       #  # #     #
 #        #  #   #       #   ##     #
 ######    ##    ######  #    #     #
*/

export function _writeTruths (connection: ScribePartitionConnection, truthLog: EventBase[]) {
  if (!connection._db) return undefined;
  return connection._db.transaction(["truths"], "readwrite", ({ truths }) => {
    truthLog.forEach(truth => {
      if (typeof truth.eventId !== "number") {
        throw new Error(`INTERNAL ERROR: Truth is missing eventId when trying to write ${
            truthLog.length} truths to local cache`);
      }
      const req = truths.add(_serializeEventAsJSON(truth));
      req.onerror = reqEvent => {
        if (reqEvent.error.name !== "ConstraintError") throw req.error;
        reqEvent.preventDefault(); // Prevent transaction abort.
        reqEvent.stopPropagation(); // Prevent transaction onerror callback call.
        const validateReq = truths.get(truth.eventId);
        validateReq.onsuccess = validateReqEvent => {
          if ((validateReqEvent.target.result || {}).commandId === truth.commandId) return;
          throw connection.wrapErrorEvent(
              new Error(`Mismatching existing truth commandId when persisting truth`),
              `_writeTruths(${truth.eventId})`,
              "\n\texisting commandId:", (validateReqEvent.target.result || {}).commandId,
              "\n\tnew truth commandId:", truth.commandId,
              "\n\texisting truth:", ...dumpObject(validateReqEvent.target.result),
              "\n\tnew truth:", ...dumpObject(truth));
        };
      };
    });
  });
}

export function _readTruths (connection: ScribePartitionConnection, options: Object) {
  if (!connection._db) return undefined;
  const range = connection._db.getIDBKeyRange(options);
  if (range === null) return undefined;
  return connection._db.transaction(["truths"], "readonly",
      ({ truths }) => new Promise(_getAllShim.bind(null, truths, range)));
}

export function _writeCommands (connection: ScribePartitionConnection,
    commandLog: EventBase[]) {
  if (!connection._db) return undefined;
  return connection._db.transaction(["commands"], "readwrite", ({ commands }) =>
      commandLog.forEach(command => {
        if (typeof command.eventId !== "number") {
          throw new Error(`INTERNAL ERROR: Command is missing eventId when trying to write ${
              commandLog.length} commands to local cache`);
        }
        const req = commands.add(_serializeEventAsJSON(command));
        req.onerror = reqEvent => {
          if (reqEvent.error.name !== "ConstraintError") throw req.error;
          const error = new Error(`Cross-tab command cache conflict`);
          error.conflictingCommandEventId = commandLog[0].eventId;
          throw error;
        };
      }));
}

export function _readCommands (connection: ScribePartitionConnection, options: Object) {
  if (!connection._db) return undefined;
  const range = connection._db.getIDBKeyRange(options);
  if (range === null) return undefined;
  return connection._db.transaction(["commands"], "readonly",
      ({ commands }) => new Promise(_getAllShim.bind(null, commands, range)));
}

export function _deleteCommands (connection: ScribePartitionConnection,
    eventIdBegin: string, eventIdEnd: string, expectedCommandIds?: string[]) {
  if (!connection._db) return undefined;
  const range = connection._db.getIDBKeyRange({ eventIdBegin, eventIdEnd });
  return connection._db.transaction(["commands"], "readwrite", ({ commands }) => {
    if (!expectedCommandIds) return _deleteRange(commands);
    if (expectedCommandIds.length !== eventIdEnd - eventIdBegin) {
      throw new Error(`Expected expectedCommandIds.length(${expectedCommandIds.length
          }) to equal range ([${eventIdBegin}, ${eventIdEnd}} === ${eventIdEnd - eventIdBegin})`);
    }
    return new Promise(_getAllShim.bind(null, commands, range)).then(existingCommands => {
      for (let i = 0; i !== expectedCommandIds.length; ++i) {
        if (expectedCommandIds[i] !== existingCommands[i].commandId) {
          const error = new Error(`commandId mismatch between stored '${
              existingCommands[i].commandId}' and expected '${expectedCommandIds[i]
              }' commandId's for eventId ${eventIdBegin + i}`);
          error.conflictingCommandEventId = eventIdBegin + i;
          throw error;
        }
      }
      return _deleteRange(commands, existingCommands);
    });
  });
  function _deleteRange (commands, deletedCommands?: Object[]) {
    return new Promise((resolve, reject) => {
      const req = commands.delete(range);
      req.onsuccess = () => resolve(deletedCommands);
      req.onerror = (evt => reject(new Error(evt.target.error.message)));
    });
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

function _getAllShim (database, range: IDBKeyRange, resolve: Function, reject: Function) {
  let req;
  if (typeof database.getAll !== "undefined") {
    req = database.getAll(range);
    req.onsuccess = () => resolve(req.result);
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
        // console.log("Cursor processing complete, result:", result);
        resolve(result);
      }
    };
  }
  req.onerror = (evt => reject(new Error(evt.target.error.message)));
}
