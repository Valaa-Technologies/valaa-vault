import PerspireServer from "@valos/inspire/PerspireServer";

const fs = require("fs");

const output = "./revelations/perspire-test/test/index.html";
const revelationPath = "./revelations/perspire-test/valaa.json";
const expected = `<html><head><meta http-equiv="refresh" content="1"></head><body><div id="valaa-inspire--main-container"><div id="valaa-inspire--main-root"><div><div><h1>Hello World!</h1><h2>Hello World! function</h2></div></div></div></div>`;

beforeEach(() => {
  if (fs.existsSync(output)) {
    fs.unlinkSync(output);
  }
});

describe("testing perspire", () => {
  describe("perspire rendering", () => {
    it("running trivial local revelation and compairing render dump", () => {
      const server = new PerspireServer({
        revelationPath,
        output,
      });
      server.start();
      setTimeout(() => {
        const testHtml = fs.readFileSync(output).toString();
        expect(testHtml).toEqual(expected);
      }, 3000);
    });
  });
});
