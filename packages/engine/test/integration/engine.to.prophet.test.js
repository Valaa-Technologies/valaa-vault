/* global describe expect it */

import { vRef } from "~/raem/VRL";

import { createEngineTestHarness, createEngineOracleHarness }
    from "~/engine/test/EngineTestHarness";
import { clearAllScribeDatabases } from "~/prophet/test/ProphetTestHarness";
import { arrayBufferFromUTF8String } from "~/tools/textEncoding";
import { contentHashFromArrayBuffer } from "~/tools";

let harness: { createds: Object, engine: Object, prophet: Object, testEntities: Object };
const entities = () => harness.createds.Entity;
afterEach(async () => {
  await clearAllScribeDatabases();
  harness = null;
}); // eslint-disable-line no-undef

describe("Media handling", () => {
  it("does an async prepareBvob for non-locally persisted Media content", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracleOptions: { testAuthorityConfig: {
        isRemoteAuthority: true, isLocallyPersisted: false,
      } },
      awaitResult: (result) => result.getLocalStory(),
    });
    const buffer = arrayBufferFromUTF8String("example content");
    const contentHash = contentHashFromArrayBuffer(buffer);
    const testPartitionBackend = harness.tryGetTestAuthorityConnection(harness.testConnection);
    const existingChroniclingCount = testPartitionBackend._chroniclings.length;
    const { media, contentSetting } = await harness.runValoscript(vRef("test_partition"), `
      const media = new Media({
          name: "text media",
          owner: this,
          mediaType: { type: "text", subtype: "plain" },
      });
      const contentSetting = media[valos.prepareBvob](buffer)
          .then(createBvob => ({ bvobId: (media[valos.Media.content] = createBvob()) }));
      this.text = media;
      ({ media, contentSetting });
    `, { scope: { buffer, console }, awaitResult: (result) => result.getLocalEvent() });
    expect(media.getId().toJSON())
        .toEqual(entities().test_partition.get(["§..", "text"]).getId().toJSON());
    expect(testPartitionBackend.getPreparation(contentHash))
        .toBeTruthy();
    expect(media.get("content"))
        .toBeFalsy();
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 1);
    testPartitionBackend.addPrepareBvobResult({ contentHash });
    const { bvobId } = await contentSetting;
    expect(bvobId.getId().rawId())
        .toEqual(contentHash);
    expect(bvobId.getId().toJSON())
        .toEqual(media.get("content").getId().toJSON());
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 2);
  });

  it("does an async prepareBvob for locally persisted Media content", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracleOptions: { testAuthorityConfig: {
        isRemoteAuthority: true, isLocallyPersisted: true, // as opposed to false of previous test
      } },
    });
    const testPartitionBackend = harness.tryGetTestAuthorityConnection(harness.testConnection);
    const existingChroniclingCount = testPartitionBackend._chroniclings.length;
    const buffer = arrayBufferFromUTF8String("example content");
    const contentHash = contentHashFromArrayBuffer(buffer);
    const { media, contentSetting } = await harness.runValoscript(vRef("test_partition"), `
      const media = new Media({
          name: "text media",
          owner: this,
          mediaType: { type: "text", subtype: "plain" },
      });
      const contentSetting = media[valos.prepareBvob](buffer)
          .then(createBvob => ({ bvobId: (media[valos.Media.content] = createBvob()) }));
      this.text = media;
      ({ media, contentSetting });
    `, { scope: { buffer, console } });
    expect(media.getId().toJSON())
        .toEqual(entities().test_partition.get(["§..", "text"]).getId().toJSON());
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 1);
    // no remote confirmation!
    const { bvobId } = await contentSetting;
    expect(bvobId.getId().rawId())
        .toEqual(contentHash);
    expect(bvobId.getId().toJSON())
        .toEqual(media.get("content").getId().toJSON());
    // FIXME(iridian, 2019-01): Replace this ugly prophecy extraction
    // with transaction introspection API, so that the createBvob
    // callback in the above VS code will get its own transaction
    // completion promise and export it to this outer test context.
    const createBvobProphecy = harness.falseProphet._primaryRecital.getLast();
    expect((await createBvobProphecy.meta.operation.getLocalStory()).actions.length)
        .toEqual(2); // good enough...
    testPartitionBackend.addPrepareBvobResult({ contentHash });
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 1);
    await createBvobProphecy.meta.operation.getPersistedStory();
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 2);
  });

  it("doesn't fetch a media content from the stale lookups when updating content", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracleOptions: { testAuthorityConfig: {
        isRemoteAuthority: true, isLocallyPersisted: true, // as opposed to false of previous test
      } },
    });
    const undefinedMedia = await harness.runValoscript(vRef("test_partition"), `
      new Media({
        name: "undefined_text_media",
        owner: this,
        mediaType: { type: "application", subtype: "octet-stream" },
      })`, {},
    );
    expect(undefinedMedia.get("content"))
        .toBeNull();
    expect(undefinedMedia.interpretContent({ synchronous: true }))
        .toBeUndefined();

    const initialContent = "initial content";
    const initialBuffer = arrayBufferFromUTF8String(initialContent);
    const initialContentHash = contentHashFromArrayBuffer(initialBuffer);

    const subscribeToContentUpdate = contentMedia => resolve =>
        contentMedia.obtainSubscription("content")
            .addSubscriber(harness, "test", liveUpdate => resolve({
              liveUpdate,
              bvobId: contentMedia.get("content"),
              content: contentMedia.interpretContent({ synchronous: true, mime: "text/plain" }),
            }), false);
    const { contentMedia, createdProcess } = await harness.runValoscript(vRef("test_partition"), `
      this[valos.prepareBvob](initialBuffer).then(createBvob => {
        const contentMedia = new Media({
          name: "initial_content_media",
          owner: this,
          content: createBvob(),
          mediaType: { type: "application", subtype: "octet-stream" },
        });
        return {
          contentMedia,
          createdProcess: new Promise(subscribeToContentUpdate(contentMedia)),
        };
      })`, { scope: { initialBuffer, console, subscribeToContentUpdate } },
    );
    const createdUpdate = await createdProcess;

    expect(createdUpdate.liveUpdate.value().getRawId())
        .toEqual(initialContentHash);
    expect(createdUpdate.bvobId.getRawId())
        .toEqual(initialContentHash);
    expect(createdUpdate.content)
        .toEqual(initialContent);

    expect(contentMedia.get("content").getRawId())
        .toEqual(initialContentHash);
    expect(contentMedia.interpretContent({ synchronous: true, mime: "text/plain" }))
        .toEqual(initialContent);

    const updateContent = "update content";
    const updateBuffer = arrayBufferFromUTF8String(updateContent);
    const updateContentHash = contentHashFromArrayBuffer(updateBuffer);

    const { updateBvob, modifiedProcess } = await harness.runValoscript(
        undefinedMedia,
        `this[valos.prepareBvob](updateBuffer).then(createBvob => ({
          modifiedProcess: new Promise(subscribeToContentUpdate(this)),
          updateBvob: (this.$V.content = createBvob()),
        }));`,
        { scope: { updateBuffer, console, subscribeToContentUpdate } },
    );
    const modifiedUpdate = await modifiedProcess;

    expect(updateBvob.getRawId())
        .toEqual(updateContentHash);

    expect(modifiedUpdate.liveUpdate.value().getRawId())
        .toEqual(updateContentHash);
    expect(modifiedUpdate.bvobId.getRawId())
        .toEqual(updateContentHash);
    expect(modifiedUpdate.content)
        .toEqual(updateContent);

    expect(undefinedMedia.get("content").getRawId())
        .toEqual(updateContentHash);
    expect(undefinedMedia.interpretContent({ synchronous: true, mime: "text/plain" }))
        .toEqual(updateContent);

    const { updateAgainBvob, modifiedAgainProcess } = await harness.runValoscript(
        contentMedia, // this time we update the contentMedia
        `this[valos.prepareBvob](updateBuffer).then(createBvob => ({
          modifiedAgainProcess: new Promise(subscribeToContentUpdate(this)),
          updateAgainBvob: (this.$V.content = createBvob()),
        }));`,
        { scope: { updateBuffer, console, subscribeToContentUpdate } },
    );
    const modifiedAgainUpdate = await modifiedAgainProcess;

    expect(updateAgainBvob.getRawId())
        .toEqual(updateContentHash);

    expect(modifiedAgainUpdate.liveUpdate.value().getRawId())
        .toEqual(updateContentHash);
    expect(modifiedAgainUpdate.bvobId.getRawId())
        .toEqual(updateContentHash);
    expect(modifiedAgainUpdate.content)
        .toEqual(updateContent);

    expect(contentMedia.get("content").getRawId())
        .toEqual(updateContentHash);
    expect(contentMedia.interpretContent({ synchronous: true, mime: "text/plain" }))
        .toEqual(updateContent);
  });
});

