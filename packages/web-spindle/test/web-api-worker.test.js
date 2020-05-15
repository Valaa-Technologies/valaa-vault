// @flow

import PerspireServer from "~/inspire/PerspireServer";

import fetchJSON, { fetch } from "~/tools/fetchJSON";

import { burlaesgEncode, hs256JWTDecode } from "~/web-spindle/tools/security";

const revelationRoot = "./packages/web-spindle/test/worker";
const expectedOutputHTML = `<html><head>${
  ""}<meta http-equiv="refresh" content="1"></head>${
  ""}<body><div id="perspire-gateway--main-container">${
    ""}<div id="valos-gateway--web-api-test-view--view-root">${
      ""}<div style="width: 100vw; height: 100vh;">${
        ""}<div><h1>Hello World!</h1><h2>Hello World! function</h2></div>${
      ""}</div>${
    ""}</div>${
    ""}<div id="perspire-gateway--worker-view"><div style="width: 100vw; height: 100vh;">${
      ""}<div><h1>Hello World!</h1><h2>Hello World! function</h2></div>${
    ""}</div></div>${
  ""}</div></body></html>`;

beforeEach(() => {});

const testClientChronicleURI = "valaa-local:?id=@$~u4.f3d306d9-79ac-4087-afbc-46f739226eb2@@";
const testClientId = encodeURIComponent(testClientChronicleURI);
const sessionCookieName = `__Secure-valos-session-token-${testClientId}`;
const clientCookieName = `__Secure-valos-client-${testClientId}`;

const testAdminId = "@$~test.admin@@";
const testUserId = "@$~test.user@@";
const testRandoId = "@$~test.rando@@";
const adminChronicleURI = `valaa-local:?id=${testAdminId}`;
const userChronicleURI = `valaa-local:?id=${testUserId}`;
const randoChronicleURI = `valaa-local:?id=${testRandoId}`;

let _server, _testView, _testRouter;
let _vViewFocus, _vAuRoot, _vAdmin, _vUser/* , _vRando */;

