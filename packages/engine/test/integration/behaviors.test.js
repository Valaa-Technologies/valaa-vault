/* global describe expect it */

import { verifyVPlotSignature } from "~/security/signatures";

import { naiveURI } from "~/raem/ValaaURI";

import { getAspect, swapAspectRoot } from "~/sourcerer/tools/EventAspects";
import IdentityMediator from "~/sourcerer/FalseProphet/IdentityMediator";

import { testAuthorityURI, createEngineOracleHarness } from "~/engine/test/EngineTestHarness";

import { qualifiedSymbol } from "~/tools/namespace";

let harness: { createds: Object, engine: Object, sourcerer: Object, testEntities: Object };
let decepness: { createds: Object, engine: Object, sourcerer: Object, testEntities: Object };

const entities = () => harness.createds.Entity;
const decepEntities = () => decepness.createds.Entity;

const primeDirectorId = "@$~raw.director-prime@@";
const decepTributorId = "@$~raw.decep-tributor@@";

const primeDirectorURI = naiveURI.createChronicleURI(testAuthorityURI, primeDirectorId);
const decepTributorURI = naiveURI.createChronicleURI(testAuthorityURI, decepTributorId);

async function prepareHarnesses (sharedOptions) {
  harness = await createEngineOracleHarness({
    name: "prime",
    verbosity: 0, claimBaseBlock: true,
    oracle: { testAuthorityConfig: { isRemoteAuthority: true } },
    awaitResult: (result) => result.getComposedStory(),
    ...sharedOptions,
  });
  await harness.interceptErrors(async () => {
    await registerLocalTestUserIdentity(harness, primeDirectorId);

    decepness = await createEngineOracleHarness({
      name: "decep",
      pairedHarness: harness,
      verbosity: 0, claimBaseBlock: true,
      oracle: { testAuthorityConfig: { isRemoteAuthority: true } },
      awaitResult: (result) => result.getComposedStory(),
      ...sharedOptions,
    });
    await registerLocalTestUserIdentity(decepness, decepTributorId);
  })();
}

const signatureKeys = {};

async function registerLocalTestUserIdentity (targetHarness, publicIdentityId) {
  const { identityRoot, publicKey, secretKey } = await targetHarness.runValoscript(null, `
    const keys = valos.identity.createAuthorKeys(seed);
    const publicKey = keys.publicKey, secretKey = keys.secretKey;
    const identityRoot = new Entity({
      id: "${publicIdentityId}",
      authorityURI: "${testAuthorityURI}",
      properties: { asContributor: { publicKey } },
    });
    valos.identity.add(identityRoot, { secretKey, asContributor: { publicKey } });
    ({ identityRoot, publicKey, secretKey });
  `, { seed: publicIdentityId }, {});
  signatureKeys[publicIdentityId] = { publicKey, secretKey };
  signatureKeys[identityRoot.getChronicleURI()] = { publicKey, secretKey };
  return identityRoot.getChronicleURI();
}

afterEach(async () => {
  harness = null;
}); // eslint-disable-line no-undef

