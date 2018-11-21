import { Command } from "~/raem/events";
import FakeIndexedDB from "fake-indexeddb";
import FDBDatabase from "fake-indexeddb/lib/FDBDatabase";

import { dumpObject, wrapError } from "~/tools";
import { swapAspectRoot } from "../../prophet/tools/EventAspects";

export async function openDB (uri: string) {
  let database;
  const process = new Promise((resolve, reject) => {
    const request = FakeIndexedDB.open(uri, 1);
    request.onerror = reject;
    request.onsuccess = (event: Event) => {
      database = event.target.result;
      resolve();
    };
  });
  await process;
  return database;
}

export async function getFromDB (database: FDBDatabase, table: string, key: any) {
  try {
    const transaction = database.transaction([table], "readonly");
    const objectStore = transaction.objectStore(table);

    let entry;
    const process = new Promise((resolve, reject) => {
      const request = objectStore.get(key);
      request.onerror = reject;
      request.onsuccess = (event: Event) => {
        entry = event.target.result;
        resolve();
      };
    });
    await process;
    return entry;
  } catch (error) {
    throw wrapError(error, `During getFromDB("${database.name}", ${table}, ${key}), with:`,
        "\n\tkey:", key);
  }
}

export async function getKeysFromDB (database: FDBDatabase, table: string) {
  let keys;
  try {
    const transaction = database.transaction([table], "readonly");
    const objectStore = transaction.objectStore(table);

    const process = new Promise((resolve, reject) => {
      const request = objectStore.getAllKeys();
      request.onerror = reject;
      request.onsuccess = (event: Event) => {
        keys = event.target.result;
        resolve();
      };
    });
    await process;
    return keys;
  } catch (error) {
    throw wrapError(error, `During getKeyFromDB("${database.name}", ${table}), with:`,
        "\n\tcurrent ret keys:", keys);
  }
}

// Utility function verifying that a command got stored in the database with a given logIndex.
export async function expectStoredInDB (command: Command, database: FDBDatabase, table: string,
    logIndex: number) {
  let stored, expected;
  expect(command.aspects.log.index).toEqual(logIndex);
  try {
    const storedCommand = await getFromDB(database, table, logIndex);
    if (storedCommand === undefined) {
      throw new Error(`No event found for id '${logIndex}' in "${database.name}"/${table}`);
    }
    if (command instanceof Error) throw command;

    // XXX Hack to flatten any vrefs that may be dangling onto the commands
    stored = JSON.parse(JSON.stringify(storedCommand));
    expected = JSON.parse(JSON.stringify(command));
    expected = swapAspectRoot("event", expected, "log");
    delete expected.aspects.log;
    // console.info("STORED:\n", stored, "\n\nINDEXED:\n", indexed);
  } catch (error) {
    throw wrapError(error, `During expectStoredInDB("${database.name}", ${table}), with:`,
        "\n\tlogIndex:", logIndex,
        "\n\texpected command:", ...dumpObject(expected || command));
  }
  expect(stored).toEqual(expected);
}