beforeAll(async () => {
  _server = new PerspireServer({
    isTest: true,
    siteRoot: process.cwd(),
    revelationRoot,
    revelations: [{ "!!!": "./revela.json" }],
  });
  await _server.initialize(["../web-spindle"]);
  await _server.createView("worker");
  _testView = _server.getGateway().getView("web-api-test-view");
  _testRouter = _testView.prefixRouters["/rest-test/v0"];
  _vViewFocus = _testView.getFocus();

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

  const sessionRedirect = await fetch(`http://127.0.0.1:7357/rest-test/v0/session${
      ""}?code=${code}&state=auth-state`, {
        method: "GET",
        headers: { cookie: `${clientCookieName}=auth-state` },
        redirect: "manual",
      });
  expect(sessionRedirect.status)
      .toEqual(302);
  expect(sessionRedirect.headers.get("location"))
      .toEqual("http://127.0.0.1:7357/rest-test-app/");
  return _extractSessionClientCookie(sessionRedirect.headers);
}

function _extractSessionClientCookie (incomingHeaders) {
  const cookies = incomingHeaders.get("set-cookie");
  const sessionCookie = cookies.match(new RegExp(`${sessionCookieName}\\=([^;]*)\\;`))[1];
  const clientCookie = cookies.match(new RegExp(`${clientCookieName}\\=([^;]*)\\;`))[1];
  return {
    sessionCookie,
    clientCookie,
    cookie: `${sessionCookieName}=${sessionCookie}; ${clientCookieName}=${clientCookie}`,
  };
}

describe("Web API spindle worker", () => {
  it("runs a trivial local revelation which renders a proper html dump", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(_server.getRootHTML())
        .toEqual(expectedOutputHTML);

    expect(_vAdmin.getURI())
        .toEqual(`${adminChronicleURI}#${testAdminId}`);
    expect(_vUser.getURI())
        .toEqual(`${userChronicleURI}#${testUserId}`);
  });

  it("performs a full resource methods session", async () => {
    await expect(fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals",
            { method: "POST", body: { name: "unauthorized-without-session" } }))
        .rejects.toMatchObject({ message: /403/ });

    const { cookie } = await _initiateTestSession(adminChronicleURI);
    const headers = { cookie };

    const userHeaders = { cookie: (await _initiateTestSession(userChronicleURI)).cookie };
    const randoHeaders = { cookie: (await _initiateTestSession(randoChronicleURI)).cookie };

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
    const { cookie } = await _initiateTestSession(adminChronicleURI);
    const headers = { cookie };

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

  it("refreshes and closes a session", async () => {
    await expect(fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals",
            { method: "POST", body: { name: "unauthorized-without-session" } }))
        .rejects.toMatchObject({ message: /403/ });

    const { cookie, clientCookie } = await _initiateTestSession(adminChronicleURI);
    const headers = { cookie };

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

    // wait so that the client cookie iat and exp timestamps have time to change.
    await new Promise(resolve => setTimeout(resolve, 1100));

    const refreshSessionRedirect = await fetch(`http://127.0.0.1:7357/rest-test/v0/session`, {
      method: "POST", headers, redirect: "manual",
    });
    expect(refreshSessionRedirect.status)
        .toEqual(302);
    expect(refreshSessionRedirect.headers.get("location"))
        .toEqual("http://127.0.0.1:7357/rest-test-app/");
    const { cookie: refreshedCookie, clientCookie: refreshedClientCookie } =
        _extractSessionClientCookie(refreshSessionRedirect.headers);

    expect(refreshedCookie)
        .not.toEqual(cookie);

    const clientToken = hs256JWTDecode(clientCookie);
    const refreshedClientToken = hs256JWTDecode(refreshedClientCookie);
    expect(refreshedClientToken.header)
        .toEqual(clientToken.header);
    expect(refreshedClientToken.payload.iss)
        .toEqual(clientToken.payload.iss);
    expect(refreshedClientToken.payload.sub)
        .toEqual(clientToken.payload.sub);
    expect(refreshedClientToken.payload.iat)
        .not.toEqual(clientToken.payload.iat);
    expect(refreshedClientToken.payload.exp)
        .not.toEqual(clientToken.payload.exp);
    expect(refreshedClientToken.signature)
        .not.toEqual(clientToken.signature);

    const initialCookie = headers.cookie;
    headers.cookie = refreshedCookie;

    const previousDuration = _testRouter._sessionDuration;
    _testRouter._sessionDuration = -3600;

    try {
      await fetchJSON("http://127.0.0.1:7357/rest-test/v0/tags",
          { method: "POST", body: { name: "unrefreshing" }, headers, redirect: "manual" });
    } catch (error) {
      const expiredResponse = error.response;
      expect(expiredResponse.status)
          .toEqual(401);
      const { sessionCookie: expiredSessionCookie, clientCookie: expiredClientCookie } =
          _extractSessionClientCookie(expiredResponse.headers);
      expect(expiredSessionCookie)
          .toEqual("");
      expect(expiredClientCookie)
          .toEqual("");
    }

    // revert to initial cookie and a session duration short enough
    // for it to have expired, but longer than 1s for the internal
    // auto-refreshed cookie to be valid for the request retry even in
    // marginal cases.

    _testRouter._sessionDuration = 1.1;
    headers.cookie = initialCookie;

    const postIndividualOptions = { method: "POST", body: { name: "other" }, headers };

    // first make a failed POST individual attempt with expired refresh delay
    const refreshProjector = _testRouter.getProjectors({ method: "POST", category: "session" })[0];
    const previousRefreshDelay = refreshProjector.runtime.scopeBase.refreshExpirationDelay;
    refreshProjector.runtime.scopeBase.refreshExpirationDelay = 0;
    await expect(fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals", postIndividualOptions))
        .rejects
        .toThrow();
    expect(postIndividualOptions.response.status)
        .toEqual(401);
    expect(await postIndividualOptions.response.text())
        .toEqual("Session refresh window has expired");
    refreshProjector.runtime.scopeBase.refreshExpirationDelay = previousRefreshDelay;

   // make successful POST individual including token refresh
    const otherPOST = await fetchJSON(
        "http://127.0.0.1:7357/rest-test/v0/individuals", postIndividualOptions);
    expect(otherPOST)
        .toMatchObject({ $V: { rel: "self" } });
    const otherHRef = otherPOST.$V.href;
    const otherId = otherHRef.match(/^\/rest-test\/v0\/individuals\/([@$.a-zA-Z0-9\-_~]*)$/)[1];

    const { cookie: autoRefreshedCookie, clientCookie: autoRefreshedClientCookie } =
        _extractSessionClientCookie(postIndividualOptions.response.headers);

    expect(autoRefreshedCookie)
        .not.toEqual(cookie);

    const autoRefreshedClientToken = hs256JWTDecode(autoRefreshedClientCookie);
    expect(autoRefreshedClientToken.header)
        .toEqual(clientToken.header);
    expect(autoRefreshedClientToken.payload.iss)
        .toEqual(clientToken.payload.iss);
    expect(autoRefreshedClientToken.payload.sub)
        .toEqual(clientToken.payload.sub);
    expect(autoRefreshedClientToken.payload.iat)
        .not.toEqual(clientToken.payload.iat);
    expect(autoRefreshedClientToken.payload.exp)
        .not.toEqual(clientToken.payload.exp);
    expect(autoRefreshedClientToken.signature)
        .not.toEqual(clientToken.signature);

    headers.cookie = autoRefreshedCookie;
    _testRouter._sessionDuration = previousDuration;

    const otherGET = await fetchJSON(`http://127.0.0.1:7357${otherHRef}?fields=*`,
        { method: "GET", headers });
    expect(otherGET)
        .toMatchObject({ $V: { id: otherId }, name: "other", image: "other", owned: {} });

    const deleteSessionRedirect = await fetch(`http://127.0.0.1:7357/rest-test/v0/session`, {
      method: "DELETE", headers, redirect: "manual",
    });
    expect(deleteSessionRedirect.status)
        .toEqual(303);
    expect(deleteSessionRedirect.headers.get("location"))
        .toEqual("http://127.0.0.1:7357/rest-test-app/");
    const { cookie: deleteSessionCookies } =
        _extractSessionClientCookie(deleteSessionRedirect.headers);
    expect(deleteSessionCookies)
        .toEqual(`${sessionCookieName}=; ${clientCookieName}=`);
  });
});
