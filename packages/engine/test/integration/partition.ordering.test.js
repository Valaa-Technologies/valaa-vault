// @flow

import { createEngineOracleHarness } from "~/engine/test/EngineTestHarness";
import { testRootId, clearAllScribeDatabases } from "~/sourcerer/test/SourcererTestHarness";

let harness = null;

async function setUp (testAuthorityConfig: Object = {}, options: {}) {
  harness = await createEngineOracleHarness({ verbosity: 0,
    oracle: { testAuthorityConfig },
    ...options,
  });
  const ret = {
    connection: await harness.sourcerer.sourcerChronicle(
        harness.testChronicleURI).asSourceredConnection(),
    scribeConnection: await harness.scribe.sourcerChronicle(
        harness.testChronicleURI, { newConnection: false }).asSourceredConnection(),
    oracleConnection: await harness.oracle.sourcerChronicle(
        harness.testChronicleURI, { newConnection: false }).asSourceredConnection(),
  };
  ret.authorityConnection = ret.oracleConnection.getUpstreamConnection();
  return ret;
}

afterEach(async () => {
  if (harness) {
    await harness.cleanupScribe();
    harness = null;
  }
  await clearAllScribeDatabases(/* [testChronicleURI] */);
});

describe("Chronicle load ordering and inactive resource handling", () => {
  it("handles out-of-order new property creation for an immaterial ghost", async () => {
    // The test is a bit broken with "no events found when connecting":
    // this is not a bug of the payload source, but of arrangement of
    // this test.
    await setUp({ isRemoteAuthority: true, isLocallyRecorded: true }, { verbosity: 0 });
    let vLaterRoot;
    // Create a prototype to a separate chronicle
    const creation = harness.engine.create("Entity",
        { authorityURI: String(harness.testAuthorityURI) },
        { awaitResult (result, vRet) { vLaterRoot = vRet; return result.getPremiereStory(); } });
    const baseChronicle = vLaterRoot.getConnection();
    harness.tryGetTestAuthorityConnection(baseChronicle)
        .addNarrateResults({ eventIdBegin: 0 }, []);
    await creation;
    const { Prototype, component } = await harness.runValoscript(vLaterRoot, `
      const Prototype = new Entity({ owner: this });
      Prototype.c = new Entity({
        owner: Prototype, name: "component", properties: { p: "base" },
      });
      ({ Prototype, component: Prototype.c });
    `);
    expect(Prototype.step("owner"))
        .toEqual(vLaterRoot);
    expect(component.step("owner"))
        .toEqual(Prototype);
    // Create a instance to the primary test chronicle
    const componentGhost = await harness.runValoscript(harness.createds.Entity[testRootId], `
      const instance = new Prototype({ owner: this });
      const componentGhost = instance.c;
      componentGhost.num = 10;
      componentGhost.child = new Entity({ owner: componentGhost, name: "child" });
      componentGhost;
    `, { Prototype }, { awaitResult: (result) => result.getPremiereStory() });
    expect(componentGhost.propertyValue("num"))
        .toEqual(10);
    expect(componentGhost.step("prototype"))
        .toEqual(component);

    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });
    await pairness.sourcerer.sourcerChronicle(harness.testChronicleURI)
        .asSourceredConnection();
    expect((await pairness.receiveEventsFrom(harness.testChronicle, { verbosity: 0 })).length)
        .toEqual(1);

    const pairedBaseConnection = pairness.sourcerer
        .sourcerChronicle(baseChronicle.getChronicleURI());
    expect((await pairness
            .receiveEventsFrom(baseChronicle, { verbosity: 0, asNarrateResults: true })).length)
        .toEqual(2);
    await pairedBaseConnection.asSourceredConnection();

    const componentId = componentGhost.getVRef();
    const pairedComponent = pairness.run(componentId, null);
    expect(componentId.rawId())
        .toEqual(pairedComponent.getVRef().rawId());
    expect(componentId !== pairedComponent.getVRef())
        .toBeTruthy();
    expect(pairness.runValoscript(pairedComponent, `
      this.num;
    `, { verbosity: 0 })).toEqual(10);
    // await pairness.sourcerer.sourcerChronicle(baseChronicle.getChronicleURI())
    //    .asSourceredConnection();
    /*

    await pairness.sourcerer.sourcerChronicle(harness.testChronicleURI);
    */
  });
});
