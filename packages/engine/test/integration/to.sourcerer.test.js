/* global describe expect it */

import { vRef } from "~/raem/VRL";
import { qualifiedSymbol, $ } from "~/tools/namespace";

import { testRootId, clearAllScribeDatabases } from "~/sourcerer/test/SourcererTestHarness";

import { createEngineTestHarness, createEngineOracleHarness }
    from "~/engine/test/EngineTestHarness";

import { arrayBufferFromUTF8String } from "~/security/textEncoding";

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
const exampleContentId = `@$~bvob.${exampleContentHash}@@`;

describe("Media handling", () => {
  it("does an async prepareBvob for non-locally persisted Media content", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: {
        isRemoteAuthority: true, isLocallyRecorded: false,
      } },
      awaitResult: (result) => result.getComposedStory(),
    });
    const testConnectionBackend = harness.tryGetTestAuthorityConnection(harness.testChronicle);
    const existingProclamationCount = testConnectionBackend._proclamations.length;
    const vTestRoot = entities()[testRootId];
    const { media, contentUpdateStarted } = await harness.runValoscript(vTestRoot, `
      const media = new Media({
        name: "text media", owner: this, mediaType: { type: "text", subtype: "plain" },
      });
      const contentUpdateStarted = media[valos.prepareBvob](exampleBuffer)
          .then(createBvob => ({ bvobId: (media[valos.Media.content] = createBvob()) }));
      this.text = media;
      ({ media, contentUpdateStarted });
    `, { exampleBuffer, console }, { awaitResult: (result) => result.getComposedEvent() });
    const vMedias = vTestRoot.step(["§.", "medias"]);
    const vEntities = vTestRoot.step(["§.", "entities"]);
    expect(vMedias.length)
        .toEqual(1);
    expect(vMedias.length + vEntities.length)
        .toEqual(vTestRoot.step(["§.", "unnamedOwnlings"]).length);
    expect(media.getVRef().toJSON())
        .toEqual(vTestRoot.step(["§..", "text"]).getVRef().toJSON());
    expect(vMedias[0].getVRef().toJSON())
        .toEqual(media.getVRef().toJSON());
    expect(testConnectionBackend.getPreparation(exampleContentHash))
        .toBeTruthy();
    expect(media.step("content"))
        .toBeFalsy();
    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 1);
    testConnectionBackend.addPrepareBvobResult({ contentHash: exampleContentHash });
    const { bvobId } = await contentUpdateStarted;
    expect(bvobId.getVRef().rawId())
        .toEqual(exampleContentId);
    expect(bvobId.getVRef().toJSON())
        .toEqual(media.step("content").getVRef().toJSON());
    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 2);

    await expect(media.extractValue()).rejects
        .toThrow(/content not found in local cache/);
  });

  it("does an async prepareBvob for locally persisted Media content", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: {
        isRemoteAuthority: true, isLocallyRecorded: true, // as opposed to false of previous test
      } },
    });
    const testConnectionBackend = harness.tryGetTestAuthorityConnection(harness.testChronicle);
    const existingProclamationCount = testConnectionBackend._proclamations.length;
    const { media, contentUpdateStarted, newMediaPersist } = await harness.runValoscript(
        vRef(testRootId), `
      const media = new Media({
        name: "text media", owner: this, mediaType: { type: "text", subtype: "plain" },
      });
      const contentUpdateStarted = media[valos.prepareBvob](exampleBuffer)
          .then(createBvob => ({
            bvobId: (media[valos.Media.content] = createBvob()),
            bvobComposed: new Promise(resolve =>
                valos.getTransactor().addEventListener("profess", resolve)),
            bvobRecorded: new Promise(resolve =>
                valos.getTransactor().addEventListener("record", resolve)),
          }));
      this.text = media;
      ({
        media, contentUpdateStarted,
        newMediaPersist: new Promise(resolve => (valos.getTransactor().onrecord = resolve)),
      });
    `, { exampleBuffer, console });
    await newMediaPersist;
    expect(media.getVRef().toJSON())
        .toEqual(entities()[testRootId].step(["§..", "text"]).getVRef().toJSON());
    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 1);
    // local bvob persisted internally but not remotely
    const { bvobId, bvobComposed, bvobRecorded } = await contentUpdateStarted;
    expect(bvobId.getVRef().rawId())
        .toEqual(exampleContentId);
    expect(bvobId.getVRef().toJSON())
        .toEqual(media.step("content").getVRef().toJSON());
    const bvobComposedEvent = await bvobComposed;

    expect(await media.extractValue())
        .toEqual(exampleContent);

    expect(bvobComposedEvent.command.actions.length).toEqual(2);
    testConnectionBackend.addPrepareBvobResult({ contentHash: exampleContentHash });
    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 1);
    await bvobRecorded;
    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 2);

    expect(await media.extractValue())
        .toEqual(exampleContent);
  });

  it("rejects async prepareBvob command recomposition after Media command is purged", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: { isRemoteAuthority: true, isLocallyRecorded: true } },
      awaitResult: (result) => result.getRecordedStory(),
    });
    const plog = harness.opLog(1, "test_purge-recompose", "Harness created");
    const testConnectionBackend = harness.tryGetTestAuthorityConnection(harness.testChronicle);
    const existingProclamationCount = testConnectionBackend._proclamations.length;
    let reformCause;
    const onReform = e => { reformCause = e.error; e.preventDefault(); };
    plog && plog.opEvent("await_runValoscript");
    const { media, contentUpdateStarted, newMediaPersist } = await harness.runValoscript(
        vRef(testRootId), `
      const media = new Media({
        name: "text media", owner: this, mediaType: { type: "text", subtype: "plain" },
      });
      const contentUpdateStarted = media[valos.prepareBvob](exampleBuffer)
          .then(createBvob => ({
            bvobId: (media[valos.Media.content] = createBvob()),
            bvobRecorded: new Promise(resolve =>
                valos.getTransactor().addEventListener("record", resolve)),
            bvobPurged: new Promise(resolve =>
                valos.getTransactor().addEventListener("reform", resolve)),
          }));
      this.text = media;
      valos.getTransactor().addEventListener("reform", onReform);
      ({
        media, contentUpdateStarted,
        newMediaPersist: new Promise(resolve => (valos.getTransactor().onrecord = resolve)),
      });
    `,
        { exampleBuffer, console, onReform },
        { awaitResult: (result) => result.getComposedEvent() });
    plog && plog.opEvent("await_newMediaPersist");
    await newMediaPersist;
    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 1);
    plog && plog.opEvent("await_contentUpdateStarted");
    const { bvobRecorded, bvobPurged } = await contentUpdateStarted;
    testConnectionBackend.addPrepareBvobResult({ contentHash: exampleContentHash });
    plog && plog.opEvent("await_bvobRecorded");
    await bvobRecorded;

    expect(await media.extractValue())
        .toEqual(exampleContent);

    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 2);
    testConnectionBackend._proclamations.splice(existingProclamationCount, 2)[0]
        .rejectTruthEvent(Object.assign(
            new Error("Not permitted"), { isRevisable: false, isReformable: true }));
    plog && plog.opEvent("await_bvobPurged");
    const purgeEvent = await bvobPurged;
    plog && plog.opEvent("bvobPurged", "Purged bvob:", purgeEvent);
    expect(purgeEvent.error.message)
        .toMatch(/Media does not exist/);
    expect(purgeEvent.errorAct)
        .toEqual("compose");
    expect(reformCause.message)
        .toMatch(/Not permitted/);

    expect(() => media.extractValue())
        .toThrow(/Cannot operate on a non-Created/);
  });

  it("does not reform nor reproclaim when only non-schismatic errors are thrown", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: { isRemoteAuthority: true, isLocallyRecorded: true } },
      awaitResult: (result) => result.getRecordedStory(),
    });
    const plog = harness.opLog(1, "test_no-reform-non-schism");
    const testConnectionBackend = harness.tryGetTestAuthorityConnection(harness.testChronicle);
    const existingProclamationCount = testConnectionBackend._proclamations.length;
    let reformCause;
    const onReform = e => { reformCause = e.error; e.preventDefault(); };
    plog && plog.opEvent("await_runValoscript");
    const { media, contentUpdateStarted, newMediaPersist, newMediaError } =
        await harness.runValoscript(vRef(testRootId), `
      const media = new Media({
        name: "text media", owner: this, mediaType: { type: "text", subtype: "plain" },
      });
      const contentUpdateStarted = media[valos.prepareBvob](exampleBuffer)
          .then(createBvob => ({
            bvobId: (media[valos.Media.content] = createBvob()),
            bvobRecorded: new Promise(resolve =>
                valos.getTransactor().addEventListener("record", resolve)),
          }));
      this.text = media;
      valos.getTransactor().addEventListener("reform", onReform);
      ({
        media, contentUpdateStarted,
        newMediaPersist: new Promise(resolve => valos.getTransactor()
            .addEventListener("record", resolve)),
        newMediaError: new Promise(resolve => valos.getTransactor()
            .addEventListener("error", resolve)),
      });`,
        { exampleBuffer, console, onReform },
        { awaitResult: (result) => result.getComposedEvent() });
    plog && plog.opEvent("await_newMediaPersist");
    await newMediaPersist;
    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 1);
    plog && plog.opEvent("await_contentUpdateStarated");
    const { bvobRecorded } = await contentUpdateStarted;
    testConnectionBackend.addPrepareBvobResult({ contentHash: exampleContentHash });
    plog && plog.opEvent("await_bvobRecorded");
    await bvobRecorded;

    expect(await media.extractValue())
        .toEqual(exampleContent);

    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 2);
    testConnectionBackend._proclamations.splice(existingProclamationCount, 2)[0]
        .rejectTruthEvent(Object.assign(
            new Error("Connection lost"), { isSchismatic: false }));
    plog && plog.opEvent("await_newMediaError");
    const errorEvent = await newMediaError;
    expect(errorEvent.error.message)
        .toMatch(/Connection lost/);
    expect(errorEvent.errorAct)
        .toEqual("profess");
    expect(reformCause)
        .toEqual(undefined);

    expect(await media.extractValue())
        .toEqual(exampleContent);
  });

  it("delays a depending reformation when dependent reformation is delayed", async () => {
    // this test is broken. The delay-of-depending does not in fact happen
    // and bvobPurged gets calle when it shouldn't.
    harness = await createEngineOracleHarness({ verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: { isRemoteAuthority: true, isLocallyRecorded: true } },
      awaitResult: (result) => result.getRecordedStory(),
    });
    const plog = harness.opLog(1, "test_delay-depending", "Harness created");
    const buffer = arrayBufferFromUTF8String("example content");
    const contentHash = contentHashFromArrayBuffer(buffer);
    const testConnectionBackend = harness.tryGetTestAuthorityConnection(harness.testChronicle);
    const existingProclamationCount = testConnectionBackend._proclamations.length;
    let mediaProphecy, mediaPurgeEvent, mediaReformCause;
    let resolveReformationDelay;
    const onReform = e => {
      mediaReformCause = e.error;
      e.reformAfterAll(resolve => { resolveReformationDelay = resolve; });
    };
    const onPurge = e => (mediaPurgeEvent = e);
    plog && plog.opEvent("await_runValoscript");
    const { media, contentUpdateStarted, newMediaPersist } = await harness.runValoscript(
        vRef(testRootId), `
      const media = new Media({
        name: "text media", owner: this, mediaType: { type: "text", subtype: "plain" },
      });
      const contentUpdateStarted = media[valos.prepareBvob](buffer)
          .then(createBvob => ({
            bvobId: (media[valos.Media.content] = createBvob()),
            bvobRecorded: new Promise(resolve =>
                valos.getTransactor().addEventListener("record", resolve)),
            bvobPurged: new Promise(resolve =>
                valos.getTransactor().addEventListener("purge", resolve)),
            bvobPurged: new Promise(resolve =>
                valos.getTransactor().addEventListener("purge", resolve)),
          }));
      this.text = media;
      valos.getTransactor().addEventListener("reform", onReform);
      valos.getTransactor().addEventListener("purge", onPurge);
      ({
        media, contentUpdateStarted,
        newMediaPersist: new Promise(resolve => (valos.getTransactor().onrecord = resolve)),
      });`,
        { buffer, console, onReform, onPurge },
        { awaitResult: (result) => (mediaProphecy = result).getComposedEvent() });
    plog && plog.opEvent("await_newMediaPersist");
    await newMediaPersist;
    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 1);
    plog && plog.opEvent("await_contentUpdateStarted");
        const { bvobRecorded, bvobPurged } = await contentUpdateStarted;
    testConnectionBackend.addPrepareBvobResult({ contentHash });
    plog && plog.opEvent("await_bvobRecorded");
    await bvobRecorded;
    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 2);
    testConnectionBackend._proclamations.splice(existingProclamationCount, 2)[0]
        .rejectTruthEvent(Object.assign(new Error("Not permitted"),
            { isRevisable: false, isReformable: true }));
    plog && plog.opEvent("await_bvobPurged");
    const bvobPurgeEvent = await bvobPurged;
    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount);
    expect(bvobPurgeEvent.error.message)
        .toMatch(/Media does not exist/);
    expect(bvobPurgeEvent.errorAct)
        .toEqual("compose");

    expect(mediaReformCause.message)
        .toMatch(/Not permitted/);

    resolveReformationDelay();
    plog && plog.opEvent("await_mediaProphecy.getRecordedStory");
    let mediaStory;
    while (!mediaStory) {
      // FIXME(iridian, 2019-05): This is horrible. Async synchronization is pain.
      // This test produces "null truth when fulfilling prophecy" errors to the log .
      try {
        mediaStory = await mediaProphecy.getRecordedStory();
      } catch (error) {
        if (error.message !== "Heresy pending reformation") throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(mediaPurgeEvent)
        .toEqual(undefined);
    expect(testConnectionBackend._proclamations.length)
        .toEqual(existingProclamationCount + 1);
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
        isRemoteAuthority: true, isLocallyRecorded: true, // as opposed to false of previous test
      } },
    });
    const undefinedMedia = await harness.runValoscript(vRef(testRootId), `
      new Media({
        name: "undefined_text_media",
        owner: this,
        mediaType: { type: "application", subtype: "octet-stream" },
      })`, {},
    );
    expect(undefinedMedia.step("content"))
        .toBeNull();
    expect(undefinedMedia.interpretContent({ synchronous: true }))
        .toBeUndefined();

    const initialContent = "initial content";
    const initialBuffer = arrayBufferFromUTF8String(initialContent);
    const initialContentHash = contentHashFromArrayBuffer(initialBuffer);
    const initialContentId = `@$~bvob.${initialContentHash}@@`;

    const subscribeToContentUpdate = contentMedia => resolve => contentMedia
        .obtainSubscription("content")
        .addListenerCallback(harness, "test", liveUpdate => resolve({
          liveUpdate,
          bvobId: contentMedia.step("content"),
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
        .toEqual(initialContentId);
    expect(createdUpdate.bvobId.getRawId())
        .toEqual(initialContentId);
    expect(createdUpdate.content)
        .toEqual(initialContent);

    expect(contentMedia.step("content").getRawId())
        .toEqual(initialContentId);
    expect(contentMedia.interpretContent({ synchronous: true, contentType: "text/plain" }))
        .toEqual(initialContent);

    const updateContent = "update content";
    const updateBuffer = arrayBufferFromUTF8String(updateContent);
    const updateContentHash = contentHashFromArrayBuffer(updateBuffer);
    const updateContentId = `@$~bvob.${updateContentHash}@@`;

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
        .toEqual(updateContentId);

    expect(modifiedUpdate.liveUpdate.value().getRawId())
        .toEqual(updateContentId);
    expect(modifiedUpdate.bvobId.getRawId())
        .toEqual(updateContentId);
    expect(modifiedUpdate.content)
        .toEqual(updateContent);

    expect(undefinedMedia.step("content").getRawId())
        .toEqual(updateContentId);
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
        .toEqual(updateContentId);

    expect(modifiedAgainUpdate.liveUpdate.value().getRawId())
        .toEqual(updateContentId);
    expect(modifiedAgainUpdate.bvobId.getRawId())
        .toEqual(updateContentId);
    expect(modifiedAgainUpdate.content)
        .toEqual(updateContent);

    expect(contentMedia.step("content").getRawId())
        .toEqual(updateContentId);
    expect(contentMedia.interpretContent({ synchronous: true, contentType: "text/plain" }))
        .toEqual(updateContent);
  });
});

