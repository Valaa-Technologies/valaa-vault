// @flow

import PerspireServer from "~/inspire/PerspireServer";

const testRevelationPath = "./revelations/perspire-test/valaa.json";
const expectedOutputHTML = `<html><head><meta http-equiv="refresh" content="1"></head><body>${""
  }<div id="valaa-inspire--main-container"><div id="valaa-inspire--main-root">${""
    }<div><div><h1>Hello World!</h1><h2>Hello World! function</h2></div></div>${""
  }</div></div>
        </body></html>`;

beforeEach(() => {});

async function _createAndStartPerspireServer () {
  // TODO(iridian): Implement proper logging levels. Now even verbosity 0 gives a lot of spam.
  const ret = new PerspireServer({
    test: true,
    revelations: [
      { "...": testRevelationPath },
      { gateway: { verbosity: 0 } },
    ],
  });
  await ret.start();
  return ret;
}

describe("testing perspire", () => {
  describe("perspire rendering", () => {
    it("runs a trivial local revelation which renders a proper html dump", async () => {
      const server = await _createAndStartPerspireServer();
      expect(server.serializeMainDOM())
          .toEqual(expectedOutputHTML);
    });
  });
});