describe("Two paired harnesses emulating two gateways connected through event streams", () => {
  it("passes a property value to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracleOptions: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runValoscript(vRef("test_partition"), `
      this.val = "yo";
    `)).toEqual("yo");

    await pairness.receiveTruthsFrom(harness);

    expect(pairness.runValoscript(vRef("test_partition"), `
      this.val;
    `)).toEqual("yo");
  });

  it("passes a property reference to a newly created Entity to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracleOptions: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runValoscript(vRef("test_partition"), `
      this.thing = new Entity({ owner: this, name: "thingie", properties: { val: "yoyo" } });
      this.thing.$V.name;
    `)).toEqual("thingie");

    await pairness.receiveTruthsFrom(harness);

    expect(pairness.runValoscript(vRef("test_partition"), `
      [this.thing.$V.name, this.thing.val];
    `)).toEqual(["thingie", "yoyo"]);
  });

  it("passes a complex property with a Resource reference to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracleOptions: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runValoscript(vRef("test_partition"), `
      const obj = {
        things: [new Entity({ owner: this, name: "thingie", properties: { val: "yoyo" } })],
      };
      this.lookup = obj;
      obj.things[1] = "local but not universal";
      [
        this.lookup.things[0].$V.name, this.lookup.things[0].val,
        this.lookup.things[1], obj.things[1],
      ];
    `)).toEqual(["thingie", "yoyo", undefined, "local but not universal"]);

    await pairness.receiveTruthsFrom(harness, { verbosity: 0 });

    expect(pairness.runValoscript(vRef("test_partition"), `
      [
        this.lookup.things[0].$V.name, this.lookup.things[0].val, this.lookup.things[1],
      ];
    `)).toEqual(["thingie", "yoyo", undefined]);
  });

  it("passes a function inside property to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracleOptions: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    const values = await harness.runValoscript(vRef("test_partition"), `
      const callbackEntity = new Entity({ owner: this, name: "Callback Target",
        properties: { result: 10 },
      });
      const obj = {
        increment: 1,
        callbackEntity: callbackEntity,
        callback: function () {
          return (callbackEntity.result += (this.increment + obj.increment));
        },
      };
      Object.defineProperty(obj, "decrement", { get: function () { return -this.increment; } });
      Object.defineProperty(callbackEntity, "antiresult",
          { get: function () { return -this.result; } });
      const values = [obj.callback()];
      values.push(callbackEntity.result);
      this.obj = obj;
      values.push(obj.increment += 1);
      values.push(obj.callback());
      values.push(this.obj.callback());
      values.push(callbackEntity.result);
      values.push(obj.decrement);
      values.push(callbackEntity.antiresult);
      values.push(obj.callback);
      values;
    `, { scope: { console } });
    expect(values.slice(0, -1))
        .toEqual([12, 12, 2, 16, 18, 18, -2, -18]);
    // expect(values[values.length - 1].call({ increment: 3 }))
    //    .toEqual(23); // this works but it's a pita to await for getLocalEvent
    await pairness.receiveTruthsFrom(harness, { verbosity: 0 });

    const pairedValues = await pairness.runValoscript(vRef("test_partition"), `
      const values = [this.obj.callbackEntity.result];
      values.push(this.obj.callback());
      values.push(this.$V.unnamedOwnlings[0].result);
      values.push(this.obj.decrement);
      values.push(this.obj.callbackEntity.antiresult);
      values;
    `);
    expect(pairedValues)
        .toEqual([18, 20, 20, undefined /* -1 */, -20]);
    // See VALEK/index.js:94 for missing getter universalization

    await harness.receiveTruthsFrom(harness, { clearUpstreamEntries: true });
    await harness.receiveTruthsFrom(pairness, { clearUpstreamEntries: true });

    expect(await harness.runValoscript(vRef("test_partition"), `this.obj.callbackEntity.result`))
        .toEqual(20);
  });
});

describe("Regressions", () => {
  it("returns $V.partitionURI for root, child, instance and ghosts properly", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const { rootURI, testURI, instanceURI, ghostURI } = harness.runValoscript(
        vRef("test_partition"), `
      const rootURI = this.$V.partitionURI;
      const test = this.$V.unnamedOwnlings.find(e => (e.$V.name === "testName"));
      const instance = this.$V.unnamedOwnlings.find(e => (e.$V.name === "testInstance"));
      const ghost = instance.$V.unnamedOwnlings.find(e => (e.$V.name === "ownlingCreator"));
      ({
        rootURI: this.$V.partitionURI,
        testURI: test.$V.partitionURI,
        instanceURI: instance.$V.partitionURI,
        ghostURI: ghost.$V.partitionURI,
      });
    `);
    expect(rootURI).toEqual(String(harness.testPartitionURI));
    expect(testURI).toEqual(String(harness.testPartitionURI));
    expect(instanceURI).toEqual(String(harness.testPartitionURI));
    expect(ghostURI).toEqual(String(harness.testPartitionURI));
  });
});
