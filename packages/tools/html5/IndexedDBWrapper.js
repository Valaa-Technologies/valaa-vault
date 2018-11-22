// @flow

import { Logger, LogEventGenerator } from "~/tools";
import { type DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

export type KeyRangeQuery = {
  eventIdBegin: ?number,
  eventIdEnd: ?number,
};


export default class IndexedDBWrapper extends LogEventGenerator {
  database: IDBDatabase;
  databaseAPI: DatabaseAPI;
  databaseId: string;

  constructor (databaseId: string, storeDescriptors: Array<{ name: string, keyPath: string}>,
      logger: Logger, databaseAPI: DatabaseAPI) {
    super({ name: databaseId, logger });
    this.databaseAPI = databaseAPI;
    this.databaseId = databaseId;
    this.storeDescriptors = storeDescriptors;
  }

  initialize () {
    return new Promise((resolve, reject) => {
      const openReq = this.databaseAPI.IndexedDB.open(this.databaseId, 1);
      openReq.onerror = reject;

      openReq.onupgradeneeded = (event: Event) => {
        this._initDatabase(event);
      };

      // AFAIK if onupgradeneeded is called then onsuccess will not be called until any transactions
      // from onupgradeneeded are complete
      openReq.onsuccess = (event: Event) => {
        this._setDatabaseObject(event);
        resolve();
      };
    });
  }

  _initDatabase = (event: Event) => {
    const database: IDBDatabase = event.target.result;
    for (const storeDescriptor of Object.values(this.storeDescriptors)) {
      database.createObjectStore(storeDescriptor.name, { keyPath: storeDescriptor.keyPath });
    }
  }

  _setDatabaseObject = (event: Event) => {
    this.database = event.target.result;
    this.database.onerror = (evt: Event) => {
      throw this.wrapErrorEvent(evt.target.error, `IDB.onerror`,
          "\n\tstores:", this.storeDescriptors.map(({ name }) => name).join(", "));
    };
  }

  async transaction (stores: Array<string>, mode: string = "readonly", opsCallback: Function) {
    let result;
    try {
      const trans = this.database.transaction(stores, mode);
      const objStores = stores.reduce((container, store) => {
        container[store] = trans.objectStore(store);
        return container;
      }, {});
      const onCompletePromise = new Promise((resolveTrans, rejectTrans) => {
        trans.oncomplete = resolveTrans;
        trans.onerror = (evt) => rejectTrans(evt.target.error);
        trans.onabort = trans.onerror;
      });
      result = await opsCallback(objStores);
      await onCompletePromise;
    } catch (error) {
      throw this.wrapErrorEvent(error, `transaction([${stores}], mode)`);
    }
    return result;
  }

  getIDBKeyRange ({ eventIdBegin, eventIdEnd }: KeyRangeQuery) {
    try {
      return (typeof eventIdBegin === "undefined")
          ? (typeof eventIdEnd === "undefined")
              ? undefined
              : this.databaseAPI.IDBKeyRange.upperBound(eventIdEnd - 1)
          : (typeof eventIdEnd === "undefined")
              ? this.databaseAPI.IDKeyRange(eventIdBegin)
          : (eventIdEnd > eventIdBegin)
              ? this.databaseAPI.IDBKeyRange.bound(eventIdBegin, eventIdEnd - 1)
          : null;
    } catch (error) {
      throw this.wrapErrorEvent(error, `getIDBKeyRange([${eventIdBegin}, ${eventIdEnd}))`);
    }
  }
}
