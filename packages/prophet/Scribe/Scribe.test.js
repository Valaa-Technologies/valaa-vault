// @flow

import { created, transacted } from "~/raem/events/index";
import { createPartitionURI } from "~/raem/ValaaURI";

import {
  createScribe, clearScribeDatabases, createTestMockProphet
} from "~/prophet/test/ProphetTestHarness";

import { utf8StringFromArrayBuffer } from "~/tools/textEncoding";

import { openDB, getFromDB, getKeysFromDB, expectStoredInDB }
    from "~/tools/html5/InMemoryIndexedDBUtils";
import { initializeAspects } from "../tools/EventAspects";

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
  const simpleCommand = initializeAspects(created({
    id: ["some-entity"], typeName: "Entity",
  }), { version: "0.2", command: { id: "cid-0" }, log: { index: 0 } });

  const followupTransaction = initializeAspects(transacted({
    actions: [
      created({ id: ["some-relation"], typeName: "Relation" }),
      created({ id: ["some-other-entity"], typeName: "Entity" }),
    ],
  }), { version: "0.2", command: { id: "cid-1" }, log: { index: 1 } });

  const simpleEntityTemplate = { typeName: "Entity", initialState: { owner: ["test_partition"] } };
  const simpleCommandList = [
    created({ id: ["Entity-A"], ...simpleEntityTemplate }),
    created({ id: ["Entity-B"], ...simpleEntityTemplate }),
    created({ id: ["Entity-C"], ...simpleEntityTemplate }),
    created({ id: ["Entity-D"], ...simpleEntityTemplate }),
    created({ id: ["Entity-E"], ...simpleEntityTemplate }),
    created({ id: ["Entity-F"], ...simpleEntityTemplate }),
  ];
  simpleCommandList.forEach((event, index) => {
    initializeAspects(event, { version: "0.2", command: { id: `cid-2-${index}` }, log: { index } });
  });

  it("stores truths/commands in the database", async () => {
    const scribe = createScribe(createTestMockProphet({ isRemoteAuthority: true }));
    await scribe.initiate();

    const connection = await scribe
        .acquirePartitionConnection(testPartitionURI).getSyncedConnection();
    const database = await openDB(testPartitionURI.toString());

    // Adds an entity and checks that it has been stored
    let storedEvent = await connection.chronicleEvent(simpleCommand).getLocalEvent();
    expect(storedEvent.aspects.log.index)
        .toEqual(connection.getFirstUnusedCommandEventId() - 1);
    await expectStoredInDB(simpleCommand, database, "commands",
        connection.getFirstUnusedCommandEventId() - 1);

    // Runs a transaction and confirms that it has been stored
    storedEvent = await connection.chronicleEvent(followupTransaction).getLocalEvent();
    expect(storedEvent.aspects.log.index)
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
      const restoredContent = utf8StringFromArrayBuffer(restoredBuffer.buffer);
      expect(restoredContent).toEqual(mediaContent);
    }
  });

  it("populates a new connection to an existing partition with its cached commands", async () => {
    const scribe = createScribe(createTestMockProphet());
    await scribe.initiate();

    const firstConnection = await scribe.acquirePartitionConnection(testPartitionURI)
        .getSyncedConnection();

    await firstConnection.chronicleEvent(simpleCommand).getLocalEvent();

    const storedEvent = await firstConnection.chronicleEvent(followupTransaction).getLocalEvent();

    const firstUnusedCommandEventId = firstConnection.getFirstUnusedCommandEventId();
    expect(firstUnusedCommandEventId).toEqual(storedEvent.aspects.log.index + 1);
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
      expect(storedEvent.aspects.log.index)
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
    expect(lastLocal.aspects.log.index + 1)
        .toEqual(connection.getFirstUnusedCommandEventId());
    const lastTruth = await chronicling.eventResults[simpleCommandList.length - 1].getTruthEvent();
    expect(lastTruth.aspects.log.index + 1)
        .toEqual(connection.getFirstUnusedTruthEventId());
  });
});
