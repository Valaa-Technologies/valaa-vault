// @flow

import PerspireServer from "~/inspire/PerspireServer";

import fetchJSON, { fetch } from "~/tools/fetchJSON";

import { burlaesgEncode } from "~/web-spindle/tools/security";

const revelationRoot = "./packages/web-spindle/test/worker";
const expectedOutputHTML = `<html><head>${
  ""}<meta http-equiv="refresh" content="1"></head>${
  ""}<body><div id="perspire-gateway--main-container">${
    ""}<div id="perspire-gateway--worker-view"><div style="width: 100vw; height: 100vh;">${
      ""}<div><h1>Hello World!</h1><h2>Hello World! function</h2></div>${
    ""}</div></div>${
    ""}<div id="valos-gateway--@valos/web-spindle:view:/rest-test/v0--view-root">${
      ""}<div style="width: 100vw; height: 100vh;">${
        ""}<div><h1>Hello World!</h1><h2>Hello World! function</h2></div>${
      ""}</div>${
    ""}</div>${
  ""}</div></body></html>`;

beforeEach(() => {});

const testClientChronicleURI = "valaa-local:?id=@$~u4.f3d306d9-79ac-4087-afbc-46f739226eb2@@";
const testClientId = encodeURIComponent(testClientChronicleURI);

const testAdminId = "@$~test.admin@@";
const testUserId = "@$~test.user@@";
const testRandoId = "@$~test.rando@@";
const adminChronicleURI = `valaa-local:?id=${testAdminId}`;
const userChronicleURI = `valaa-local:?id=${testUserId}`;
const randoChronicleURI = `valaa-local:?id=${testRandoId}`;

let _server;
let _vViewFocus, _vAuRoot, _vAdmin, _vUser/* , _vRando */;

beforeAll(async () => {
  _server = new PerspireServer({
    isTest: true,
    siteRoot: process.cwd(),
    revelationRoot,
    revelations: [{ "!!!": "./revela.json" }],
  });
  await _server.initialize(["../web-spindle"]);
  const view = await _server.createView("worker");
  _vViewFocus = view.getFocus();

  _vAuRoot = await _vViewFocus.doValoscript(
      `new Entity({ id, name: "test authority root", authorityURI: "valaa-local:" })`,
      { id: "@$~aur.valaa-local%3A@@" });
  _vAdmin = await _vViewFocus.doValoscript(
      `new Entity({ id, name: "admin", authorityURI: "valaa-local:" })`,
      { id: testAdminId });
  _vUser = await _vViewFocus.doValoscript(
      `this.user = new Entity({ id, name: "user", authorityURI: "valaa-local:" })`,
      { id: testUserId });
  /* _vRando = */ await _vViewFocus.doValoscript(
      `new Entity({ id, name: "rando", authorityURI: "valaa-local:" })`,
      { id: testRandoId });

  await _vViewFocus.doValoscript(`new Relation({
    source: this, name: "RIGHTS", target, properties: {
      read: true, write: true,
    },
  })`, { target: _vAdmin });
  await _vViewFocus.doValoscript(`new Relation({
    source: this, name: "RIGHTS", target, properties: {
      read: true, write: false,
    },
  })`, { target: _vUser });
  await _vViewFocus.doValoscript(`new Relation({
    source: this, name: "RIGHTS", target, properties: {
      read: true, write: false,
    },
  })`, { target: _vAuRoot });
});

afterAll(() => _server.terminate());

async function _initiateTestSession (identityChronicle) {
  // DO NOT COPY TO OUTSIDE TESTS. iv and nonce must be unique. See security.test.js
  const iv = new Uint8Array(12);
  iv.set([185, 101, 152, 96, 39, 227, 175, 178, 236, 173, 121, 187], 0);
  const nonce = "sdsd098131##";

  const code = burlaesgEncode({
    identityChronicle, claims: { email: "tester@example.org", preferred_username: "tester" },
    nonce, timeStamp: Math.floor(Date.now() / 1000),
  }, "pen-pineapple-apple-pen", iv);

  const clientTokenName = `__Secure-valos-client-${testClientId}`;

  const sessionRedirect = await fetch(`http://127.0.0.1:7357/rest-test/v0/session${
      ""}?code=${code}&state=auth-state`, {
        method: "GET",
        headers: { cookie: `${clientTokenName}=auth-state` },
        redirect: "manual",
      });
  expect(sessionRedirect.status)
      .toEqual(302);
  expect(sessionRedirect.headers.get("location"))
      .toEqual("http://127.0.0.1:7357/rest-test-app/");
  const cookies = sessionRedirect.headers.get("set-cookie");
  const sessionTokenName = `__Secure-valos-session-token-${testClientId}`;
  const sessionCookieContent = cookies.match(new RegExp(`${sessionTokenName}\\=([^;]*)\\;`))[1];
  return `${sessionTokenName}=${sessionCookieContent}`;
}

