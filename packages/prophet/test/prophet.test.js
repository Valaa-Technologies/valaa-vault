// @flow

import { created, transacted } from "~/raem/command/index";
import { vRef } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";

import {
  createScribe, clearScribeDatabases, createTestMockProphet, createOracle,
  createProphetOracleHarness,
} from "~/prophet/test/ProphetTestHarness";

import { openDB, expectStoredInDB } from "~/tools/html5/InMemoryIndexedDBUtils";

const testAuthorityURI = "valaa-test:";
const testPartitionURI = createPartitionURI(testAuthorityURI, "test_partition");

let harness = null;

afterEach(async () => {
  if (harness) {
    await harness.cleanup();
    harness = null;
  } else await clearScribeDatabases([testPartitionURI]);
});

describe("Prophet", () => {
  const structuredMediaContents = [
    [`"Hello world"`, { name: "hello.txt", type: "text", subtype: "plain" }, `"Hello world"`],
    [`"Hello world"`, { name: "hello.txt", type: "text", subtype: "whatevs" }, `"Hello world"`],
    [`"Hello world"`, { name: "hello.json", type: "application", subtype: "json" }, "Hello world"],
    [`{ "a": 10 }`, { name: "a10.json", type: "application", subtype: "json" }, { a: 10 }],
  ];

  it("decodes cached bvob buffers based on media type", async () => {
    const scribe = createScribe(createOracle(createTestMockProphet({ isLocallyPersisted: true })));
    await scribe.initiate();

    const connection = await scribe.acquirePartitionConnection(testPartitionURI)
        .getSyncedConnection();

    const mediaId = vRef("abcd-0123");
    for (const [bufferContent, mediaInfo, expectedContent] of structuredMediaContents) {
      const preparedBvob = connection.prepareBvob(bufferContent);
      const bvobId = await preparedBvob.persistProcess;
      const decodedContent =
          await connection.decodeMediaContent({ mediaId, bvobId, ...mediaInfo });
      expect(decodedContent).toEqual(expectedContent);
    }
  });

  const simpleCommand = created({ eventId: 0, id: "Some entity", typeName: "Entity" });

  const simpleTransaction = transacted({
    eventId: 1,
    actions: [
      created({ id: "Some relation", typeName: "Relation" }),
      created({ id: "Some other entity", typeName: "Entity" }),
    ],
  });

  const commands = [
    created({ id: "Entity A", typeName: "Entity", initialState: { owner: "test_partition" } }),
    created({ id: "Entity B", typeName: "Entity", initialState: { owner: "test_partition" } }),
    created({ id: "Entity C", typeName: "Entity", initialState: { owner: "test_partition" } }),
    created({ id: "Entity D", typeName: "Entity", initialState: { owner: "test_partition" } }),
    created({ id: "Entity E", typeName: "Entity", initialState: { owner: "test_partition" } }),
    created({ id: "Entity F", typeName: "Entity", initialState: { owner: "test_partition" } }),
  ];

  it("stores the contents of the actions on the scribe correctly", async () => {
    harness = await createProphetOracleHarness({ verbosity: 0,
      oracleOptions: { testAuthorityConfig: { isLocallyPersisted: true } },
    });
    const prophetConnection = await harness.prophet
        .acquirePartitionConnection(testPartitionURI).getSyncedConnection();
    const scribeConnection = prophetConnection.getUpstreamConnection();
    const database = await openDB(testPartitionURI.toString());

    for (const command of commands) {
      const claimResult = await harness.chronicleEvent(command);
      await claimResult.getStoryPremiere();
      const partitionCommand = await claimResult.getCommandOf(testPartitionURI);
      const eventId = scribeConnection.getFirstUnusedCommandEventId() - 1;
      await expectStoredInDB(partitionCommand, database, "commands", eventId);
    }
  });

  it("assigns proper eventIds for commands", async () => {
    harness = await createProphetOracleHarness({});
    const partitionURI = createPartitionURI(testAuthorityURI, "test_partition");

    const prophetConnection = await harness.prophet
        .acquirePartitionConnection(partitionURI).getSyncedConnection();
    const scribeConnection = prophetConnection.getUpstreamConnection();

    let oldCommandId;
    let newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;

    for (const command of commands) {
      oldCommandId = newCommandId;

      await harness.chronicleEvent(command).getStoryPremiere();

      newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;
      expect(oldCommandId).toBeLessThan(newCommandId);
    }
  });
});
