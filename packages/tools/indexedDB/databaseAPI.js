// @flow

/**
 * This file describes a type that encapsulates either all possibly
 * relevant scope of IndexedDB or its mock for jest tests in FakeIndexedDB.
 */

export type DatabaseAPI = {
  indexedDB: IDBFactory,
  IDBFactory: Function,
  IDBOpenDBRequest: Function,
  IDBDatabase: Function,
  IDBTransaction: Function,
  IDBRequest: Function,
  IDBObjectStore: Function,
  IDBIndex: Function,
  IDBCursor: Function,
  IDBCursorWithValue: Function,
  IDBKeyRange: Function,
};
