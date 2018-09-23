// @flow

import { created, transacted } from "~/raem/command/index";
import { vRef } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";

import { createScribe, clearScribeDatabases } from "~/prophet/test/ProphetTestHarness";

import { stringFromUTF8ArrayBuffer } from "~/tools/textEncoding";

import { openDB, getFromDB, getKeysFromDB, expectStoredInDB }
    from "~/tools/html5/InMemoryIndexedDBUtils";

const URI = "test-partition:";
const sharedURI = "valaa-shared-content";

afterEach(async () => {
  await clearScribeDatabases();
});

describe("Scribe", () => {
  const simpleCommand = created({ id: "Some entity", typeName: "Entity" });

  const simpleTransaction = transacted({
    actions: [
      created({ id: "Some relation", typeName: "Relation" }),
      created({ id: "Some other entity", typeName: "Entity" }),
    ],
  });

  it("Keeps track of the count of commands executed", async () => {
    let commandsCounted = 0;
    const commandCountCallback = (count) => {
      commandsCounted = count;
    };

    const scribe = createScribe(commandCountCallback);
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    expect(commandsCounted).toBe(0);

    const connection = await scribe.acquirePartitionConnection(uri).getSyncedConnection();
    expect(commandsCounted).toBe(0);

    await connection.claimCommandEvent(simpleCommand);
    expect(commandsCounted).toBe(1);

    // A transaction counts as one command
    await connection.claimCommandEvent(simpleTransaction);
    expect(commandsCounted).toBe(2);
  });

  it("Stores events/commands in the database", async () => {
    const scribe = createScribe();
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    const connection = await scribe.acquirePartitionConnection(uri).getSyncedConnection();
    const database = await openDB(URI);

    // Adds an entity and checks that it has been stored
    let claimResult = await connection.claimCommandEvent(simpleCommand);
    await claimResult.finalizeLocal();
    await expectStoredInDB(simpleCommand, database, "commands",
        connection.getLastCommandEventId());

    // Runs a transaction and confirms that it has been stored
    claimResult = await connection.claimCommandEvent(simpleTransaction);
    await claimResult.finalizeLocal();
    await expectStoredInDB(simpleTransaction, database, "commands",
        connection.getLastCommandEventId());
  });

  const textMediaContents = [
    "Hello world",
    "",
    "abcdefghijklmnopqrstuvwxyzäöåABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÅøØæÆ¤§½",
    "f".repeat(262144), // 256 KB
  ];

  it("Stores (and returns) utf-8 strings correctly", async () => {
    const scribe = createScribe();
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    const connection = await scribe.acquirePartitionConnection(uri).getSyncedConnection();
    const sharedDB = await openDB(sharedURI);

    for (const mediaContent of textMediaContents) {
      const preparedBvob = connection.prepareBvob(mediaContent, "Some media");
      const bvobId = await preparedBvob.persistProcess;

      const bvobKeys = await getKeysFromDB(sharedDB, "bvobs");
      expect(bvobKeys).toContain(bvobId);

      const bufferKeys = await getKeysFromDB(sharedDB, "buffers");
      expect(bufferKeys).toContain(bvobId);

      const restoredBuffer = await getFromDB(sharedDB, "buffers", bvobId);
      const restoredContent = stringFromUTF8ArrayBuffer(restoredBuffer.buffer);
      expect(restoredContent).toEqual(mediaContent);
    }
  });

  const structuredMediaContents = [
    [`"Hello world"`, { name: "hello.txt", type: "text", subtype: "plain" }, `"Hello world"`],
    [`"Hello world"`, { name: "hello.txt", type: "text", subtype: "whatevs" }, `"Hello world"`],
    [`"Hello world"`, { name: "hello.json", type: "application", subtype: "json" }, "Hello world"],
    [`{ "a": 10 }`, { name: "a10.json", type: "application", subtype: "json" }, { a: 10 }],
  ];

  it("decodes bvob buffers based on media type", async () => {
    const scribe = createScribe();
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    const connection = await scribe.acquirePartitionConnection(uri).getSyncedConnection();

    const mediaId = vRef("abcd-0123");
    for (const [bufferContent, mediaInfo, expectedContent] of structuredMediaContents) {
      const preparedBvob = connection.prepareBvob(bufferContent);
      const bvobId = await preparedBvob.persistProcess;
      const decodedContent =
          await connection.decodeMediaContent({ mediaId, bvobId, ...mediaInfo });
      expect(decodedContent).toEqual(expectedContent);
    }
  });

  it("Populates a brand new connection to an existing partition with its pre-existing commands",
  async () => {
    const scribe = createScribe();
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    const firstConnection = await scribe.acquirePartitionConnection(uri).getSyncedConnection();

    let claimResult = firstConnection.claimCommandEvent(simpleCommand);
    await claimResult.finalizeLocal();

    claimResult = firstConnection.claimCommandEvent(simpleTransaction);
    await claimResult.finalizeLocal();

    const lastCommandId = firstConnection.getLastCommandEventId();
    expect(lastCommandId).toBeGreaterThan(0);
    firstConnection.disconnect();

    const secondConnection = await scribe.acquirePartitionConnection(uri).getSyncedConnection();
    expect(secondConnection.getLastCommandEventId()).toBe(lastCommandId);
  });

  const commandList = [
    created({ id: "Entity A", typeName: "Entity" }),
    created({ id: "Entity B", typeName: "Entity" }),
    created({ id: "Entity C", typeName: "Entity" }),
    created({ id: "Entity D", typeName: "Entity" }),
    created({ id: "Entity E", typeName: "Entity" }),
    created({ id: "Entity F", typeName: "Entity" }),
  ];

  it("Ensures command IDs are stored in a crescent order", async () => {
    const scribe = createScribe();
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    const connection = await scribe.acquirePartitionConnection(uri).getSyncedConnection();
    let oldCommandId;
    let newCommandId = connection.getLastCommandEventId();

    for (const command of commandList) {
      const claimResult = connection.claimCommandEvent(command);
      await claimResult.finalizeLocal();

      oldCommandId = newCommandId;
      newCommandId = connection.getLastCommandEventId();
      expect(oldCommandId).toBeLessThan(newCommandId);
    }
  });
});
