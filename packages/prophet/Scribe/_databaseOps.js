// @flow

import type { EventBase } from "~/raem/events";

import { tryAspect, swapAspectRoot } from "~/prophet/tools/EventAspects";

import { debugObjectType, dumpObject, vdon, wrapError } from "~/tools";
import IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";
import type MediaDecoder from "~/tools/MediaDecoder";
import trivialClone from "~/tools/trivialClone";

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
  bvobId: string, // primary key, to be deprecated, see contentHash,
  contentHash: string, // future db primary key for "bvobs" and "buffers"
  persistRefCount: number, // db-backed in "bvobs"
  byteLength: number, // db-backed in "bvobs"
  inMemoryRefCount: number, // not db-backed
  buffer: ?ArrayBuffer, // db-backed in "buffers" but not always in memory
  decodings?: WeakMap<MediaDecoder, any>,
  persistProcess: ?Promise<any>,
};

export async function _initializeSharedIndexedDB (scribe: Scribe) {
  scribe._sharedDb = new IndexedDBWrapper(`${scribe._databasePrefix}valaa-shared-content`,
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
  const clearedBuffers = 0;
  const releasedBytes = 0;
  await scribe._sharedDb.transaction(["bvobs", "buffers"], "readwrite",
      ({ bvobs, /* buffers */ }) => {
    bvobs.openCursor().onsuccess = event => {
      const cursor: IDBCursorWithValue = event.target.result;
      if (!cursor) return;
      if (cursor.value.persistRefCount <= 0) {
        // FIXME(iridian, 2019-03): Deletion disabled until garbage
        // if (cursor.value.byteLength) releasedBytes += cursor.value.byteLength;
        // collection becomes an actual issue,
        // buffers.delete(cursor.key);
        // cursor.delete();
        // ++clearedBuffers;
      } else if (!contentLookup[cursor.key]) {
        contentLookup[cursor.key] = { ...cursor.value, inMemoryRefCount: 0 };
        if (cursor.value.byteLength) totalBytes += cursor.value.byteLength;
      }
      cursor.continue();
    };
  });
  return { totalBytes, clearedBuffers, releasedBytes, contentLookup };
}

export async function _initializeConnectionIndexedDB (connection: ScribePartitionConnection) {
  // TODO(iridian): Implement initialNarrateOptions
  // TODO(iridian): Load info structures from indexed_db. These are member fields described above.
  // Also create Scribe._contentLookup entries for contents referenced by the _pendingMediaLookup
  // entries, including the in-memory contents.
  // If the partition does not exist, create it and its structures.
  connection._db = new IndexedDBWrapper(
      `${connection._prophet._databasePrefix}${connection._partitionURI.toString()}`, [
        { name: "truths", keyPath: "index" },
        { name: "commands", keyPath: "index" },
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
  connection._clampCommandQueueByTruthEventIdEnd();
  return connection;

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
  if (!updates || !updates.length) return {};
  const inMemoryRefCountAdjusts = {};
  const persistRefCountAdjusts = {};
  function _addAdjust (refs, contentHash, adjust) {
    refs[contentHash] = (refs[contentHash] || 0) + adjust;
  }

  await (connection._db && connection._db.transaction(["medias"], "readwrite", ({ medias }) => {
    updates.forEach(entry => {
      const currentEntryReq = medias.get(entry.mediaId);
      currentEntryReq.onsuccess = (/* event */) => {
        const currentEntry = currentEntryReq.result;
        // Skip obsolete updates.
        if (currentEntry && ((currentEntry.logIndex || 0) >= (entry.logIndex || 0))) return;
        const updateEntryReq = medias.put(entry);
        updateEntryReq.onsuccess = () => {
          const newInfo = entry.mediaInfo;
          const contentHash = newInfo.contentHash || newInfo.bvobId;
          if (contentHash) {
            if (connection._prophet._bvobLookup[contentHash]) {
              if (entry.isInMemory) _addAdjust(inMemoryRefCountAdjusts, contentHash, 1);
              if (entry.isPersisted) _addAdjust(persistRefCountAdjusts, contentHash, 1);
            } else {
              console.log(`Can't find Media "${newInfo.name}" Bvob info for ${contentHash
              } when adding new content references`);
            }
          }
          const currentMediaInfo = ((currentEntryReq.result || {}).mediaInfo || {});
          const currentContentHash = currentMediaInfo.contentHash || currentMediaInfo.bvobId;
          if (currentContentHash && currentEntryReq.result.isPersisted) {
            if (connection._prophet._bvobLookup[currentContentHash]) {
              _addAdjust(persistRefCountAdjusts, currentContentHash, -1);
            } else {
              console.log(`Can't find Media "${newInfo.name}" Bvob info for ${currentContentHash
                } when removing old content references`);
            }
          }
          entry.updatePersisted = true;
        };
        updateEntryReq.onerror = (failureEvent) => {
          connection.errorEvent(
              `_updateMediaEntries().put("${(entry.mediaInfo || {}).name || entry.mediaId
                  }") Failed:`, ...dumpObject(failureEvent),
              "\n\terror:", ...dumpObject(updateEntryReq.error),
              "\n\tmediaEntry:", ...dumpObject(entry));
          // Don't prevent the error from aborting the transaction,
          // which will then roll back and no refcount updates will be
          // made either. This line is thus useless and is here only
          // for future reminder: if this error is selectively ignored
          // and the particular media update skipped
        };
      };
    });
  }));
  const ret = {};
  updates.forEach(entry => {
    if (connection.isLocallyPersisted() && !entry.updatePersisted) return;
    delete entry.updatePersisted;
    const currentScribeEntry = connection._prophet._persistedMediaLookup[entry.mediaId] || {};
    const contentHash = (currentScribeEntry.mediaInfo || {}).contentHash
        || (currentScribeEntry.mediaInfo || {}).bvobId;
    if (currentScribeEntry.isInMemory && contentHash) {
      _addAdjust(inMemoryRefCountAdjusts, contentHash, -1);
    }
    connection._prophet._persistedMediaLookup[entry.mediaId] = entry;
    ret[entry.mediaId] = entry;
  });
  connection._prophet._adjustInMemoryBvobBufferRefCounts(inMemoryRefCountAdjusts);
  await connection._prophet._adjustBvobBufferPersistRefCounts(persistRefCountAdjusts);
  return ret;
}

export function _readMediaEntries (connection: ScribePartitionConnection) {
  if (!connection._db) return {};
  const results = {};
  return connection._db.transaction(["medias"], "readwrite", ({ medias }) =>
      new Promise((resolve, reject) => {
        const req = medias.openCursor();
        req.onsuccess = event => {
          const cursor: IDBCursorWithValue = event.target.result;
          // Cursor is null when end of record set is reached
          if (!cursor) {
            resolve(results);
            return;
          }
          const entry = { ...cursor.value, isInMemory: true };
          const contentHash = (entry.mediaInfo || {}).contentHash || (entry.mediaInfo || {}).bvobId;
          if (contentHash && entry.isInMemory) {
            if (connection._prophet._bvobLookup[contentHash]) {
              connection._prophet._adjustInMemoryBvobBufferRefCounts({ [contentHash]: 1 });
            } else {
              connection.errorEvent(`Can't find Media "${(entry.mediaInfo || {}).name
                  }" in-memory Bvob info for ${entry.mediaInfo.contentHash
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
      const contentHash = mediaEntry.mediaInfo.contentHash || mediaEntry.mediaInfo.bvobId;
      if (contentHash) {
        if (mediaEntry.isInMemory) {
          connection._prophet._adjustInMemoryBvobBufferRefCounts({ [contentHash]: -1 });
        }
        if (mediaEntry.isPersisted) {
          connection._prophet._adjustBvobBufferPersistRefCounts({ [contentHash]: -1 });
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
  contentHash: string, bvobInfo?: BvobInfo, initialPersistRefCount: number = 0): ?Promise<any> {
  if (bvobInfo && bvobInfo.persistRefCount) return bvobInfo.persistProcess;
  // Initiate write (set persistProcess so eventual commands using the contentHash can wait
  // before being accepted) but leave the bvob persist refcount to zero. Even if the bvob is
  // never actually attached to a metadata, zero-refcount bvobs can be cleared from storage at
  // next _initializeContentLookup.
  const actualBvobInfo = scribe._bvobLookup[contentHash] = {
    contentHash,
    bvobId: contentHash,
    buffer,
    byteLength: buffer.byteLength,
    persistRefCount: initialPersistRefCount,
    inMemoryRefCount: 0,
    persistProcess: scribe._sharedDb.transaction(["bvobs", "buffers"], "readwrite",
        ({ bvobs, buffers }) => {
          bvobs.get(contentHash).onsuccess = event => {
            const existingRefCount = event.target.result && event.target.result.persistRefCount;
            actualBvobInfo.persistRefCount = existingRefCount || initialPersistRefCount;
            bvobs.put({
              contentHash,
              bvobId: contentHash,
              byteLength: actualBvobInfo.byteLength,
              persistRefCount: actualBvobInfo.persistRefCount,
            });
            if (!existingRefCount) buffers.put({ contentHash, bvobId: contentHash, buffer });
          };
          return contentHash;
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
        const req = buffers.get(bvobInfo.contentHash || bvobInfo.bvobId);
        req.onerror = (error) => {
          delete bvobInfo.pendingBuffer;
          pendingRead.reject(error);
        };
        req.onsuccess = () => {
          delete bvobInfo.pendingBuffer;
          if (!req.result || !req.result.buffer) {
            pendingRead.reject(new Error(
                `Cannot find bvob '${bvobInfo.contentHash}' from IndexedDB`));
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
    scribe: Scribe, adjusts: { [contentHash: string]: number },
) {
  // Check if recently created file does not need in-memory buffer persist but bvobInfo still
  // has it and delete the buffer.
  const newPersistRefcounts = [];
  await scribe._sharedDb.transaction(["bvobs"], "readwrite", ({ bvobs }) => {
    Object.keys(adjusts).forEach(contentHash => {
      const adjustment = adjusts[contentHash];
      if (!adjustment) return;
      // if (!bvobInfo.inMemoryRefCount && bvobInfo.buffer) delete bvobInfo.buffer;
      const req = bvobs.get(contentHash);
      req.onsuccess = () => {
        if (!req.result) {
          scribe.errorEvent(`While adjusting content buffer persist references, cannot find ${
              ""}IndexedDB.valaa-shared-content.bvobs entry ${contentHash}, skipping`);
          return;
        }
        let persistRefCount = (req.result && req.result.persistRefCount) || 0;
        persistRefCount += adjustment;
        if (!(persistRefCount > 0)) { // a bit of defensive programming vs NaN and negatives
          persistRefCount = 0;
        }
        const updateReq = bvobs.put({
          contentHash, bvobId: contentHash, byteLength: req.result.byteLength, persistRefCount,
        });
        updateReq.onsuccess = () => newPersistRefcounts.push([contentHash, persistRefCount]);
        /* Only removing bvob infos and associated buffers on start-up.
        if (!bvobInfo.persistRefCount) {
          bvobs.delete(bvobInfo.contentHash);
          buffers.delete(bvobInfo.contentHash);
        }
        */
      };
    });
  });
  return newPersistRefcounts.map(([contentHash, persistRefCount]) => {
    const bvobInfo = scribe._bvobLookup[contentHash] || { contentHash, bvobId: contentHash };
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
      if (typeof truth.aspects.log.index !== "number") {
        throw new Error(`INTERNAL ERROR: Truth is missing aspects.log.index when trying to write ${
            truthLog.length} truths to local cache, aborting _writeTruths`);
      }
      const req = truths.add(_serializeEventAsJSON(truth));
      req.onerror = reqEvent => {
        if (((reqEvent.target || {}).error || {}).name !== "ConstraintError") throw req.error;
        reqEvent.preventDefault(); // Prevent transaction abort.
        reqEvent.stopPropagation(); // Prevent transaction onerror callback call.
        const validateReq = truths.get(truth.aspects.log.index);
        validateReq.onsuccess = validateReqEvent => {
          if (tryAspect(validateReqEvent.target.result, "command").id
              === tryAspect(truth, "command").id) return;
          throw connection.wrapErrorEvent(
              new Error(`Mismatching existing truth aspects.command.id when persisting truth`),
              `_writeTruths(#${truth.aspects.log.index})`,
              "\n\texisting aspects.command.id:",
                  tryAspect(validateReqEvent.target.result, "command").id,
              "\n\tnew truth aspects.command.id:", truth.aspects.command.id,
              "\n\texisting truth:", ...dumpObject(validateReqEvent.target.result),
              "\n\tnew truth:", ...dumpObject(truth));
        };
      };
    });
    return truthLog;
  });
}

export function _readTruths (connection: ScribePartitionConnection, options: Object) {
  if (!connection._db) return undefined;
  const range = connection._db.getIDBKeyRange(options);
  if (range === null) return undefined;
  return connection._db.transaction(["truths"], "readonly",
      ({ truths }) => new Promise(_getAllShim.bind(null, connection, truths, range)));
}

export function _writeCommands (connection: ScribePartitionConnection,
    commandLog: EventBase[]) {
  if (!connection._db) return undefined;
  return connection._db.transaction(["commands"], "readwrite", ({ commands }) => {
    commandLog.forEach(command => {
      if (typeof command.aspects.log.index !== "number") {
        throw new Error(`INTERNAL ERROR: Command is missing aspects.log.index when writing ${
            commandLog.length} commands to local cache: aborting _writeCommands`);
      }
      const req = commands.add(_serializeEventAsJSON(command));
      req.onerror = reqEvent => {
        if (reqEvent.error.name !== "ConstraintError") throw req.error;
        const error = new Error(`Cross-tab command cache conflict`);
        error.conflictingCommandEventId = commandLog[0].aspects.log.index;
        throw error;
      };
    });
    return commandLog;
  });
}

export function _readCommands (connection: ScribePartitionConnection, options: Object) {
  if (!connection._db) return undefined;
  const range = connection._db.getIDBKeyRange(options);
  if (range === null) return undefined;
  return connection._db.transaction(["commands"], "readonly",
      ({ commands }) => new Promise(_getAllShim.bind(null, connection, commands, range)));
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
    return new Promise((resolve, reject) => _getAllShim(connection, commands, range,
        storedCommands => {
      for (let i = 0; i !== expectedCommandIds.length; ++i) {
        const existingCommandId = tryAspect(storedCommands[i], "command").id;
        if (existingCommandId === undefined) {
          connection.errorEvent(`deleteCommands: No existing command found when trying to delete #${
              eventIdBegin + i}:`, expectedCommandIds[i]);
        } else if (expectedCommandIds[i] !== existingCommandId) {
          const error = new Error(`aspects.command.id mismatch between stored '${
              existingCommandId}' and expected '${expectedCommandIds[i]
              }' for aspects.log.index #${eventIdBegin + i}`);
          error.conflictingCommandEventId = eventIdBegin + i;
          throw error;
        }
      }
      return _deleteRange(commands, storedCommands);
    }, reject));
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
  const logRoot = swapAspectRoot("event", event, "log");
  try {
    return trivialClone(logRoot, (value, key) => {
      try {
        if (((typeof value !== "object") || (value === null)) && (typeof value !== "function")) {
          return value;
        }
        if (!Array.isArray(value) && (Object.getPrototypeOf(value) !== Object.prototype)) {
          throw new Error(`Event cannot be serialized to IndexedDB due to non-trivial member${
              ""} .${key}:${debugObjectType(value)}`);
        }
        if (typeof value.toJSON === "function") return value.toJSON();
        return undefined;
      } catch (error) {
        throw wrapError(error, new Error("During serializeEventAsJSON.trivialClone.customizer"),
            `\n\t${key}:`, ...dumpObject(value));
      }
    });
  } catch (error) {
    throw wrapError(error, new Error("During serializeEventAsJSON"),
        "\n\tevent:", ...dumpObject(event));
  } finally {
    swapAspectRoot("log", logRoot, "event");
  }
}

function _getAllShim (connection: ScribePartitionConnection, database, range: IDBKeyRange,
    resolve: Function, reject: Function) {
  // Important note on IndexedDB transaction semantics: the resolve
  // callback must _synchronously_ create any follow-up database
  // request because the transaction active flag is only set during the
  // handler. https://www.w3.org/TR/IndexedDB/#fire-success-event
  let req;
  if (database.getAll !== undefined) {
    req = database.getAll(range);
    req.onsuccess = () => {
      try {
        resolve(req.result.map(eventLogRoot => swapAspectRoot("log", eventLogRoot, "event")));
      } catch (error) {
        reject(connection.wrapErrorEvent(error, `getAll("${database.name}", ${range})`,
            "\n\treq.result:", ...dumpObject(req.result)));
      }
    };
  } else {
    console.warn("Using openCursor because getAll is not implemented (by Edge?)");
    const result = [];
    req = database.openCursor(range);
    req.onsuccess = () => {
      const nextCursor = event.target.result;
      if (nextCursor) {
        result.push(swapAspectRoot("log", nextCursor.value, "event"));
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
