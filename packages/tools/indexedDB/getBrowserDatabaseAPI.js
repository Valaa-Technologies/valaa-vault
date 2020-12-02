// @flow
import type { DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

export function getDatabaseAPI (): DatabaseAPI {
  return {
    indexedDB: window.indexedDB,
    IDBFactory,
    IDBOpenDBRequest,
    IDBDatabase,
    IDBTransaction,
    IDBRequest,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBCursorWithValue,
    IDBKeyRange,
  };
}
