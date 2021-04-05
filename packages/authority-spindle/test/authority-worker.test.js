// @flow

import https from "https";

import PerspireServer from "~/inspire/PerspireServer";

import fetchJSON, { fetch } from "~/tools/fetchJSON";

const ignoreSelfSignedAgent = new https.Agent({ rejectUnauthorized: false });

// This assumes that the test is being run via "yarn test" (or similar)
// at the monorepo root.
const revelationRoot = "./packages/authority-spindle/test/worker/";
const expectedOutputHTML = `<html><head>${
  ""}<meta http-equiv="refresh" content="1"></head>${
  ""}<body><div id="perspire-gateway--main-container">${
    ""}<div id="valos-gateway--authority-test-view--view-root">${
      ""}<div> <h1>Hello World!</h1> <h2>Hello World! function</h2> </div>${
    ""}</div>${
    ""}<div id="perspire-gateway--worker-view">${
      ""}<div> <h1>Hello World!</h1> <h2>Hello World! function</h2> </div>${
    ""}</div>${
  ""}</div></body></html>`;

beforeEach(() => {});

const testClientChronicleURI = "valaa-local:?id=@$~u4.f3d306d9-79ac-4087-afbc-46f739226eb2@@";
const testClientId = encodeURIComponent(testClientChronicleURI);
const sessionCookieName = `__Secure-valos-session-${testClientId}`;
const clientCookieName = `__Secure-valos-id-claims-${testClientId}`;

const _testAuthorityURI = "valosp://localhost:7358/testaur/";
const _testAuthorityEndpoint = "https://localhost:7358/testaur/";

const testAdminId = "@$~test.admin@@";
const testUserId = "@$~test.user@@";
const testRandoId = "@$~test.rando@@";

const adminChronicleURI = `${_testAuthorityURI}~test!admin/`;
const userChronicleURI = `${_testAuthorityURI}~test!user/`;
const randoChronicleURI = `${_testAuthorityURI}~test!rando/`;

let _server, _testView, _testRouter;
let _vViewFocus, _vAuRoot, _vAdmin, _vUser, _vRando;

