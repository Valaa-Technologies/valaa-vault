// @flow

import { utf8StringFromArrayBuffer } from "~/security/textEncoding";

import { created, transacted } from "~/raem/events/index";

import {
  testRootId, testChronicleURI,
  createScribe, clearAllScribeDatabases, createTestMockSourcerer
} from "~/sourcerer/test/SourcererTestHarness";
// @flow

import { initializeAspects } from "~/sourcerer/tools/EventAspects";

import { openDB, getFromDB, getKeysFromDB, expectStoredInDB }
    from "~/tools/html5/InMemoryIndexedDBUtils";

const sharedURI = "valos-shared-content";

let simpleCommand, followupTransaction, simpleEntityTemplate, simpleCommandList;

beforeEach(() => {
  simpleCommand = initializeAspects(created({
    id: ["some-entity"], typeName: "Entity",
  }), { version: "0.2", command: { id: "cid-0" }, log: { index: 0 } });

  followupTransaction = initializeAspects(transacted({
    actions: [
      created({ id: ["some-relation"], typeName: "Relation" }),
      created({ id: ["some-other-entity"], typeName: "Entity" }),
    ],
  }), { version: "0.2", command: { id: "cid-1" }, log: { index: 1 } });

  simpleEntityTemplate = {
    typeName: "Entity", initialState: { owner: [testRootId] },
  };
  simpleCommandList = [
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
});

afterEach(async () => {
  await clearAllScribeDatabases();
});

describe("Scribe", () => {
  it("stores truths/commands in the database", async () => {
    const scribe = await createScribe(createTestMockSourcerer({ isRemoteAuthority: true }));

    const connection = scribe.sourcifyChronicle(testChronicleURI);
    connection.getUpstreamConnection().addNarrateResults({ eventIdBegin: 0 }, []);
    await connection.asSourceredConnection();
    const database = await openDB(testChronicleURI.toString());

    // Adds an entity and checks that it has been stored
    let storedEvent = await connection.proclaimEvent(simpleCommand).getComposedEvent();
    expect(storedEvent.aspects.log.index)
        .toEqual(connection.getFirstUnusedCommandEventId() - 1);
    await expectStoredInDB(simpleCommand, database, "commands",
        connection.getFirstUnusedCommandEventId() - 1);

    // Runs a transaction and confirms that it has been stored
    storedEvent = await connection.proclaimEvent(followupTransaction).getComposedEvent();
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
    const scribe = await createScribe(createTestMockSourcerer());

    const connection = await scribe.sourcifyChronicle(testChronicleURI)
        .asSourceredConnection();
    const sharedDB = await openDB(sharedURI);

    for (const mediaContent of textMediaContents) {
      const preparation = await connection.prepareBvob(mediaContent, { name: "Some media" });
      const contentHash = await preparation.persistProcess;

      const bvobKeys = await getKeysFromDB(sharedDB, "bvobs");
      expect(bvobKeys).toContain(contentHash);

      const bufferKeys = await getKeysFromDB(sharedDB, "buffers");
      expect(bufferKeys).toContain(contentHash);

      const restoredBuffer = await getFromDB(sharedDB, "buffers", contentHash);
      const restoredContent = utf8StringFromArrayBuffer(restoredBuffer.buffer);
      expect(restoredContent).toEqual(mediaContent);
    }
  });

  it("populates a new connection to an existing chronicle with its cached commands", async () => {
    const scribe = await createScribe(createTestMockSourcerer());

    const firstConnection = await scribe.sourcifyChronicle(testChronicleURI)
        .asSourceredConnection();

    await firstConnection.proclaimEvent(simpleCommand).getComposedEvent();

    const storedEvent = await firstConnection
        .proclaimEvent(followupTransaction).getComposedEvent();

    const firstUnusedCommandEventId = firstConnection.getFirstUnusedCommandEventId();
    expect(firstUnusedCommandEventId).toEqual(storedEvent.aspects.log.index + 1);
    expect(firstUnusedCommandEventId).toBeGreaterThan(1);
    firstConnection.disconnect();

    const secondConnection = await scribe.sourcifyChronicle(testChronicleURI)
        .asSourceredConnection();
    expect(secondConnection.getFirstUnusedCommandEventId()).toBe(firstUnusedCommandEventId);
  });

  it("ensures commands are stored in a proper ascending order", async () => {
    const scribe = await createScribe(createTestMockSourcerer());

    const connection = await scribe.sourcifyChronicle(testChronicleURI)
        .asSourceredConnection();
    let oldUnusedCommandId;
    let newUnusedCommandId = connection.getFirstUnusedCommandEventId();

    for (const command of simpleCommandList) {
      const storedEvent = await connection.proclaimEvent(command).getComposedEvent();
      expect(storedEvent.aspects.log.index)
          .toEqual(newUnusedCommandId);

      oldUnusedCommandId = newUnusedCommandId;
      newUnusedCommandId = connection.getFirstUnusedCommandEventId();
      expect(oldUnusedCommandId).toBeLessThan(newUnusedCommandId);
    }
  });

  it("writes multiple commands in a single go gracefully", async () => {
    const scribe = await createScribe(createTestMockSourcerer());

    const connection = await scribe.sourcifyChronicle(testChronicleURI)
        .asSourceredConnection();

    const proclamation = connection.proclaimEvents(simpleCommandList);
    const lastLocal = await proclamation.eventResults[simpleCommandList.length - 1]
        .getComposedEvent();
    expect(lastLocal.aspects.log.index + 1)
        .toEqual(connection.getFirstUnusedCommandEventId());
    const lastTruth = await proclamation.eventResults[simpleCommandList.length - 1]
        .getTruthEvent();
    expect(lastTruth.aspects.log.index + 1)
        .toEqual(connection.getFirstUnusedTruthEventId());
  });
});
