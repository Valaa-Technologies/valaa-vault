// @flow

import { created, transacted } from "~/raem/events/index";
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
  } else await clearScribeDatabases(["valaa-test:?id=test_partition"]);
});

describe("Scribe", () => {
  const simpleCommand = created({ logIndex: 0, id: "Some entity", typeName: "Entity" });

  const followupTransaction = transacted({
    logIndex: 1,
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
    entry.logIndex = index;
  });

  it("stores truths/commands in the database", async () => {
    const scribe = createScribe(createTestMockProphet({ isRemoteAuthority: true }));
    await scribe.initiate();

    const connection = await scribe
        .acquirePartitionConnection(testPartitionURI).getSyncedConnection();
    const database = await openDB(testPartitionURI.toString());

    // Adds an entity and checks that it has been stored
    let storedEvent = await connection.chronicleEvent(simpleCommand).getLocalEvent();
    expect(storedEvent.logIndex)
        .toEqual(connection.getFirstUnusedCommandEventId() - 1);
    await expectStoredInDB(simpleCommand, database, "commands",
        connection.getFirstUnusedCommandEventId() - 1);

    // Runs a transaction and confirms that it has been stored
    storedEvent = await connection.chronicleEvent(followupTransaction).getLocalEvent();
    expect(storedEvent.logIndex)
        .toEqual(connection.getFirstUnusedCommandEventId() - 1);
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
    const scribe = createScribe(createTestMockProphet());
    await scribe.initiate();

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
    const scribe = createScribe(createTestMockProphet());
    await scribe.initiate();

    const firstConnection = await scribe.acquirePartitionConnection(testPartitionURI)
        .getSyncedConnection();

    await firstConnection.chronicleEvent(simpleCommand).getLocalEvent();

    const storedEvent =
        await firstConnection.chronicleEvent(followupTransaction).getLocalEvent();

    const firstUnusedCommandEventId = firstConnection.getFirstUnusedCommandEventId();
    expect(firstUnusedCommandEventId).toEqual(storedEvent.logIndex + 1);
    expect(firstUnusedCommandEventId).toBeGreaterThan(1);
    firstConnection.disconnect();

    const secondConnection = await scribe.acquirePartitionConnection(testPartitionURI)
        .getSyncedConnection();
    expect(secondConnection.getFirstUnusedCommandEventId()).toBe(firstUnusedCommandEventId);
  });

  it("ensures commands are stored in a proper ascending order", async () => {
    const scribe = createScribe(createTestMockProphet());
    await scribe.initiate();

    const connection = await scribe.acquirePartitionConnection(testPartitionURI)
        .getSyncedConnection();
    let oldUnusedCommandId;
    let newUnusedCommandId = connection.getFirstUnusedCommandEventId();

    for (const command of simpleCommandList) {
      const storedEvent = await connection.chronicleEvent(command).getLocalEvent();
      expect(storedEvent.logIndex)
          .toEqual(newUnusedCommandId);

      oldUnusedCommandId = newUnusedCommandId;
      newUnusedCommandId = connection.getFirstUnusedCommandEventId();
      expect(oldUnusedCommandId).toBeLessThan(newUnusedCommandId);
    }
  });

  it("writes multiple commands in a single go gracefully", async () => {
    const scribe = createScribe(createTestMockProphet());
    await scribe.initiate();

    const connection = await scribe.acquirePartitionConnection(testPartitionURI)
        .getSyncedConnection();

    const chronicling = connection.chronicleEvents(simpleCommandList);
    const lastLocal = await chronicling.eventResults[simpleCommandList.length - 1].getLocalEvent();
    expect(lastLocal.logIndex + 1)
        .toEqual(connection.getFirstUnusedCommandEventId());
    const lastTruth = await chronicling.eventResults[simpleCommandList.length - 1].getTruthEvent();
    expect(lastTruth.logIndex + 1)
        .toEqual(connection.getFirstUnusedTruthEventId());
  });
});