describe("Chronicle behaviors: VChronicle:requireAuthoredEvents", () => {
  function _createAuthoredOnlyChronicle () {
    return `
      const authoroot = this.authoroot = new Entity({
        authorityURI: "${testAuthorityURI}",
        name: "authored-only",
        properties: {
          [$VChronicle.requireAuthoredEvents]: true,
        },
      });

      ${_addIdentityRoleRelation("authoroot")};

      ({ authoroot, directors: authoroot.$V.getRelations($VChronicle.director) });
    `;
  }

  function _addIdentityRoleRelation (
      chronicleRoot = "this", role = "$VChronicle.director",
      targetMediator = "valos.identity", contributorMediator = "valos.identity") {
    return `
      new Relation({
        source: ${chronicleRoot},
        fixed: { name: ${role}, target: ${targetMediator}.getPublicIdentityFor(${chronicleRoot}) },
        properties: ${contributorMediator}.getContributorPropertiesFor(${chronicleRoot}),
      })
    `;
  }

  async function _sourcerDecepAuthoroot (authoroot, expectedAuthorootEvents = 1) {
    expect((await decepness.receiveEventsFrom(harness.testChronicle)).length)
        .toEqual(2);

    const authorootConnection = await authoroot.getConnection().asSourceredConnection();
    const decepConnection = decepness.sourcerer
        .sourcerChronicle(authorootConnection.getChronicleURI());
    const authorootEvents = await decepness
        .receiveEventsFrom(authorootConnection, {
          asNarrateResults: true,
          alsoReceiveBackToSource: "asPush",
        });
    expect(authorootEvents.length)
        .toEqual(expectedAuthorootEvents);

    await decepConnection.asSourceredConnection();
    const decepAuthoroot = decepEntities().creator.propertyValue("authoroot");
    return { decepAuthoroot, authorootEvents };
  }

  it("happily receives authored events", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot, directors } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), { console }, { verbosity: 0 });
    expect(authoroot.step("name"))
        .toEqual("authored-only");
    expect(authoroot.propertyValue(qualifiedSymbol("VChronicle", "requireAuthoredEvents")))
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

    const event = authorootEvents[0];
    const command = getAspect(event, "command");
    const author = swapAspectRoot("author", event, "event");
    expect(author)
        .toMatchObject({ publicIdentity: primeDirectorId });
    expect(verifyVPlotSignature(
            { event, command },
            author.signature,
            signatureKeys[author.publicIdentity].publicKey))
        .toEqual(true);
    swapAspectRoot("event", author, "author");
  });

  it("refuses to profess a non-authorable outgoing event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator
        .doValoscript(_createAuthoredOnlyChronicle(), {}, {});

    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot);
    const errorResult = {};

    expect(() => decepAuthoroot.doValoscript(`
      this.nonAuthoredNotRefused = true;
      valos.getTransactor().addEventListener("error", event => errorResult.event = event);
    `, { errorResult })).toThrow(/No VChronicle:contributor found/);

    expect(errorResult.event)
        .toMatchObject({ isSchismatic: true, isRevisable: false, isReformable: false });
    expect(decepAuthoroot.propertyValue("nonAuthoredNotRefused"))
        .toBeUndefined();
  });

  async function _addIdentityAsContributor (chronicleRoot, identityURI) {
    const mediator = new IdentityMediator({ parent: chronicleRoot.getEngine() });
    mediator.add(identityURI, {
      asContributor: { publicKey: signatureKeys[identityURI].publicKey },
    });
    return chronicleRoot.doValoscript(
        _addIdentityRoleRelation("this", "$VChronicle.contributor", "mediator", "mediator"),
        { mediator });
  }

  async function _addIdentityAsDirector (chronicleRoot, identityURI) {
    const mediator = new IdentityMediator({ parent: chronicleRoot.getEngine() });
    mediator.add(identityURI, {
      secretKey: signatureKeys[identityURI].secretKey,
      asContributor: { publicKey: signatureKeys[identityURI].publicKey },
    });
    return chronicleRoot.doValoscript(
        _addIdentityRoleRelation("this", "$VChronicle.director", "mediator", "mediator"),
        { mediator });
  }

  it("freezes a chronicle with SEALED (ie. seals) on an authorized but invalid event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});

    await _addIdentityAsContributor(authoroot, decepTributorURI);

    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot, 2);

    await decepAuthoroot.doValoscript(`this.happyModification = 1;`);
    await decepAuthoroot.doValoscript(`this.manuallyBrokenModification = 2;`);
    await decepAuthoroot.doValoscript(`this.postBrokenModification = 3;`);

    expect(decepAuthoroot.propertyValue("happyModification"))
        .toEqual(1);
    expect(decepAuthoroot.propertyValue("manuallyBrokenModification"))
        .toEqual(2);
    expect(decepAuthoroot.propertyValue("postBrokenModification"))
        .toEqual(3);

    const decepAuthorootBackend = decepness
        .tryGetTestAuthorityConnection(decepAuthoroot.getConnection());
    const event = decepAuthorootBackend._proclamations[1].event;
    const validPreviousType = event.type;

    // break the event for prime harness to detect
    event.type = "BROKEN";
    expect((await harness.receiveEventsFrom(decepAuthoroot.getConnection(), {})).length)
        .toEqual(3);

    // fix the event for decepness to have fraudulently confirmed
    event.type = validPreviousType;
    expect((await decepness.receiveEventsFrom(
            decepAuthoroot.getConnection(), { clearSourceUpstream: true })).length)
        .toEqual(3);

    expect(authoroot.propertyValue("happyModification"))
        .toEqual(1);
    expect(authoroot.propertyValue("manuallyBrokenModification"))
        .toBeUndefined();
    expect(authoroot.propertyValue("postBrokenModification"))
        .toBeUndefined();

    expect(authoroot.getConnection().isFrozenConnection())
        .toEqual(true);

    await new Promise(resolve => setTimeout(resolve, 1));

    const decepEvents = (await decepness.receiveEventsFrom(authoroot.getConnection(), {}));

    expect(decepEvents[0])
        .toMatchObject({
          type: "SEALED",
          invalidAntecedentIndex: 3,
          aspects: { author: { antecedent: 4, publicIdentity: primeDirectorId } },
        });
    expect(decepEvents[0].invalidationReason)
        .toMatch(/validator missing for type BROKEN/);

    // TODO(iridian, 2020-10): Evaluate whether retrograde invalidation
    // of already confirmed truths by an incoming SEALED is desirable.
    // In general gateways should already invalidate local commands
    // themselves and thus SEALED is useful as an only informative
    // variant of FROZEN. Retrograde invalidation would be useful if
    // there are different types of validation behaviors in which case
    // some gateways could treat all incoming events as unconfirmed and
    // rely on SEALED.
    // Not implementing retroactive invalidation yet:
    //
    // expect(decepAuthoroot.propertyValue("manuallyBrokenModification"))
    //    .toBeUndefined();

    expect(decepAuthoroot.getConnection().isFrozenConnection())
        .toEqual(true);
  });

  it("seals on an obnoxiously authorized but non-authored incoming event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});
    await _addIdentityAsContributor(authoroot, decepTributorURI);
    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot, 2);

    await decepAuthoroot.doValoscript(`this.obnoxiouslyNonAuthored = true;`);

    expect(decepAuthoroot.propertyValue("obnoxiouslyNonAuthored"))
        .toEqual(true);

    const decepAuthorootBackend = decepness
        .tryGetTestAuthorityConnection(decepAuthoroot.getConnection());
    const event = decepAuthorootBackend._proclamations[0].event;

    // Nuke the upstream author aspect
    const author = event.aspects.author;
    delete event.aspects.author;
    expect((await harness.receiveEventsFrom(decepAuthoroot.getConnection(), {})).length)
        .toEqual(1);

    // Return the author aspect for the fraudulent harness itself
    event.aspects.author = author;
    expect((await decepness.receiveEventsFrom(
            decepAuthoroot.getConnection(), { clearSourceUpstream: true })).length)
        .toEqual(1);

    expect(authoroot.propertyValue("obnoxiouslyNonAuthored"))
        .toBeUndefined();
    expect((await authoroot.getConnection()).isFrozenConnection())
        .toEqual(true);

    await new Promise(resolve => setTimeout(resolve, 1));

    const decepEvents = (await decepness.receiveEventsFrom(authoroot.getConnection(), {}));
    expect(decepEvents[0])
        .toMatchObject({
          type: "SEALED",
          invalidAntecedentIndex: 2,
          aspects: { author: { antecedent: 2, publicIdentity: primeDirectorId } },
        });
    expect(decepEvents[0].invalidationReason)
        .toMatch(/AuthorAspect missing/);

    // See note on previous test
    // expect(decepAuthoroot.propertyValue("obnoxiouslyNonAuthored"))
    //     .toBeUndefined();
    expect((await decepAuthoroot.getConnection()).isFrozenConnection())
        .toEqual(true);
  });

  it("seals on a deceptively authorized but incorrectly signed event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});
    await _addIdentityAsContributor(authoroot, decepTributorURI);
    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot, 2);

    await decepAuthoroot.doValoscript(`this.incorrectlySigned = true;`);

    expect(decepAuthoroot.propertyValue("incorrectlySigned"))
        .toEqual(true);

    const decepAuthorootBackend = decepness
        .tryGetTestAuthorityConnection(decepAuthoroot.getConnection());
    const event = decepAuthorootBackend._proclamations[0].event;

    // Scramble the signature
    const correctSignature = event.aspects.author.signature;
    event.aspects.author.signature =
        "sfnIAQa16JF6MIvHNbDbbNp3pa__lj0a3iHxzFjQvysUR-2pBwkP-FOmAbg-SvCH-ZsehaNUghgJExhzBqr9Aw";
    expect((await harness.receiveEventsFrom(decepAuthoroot.getConnection(), {})).length)
        .toEqual(1);

    // Revert the signature aspect for the fraudulent harness itself
    event.aspects.author.signature = correctSignature;
    expect((await decepness.receiveEventsFrom(
            decepAuthoroot.getConnection(), { clearSourceUpstream: true })).length)
        .toEqual(1);

    expect(authoroot.propertyValue("incorrectlySigned"))
        .toBeUndefined();
    expect((await authoroot.getConnection()).isFrozenConnection())
        .toEqual(true);

    const decepEvents = (await decepness.receiveEventsFrom(authoroot.getConnection(), {}));
    expect(decepEvents[0])
        .toMatchObject({
          type: "SEALED",
          invalidAntecedentIndex: 2,
          aspects: { author: { antecedent: 2, publicIdentity: primeDirectorId } },
        });
    expect(decepEvents[0].invalidationReason)
        .toMatch(/Invalid VLog:signature/);

    // See note on previous test
    // expect(decepAuthoroot.propertyValue("obnoxiouslyNonAuthored"))
    //     .toBeUndefined();
    expect((await decepAuthoroot.getConnection()).isFrozenConnection())
        .toEqual(true);
  });

  it("seals on a subversively authorized and authored yet forbidden privilege escalation event",
      async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});
    await _addIdentityAsContributor(authoroot, decepTributorURI);
    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot, 2);

    expect(decepAuthoroot.propertyValue(qualifiedSymbol("VChronicle", "requireAuthoredEvents")))
        .toEqual(true);

    expect(() => decepAuthoroot
        .doValoscript(`this[$VChronicle.requireAuthoredEvents] = false;`, {}))
        .toThrow(/No VChronicle:director identity found/);

    await expect(_addIdentityAsDirector(decepAuthoroot, decepTributorURI))
        .rejects.toThrow(/No VChronicle:director identity found/);

    // Disable local director validation on VChronicle property changes

    decepAuthoroot.getConnection()._bypassLocalAuthorChecks = true;

    await decepAuthoroot.doValoscript(
        `this[$VChronicle.requireAuthoredEvents] = false;`, {}, {});
    expect(decepAuthoroot.propertyValue(qualifiedSymbol("VChronicle", "requireAuthoredEvents")))
        .toEqual(false);

    expect((await harness.receiveEventsFrom(decepAuthoroot.getConnection(), {})).length)
        .toEqual(1);

    expect((await decepness.receiveEventsFrom(
            decepAuthoroot.getConnection(), { clearSourceUpstream: true })).length)
        .toEqual(1);

    expect(authoroot.propertyValue(qualifiedSymbol("VChronicle", "requireAuthoredEvents")))
        .toEqual(true);
    expect((await authoroot.getConnection()).isFrozenConnection())
        .toEqual(true);

    await new Promise(resolve => setTimeout(resolve, 1));

    const decepEvents = (await decepness.receiveEventsFrom(authoroot.getConnection(), {}));
    expect(decepEvents[0])
        .toMatchObject({
          type: "SEALED",
          invalidAntecedentIndex: 2,
          aspects: { author: { antecedent: 2, publicIdentity: primeDirectorId } },
        });
    expect(decepEvents[0].invalidationReason)
        .toMatch(/No VChronicle:director identity found/);

    // See note on previous test
    // expect(decepAuthoroot.propertyValue(qualifiedSymbol("VChronicle", "requireAuthoredEvents")))
    //    .toEqual(true);
    expect((await decepAuthoroot.getConnection()).isFrozenConnection())
        .toEqual(true);
  });

  it("seals on an anachronistic crypto chain breaking event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});
    await _addIdentityAsContributor(authoroot, decepTributorURI);
    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot, 2);

    await decepAuthoroot.doValoscript(`this.hacked = 15;`, {}, {});
    await decepAuthoroot.doValoscript(`this.untouched = 20;`, {}, {});

    expect(decepAuthoroot.propertyValue("hacked"))
        .toEqual(15);
    expect(decepAuthoroot.propertyValue("untouched"))
        .toEqual(20);

    const decepAuthorootBackend = decepness
        .tryGetTestAuthorityConnection(decepAuthoroot.getConnection());
    const event = decepAuthorootBackend._proclamations[0].event;

    // Hack the 'hacked' value with a correct signature but invalid event chain hash
    event.initialState.value.value = 10;
    event.aspects.command.timeStamp = 1605570226556;
    event.aspects.author.signature =
        "xbvSJb3lg3aR4Ft0iMy3G07jP-Dk2pW2d1Pz1qpxkLfib0iMoTiG1SFMi-scAlc_rzzC3pcM9ahOhcTXfyjxAg";

    expect((await harness.receiveEventsFrom(decepAuthoroot.getConnection(), {})).length)
        .toEqual(2);

    expect((await decepness.receiveEventsFrom(
            decepAuthoroot.getConnection(), { clearSourceUpstream: true })).length)
        .toEqual(2);

    expect(authoroot.propertyValue("hacked"))
        .toBeUndefined();
    expect(authoroot.propertyValue("untouched"))
        .toBeUndefined();
    expect((await authoroot.getConnection()).isFrozenConnection())
        .toEqual(true);

    await new Promise(resolve => setTimeout(resolve, 1));

    const decepEvents = (await decepness.receiveEventsFrom(authoroot.getConnection(), {}));
    expect(decepEvents[0])
        .toMatchObject({
          type: "SEALED",
          invalidAntecedentIndex: 2,
          aspects: { author: { antecedent: 3, publicIdentity: primeDirectorId } },
        });
    expect(decepEvents[0].invalidationReason)
        .toMatch(/Invalid VLog:chainHash/);

    // See note on previous test
    // expect(decepAuthoroot.propertyValue("hacked"))
    //     .toBeUndefined();
    // expect(decepAuthoroot.propertyValue("untouched"))
    //     .toBeUndefined();
    expect((await decepAuthoroot.getConnection()).isFrozenConnection())
        .toEqual(true);
  });

  it("seals on an impersonating authorized but incongruent director update event", async () => {
    await prepareHarnesses({ verbosity: 0, claimBaseBlock: true });
    const { authoroot } = await entities().creator.doValoscript(
        _createAuthoredOnlyChronicle(), {}, {});
    await _addIdentityAsDirector(authoroot, decepTributorURI);
    const { decepAuthoroot } = await _sourcerDecepAuthoroot(authoroot, 2);

    const decepPublicKey = signatureKeys[decepTributorURI].publicKey;
    expect(() =>
        decepAuthoroot.doValoscript(
            `this.$V.getRelations($VChronicle.director)[0].publicKey = decepPublicKey`,
            { decepPublicKey }, {}))
        .toThrow(/Incongruent VChronicle:director identity encountered when modifying/);

    // Disable local author aspect validations
    decepAuthoroot.getConnection()._bypassLocalAuthorChecks = true;

    await decepAuthoroot.doValoscript(
      `this.$V.getRelations($VChronicle.director)[0].publicKey = decepPublicKey`,
      { decepPublicKey }, {});

    await decepAuthoroot.doValoscript(`
        valos.identity.remove("${decepTributorURI}");
        valos.identity.add("${primeDirectorURI}", {
          secretKey: secretKey,
          asContributor: { publicKey: publicKey },
        });
        `, { publicKey: decepPublicKey, secretKey: signatureKeys[decepTributorURI].secretKey });

    await decepAuthoroot.doValoscript(`this.impersonatedWrite = true;`, {}, {});
    expect(decepAuthoroot.propertyValue("impersonatedWrite"))
        .toEqual(true);

    const decepAuthorootBackend = decepness
        .tryGetTestAuthorityConnection(decepAuthoroot.getConnection());
    const event = decepAuthorootBackend._proclamations[1].event;
    expect(event.aspects.author)
        .toMatchObject({ antecedent: 2, publicIdentity: "@$~raw.director-prime@@" });

    expect((await harness.receiveEventsFrom(decepAuthoroot.getConnection(), {})).length)
        .toEqual(2);

    expect((await decepness.receiveEventsFrom(
          decepAuthoroot.getConnection(), { clearSourceUpstream: true })).length)
      .toEqual(2);

    expect(authoroot.propertyValue("impersonatedWrite"))
        .toBeUndefined();
    expect((await authoroot.getConnection()).isFrozenConnection())
        .toEqual(true);

    const decepEvents = (await decepness.receiveEventsFrom(authoroot.getConnection(), {}));
    expect(decepEvents[0])
        .toMatchObject({
          type: "SEALED",
          invalidAntecedentIndex: 2,
          aspects: { author: { antecedent: 3, publicIdentity: primeDirectorId } },
        });
    expect(decepEvents[0].invalidationReason)
        .toMatch(/Incongruent VChronicle:director identity encountered/);

    // See note on previous test
    // expect(decepAuthoroot.propertyValue("nonchalantFollowup"))
    //     .toBeUndefined();
    expect((await decepAuthoroot.getConnection()).isFrozenConnection())
        .toEqual(true);
  });
});
