// @flow

import FakeIndexedDB from "fake-indexeddb";
import FDBFactory from "fake-indexeddb/lib/FDBFactory";
import FDBOpenDBRequest from "fake-indexeddb/lib/FDBOpenDBRequest";
import FDBDatabase from "fake-indexeddb/lib/FDBDatabase";
import FDBTransaction from "fake-indexeddb/lib/FDBTransaction";
import FDBRequest from "fake-indexeddb/lib/FDBRequest";
import FDBObjectStore from "fake-indexeddb/lib/FDBObjectStore";
import FDBIndex from "fake-indexeddb/lib/FDBIndex";
import FDBCursor from "fake-indexeddb/lib/FDBCursor";
import FDBCursorWithValue from "fake-indexeddb/lib/FDBCursorWithValue";
import FDBKeyRange from "fake-indexeddb/lib/FDBKeyRange";

import type { DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

/**
 * Returns a mocked IndexedDB API that can be passed around to the Scribe section of the prophet
 * stack. This is used in jest tests.
 */

export function getDatabaseAPI (): DatabaseAPI {
  return {
    IndexedDB: FakeIndexedDB,
    IDBFactory: FDBFactory,
    IDBOpenDBRequest: FDBOpenDBRequest,
    IDBDatabase: FDBDatabase,
    IDBTransaction: FDBTransaction,
    IDBRequest: FDBRequest,
    IDBObjectStore: FDBObjectStore,
    IDBIndex: FDBIndex,
    IDBCursor: FDBCursor,
    IDBCursorWithValue: FDBCursorWithValue,
    IDBKeyRange: FDBKeyRange,
  };
}
