// @flow

import { FabricEventTarget } from "~/tools";
import { type DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

export type KeyRangeQuery = {
  eventIdBegin: ?number,
  eventIdEnd: ?number,
};

export default class IndexedDBWrapper extends FabricEventTarget {
  database: IDBDatabase;
  databaseAPI: DatabaseAPI;
  databaseId: string;

  constructor (options: {
    parent: FabricEventTarget, verbosity: ?number, name: ?string,
    databaseId: string, storeDescriptors: Array<{ name: string, keyPath: string}>,
    databaseAPI: DatabaseAPI, version: number,
  }) {
    super(options.parent, options.verbosity, options.name || options.databaseId);
    this.databaseAPI = options.databaseAPI;
    this.databaseId = options.databaseId;
    this.version = options.version || 1;
    this.storeDescriptors = options.storeDescriptors;
  }

  initialize () {
    return new Promise((resolve, reject) => {
      const openReq = this.databaseAPI.indexedDB.open(this.databaseId, this.version);
      openReq.onerror = reject;
      openReq.onupgradeneeded = (event: Event) => {
        this._upgradeDatabase(event);
      };

      // AFAIK if onupgradeneeded is called then onsuccess will not be
      // called until any transactions from onupgradeneeded are complete
      openReq.onsuccess = (event: Event) => {
        if (this.database === null) { // closed via API call before init was complete
          event.target.result.close();
          const error = new Error("database released during initialize");
          error.disconnected = true;
          reject(error);
        } else {
          this.database = event.target.result;
          this.database.onerror = (evt: Event) => {
            throw this.wrapErrorEvent(evt.target.error, 1, `IDB.onerror`,
                "\n\tstores:", this.storeDescriptors.map(descriptor =>
                    (descriptor ? descriptor.name : "<no descriptor>")).join(", "));
          };
          resolve();
        }
      };
    });
  }

  release () {
    if (this.database) {
      this.database.close();
    }
    this.database = null;
  }

  _upgradeDatabase = (event: Event) => {
    const database: IDBDatabase = event.target.result;
    for (const storeDescriptor of Object.values(this.storeDescriptors)) {
      if (!database.objectStoreNames.contains(storeDescriptor.name)) {
        database.createObjectStore(storeDescriptor.name, { keyPath: storeDescriptor.keyPath });
      }
    }
  }

  async transaction (stores: Array<string>, mode: string = "readonly", opsCallback: Function) {
    let result;
    const database = this.database;
    try {
      if (!database) {
        throw new Error(`transaction could not be initiated against a database connection to '${
            this.databaseId}' that has been detached`);
      }
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
      throw this.wrapErrorEvent(error, 1, `transaction([${stores}], mode)`);
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
              ? this.databaseAPI.IDBKeyRange(eventIdBegin)
          : (eventIdEnd > eventIdBegin)
              ? this.databaseAPI.IDBKeyRange.bound(eventIdBegin, eventIdEnd - 1)
          : null;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `getIDBKeyRange([${eventIdBegin}, ${eventIdEnd}))`);
    }
  }
}
