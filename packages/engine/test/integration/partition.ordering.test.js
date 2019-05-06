// @flow

import { createEngineOracleHarness } from "~/engine/test/EngineTestHarness";
import { clearAllScribeDatabases } from "~/prophet/test/SourcererTestHarness";

let harness = null;

async function setUp (testAuthorityConfig: Object = {}, options: {}) {
  harness = await createEngineOracleHarness({ verbosity: 0,
    oracle: { testAuthorityConfig },
    ...options,
  });
  const ret = {
    connection: await harness.sourcerer.acquireConnection(
        harness.testPartitionURI).asActiveConnection(),
    scribeConnection: await harness.scribe.acquireConnection(
        harness.testPartitionURI, { newConnection: false }).asActiveConnection(),
    oracleConnection: await harness.oracle.acquireConnection(
        harness.testPartitionURI, { newConnection: false }).asActiveConnection(),
  };
  ret.authorityConnection = ret.oracleConnection.getUpstreamConnection();
  return ret;
}

afterEach(async () => {
  if (harness) {
    await harness.cleanupScribe();
    harness = null;
  }
  await clearAllScribeDatabases(/* [testPartitionURI] */);
});

describe("Partition load ordering and inactive resource handling", () => {
  it("handles out-of-order new property creation for an immaterial ghost", async () => {
    // The test is a bit broken with "no events found when connecting":
    // this is not a bug of the payload source, but of arrangement of
    // this test.
    await setUp({ isRemoteAuthority: true, isLocallyPersisted: true }, { verbosity: 0 });
    let vLaterRoot;
    const creation = harness.engine.create("Entity",
        { partitionAuthorityURI: String(harness.testAuthorityURI) },
        { awaitResult (result, vRet) { vLaterRoot = vRet; return result.getPremiereStory(); } });
    const laterConnection = vLaterRoot.getConnection();
    harness.tryGetTestAuthorityConnection(laterConnection)
        .addNarrateResults({ eventIdBegin: 0 }, []);
    await creation;
    const { Prototype, component } = await harness.runValoscript(vLaterRoot, `
      const Prototype = new Entity({ owner: this });
      Prototype.c = new Entity({
        owner: Prototype, name: "component", properties: { p: "base" },
      });
      ({ Prototype, component: Prototype.c });
    `);
    expect(Prototype.get("owner"))
        .toEqual(vLaterRoot);
    expect(component.get("owner"))
        .toEqual(Prototype);
    const componentGhost = await harness.runValoscript(harness.createds.Entity.test_partition, `
      const instance = new Prototype({ owner: this });
      const componentGhost = instance.c;
      componentGhost.num = 10;
      componentGhost.child = new Entity({ owner: componentGhost, name: "child" });
      componentGhost;
    `, { scope: { Prototype }, awaitResult: (result) => result.getPremiereStory() });
    expect(componentGhost.propertyValue("num"))
        .toEqual(10);
    expect(componentGhost.get("prototype"))
        .toEqual(component);

    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });
    await pairness.sourcerer.acquireConnection(harness.testPartitionURI)
        .asActiveConnection();
    await pairness.receiveTruthsFrom(harness.testConnection, { verbosity: 0 });

    const pairedLaterConnection = pairness.sourcerer
        .acquireConnection(laterConnection.getPartitionURI());
    await pairness.receiveTruthsFrom(laterConnection, { verbosity: 0, asNarrateResults: true });
    await pairedLaterConnection.asActiveConnection();

    const componentId = componentGhost.getId();
    const pairedComponent = pairness.run(componentId, null);
    expect(componentId.rawId())
        .toEqual(pairedComponent.getId().rawId());
    expect(componentId !== pairedComponent.getId())
        .toBeTruthy();
    expect(pairness.runValoscript(pairedComponent, `
      this.num;
    `)).toEqual(10);
    // await pairness.sourcerer.acquireConnection(laterConnection.getPartitionURI())
    //    .asActiveConnection();
    /*

    await pairness.sourcerer.acquireConnection(harness.testPartitionURI);
    */
  });
});