describe("Web API spindle worker", () => {
  it("runs a trivial local revelation which renders a proper html dump", async () => {
    const server = await _server;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(server.getRootHTML())
        .toEqual(expectedOutputHTML);

    expect(_vAdmin.getURI())
        .toEqual(`${adminChronicleURI}#${testAdminId}`);
    expect(_vUser.getURI())
        .toEqual(`${userChronicleURI}#${testUserId}`);
  });

  it("performs a full resource methods session", async () => {
    await _server;

    await expect(fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals",
            { method: "POST", body: { name: "unauthorized-without-session" } }))
        .rejects.toMatchObject({ message: /403/ });

    const sessionCookie = await _initiateTestSession(adminChronicleURI);
    const headers = { cookie: sessionCookie };

    const userHeaders = { cookie: await _initiateTestSession(userChronicleURI) };
    const randoHeaders = { cookie: await _initiateTestSession(randoChronicleURI) };

    const testingividualPOST = await fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals",
        { method: "POST", body: { name: "testingividual" }, headers });
    expect(testingividualPOST)
        .toMatchObject({ $V: { rel: "self" } });

    const href = testingividualPOST.$V.href;
    const id = href.match(/^\/rest-test\/v0\/individuals\/([@$.a-zA-Z0-9\-_~]*)$/)[1];

    const testingividualGET = await fetchJSON(`http://127.0.0.1:7357${href}?fields=*`,
        { method: "GET", headers });
    expect(testingividualGET)
        .toMatchObject({ $V: { id }, name: "testingividual", image: "testingividual", owned: {} });

    expect(await fetchJSON(`http://127.0.0.1:7357${href}?fields=*`,
        { method: "GET", headers: userHeaders }))
        .toMatchObject({ $V: { id }, name: "testingividual", image: "testingividual", owned: {} });

    await expect(fetchJSON(`http://127.0.0.1:7357${href}?fields=*`,
        { method: "GET", headers: randoHeaders }))
        .rejects.toMatchObject({ message: /403/ });

    const noIndividuals = await fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals",
        { method: "GET", headers });
    expect(noIndividuals.length)
        .toEqual(0);

    expect(await fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals",
        { method: "GET", headers: randoHeaders }))
        .toEqual([]);

    await expect(fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals",
        { method: "GET" }))
        .rejects.toMatchObject({ message: /403/ });

    const showIndividualPATCH = await fetchJSON(`http://127.0.0.1:7357${href}`,
        { method: "PATCH", body: { visible: true }, headers });
    expect(showIndividualPATCH)
        .toBeUndefined();

    const visiblePATCHGET = await fetchJSON(`http://127.0.0.1:7357${href}?fields=visible`,
        { method: "GET", headers });
    expect(visiblePATCHGET)
        .toEqual({ visible: true, $V: { id } });

    const visibleIndividuals = await fetchJSON(
        "http://127.0.0.1:7357/rest-test/v0/individuals?fields=name,visible",
        { method: "GET", headers });
    expect(visibleIndividuals)
        .toEqual([{ $V: { id }, name: "testingividual", visible: true }]);

    /* TODO: hide entries (but do not fail request) whose specific access doesn't provide
             read for randos
    expect(await fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals?fields=name,visible",
        { method: "GET", headers: randoHeaders }))
        .toEqual([]);
    */

    const testingividualDELETE = await fetchJSON(`http://127.0.0.1:7357${href}`,
        { method: "DELETE", headers });
    expect(testingividualDELETE)
        .toBeUndefined();

    const finalIndividuals = await fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals",
        { method: "GET", headers });
    expect(finalIndividuals.length)
        .toEqual(0);
  });

  it("performs a full mapping methods session", async () => {
    await _server;

    const sessionCookie = await _initiateTestSession(adminChronicleURI);
    const headers = { cookie: sessionCookie };

    const announcerPOST = await fetchJSON(
        "http://127.0.0.1:7357/rest-test/v0/services",
        { method: "POST", headers, body: { name: "announcer" } });
    expect(announcerPOST)
        .toMatchObject({ $V: { rel: "self" } });
    const announcerHRef = announcerPOST.$V.href;

    const shoutPOST = await fetchJSON(
        "http://127.0.0.1:7357/rest-test/v0/news",
        { method: "POST", headers, body: { name: "shout" } });
    expect(shoutPOST)
        .toMatchObject({ $V: { rel: "self" } });
    const shoutHRef = shoutPOST.$V.href;
    const shoutId = shoutHRef.match(/^\/rest-test\/v0\/news\/([@$.a-zA-Z0-9\-_~]*)$/)[1];

    const shoutingPATCH = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news/${shoutId}`,
        { method: "PATCH", headers, body: { highlight: true } });
    const shoutingHRef = `${announcerHRef}/owned/news/${shoutId}`;
    expect(shoutingPATCH)
        .toEqual({ $V: {
          rel: "self", href: shoutingHRef,
          target: { $V: { rel: "self", href: shoutHRef } },
        } });

    const yellingPOST = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news`,
        { method: "POST", headers, body: { $V: { target: { name: "yell", visible: true } } } });
    expect(yellingPOST)
        .toMatchObject({ $V: { rel: "self", target: { $V: { rel: "self" } } } });
    const yellingHRef = yellingPOST.$V.href;
    const yellId = yellingHRef.match(
        /^\/rest-test\/v0\/services\/[@$.a-zA-Z0-9\-_~]*\/owned\/news\/([@$.a-zA-Z0-9\-_~]*)$/)[1];
    const yellHRef = `/rest-test/v0/news/${yellId}`;
    expect(yellingPOST.$V.target.$V.href)
        .toEqual(yellHRef);

    // TODO(iridian, 2019-12): This is wrong? Should at least have "yell" as entry.
    const newsGET = await fetchJSON("http://127.0.0.1:7357/rest-test/v0/news",
        { method: "GET", headers });
    expect(newsGET)
        .toEqual([]);

    const utterancesGET = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news?require-highlight`,
        { method: "GET", headers });
    expect(utterancesGET)
        .toEqual([{
          highlight: true,
          $V: { href: shoutHRef, rel: "self", target: { $V: { id: shoutId } } }
        }]);

    const screamPATCH = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news/${yellId}`,
        { method: "PATCH", headers, body: {
          highlight: true, $V: { target: { name: "scream" } },
        } });
    expect(screamPATCH)
        .toEqual({ $V: {
          href: yellingHRef, rel: "self",
          target: { $V: { href: `/rest-test/v0/news/${yellId}`, rel: "self" } },
        } });

    const screamGET = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news/${yellId}?fields=*`,
        { method: "GET", headers });
    expect(screamGET)
        .toEqual({ highlight: true, $V: {
          href: `/rest-test/v0/news/${yellId}`, rel: "self",
          target: { $V: { id: yellId }, name: "scream", image: "yell", visible: true, tags: [] },
        } });

    const exclamationsGET = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news?require-highlight`,
        { method: "GET", headers });
    expect(exclamationsGET)
        .toEqual([
          { highlight: true, $V: {
            href: shoutHRef, rel: "self", target: { $V: { id: shoutId } },
          } },
          { highlight: true, $V: {
            href: yellHRef, rel: "self", target: { $V: { id: yellId } },
          } },
        ]);

    const silencerDELETE = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news/${yellId}`,
        { method: "DELETE", headers });
    expect(silencerDELETE)
        .toBeUndefined();

    const suppressPATCH = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news/${shoutId}`,
        { method: "PATCH", headers,
          body: { highlight: false, $V: { target: { visible: false } } },
        });
    expect(suppressPATCH)
        .toEqual({ $V: {
          href: shoutingHRef, rel: "self",
          target: { $V: { href: shoutHRef, rel: "self" } },
        } });

    const echoGET = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news`,
        { method: "GET", headers });
    expect(echoGET)
        .toEqual([{ highlight: false, $V: {
          href: shoutHRef, rel: "self", target: { $V: { id: shoutId } },
        } }]);

    const silenceGET = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news?require-highlight`,
        { method: "GET", headers });
    expect(silenceGET)
        .toEqual([]);
  });
});