beforeAll(async () => {
  _server = new PerspireServer({
    isTest: true,
    siteRoot: process.cwd(),
    revelationRoot,
    revelations: [{ "!!!": "./revela.json" }],
  });
  await _server.initialize(["@valos/web-spindle", "@valos/authority-spindle"]);
  await _server.createView("worker");
  _testView = _server.getGateway().getView("authority-test-view");
  if (!_testView) throw new Error(`The spindle view "authority-test-view" failed to initialize`);
  _testRouter = _testView.prefixRouters["/testaur"];
  _vViewFocus = _testView.getFocus();

  _vAuRoot = await _vViewFocus.doValoscript(
      `new Entity({ id, name: "test authority root", authorityURI })`,
      { id: `@$~aur.${encodeURIComponent(_testAuthorityURI)}@@`, authorityURI: _testAuthorityURI });
  _vAdmin = await _vViewFocus.doValoscript(
      `new Entity({ id, name: "admin", authorityURI })`,
      { id: testAdminId, authorityURI: _testAuthorityURI });
  _vUser = await _vViewFocus.doValoscript(
      `this.user = new Entity({ id, name: "user", authorityURI })`,
      { id: testUserId, authorityURI: _testAuthorityURI });
  _vRando = await _vViewFocus.doValoscript(
      `new Entity({ id, name: "rando", authorityURI })`,
      { id: testRandoId, authorityURI: _testAuthorityURI });

  await _vViewFocus.doValoscript(`new Relation({
    source: this, name: $\`VChronicle:Directorship\`, target, properties: {
      read: true, write: true,
    },
  })`, { target: _vAdmin });
  await _vViewFocus.doValoscript(`new Relation({
    source: this, name: $\`VChronicle:Contributorship\`, target, properties: {
      read: true, write: false,
    },
  })`, { target: _vUser });
  await _vViewFocus.doValoscript(`new Relation({
    source: this, name: $\`VChronicle:Contributorship\`, target, properties: {
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

  const sessionRedirect = await fetch(`${_testAuthorityEndpoint}v0/session${
      ""}?code=${code}&state=auth-state`, {
        method: "GET",
        headers: { cookie: `${clientCookieName}=auth-state` },
        redirect: "manual",
      });
  expect(sessionRedirect.status)
      .toEqual(302);
  expect(sessionRedirect.headers.get("location"))
      .toEqual("http://localhost:7358/rest-test-app/");
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

describe("Authority spindle worker", () => {
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
    const croVGRID = "@$~cro.Y5H1SS5yAhfxF4RjXqKkLOFMPGrXbiYvrr_-Br45@@";
    const croPlot = "~cro!Y5H1SS5yAhfxF4RjXqKkLOFMPGrXbiYvrr_-Br45";
    const croURL = `${_testAuthorityURI}${croPlot}/`;
    const proclaim0Stack = {
      method: "PUT",
      agent: ignoreSelfSignedAgent,
      body: {
        actions: [{
          type: "CREATED", typeName: "Entity", id: [croVGRID, { partition: croURL }],
          initialState: { name: "new thing", authorityURI: _testAuthorityURI },
        }, {
          type: "CREATED", typeName: "Property",
          initialState: {
            owner: [croVGRID, { partition: croURL }, { coupling: "properties" }],
            name: "value",
            value: { typeName: "Literal", value: 15 },
          },
          id: [`${croVGRID.slice(0, -1)}.$.value@@`, { partition: croURL }]
        }],
        type: "TRANSACTED",
        aspects: {
          version: "0.2",
          command: { id: "2fcf6edb-a248-4622-821c-5c98bfe9ce97", timeStamp: 1617614771461 },
          log: { index: 0 },
        },
      },
    };
    await fetchJSON(`${_testAuthorityEndpoint}${croPlot}/-log!0/`, proclaim0Stack);
    console.log("response:", await proclaim0Stack.response.text());
    expect(proclaim0Stack.response.status).toEqual(204);

    /*
    const httpsRedirection = await fetch("http://localhost:7380/rest-test/v0/individuals",
        { method: "GET", redirect: "manual" });

    expect(httpsRedirection.headers.get("location"))
        .toEqual("https://localhost:7358/rest-test/v0/individuals");

    const { cookie } = await _initiateTestSession(adminChronicleURI);
    const headers = { cookie };

    const userHeaders = { cookie: (await _initiateTestSession(userChronicleURI)).cookie };
    const randoHeaders = { cookie: (await _initiateTestSession(randoChronicleURI)).cookie };

    const testingividualPOST = await fetchJSON("${_testAuthorityEndpoint}v0/individuals",
        { method: "POST", body: { name: "testingividual" }, headers });
    expect(testingividualPOST)
        .toMatchObject({ $V: { rel: "self" } });

    const href = testingividualPOST.$V.href;
    const id = href.match(/^\/rest-test\/v0\/individuals\/([@$.a-zA-Z0-9\-_~]*)$/)[1];

    const testingividualGET = await fetchJSON(`http://localhost:7358${href}?fields=*`,
        { method: "GET", headers });
    expect(testingividualGET)
        .toMatchObject({ $V: { id }, name: "testingividual", image: "testingividual", owned: {} });

    expect(await fetchJSON(`http://localhost:7358${href}?fields=*`,
        { method: "GET", headers: userHeaders }))
        .toMatchObject({ $V: { id }, name: "testingividual", image: "testingividual", owned: {} });

    await expect(fetchJSON(`http://localhost:7358${href}?fields=*`,
        { method: "GET", headers: randoHeaders }))
        .rejects.toMatchObject({ message: /403/ });

    const noIndividuals = await fetchJSON("${_testAuthorityEndpoint}v0/individuals",
        { method: "GET", headers });
    expect(noIndividuals.length)
        .toEqual(0);

    expect(await fetchJSON("${_testAuthorityEndpoint}v0/individuals",
        { method: "GET", headers: randoHeaders }))
        .toEqual([]);

    await expect(fetchJSON("${_testAuthorityEndpoint}v0/individuals",
        { method: "GET" }))
        .rejects.toMatchObject({ message: /403/ });

    const showIndividualPATCH = await fetchJSON(`http://localhost:7358${href}`,
        { method: "PATCH", body: { visible: true }, headers });
    expect(showIndividualPATCH)
        .toBeUndefined();

    const visiblePATCHGET = await fetchJSON(`http://localhost:7358${href}?fields=visible`,
        { method: "GET", headers });
    expect(visiblePATCHGET)
        .toEqual({ visible: true, $V: { id } });

    const visibleIndividuals = await fetchJSON(
        "${_testAuthorityEndpoint}v0/individuals?fields=name,visible",
        { method: "GET", headers });
    expect(visibleIndividuals)
        .toEqual([{ $V: { id }, name: "testingividual", visible: true }]);

    const testingividualDELETE = await fetchJSON(`http://localhost:7358${href}`,
        { method: "DELETE", headers });
    expect(testingividualDELETE)
        .toBeUndefined();

    const finalIndividuals = await fetchJSON("${_testAuthorityEndpoint}v0/individuals",
        { method: "GET", headers });
    expect(finalIndividuals.length)
        .toEqual(0);
    */
  });

  /*
  it("refreshes and closes a session", async () => {
    await expect(fetchJSON("${_testAuthorityEndpoint}v0/individuals",
            { method: "POST", body: { name: "unauthorized-without-session" } }))
        .rejects.toMatchObject({ message: /403/ });

    const { cookie, clientCookie } = await _initiateTestSession(adminChronicleURI);
    const headers = { cookie };

    const testingividualPOST = await fetchJSON("${_testAuthorityEndpoint}v0/individuals",
        { method: "POST", body: { name: "testingividual" }, headers });
    expect(testingividualPOST)
        .toMatchObject({ $V: { rel: "self" } });
    const href = testingividualPOST.$V.href;
    const id = href.match(/^\/rest-test\/v0\/individuals\/([@$.a-zA-Z0-9\-_~]*)$/)[1];

    const testingividualGET = await fetchJSON(`http://localhost:7358${href}?fields=*`,
        { method: "GET", headers });
    expect(testingividualGET)
        .toMatchObject({ $V: { id }, name: "testingividual", image: "testingividual", owned: {} });

    // wait so that the client cookie iat and exp timestamps have time to change.
    await new Promise(resolve => setTimeout(resolve, 1100));

    const refreshSessionRedirect = await fetch(`${_testAuthorityEndpoint}v0/session`, {
      method: "POST", headers, redirect: "manual",
    });
    expect(refreshSessionRedirect.status)
        .toEqual(302);
    expect(refreshSessionRedirect.headers.get("location"))
        .toEqual("http://localhost:7358/rest-test-app/");
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
      await fetchJSON("${_testAuthorityEndpoint}v0/tags",
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
    const refreshProjector = _testRouter.getProjectors({ method: "POST", projector: "session" })[0];
    const previousRefreshDelay = refreshProjector.runtime.scopeBase.tokenExpirationDelay;
    refreshProjector.runtime.scopeBase.tokenExpirationDelay = 0;
    await expect(fetchJSON("${_testAuthorityEndpoint}v0/individuals", postIndividualOptions))
        .rejects
        .toThrow();
    expect(postIndividualOptions.response.status)
        .toEqual(401);
    expect(await postIndividualOptions.response.text())
        .toEqual("Session refresh window has expired");
    refreshProjector.runtime.scopeBase.tokenExpirationDelay = previousRefreshDelay;

   // make successful POST individual including token refresh
    const otherPOST = await fetchJSON(
        "${_testAuthorityEndpoint}v0/individuals", postIndividualOptions);
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

    const otherGET = await fetchJSON(`http://localhost:7358${otherHRef}?fields=*`,
        { method: "GET", headers });
    expect(otherGET)
        .toMatchObject({ $V: { id: otherId }, name: "other", image: "other", owned: {} });

    const deleteSessionRedirect = await fetch(`${_testAuthorityEndpoint}v0/session`, {
      method: "DELETE", headers, redirect: "manual",
    });
    expect(deleteSessionRedirect.status)
        .toEqual(303);
    expect(deleteSessionRedirect.headers.get("location"))
        .toEqual("http://localhost:7358/rest-test-app/");
    const { cookie: deleteSessionCookies } =
        _extractSessionClientCookie(deleteSessionRedirect.headers);
    expect(deleteSessionCookies)
        .toEqual(`${sessionCookieName}=; ${clientCookieName}=`);
  });
  */
});
