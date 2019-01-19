/* global jest describe expect beforeEach it */

import { vRef } from "~/raem/ValaaReference";

import { createEngineTestHarness, createEngineOracleHarness }
    from "~/engine/test/EngineTestHarness";
import { clearAllScribeDatabases } from "~/prophet/test/ProphetTestHarness";

let harness: { createds: Object, engine: Object, prophet: Object, testEntities: Object };
afterEach(async () => {
  await clearAllScribeDatabases();
  harness = null;
}); // eslint-disable-line no-undef

describe("Two paired harnesses emulating two gateways connected through event streams", () => {
  it("passes a property value to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracleOptions: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runBody(vRef("test_partition"), `
      this.val = "yo";
    `)).toEqual("yo");

    await pairness.receiveTruthsFrom(harness);

    expect(pairness.runBody(vRef("test_partition"), `
      this.val;
    `)).toEqual("yo");
  });

  it("passes a property reference to a newly created Entity to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracleOptions: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runBody(vRef("test_partition"), `
      this.thing = new Entity({ owner: this, name: "thingie", properties: { val: "yoyo" } });
      this.thing.$V.name;
    `)).toEqual("thingie");

    await pairness.receiveTruthsFrom(harness);

    expect(pairness.runBody(vRef("test_partition"), `
      [this.thing.$V.name, this.thing.val];
    `)).toEqual(["thingie", "yoyo"]);
  });

  it("passes a complex property with a Resource reference to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracleOptions: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runBody(vRef("test_partition"), `
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

    expect(pairness.runBody(vRef("test_partition"), `
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

    const values = await harness.runBody(vRef("test_partition"), `
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

    const pairedValues = await pairness.runBody(vRef("test_partition"), `
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

    expect(await harness.runBody(vRef("test_partition"), `this.obj.callbackEntity.result`))
        .toEqual(20);
  });
});

describe("Regressions", () => {
  it("returns $V.partitionURI for root, child, instance and ghosts properly", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const { rootURI, testURI, instanceURI, ghostURI } = harness.runBody(vRef("test_partition"), `
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
