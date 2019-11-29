// @flow

import PerspireServer from "~/inspire/PerspireServer";

import fetchJSON from "~/tools/fetchJSON";

const revelationRoot = "./packages/rest-api-spindle/test/worker";
const expectedOutputHTML = `<html><head>${
  ""}<meta http-equiv="refresh" content="1"></head>${
  ""}<body><div id="perspire-gateway--main-container">${
    ""}<div id="perspire-gateway--main-root"><div style="width: 100vw; height: 100vh;">${
      ""}<div><h1>Hello World!</h1><h2>Hello World! function</h2></div>${
    ""}</div></div>${
    ""}<div id="valos-gateway--@valos/rest-api-spindle:view:/rest-test/v0--view-root">${
      ""}<div style="width: 100vw; height: 100vh;">${
        ""}<div><h1>Hello World!</h1><h2>Hello World! function</h2></div>${
      ""}</div>${
    ""}</div>${
  ""}</div></body></html>`;

beforeEach(() => {});

let _server;

beforeAll(async () => {
  _server = new PerspireServer({
    isTest: true,
    spindleIds: ["@valos/rest-api-spindle"],
    siteRoot: process.cwd(),
    revelationRoot,
    revelations: [{ "!!!": "./revela.json" }],
  });
  await _server.initialize();
  await _server.createMainView();
});

afterAll(() => _server.terminate());

describe("REST API spindle worker", () => {
  it("runs a trivial local revelation which renders a proper html dump", async () => {
    const server = await _server;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(server.serializeMainDOM())
        .toEqual(expectedOutputHTML);
  });

  it("resource methods", async () => {
    await _server;

    const testingividualPOST = await fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals",
        { method: "POST", body: { name: "testingividual" } });
    expect(testingividualPOST)
        .toMatchObject({ $V: { rel: "self" } });

    const href = testingividualPOST.$V.href;
    const id = href.match(/^\/rest-test\/v0\/individuals\/([a-zA-Z0-9\-_]*)$/)[1];

    const testingividualGET = await fetchJSON(`http://127.0.0.1:7357${href}?fields=*`);
    expect(testingividualGET)
        .toMatchObject({ $V: { id }, name: "testingividual", image: "testingividual", owned: {} });

    const noIndividuals = await fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals");
    expect(noIndividuals.length)
        .toEqual(0);

    const showIndividualPATCH = await fetchJSON(`http://127.0.0.1:7357${href}`,
        { method: "PATCH", body: { visible: true } });
    expect(showIndividualPATCH)
        .toBeUndefined();

    const visiblePATCHGET = await fetchJSON(`http://127.0.0.1:7357${href}?fields=visible`);
    expect(visiblePATCHGET)
        .toEqual({ visible: true, $V: { id } });

    const visibleIndividuals = await fetchJSON(
        "http://127.0.0.1:7357/rest-test/v0/individuals?fields=name,visible");
    expect(visibleIndividuals)
        .toEqual([{ $V: { id }, name: "testingividual", visible: true }]);

    const testingividualDELETE = await fetchJSON(`http://127.0.0.1:7357${href}`,
        { method: "DELETE" });
    expect(testingividualDELETE)
        .toBeUndefined();

    const finalIndividuals = await fetchJSON("http://127.0.0.1:7357/rest-test/v0/individuals");
    expect(finalIndividuals.length)
        .toEqual(0);
  });

  it("mapping methods", async () => {
    await _server;

    const announcerPOST = await fetchJSON(
        "http://127.0.0.1:7357/rest-test/v0/services",
        { method: "POST", body: { name: "announcer" } });
    expect(announcerPOST)
        .toMatchObject({ $V: { rel: "self" } });
    const announcerHRef = announcerPOST.$V.href;

    const shoutPOST = await fetchJSON(
        "http://127.0.0.1:7357/rest-test/v0/news",
        { method: "POST", body: { name: "shout" } });
    expect(shoutPOST)
        .toMatchObject({ $V: { rel: "self" } });
    const shoutHRef = shoutPOST.$V.href;
    const shoutId = shoutHRef.match(/^\/rest-test\/v0\/news\/([a-zA-Z0-9\-_]*)$/)[1];

    const shoutingPATCH = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news/${shoutId}`,
        { method: "PATCH", body: { highlight: true } });
    const shoutingHRef = `${announcerHRef}/owned/news/${shoutId}`;
    expect(shoutingPATCH)
        .toEqual({ $V: {
          rel: "self", href: shoutingHRef,
          target: { $V: { rel: "self", href: shoutHRef } },
        } });

    const yellingPOST = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news`,
        { method: "POST", body: { $V: { target: { name: "yell", visible: true } } } });
    expect(yellingPOST)
        .toMatchObject({ $V: { rel: "self", target: { $V: { rel: "self" } } } });
    const yellingHRef = yellingPOST.$V.href;
    const yellId = yellingHRef.match(
        /^\/rest-test\/v0\/services\/[a-zA-Z0-9\-_]*\/owned\/news\/([a-zA-Z0-9\-_]*)$/)[1];
    const yellHRef = `/rest-test/v0/news/${yellId}`;
    expect(yellingPOST.$V.target.$V.href)
        .toEqual(yellHRef);

    /*
     * TOOD(iridian, 2019-11): the worker/revela.json doCreateMapping
     * doesn't create a root index relation for news
    const newsGET = await fetchJSON("http://127.0.0.1:7357/rest-test/v0/news");
    expect(newsGET)
        .toEqual([{ $V: { id: y} }]);
    */

    const utterancesGET = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news?require-highlight`);
    expect(utterancesGET)
        .toEqual([{ highlight: true, $V: { href: shoutHRef, rel: "self" } }]);

    const screamPATCH = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news/${yellId}`,
        { method: "PATCH", body: { highlight: true, $V: { name: "scream" } } });
    expect(screamPATCH)
        .toEqual({ $V: {
          href: yellingHRef, rel: "self",
          target: { $V: { href: `/rest-test/v0/news/${yellId}`, rel: "self" } },
        } });

    const exclamationsGET = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news?require-highlight`);
    expect(exclamationsGET)
        .toEqual([
          { $V: { href: shoutHRef, rel: "self" }, highlight: true },
          { $V: { href: yellHRef, rel: "self" }, highlight: true },
        ]);

    const silencerDELETE = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news/${yellId}`,
        { method: "DELETE" });
    expect(silencerDELETE)
        .toBeUndefined();

    const suppressPATCH = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news/${shoutId}`,
        { method: "PATCH", body: { highlight: false, $V: { target: { visible: false } } } });
    expect(suppressPATCH)
        .toEqual({ $V: {
          href: shoutingHRef, rel: "self",
          target: { $V: { href: shoutHRef, rel: "self" } },
        } });

    const echoGET = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news`);
    expect(echoGET)
        .toEqual([{ $V: { href: shoutHRef, rel: "self" }, highlight: false }]);

    const silenceGET = await fetchJSON(
        `http://127.0.0.1:7357${announcerHRef}/owned/news?require-highlight`);
    expect(silenceGET)
        .toEqual([]);
  });
});
