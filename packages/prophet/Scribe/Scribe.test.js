// @flow

import { created, transacted } from "~/raem/command/index";
import { createPartitionURI } from "~/raem/ValaaURI";

import {
  createScribe, clearScribeDatabases, createTestMockProphet
} from "~/prophet/test/ProphetTestHarness";

import { stringFromUTF8ArrayBuffer } from "~/tools/textEncoding";

import { openDB, getFromDB, getKeysFromDB, expectStoredInDB }
    from "~/tools/html5/InMemoryIndexedDBUtils";

const testAuthorityURI = "valaa-test:";
const testPartitionURI = createPartitionURI(testAuthorityURI, "test_partition");
const sharedURI = "valaa-shared-content";

let harness = null;

afterEach(async () => {
  if (harness) {
    await harness.cleanup();
    harness = null;
  } else await clearScribeDatabases();
});

describe("Scribe", () => {
  const simpleCommand = created({ eventId: 0, id: "Some entity", typeName: "Entity" });

  const followupTransaction = transacted({
    eventId: 1,
    actions: [
      created({ id: "Some relation", typeName: "Relation" }),
      created({ id: "Some other entity", typeName: "Entity" }),
    ],
  });

  const simpleEntityTemplate = { typeName: "Entity", initialState: { owner: "test_partition" } };
  const simpleCommandList = [
    created({ id: "Entity A", ...simpleEntityTemplate }),
    created({ id: "Entity B", ...simpleEntityTemplate }),
    created({ id: "Entity C", ...simpleEntityTemplate }),
    created({ id: "Entity D", ...simpleEntityTemplate }),
    created({ id: "Entity E", ...simpleEntityTemplate }),
    created({ id: "Entity F", ...simpleEntityTemplate }),
  ];
  simpleCommandList.forEach((entry, index) => {
    entry.commandId = entry.id;
    entry.eventId = index;
  });

  it("stores truths/commands in the database", async () => {
    const scribe = createScribe(createTestMockProphet({ isLocallyPersisted: true }));
    await scribe.initialize();

    const connection = await scribe
        .acquirePartitionConnection(testPartitionURI).getSyncedConnection();
    const database = await openDB(testPartitionURI.toString());

    // Adds an entity and checks that it has been stored
    let claimResult = connection.chronicleEventLog([simpleCommand]).eventResults[0];
    await claimResult.getLocallyReceivedEvent();
    await expectStoredInDB(simpleCommand, database, "commands",
        connection.getFirstUnusedCommandEventId() - 1);

    // Runs a transaction and confirms that it has been stored
    claimResult = connection.chronicleEventLog([followupTransaction]).eventResults[0];
    await claimResult.getLocallyReceivedEvent();
    await expectStoredInDB(followupTransaction, database, "commands",
        connection.getFirstUnusedCommandEventId() - 1);
  });

  const textMediaContents = [
    "Hello world",
    "",
    "abcdefghijklmnopqrstuvwxyzäöåABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÅøØæÆ¤§½",
    "f".repeat(262144), // 256 KB
  ];

  it("stores (and returns) utf-8 strings correctly", async () => {
    const scribe = createScribe(createTestMockProphet({ isLocallyPersisted: true }));
    await scribe.initialize();

    const connection = await scribe.acquirePartitionConnection(testPartitionURI)
        .getSyncedConnection();
    const sharedDB = await openDB(sharedURI);

    for (const mediaContent of textMediaContents) {
      const preparedBvob = connection.prepareBvob(mediaContent, { name: "Some media" });
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

  it("populates a new connection to an existing partition with its cached commands", async () => {
    const scribe = createScribe(createTestMockProphet({ isLocallyPersisted: true }));
    await scribe.initialize();

    const firstConnection = await scribe.acquirePartitionConnection(testPartitionURI)
        .getSyncedConnection();

    let claimResult = firstConnection.chronicleEventLog([simpleCommand]).eventResults[0];
    await claimResult.getLocallyReceivedEvent();

    claimResult = firstConnection.chronicleEventLog([followupTransaction]).eventResults[0];
    await claimResult.getLocallyReceivedEvent();

    const firstUnusedCommandEventId = firstConnection.getFirstUnusedCommandEventId();
    expect(firstUnusedCommandEventId).toBeGreaterThan(1);
    firstConnection.disconnect();

    const secondConnection = await scribe.acquirePartitionConnection(testPartitionURI)
        .getSyncedConnection();
    expect(secondConnection.getFirstUnusedCommandEventId()).toBe(firstUnusedCommandEventId);
  });

  it("ensures commands are stored in a proper ascending order", async () => {
    const scribe = createScribe(createTestMockProphet({ isLocallyPersisted: true }));
    await scribe.initialize();

    const connection = await scribe.acquirePartitionConnection(testPartitionURI)
        .getSyncedConnection();
    let oldUnusedCommandId;
    let newUnusedCommandId = connection.getFirstUnusedCommandEventId();

    for (const command of simpleCommandList) {
      const claimResult = connection.chronicleEventLog([command]).eventResults[0];
      await claimResult.getLocallyReceivedEvent();

      oldUnusedCommandId = newUnusedCommandId;
      newUnusedCommandId = connection.getFirstUnusedCommandEventId();
      expect(oldUnusedCommandId).toBeLessThan(newUnusedCommandId);
    }
  });
});
