/* global describe expect it */

import { naiveURI } from "~/raem/ValaaURI";

import { testAuthorityURI, createEngineOracleHarness } from "~/engine/test/EngineTestHarness";

import { qualifiedSymbol } from "~/tools/namespace";

let harness: { createds: Object, engine: Object, sourcerer: Object, testEntities: Object };
let decepness: { createds: Object, engine: Object, sourcerer: Object, testEntities: Object };

const entities = () => harness.createds.Entity;
const decepEntities = () => decepness.createds.Entity;

const primeDirectorId = "@$~raw.director-prime@@";
const decepTributorId = "@$~raw.decep-tributor@@";
const impersonateeId = "@$~raw.impersona-tributor@@";

const primeDirectorURI = naiveURI.createChronicleURI(testAuthorityURI, primeDirectorId);
const decepTributorURI = naiveURI.createChronicleURI(testAuthorityURI, decepTributorId);
const impersonateeURI = naiveURI.createChronicleURI(testAuthorityURI, impersonateeId);

async function prepareHarnesses (sharedOptions) {
  harness = await createEngineOracleHarness({
    verbosity: 0, claimBaseBlock: true,
    oracle: { testAuthorityConfig: { isRemoteAuthority: true } },
    awaitResult: (result) => result.getComposedStory(),
    ...sharedOptions,
  });
  await harness.interceptErrors(async () => {
    await registerLocalTestUserIdentity(harness, primeDirectorId);

    decepness = await createEngineOracleHarness({
      pairedHarness: harness,
      verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: { isRemoteAuthority: true } },
      awaitResult: (result) => result.getComposedStory(),
      ...sharedOptions,
    });
    await registerLocalTestUserIdentity(decepness, decepTributorId);
  })();
}

async function registerLocalTestUserIdentity (targetHarness, publicIdentityId) {
  const identityRoot = await targetHarness.runValoscript(null, `
    const identityRoot = new Entity({
      id: "${publicIdentityId}",
      authorityURI: "${testAuthorityURI}",
    });
    valos.identity.add(identityRoot.$V.chronicleURI, {
      asContributor: {
      },
    });
    identityRoot;
  `, {}, {});
  return identityRoot.getChronicleURI();
}

afterEach(async () => {
  harness = null;
}); // eslint-disable-line no-undef

