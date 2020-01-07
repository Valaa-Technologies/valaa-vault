/* global describe expect it */

import { vRef } from "~/raem/VRL";

import { createEngineTestHarness, createEngineOracleHarness }
    from "~/engine/test/EngineTestHarness";
import { testRootId, clearAllScribeDatabases } from "~/sourcerer/test/SourcererTestHarness";
import { arrayBufferFromUTF8String } from "~/tools/textEncoding";
import { contentHashFromArrayBuffer } from "~/tools";

let harness: { createds: Object, engine: Object, sourcerer: Object, testEntities: Object };
const entities = () => harness.createds.Entity;
afterEach(async () => {
  await clearAllScribeDatabases();
  harness = null;
}); // eslint-disable-line no-undef

const exampleContent = "example content";
const exampleBuffer = arrayBufferFromUTF8String(exampleContent);
const exampleContentHash = contentHashFromArrayBuffer(exampleBuffer);

describe("Media handling", () => {
  it("does an async prepareBvob for non-locally persisted Media content", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: {
        isRemoteAuthority: true, isLocallyPersisted: false,
      } },
      awaitResult: (result) => result.getComposedStory(),
    });
    const testPartitionBackend = harness.tryGetTestAuthorityConnection(harness.testConnection);
    const existingChroniclingCount = testPartitionBackend._chroniclings.length;
    const { media, contentUpdateStarted } = await harness.runValoscript(vRef(testRootId), `
      const media = new Media({
        name: "text media", owner: this, mediaType: { type: "text", subtype: "plain" },
      });
      const contentUpdateStarted = media[valos.prepareBvob](exampleBuffer)
          .then(createBvob => ({ bvobId: (media[valos.Media.content] = createBvob()) }));
      this.text = media;
      ({ media, contentUpdateStarted });
    `, { exampleBuffer, console }, { awaitResult: (result) => result.getComposedEvent() });
    expect(media.getId().toJSON())
        .toEqual(entities()[testRootId].get(["§..", "text"]).getId().toJSON());
    expect(testPartitionBackend.getPreparation(exampleContentHash))
        .toBeTruthy();
    expect(media.get("content"))
        .toBeFalsy();
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 1);
    testPartitionBackend.addPrepareBvobResult({ contentHash: exampleContentHash });
    const { bvobId } = await contentUpdateStarted;
    expect(bvobId.getId().rawId())
        .toEqual(exampleContentHash);
    expect(bvobId.getId().toJSON())
        .toEqual(media.get("content").getId().toJSON());
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 2);

    await expect(media.extractValue()).rejects
        .toThrow(/content not found in local cache/);
  });

  it("does an async prepareBvob for locally persisted Media content", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: {
        isRemoteAuthority: true, isLocallyPersisted: true, // as opposed to false of previous test
      } },
    });
    const testPartitionBackend = harness.tryGetTestAuthorityConnection(harness.testConnection);
    const existingChroniclingCount = testPartitionBackend._chroniclings.length;
    const { media, contentUpdateStarted, newMediaPersist } = await harness.runValoscript(
        vRef(testRootId), `
      const media = new Media({
        name: "text media", owner: this, mediaType: { type: "text", subtype: "plain" },
      });
      const contentUpdateStarted = media[valos.prepareBvob](exampleBuffer)
          .then(createBvob => ({
            bvobId: (media[valos.Media.content] = createBvob()),
            bvobComposed: new Promise(resolve =>
                valos.getTransactor().addEventListener("aftercompose", resolve)),
            bvobPersisted: new Promise(resolve =>
                valos.getTransactor().addEventListener("persist", resolve)),
          }));
      this.text = media;
      ({
        media, contentUpdateStarted,
        newMediaPersist: new Promise(resolve => (valos.getTransactor().onpersist = resolve)),
      });
    `, { exampleBuffer, console });
    await newMediaPersist;
    expect(media.getId().toJSON())
        .toEqual(entities()[testRootId].get(["§..", "text"]).getId().toJSON());
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 1);
    // local bvob persisted internally but not remotely
    const { bvobId, bvobComposed, bvobPersisted } = await contentUpdateStarted;
    expect(bvobId.getId().rawId())
        .toEqual(exampleContentHash);
    expect(bvobId.getId().toJSON())
        .toEqual(media.get("content").getId().toJSON());
    const bvobComposedEvent = await bvobComposed;

    expect(await media.extractValue())
        .toEqual(exampleContent);

    expect(bvobComposedEvent.command.actions.length).toEqual(2);
    testPartitionBackend.addPrepareBvobResult({ contentHash: exampleContentHash });
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 1);
    await bvobPersisted;
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 2);

    expect(await media.extractValue())
        .toEqual(exampleContent);
  });

  it("rejects async prepareBvob command recomposition after Media command is purged", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true } },
      awaitResult: (result) => result.getPersistedStory(),
    });
    const testPartitionBackend = harness.tryGetTestAuthorityConnection(harness.testConnection);
    const existingChroniclingCount = testPartitionBackend._chroniclings.length;
    let reformCause;
    const onReform = e => { reformCause = e.error; e.preventDefault(); };
    harness.clockEvent(1, () => ["test.runValoscript"]);
    const { media, contentUpdateStarted, newMediaPersist } = await harness.runValoscript(
        vRef(testRootId), `
      const media = new Media({
        name: "text media", owner: this, mediaType: { type: "text", subtype: "plain" },
      });
      const contentUpdateStarted = media[valos.prepareBvob](exampleBuffer)
          .then(createBvob => ({
            bvobId: (media[valos.Media.content] = createBvob()),
            bvobPersisted: new Promise(resolve =>
                valos.getTransactor().addEventListener("persist", resolve)),
            bvobPurged: new Promise(resolve =>
                valos.getTransactor().addEventListener("purge", resolve)),
          }));
      this.text = media;
      valos.getTransactor().addEventListener("reform", onReform);
      ({
        media, contentUpdateStarted,
        newMediaPersist: new Promise(resolve => (valos.getTransactor().onpersist = resolve)),
      });
    `,
        { exampleBuffer, console, onReform },
        { awaitResult: (result) => result.getComposedEvent() });
    harness.clockEvent(1, () => ["test.newMediaPersist"]);
    await newMediaPersist;
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 1);
    harness.clockEvent(1, () => ["test.contentUpdateStarted"]);
    const { bvobPersisted, bvobPurged } = await contentUpdateStarted;
    testPartitionBackend.addPrepareBvobResult({ contentHash: exampleContentHash });
    harness.clockEvent(1, () => ["test.bvobPersisted"]);
    await bvobPersisted;

    expect(await media.extractValue())
        .toEqual(exampleContent);

    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 2);
    testPartitionBackend._chroniclings.splice(existingChroniclingCount, 2)[0]
        .rejectTruthEvent(Object.assign(new Error("Not permitted"),
            { isRevisable: false, isReformable: true }));
    harness.clockEvent(1, () => ["test.bvobPurged"]);
    const purgeEvent = await bvobPurged;
    expect(purgeEvent.error.message)
        .toMatch(/Media does not exist/);
    expect(purgeEvent.typePrecedingError)
        .toEqual("reform");
    expect(purgeEvent.isComposeSchism)
        .toBeTruthy();
    expect(reformCause.message).toEqual("Not permitted");

    expect(() => media.extractValue())
        .toThrow(/Cannot operate on a non-Created/);
  });

  it("does not reform nor rechronicle when only non-schismatic errors are thrown", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true } },
      awaitResult: (result) => result.getPersistedStory(),
    });
    const testPartitionBackend = harness.tryGetTestAuthorityConnection(harness.testConnection);
    const existingChroniclingCount = testPartitionBackend._chroniclings.length;
    let reformCause;
    const onReform = e => { reformCause = e.error; e.preventDefault(); };
    harness.clockEvent(1, () => ["test.runValoscript"]);
    const { media, contentUpdateStarted, newMediaPersist, newMediaError } =
        await harness.runValoscript(vRef(testRootId), `
      const media = new Media({
        name: "text media", owner: this, mediaType: { type: "text", subtype: "plain" },
      });
      const contentUpdateStarted = media[valos.prepareBvob](exampleBuffer)
          .then(createBvob => ({
            bvobId: (media[valos.Media.content] = createBvob()),
            bvobPersisted: new Promise(resolve =>
                valos.getTransactor().addEventListener("persist", resolve)),
          }));
      this.text = media;
      valos.getTransactor().addEventListener("reform", onReform);
      ({
        media, contentUpdateStarted,
        newMediaPersist: new Promise(resolve => (valos.getTransactor().onpersist = resolve)),
        newMediaError: new Promise(resolve => (valos.getTransactor().onerror = resolve)),
      });`,
        { exampleBuffer, console, onReform },
        { awaitResult: (result) => result.getComposedEvent() });
    harness.clockEvent(1, () => ["test.newMediaPersist"]);
    await newMediaPersist;
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 1);
    harness.clockEvent(1, () => ["test.contentUpdateStarted"]);
    const { bvobPersisted } = await contentUpdateStarted;
    testPartitionBackend.addPrepareBvobResult({ contentHash: exampleContentHash });
    harness.clockEvent(1, () => ["test.bvobPersisted"]);
    await bvobPersisted;

    expect(await media.extractValue())
        .toEqual(exampleContent);

    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 2);
    testPartitionBackend._chroniclings.splice(existingChroniclingCount, 2)[0]
        .rejectTruthEvent(Object.assign(new Error("Connection lost"),
            { isSchismatic: false }));
    harness.clockEvent(1, () => ["test.newMediaError"]);
    const errorEvent = await newMediaError;
    expect(errorEvent.error.message)
        .toMatch(/Connection lost/);
    expect(errorEvent.typePrecedingError)
        .toEqual("persist");
    expect(errorEvent.isComposeSchism)
        .toBeFalsy();
    expect(reformCause)
        .toEqual(undefined);

    expect(await media.extractValue())
        .toEqual(exampleContent);
  });

  it("delays a depending reformation when dependent heretic reformation is delayed", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true } },
      awaitResult: (result) => result.getPersistedStory(),
    });
    const buffer = arrayBufferFromUTF8String("example content");
    const contentHash = contentHashFromArrayBuffer(buffer);
    const testPartitionBackend = harness.tryGetTestAuthorityConnection(harness.testConnection);
    const existingChroniclingCount = testPartitionBackend._chroniclings.length;
    let mediaProphecy, mediaPurgeEvent, mediaReformCause;
    let resolveReformationDelay;
    const onReform = e => {
      mediaReformCause = e.error;
      e.reformWhenTruthy(new Promise(resolve => (resolveReformationDelay = resolve)));
    };
    const onPurge = e => (mediaPurgeEvent = e);
    harness.clockEvent(1, () => ["test.runValoscript"]);
    const { media, contentUpdateStarted, newMediaPersist } = await harness.runValoscript(
        vRef(testRootId), `
      const media = new Media({
        name: "text media", owner: this, mediaType: { type: "text", subtype: "plain" },
      });
      const contentUpdateStarted = media[valos.prepareBvob](buffer)
          .then(createBvob => ({
            bvobId: (media[valos.Media.content] = createBvob()),
            bvobPersisted: new Promise(resolve =>
                valos.getTransactor().addEventListener("persist", resolve)),
            bvobPurged: new Promise(resolve =>
                valos.getTransactor().addEventListener("purge", resolve)),
          }));
      this.text = media;
      valos.getTransactor().addEventListener("reform", onReform);
      valos.getTransactor().addEventListener("purge", onPurge);
      ({
        media, contentUpdateStarted,
        newMediaPersist: new Promise(resolve => (valos.getTransactor().onpersist = resolve)),
      });`,
        { buffer, console, onReform, onPurge },
        { awaitResult: (result) => (mediaProphecy = result).getComposedEvent() });
    harness.clockEvent(1, () => ["test.newMediaPersist"]);
    await newMediaPersist;
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 1);
    harness.clockEvent(1, () => ["test.contentUpdateStarted"]);
        const { bvobPersisted, bvobPurged } = await contentUpdateStarted;
    testPartitionBackend.addPrepareBvobResult({ contentHash });
    harness.clockEvent(1, () => ["test.bvobPersisted"]);
    await bvobPersisted;
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 2);
    testPartitionBackend._chroniclings.splice(existingChroniclingCount, 2)[0]
        .rejectTruthEvent(Object.assign(new Error("Not permitted"),
            { isRevisable: false, isReformable: true }));
    harness.clockEvent(1, () => ["test.bvobPurged"]);
    const bvobPurgeEvent = await bvobPurged;
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount);
    expect(bvobPurgeEvent.error.message)
        .toMatch(/Media does not exist/);
    expect(bvobPurgeEvent.typePrecedingError)
        .toEqual("reform");
    expect(bvobPurgeEvent.isComposeSchism)
        .toBeTruthy();

    expect(mediaReformCause.message).toEqual("Not permitted");
    expect(mediaPurgeEvent.error.message)
        .toMatch(/Not permitted/);
    expect(mediaPurgeEvent.typePrecedingError)
        .toEqual("persist");

    resolveReformationDelay(true);
    harness.clockEvent(1, () => ["test.mediaProphecy.getPersistedStory()"]);
    let mediaStory;
    while (!mediaStory) {
      // FIXME(iridian, 2019-05): This is horrible. Async synchronization is pain.
      // This test produces "null truth when fulfilling prophecy" errors to the log .
      try {
        mediaStory = await mediaProphecy.getPersistedStory();
      } catch (error) {
        if (error.message !== "Heresy pending reformation") throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(testPartitionBackend._chroniclings.length)
        .toEqual(existingChroniclingCount + 1);
    // FIXME(iridian, 2019-05): This test and its underlying
    // implementation is partial. This test does not make sure that the
    // depending reformation gets run: in fact the bvob command remains
    // purged.
    expect(await media.extractValue())
    // This is expected but wrong in the big picture: bvob command
    // should be reformed along the media
        .toEqual(undefined);
  });

  it("doesn't fetch a media content from the stale lookups when updating content", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: {
        isRemoteAuthority: true, isLocallyPersisted: true, // as opposed to false of previous test
      } },
    });
    const undefinedMedia = await harness.runValoscript(vRef(testRootId), `
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

    const subscribeToContentUpdate = contentMedia => resolve => contentMedia
        .obtainSubscription("content")
        .addListenerCallback(harness, "test", liveUpdate => resolve({
          liveUpdate,
          bvobId: contentMedia.get("content"),
          content: contentMedia.interpretContent({ synchronous: true, contentType: "text/plain" }),
        }), false);
    const { contentMedia, createdProcess } = await harness.runValoscript(vRef(testRootId), `
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
      })`, { initialBuffer, console, subscribeToContentUpdate },
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
    expect(contentMedia.interpretContent({ synchronous: true, contentType: "text/plain" }))
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
        { updateBuffer, console, subscribeToContentUpdate },
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
    expect(undefinedMedia.interpretContent({ synchronous: true, contentType: "text/plain" }))
        .toEqual(updateContent);

    const { updateAgainBvob, modifiedAgainProcess } = await harness.runValoscript(
        contentMedia, // this time we update the contentMedia
        `this[valos.prepareBvob](updateBuffer).then(createBvob => ({
          modifiedAgainProcess: new Promise(subscribeToContentUpdate(this)),
          updateAgainBvob: (this.$V.content = createBvob()),
        }));`,
        { updateBuffer, console, subscribeToContentUpdate },
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
    expect(contentMedia.interpretContent({ synchronous: true, contentType: "text/plain" }))
        .toEqual(updateContent);
  });
});

describe("Two paired harnesses emulating two gateways connected through event streams", () => {
  it("passes a property value to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracle: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runValoscript(vRef(testRootId), `
      this.val = "yo";
    `)).toEqual("yo");

    await pairness.receiveTruthsFrom(harness);

    expect(pairness.runValoscript(vRef(testRootId), `
      this.val;
    `)).toEqual("yo");
  });

  it("passes a property reference to a newly created Entity to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracle: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runValoscript(vRef(testRootId), `
      this.thing = new Entity({ owner: this, name: "thingie", properties: { val: "yoyo" } });
      this.thing.$V.name;
    `)).toEqual("thingie");

    await pairness.receiveTruthsFrom(harness);

    expect(pairness.runValoscript(vRef(testRootId), `
      [this.thing.$V.name, this.thing.val];
    `)).toEqual(["thingie", "yoyo"]);
  });

  it("passes a complex property with a Resource reference to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracle: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runValoscript(vRef(testRootId), `
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

    expect(pairness.runValoscript(vRef(testRootId), `
      [
        this.lookup.things[0].$V.name, this.lookup.things[0].val, this.lookup.things[1],
      ];
    `)).toEqual(["thingie", "yoyo", undefined]);
  });

  it("passes a function inside property to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracle: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    const values = await harness.runValoscript(vRef(testRootId), `
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
    `, { console });
    expect(values.slice(0, -1))
        .toEqual([12, 12, 2, 16, 18, 18, -2, -18]);
    // expect(values[values.length - 1].call({ increment: 3 }))
    //    .toEqual(23); // this works but it's a pita to await for getComposedEvent
    await pairness.receiveTruthsFrom(harness, { verbosity: 0 });

    const pairedValues = await pairness.runValoscript(vRef(testRootId), `
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

    expect(await harness.runValoscript(vRef(testRootId), `this.obj.callbackEntity.result`))
        .toEqual(20);
  });

  it("activates an inactive vref properly", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracle: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    const newVRef = await harness.runValoscript(vRef(testRootId), `
      (new Entity({ owner: this, subResource: "@_:subEntity@@", properties: {
        thing: "the", over: "base",
      } })).$V.vref;
    `);
    expect(newVRef)
        .toEqual(`valaa-test:?id=${testRootId}#@$~raw:test_chronicle@_:subEntity@@`);

    const { target, instance, isActive, targetVRef } = await pairness.runValoscript(
        vRef(testRootId), `
      const newChronicle = new Entity({ authorityURI: "valaa-test:" });
      const relation = new Relation({ owner: newChronicle, target: valos.vrefer(newVRef) });
      const instance = new Entity({
        owner: newChronicle, instancePrototype: relation.$V.target,
        // properties: { over: "ridden" },
      });
      const target = relation.$V.target;
      ({ target, instance, isActive: valos.Resource.isActive(target), targetVRef: target.$V.vref });
    `, { newVRef });
    expect(isActive)
        .toEqual(false);
    expect(targetVRef)
        .toEqual(newVRef);
    expect(target.getPhase())
        .toEqual("Immaterial");
    expect(instance.getPhase())
        .toEqual("Activating");

    await pairness.receiveTruthsFrom(harness);

    expect(target.getPhase())
        .toEqual("Active");

    const { isNowActive, thing, over, ithing, itprop } = await pairness.runValoscript(target, `({
      isNowActive: valos.Resource.isActive(this),
      thing: this.thing,
      over: instance.over,
      ithing: instance.thing,
      itprop: instance.$V.properties[0],
    });
    `, { instance });
    const instanceId = instance.getRawId();
    expect(isNowActive)
        .toEqual(true);
    expect(thing)
        .toEqual("the");
    expect(over)
        .toEqual("base");
    expect(ithing)
        .toEqual("the");
    expect(target.getPhase())
        .toEqual("Active");
    expect(itprop.getRawId())
        .toEqual(`${instanceId.slice(0, -2)}@.:thing@@`);
  });
});

describe("Regressions", () => {
  it("returns $V.partitionURI for root, child, instance and ghosts properly", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const { rootURI, testURI, instanceURI, ghostURI } = harness.runValoscript(
        vRef(testRootId), `
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
    expect(rootURI).toEqual(String(harness.testChronicleURI));
    expect(testURI).toEqual(String(harness.testChronicleURI));
    expect(instanceURI).toEqual(String(harness.testChronicleURI));
    expect(ghostURI).toEqual(String(harness.testChronicleURI));
  });
});
