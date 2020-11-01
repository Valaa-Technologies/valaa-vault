import FakeIndexedDB from "fake-indexeddb";
import FDBDatabase from "fake-indexeddb/lib/FDBDatabase";

import { Command } from "~/raem/events";

import { dumpObject, wrapError } from "~/tools";
import { swapAspectRoot } from "../../sourcerer/tools/EventAspects";

export function openDB (uri: string) {
  let database;
  return (new Promise((resolve, reject) => {
    const request = FakeIndexedDB.open(uri, 1);
    request.onerror = reject;
    request.onsuccess = (event: Event) => {
      database = event.target.result;
      resolve();
    };
  }))
  .then(() => database);
}

export function getFromDB (database: FDBDatabase, table: string, key: any) {
  let entry;
  return (new Promise((resolve, reject) => {
    const transaction = database.transaction([table], "readonly");
    const objectStore = transaction.objectStore(table);
      const request = objectStore.get(key);
    request.onerror = reject;
    request.onsuccess = (event: Event) => {
      entry = event.target.result;
      resolve();
    };
  }))
  .then(() => entry, error => {
    throw wrapError(error, `During getFromDB("${database.name}", ${table}, ${key}), with:`,
        "\n\tkey:", key);
  });
}

export function getKeysFromDB (database: FDBDatabase, table: string) {
  let keys;
  return (new Promise((resolve, reject) => {
    const transaction = database.transaction([table], "readonly");
    const objectStore = transaction.objectStore(table);
    const request = objectStore.getAllKeys();
    request.onerror = reject;
    request.onsuccess = (event: Event) => {
      keys = event.target.result;
      resolve();
    };
  }))
  .then(() => keys, error => {
    throw wrapError(error, `During getKeyFromDB("${database.name}", ${table}), with:`,
        "\n\tcurrent ret keys:", keys);
  });
}

// Utility function verifying that a command got stored in the database with a given logIndex.
export async function expectStoredInDB (command: Command, database: FDBDatabase, table: string,
    logIndex: number) {
  let stored, expected;
  expect((command.aspects.log || {}).index).toEqual(logIndex);
  try {
    const storedCommand = await getFromDB(database, table, logIndex);
    if (storedCommand === undefined) {
      throw new Error(`No event found for id '${logIndex}' in "${database.name}"/${table}`);
    }
    if (command instanceof Error) throw command;

    // XXX Hack to flatten any vrefs that may be dangling onto the commands
    stored = JSON.parse(JSON.stringify(storedCommand));
    expected = JSON.parse(JSON.stringify(command));
    expected = swapAspectRoot("log", expected, "event");
    delete expected.aspects.log;
    // console.info("STORED:\n", stored, "\n\nINDEXED:\n", indexed);
  } catch (error) {
    throw wrapError(error, `During expectStoredInDB("${database.name}", ${table}), with:`,
        "\n\tlogIndex:", logIndex,
        "\n\texpected command:", ...dumpObject(expected || command));
  }
  expect(stored).toEqual(expected);
}
