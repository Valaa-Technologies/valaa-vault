// @flow

import PerspireServer from "./PerspireServer";

const revelationRoot = "./revelations/perspire-test/";
const expectedOutputHTML = `<html><head><meta http-equiv="refresh" content="1"></head><body>${""
  }<div id="perspire-gateway--main-container"><div id="perspire-gateway--worker-view">${""
    }<div style="width: 100vw; height: 100vh;"><div>${""
      } <h1>Hello World!</h1> <h2>Hello World! function</h2> ${""
    }</div></div>${""
  }</div></div></body></html>`;

beforeEach(() => {});

describe("testing perspire", () => {
  describe("perspire rendering", () => {
    it("runs a trivial local revelation which renders a proper html dump", async () => {
      const server = new PerspireServer({
        isTest: true,
        siteRoot: process.cwd(),
        revelationRoot,
        revelations: [{
          "!!!": "./revela.json",
          gateway: {
            verbosity: 0,
          },
        }],
      });
      await server.initialize();
      const workerView = await server.createView("worker");
      expect(workerView.getEngine().getIdentityMediator()
              .add("valaa-local:?id=@$~raw.dummy-user@@")
              .authority.getAuthorityURI())
          .toEqual("valaa-local:");
      // This wait should be removeable: however as it stands the
      // creation of frame chronicles will cause an asynchronous delay
      // in creation of UI tree, which the above await doesn't catch.
      // So we wait a small bit.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(server.getRootHTML())
          .toEqual(expectedOutputHTML);
    });
  });
});
