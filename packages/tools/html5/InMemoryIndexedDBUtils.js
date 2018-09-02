import FakeIndexedDB from "fake-indexeddb";
import FDBDatabase from "fake-indexeddb/lib/FDBDatabase";

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
}

export async function getKeysFromDB (database: FDBDatabase, table: string) {
  const transaction = database.transaction([table], "readonly");
  const objectStore = transaction.objectStore(table);

  let keys;
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
}

// Utility function verifying that a command got stored in the database with a given eventId.
export async function expectStoredInDB (command: Object, database: FDBDatabase, table: string,
    eventId: number) {
  const storedCommand = await getFromDB(database, table, eventId);
  if (command instanceof Error) throw command;
  const indexedCommand = Object.assign({ eventId }, command);

  // XXX Hack to flatten any vrefs that may be dangling onto the commands
  const stored = JSON.parse(JSON.stringify(storedCommand));
  const indexed = JSON.parse(JSON.stringify(indexedCommand));
  // console.info("STORED:\n", stored, "\n\nINDEXED:\n", indexed);

  expect(stored).toEqual(indexed);
}