describe("Two paired harnesses emulating two gateways connected through event streams", () => {
  it("passes a property value to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracle: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyRecorded: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runValoscript(vRef(testRootId), `
      this.val = "yo";
    `)).toEqual("yo");

    expect((await pairness.receiveEventsFrom(harness)).length)
        .toEqual(1);

    expect(pairness.runValoscript(vRef(testRootId), `
      this.val;
    `)).toEqual("yo");
  });

  it("passes a property reference to a newly created Entity to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracle: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyRecorded: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runValoscript(vRef(testRootId), `
      this.thing = new Entity({ owner: this, name: "thingie",
        properties: { val: "yoyo", "@$foo.bar@@": "oyoy" },
      });
      this.thing.$V.name;
    `)).toEqual("thingie");

    expect((await pairness.receiveEventsFrom(harness)).length)
        .toEqual(1);

    const [thing, names] = pairness.runValoscript(vRef(testRootId), `
      ([this.thing, [this.thing.$V.name, this.thing.val, this.thing[$\`foo:bar\`]]]);
    `, { console }, { verbosity: 0 });

    expect(names)
        .toEqual(["thingie", "yoyo", "oyoy"]);
    expect(thing.getValospaceScope()[qualifiedSymbol("foo", "bar")].getVRef().vrid())
        .toEqual(thing.getVRef().getSubRef("@.$foo.bar").vrid());
    expect(thing.getValospaceScope()["@$foo.bar@@"].getVRef().vrid())
        .toEqual(thing.getVRef().getSubRef("@.$foo.bar").vrid());
    expect(thing.propertyValue("@$foo.bar@@"))
        .toEqual("oyoy");
    expect(thing.propertyValue($`foo:bar`))
        .toEqual("oyoy");
  });

  it("passes a complex property with a Resource reference to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracle: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyRecorded: true },
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

    expect((await pairness.receiveEventsFrom(harness, { verbosity: 0 })).length)
        .toEqual(1);

    expect(pairness.runValoscript(vRef(testRootId), `
      [
        this.lookup.things[0].$V.name, this.lookup.things[0].val, this.lookup.things[1],
      ];
    `)).toEqual(["thingie", "yoyo", undefined]);
  });

  it("passes a function inside property to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracle: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyRecorded: true },
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
    expect((await pairness.receiveEventsFrom(harness, { verbosity: 0 })).length)
        .toEqual(1);

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

    expect((await harness.receiveEventsFrom(harness, { clearUpstreamEntries: true })).length)
        .toEqual(1);
    expect((await harness.receiveEventsFrom(pairness, { clearUpstreamEntries: true })).length)
        .toEqual(1);

    expect(await harness.runValoscript(vRef(testRootId), `this.obj.callbackEntity.result`))
        .toEqual(20);
  });

  it("activates an absent vref properly", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracle: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyRecorded: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 1, pairedHarness: harness });

    const { newVRef, nonExistent } = await harness.runValoscript(vRef(testRootId), `
      const subEntity = new Entity({ owner: this, fixed: { name: "subEntity" }, properties: {
        thing: "the", over: "base",
        nonExistent: valos.refer("valaa-test:?id=@$~raw.nonexistent@@#@$~raw.nonexistent@@"),
      } });
      ({ newVRef: subEntity.$V.vref, nonExistent: subEntity.nonExistent })
    `);
    expect(newVRef)
        .toEqual(`valaa-test:?id=${testRootId}#@$~raw.test_chronicle@*$.subEntity@@`);

    const {
      target, prop, areEqual, instance, isActive, targetVRef, propVRef,
    } = await pairness.runValoscript(
        vRef(testRootId), `
      const newChronicle = new Entity({
        authorityURI: "valaa-test:",
        properties: { prop: valos.refer(newVRef) },
      });
      const prop = newChronicle.prop;
      const relation = new Relation({ owner: newChronicle, target: valos.refer(newVRef) });
      const areEqual = (prop === relation.$V.target);
      const instance = new Entity({
        owner: newChronicle, instancePrototype: relation.$V.target,
        // properties: { over: "ridden" },
      });
      const target = relation.$V.target;
      ({
        target, prop, areEqual,
        instance, isActive: valos.Resource.isActive(target),
        targetVRef: target.$V.vref, propVRef: prop.$V.vref,
      });
    `, { newVRef });
    expect(isActive)
        .toEqual(false);
    expect(areEqual)
        .toEqual(true);
    expect(targetVRef)
        .toEqual(newVRef);
    expect(propVRef)
        .toEqual(newVRef);
    expect(prop)
        .toEqual(target);
    expect(target.getPhase())
        .toEqual("Immaterial");
    expect(instance.getPhase())
        .toEqual("Activating");

    expect((await pairness.receiveEventsFrom(harness, { verbosity: 0 })).length)
        .toEqual(1);

    expect(target.getPhase())
        .toEqual("Active");

    const { isNowActive, thing, over, ithing, itprop, pairedNonExistent } =
        await pairness.runValoscript(target, `({
      isNowActive: valos.Resource.isActive(this),
      thing: this.thing,
      over: instance.over,
      ithing: instance.thing,
      itprop: instance.$V.properties[0],
      pairedNonExistent: instance.nonExistent,
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
        .toEqual(`${instanceId.slice(0, -2)}@.$.thing@@`);
    expect(nonExistent.getRawId())
        .toEqual(pairedNonExistent.getRawId());
  });
  it("copies valaa-test property object values on assignment", async () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const {
      val, mem1, snapval, mem2, valself, equivalences,
    } = await harness.runValoscript(vRef(testRootId), `
      const val = { num: 10, nest: { sharednum: 20 }, self: this };
      val.self = this;
      val.nest.sharednum = ++(val.num);
      val.nest.ownnum = ++(val.num);
      const mem1 = new Entity({ authorityURI: "valaa-test:", properties: { val } });
      const snapval = mem1.val;
      snapval.self = mem1;
      val.nest.sharednum = snapval.num++;
      snapval.nest.ownnum = ++(val.num);
      const mem2 = new Entity({ authorityURI: "valaa-test:" });
      mem2.val = snapval;
      mem2.val.self = mem2;
      val.nest.sharednum = mem2.val.num++;
      mem2.val.nest.ownnum = ++(val.num);
      ({
        val, mem1, snapval, mem2, valself: val.self,
        equivalences: [mem1.val, snapval, mem2.val].map(e => (e === val)),
      });
    `);
    const mem1val = mem1.propertyValue("val");
    const mem2val = mem2.propertyValue("val");
    expect(equivalences)
        .toEqual([false, false, false]);
    expect([mem1val, snapval, mem2val].map(e => (e === val)))
        .toEqual([false, false, false]);
    expect(val)
        .toMatchObject({ num: 14, nest: { sharednum: 14, ownnum: 12 } });
    expect(val.self.getVRef().vrid())
        .toBe(testRootId);
    expect(valself.getVRef().vrid())
        .toBe(testRootId);
    expect(mem1val)
        .not.toBe(val);
    expect(mem1val)
        .toMatchObject({ num: 12, nest: { sharednum: 11, ownnum: 12 } });
    expect(mem1val.self.getVRef().vrid())
        .toBe(testRootId);
    expect(snapval)
        .not.toBe(mem1val);
    expect(snapval)
        .toMatchObject({ num: 13, nest: { sharednum: 11, ownnum: 13 } });
    expect(snapval.self)
        .toBe(mem1);
    // mem2val does not get updated by the last statements
    expect(mem2val)
        .toEqual(snapval); // so equal to snapval in content...
    expect(mem2val)
        .not.toBe(snapval); // ...but not in identity
    expect(mem2val)
        .toMatchObject({ num: 13, nest: { sharednum: 11, ownnum: 13 } });
    expect(mem2val.self)
        .toBe(mem1);
  });
  it("shares valaa-memory property object values", async () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const {
      val, mem1, snapval, mem2, valself, equivalences,
    } = await harness.runValoscript(vRef(testRootId), `
      const val = { num: 10, nest: { sharednum: 20 }, self: this };
      val.self = this;
      val.nest.sharednum = ++(val.num);
      val.nest.ownnum = ++(val.num);
      const mem1 = new Entity({ authorityURI: "valaa-memory:", properties: { val } });
      const snapval = mem1.val;
      snapval.self = mem1;
      val.nest.sharednum = snapval.num++;
      snapval.nest.ownnum = ++(val.num);
      const mem2 = new Entity({ authorityURI: "valaa-memory:" });
      mem2.val = snapval;
      mem2.val.self = mem2;
      val.nest.sharednum = mem2.val.num++;
      mem2.val.nest.ownnum = ++(val.num);
      ({
        val, mem1, snapval, mem2, valself: val.self,
        equivalences: [mem1.val, snapval, mem2.val].map(e => (e === val)),
      });
    `);
    const mem1val = mem1.propertyValue("val");
    const mem2val = mem2.propertyValue("val");
    expect(equivalences)
        .toEqual([true, true, true]);
    expect([mem1val, snapval, mem2val].map(e => (e === val)))
        .toEqual([true, true, true]);
    expect(val)
        .toMatchObject({ num: 16, nest: { sharednum: 15, ownnum: 16 } });
    expect(val.self)
        .toBe(mem2);
    expect(valself)
        .toBe(mem2);
  });
});

describe("Regressions", () => {
  it("returns $V.chronicleURI for root, child, instance and ghosts properly", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const { rootURI, testURI, instanceURI, ghostURI } = harness.runValoscript(
        vRef(testRootId), `
      const rootURI = this.$V.chronicleURI;
      const test = this.$V.unnamedOwnlings.find(e => (e.$V.name === "testName"));
      const instance = this.$V.unnamedOwnlings.find(e => (e.$V.name === "testInstance"));
      const ghost = instance.$V.unnamedOwnlings.find(e => (e.$V.name === "ownlingCreator"));
      ({
        rootURI: this.$V.chronicleURI,
        testURI: test.$V.chronicleURI,
        instanceURI: instance.$V.chronicleURI,
        ghostURI: ghost.$V.chronicleURI,
      });
    `);
    expect(rootURI).toEqual(String(harness.testChronicleURI));
    expect(testURI).toEqual(String(harness.testChronicleURI));
    expect(instanceURI).toEqual(String(harness.testChronicleURI));
    expect(ghostURI).toEqual(String(harness.testChronicleURI));
  });
});