describe("Chronicle behaviors: VLog:requireAuthoredEvents", () => {
  function _createAuthoredOnlyChronicle () {
    return `
      const authoroot = this.authoroot = new Entity({
        authorityURI: "${testAuthorityURI}",
        name: "authored-only",
        properties: {
          [$VLog.requireAuthoredEvents]: true,
        },
      });

      new Relation({
        source: authoroot,
        structured: {
          name: $VLog.director,
          target: valos.identity.getPublicIdentityFor(authoroot),
        },
        properties: valos.identity.getContributorPropertiesFor(authoroot),
      });

      ({ authoroot, directors: authoroot.$V.getRelations($VLog.director) });
    `;
  }

  async function _sourcerDecepAuthoroot (authoroot) {
    expect((await decepness.receiveEventsFrom(harness.testChronicle)).length)
        .toEqual(2);

    const authorootConnection = await authoroot.getConnection().asSourceredConnection();
    const decepConnection = decepness.sourcerer
        .sourcerChronicle(authorootConnection.getChronicleURI());
    const authorootEvents = await decepness.receiveEventsFrom(authorootConnection);
    expect(authorootEvents.length)
        .toEqual(1);

    await decepConnection.asSourceredConnection();
    const decepAuthoroot = decepEntities().creator.propertyValue("authoroot");
    return { decepAuthoroot, authorootEvents };
  }

  xit("happily receives authored events", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot, directors } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), { console }, { verbosity: 0 });
    expect(authoroot.step("name"))
        .toEqual("authored-only");
    expect(authoroot.propertyValue(qualifiedSymbol("VLog", "requireAuthoredEvents")))
        .toEqual(true);
    expect(directors[0].step("target").getRawId())
        .toEqual(primeDirectorId);

    // Receive the events by another client harness

    const { decepAuthoroot, authorootEvents } = await _sourcerDecepAuthoroot(authoroot);

    expect(decepAuthoroot.getRawId())
        .toEqual(authoroot.getRawId());
    expect(decepAuthoroot)
        .not.toEqual(authoroot);
    expect(decepAuthoroot.step("name"))
        .toEqual("authored-only");

    expect(authorootEvents[0].aspects.author)
        .toMatchObject({});
  });

  xit("refuses to profess a non-authorable outgoing event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator
        .doValoscript(_createAuthoredOnlyChronicle(), {}, {});

    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot);

    expect(() => decepAuthoroot.doValoscript(`
      this.nonAuthoredNotRefused = true;
    `)).toThrow(/blrblrblr/);

    expect(decepAuthoroot.propertyValue("nonAuthoredNotRefused"))
        .toBeUndefined();
  });

  xit("freezes ie. seals a chronicle with SEALED on an authorized but invalid event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});

    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot);

    decepAuthoroot.doValoscript(`
      this.manuallyBrokenModification = true;`
    );

    expect(decepAuthoroot.propertyValue("manuallyBrokenModification"))
        .toEqual("true");

    // TODO(iridian, 2020-10): break the event

    expect((await harness.receiveEventsFrom(decepness, {})).length)
        .toEqual(1);

    expect(authoroot.propertyValue("manuallyBrokenModification"))
        .toBeUndefined();

    expect((await decepness.receiveEventsFrom(harness, {})).length)
        .toEqual(1);
    expect(decepAuthoroot.propertyValue("manuallyBrokenModification"))
        .toBeUndefined();
    expect((await decepAuthoroot.getConnection()).isFrozen())
        .toEqual(true);
  });

  xit("seals on an obnoxiously authorized but non-authored incoming event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});

    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot);

    // TODO(iridian, 2020-10): obnoxiously disable local authoring check

    expect(decepAuthoroot.doValoscript(`
      this.obnoxiouslyNonAuthored = true;
    `));

    expect(decepAuthoroot.propertyValue("obnoxiouslyNonAuthored"))
        .toEqual(true);

    expect((await harness.receiveEventsFrom(decepness, {})).length)
        .toEqual(1);
    expect(authoroot.propertyValue("obnoxiouslyNonAuthored"))
        .toBeUndefined();
    expect((await authoroot.getConnection()).isFrozen())
        .toEqual(true);

    expect((await decepness.receiveEventsFrom(harness, {})).length)
        .toEqual(1);
    expect(decepAuthoroot.propertyValue("obnoxiouslyNonAuthored"))
        .toBeUndefined();
    expect((await decepAuthoroot.getConnection()).isFrozen())
        .toEqual(true);
  });

  xit("seals on a deceptively authorized but incorrectly signed event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});

    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot);

    // TODO(iridian, 2020-10): impersonate director prime

    expect(() => decepAuthoroot.doValoscript(`
      this.incorrectlySigned = true;
    `));

    expect(decepAuthoroot.propertyValue("incorrectlySigned"))
        .toEqual(true);

    expect((await harness.receiveEventsFrom(decepness, {})).length)
        .toEqual(1);
    expect(authoroot.propertyValue("incorrectlySigned"))
        .toBeUndefined();
    expect((await authoroot.getConnection()).isFrozen())
        .toEqual(true);

    expect((await decepness.receiveEventsFrom(harness, {})).length)
        .toEqual(1);
    expect(decepAuthoroot.propertyValue("incorrectlySigned"))
        .toBeUndefined();
    expect((await decepAuthoroot.getConnection()).isFrozen())
        .toEqual(true);
  });

  function _addIdentityRoleRelation (publicIdentityURI, role = "$VLog.director", target = "this") {
    return `
      valos.sourcerIdentityMediator("${publicIdentityURI}")
      .then(identity => new Relation({
          source: ${target},
          structured: {
            name: ${role},
            target: identity.getPublicIdentityFor(${target}),
          },
          properties: identity.getContributorPropertiesFor(${target}),
      }))
    `;
  }

  xit("seals on a subversively authorized and authored yet forbidden privilege escalation event",
      async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});
    await authoroot.doValoscript(
        _addIdentityRoleRelation(decepTributorURI, "$VLog.contributor"), {}, {});

    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot);

    // TODO(iridian, 2020-10): disable local director validation on VLog property changes

    await decepAuthoroot.doValoscript(
        _addIdentityRoleRelation(decepTributorURI, "$VLog.director"), {}, {});

    expect(decepAuthoroot.propertyValue(qualifiedSymbol("VLog", "requireAuthoredEvents")))
        .toEqual(true);

    await decepAuthoroot.doValoscript(`
      this[$VLog.requireAuthoredEvents] = false;
    `, {}, {});

    expect(decepAuthoroot.propertyValue(qualifiedSymbol("VLog", "requireAuthoredEvents")))
        .toEqual(false);

    expect((await harness.receiveEventsFrom(decepness, {})).length)
        .toEqual(2);
    expect(authoroot.propertyValue(qualifiedSymbol("VLog", "requireAuthoredEvents")))
        .toEqual(true);
    expect((await authoroot.getConnection()).isFrozen())
        .toEqual(true);

    expect((await decepness.receiveEventsFrom(harness, {})).length)
        .toEqual(1);
    expect(decepAuthoroot.propertyValue(qualifiedSymbol("VLog", "requireAuthoredEvents")))
        .toEqual(true);
    expect((await decepAuthoroot.getConnection()).isFrozen())
        .toEqual(true);
  });

  xit("seals on an anachronistic crypto chain breaking event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});
    await authoroot.doValoscript(
        _addIdentityRoleRelation(decepTributorURI, "$VLog.director"), {}, {});

    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot);

    await decepAuthoroot.doValoscript(`
      this.hacked = 10;
    `, {}, {});
    await decepAuthoroot.doValoscript(`
      this.untouched = 20;
    `, {}, {});

    expect(decepAuthoroot.propertyValue("hacked"))
        .toEqual(10);
    expect(decepAuthoroot.propertyValue("untouched"))
        .toEqual(20);

    // TODO(iridian, 2020-10): hack the hacked value incl. the outgoing event chain hash

    expect((await harness.receiveEventsFrom(decepness, {})).length)
        .toEqual(2);
    expect(authoroot.propertyValue("hacked"))
        .toBeUndefined();
    expect(authoroot.propertyValue("untouched"))
        .toBeUndefined();
    expect((await authoroot.getConnection()).isFrozen())
        .toEqual(true);

    expect((await decepness.receiveEventsFrom(harness, {})).length)
        .toEqual(1);
    expect(decepAuthoroot.propertyValue("hacked"))
        .toBeUndefined();
    expect(decepAuthoroot.propertyValue("untouched"))
        .toBeUndefined();
    expect((await decepAuthoroot.getConnection()).isFrozen())
        .toEqual(true);
  });

  xit("seals on an impersonating authorized but incongruent contributor update event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});
    await authoroot.doValoscript(
        _addIdentityRoleRelation(decepTributorURI, "$VLog.director"), {}, {});

    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot);

    // TODO(iridian, 2020-10): bypass local contributor checks

    await decepAuthoroot.doValoscript(`
      Promise.all([
        valos.sourcerIdentityMediator("${impersonateeURI}"),
        valos.sourcerIdentityMediator("${decepTributorURI}")
      ]).then(([impersonateeMediator, decepMediator]) => new Relation({
        source: this,
        structured: {
          name: $VLog.contributor,
          target: impersonateeMediator.getPublicIdentityFor(this),
        },
        properties: decepMediator.getContributorPropertiesFor(this),
      }))
    `);

    await decepAuthoroot.doValoscript(`
      this.nonchalantFollowup = true;
    `);

    expect((await harness.receiveEventsFrom(decepness, {})).length)
        .toEqual(2);
    expect(authoroot.propertyValue("nonchalantFollowup"))
        .toBeUndefined();
    expect((await authoroot.getConnection()).isFrozen())
        .toEqual(true);

    expect((await decepness.receiveEventsFrom(harness, {})).length)
        .toEqual(1);
    expect(decepAuthoroot.propertyValue("nonchalantFollowup"))
        .toBeUndefined();
    expect((await decepAuthoroot.getConnection()).isFrozen())
        .toEqual(true);
  });
});
