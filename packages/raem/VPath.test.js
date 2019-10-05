// @flow

import { expandVPath } from "./VPath";

describe("VPath parsing", () => {
  it("Parses simple VPath's", () => {
    expect(expandVPath("@!:scriptRoot@!random@"))
        .toEqual(["@", ["!", ["$", "", "scriptRoot"]], ["!random"]]);
    expect(expandVPath("@!invoke:create:@!:body$V:target:name@@"))
        .toEqual(["@", [
          "!invoke",
          ["$", "", "create"],
          ["$", "", ["@", ["!", ["$", "", "body"], ["$", "V", "target"], ["$", "", "name"]]]],
        ]]);
    expect(expandVPath("@$iu4:0000@!random@"))
        .toEqual(["@", ["$", "iu4", "0000"], ["!random"]]);
  });
  it("Parses complex nested VPath's", () => {
    expect(expandVPath("@!invoke:create:event:@!:source@:@!:body@.$V:target@.:name@@"))
        .toEqual(["@", [
          "!invoke",
          ["$", "", "create"],
          ["$", "", "event"],
          ["$", "", ["@", ["!", ["$", "", "source"]]]],
          ["$", "", ["@",
            ["!", ["$", "", "body"]],
            [".", ["$", "V", "target"]],
            [".", ["$", "", "name"]],
          ]],
        ]]);
  });
  it("Parses embedded VPath's", () => {
    expect(expandVPath(["@!invoke:create:event:", ["@!:source@"],
        ":", "@!:body@!:%24V@", ["!:target"], "@", ["!:name"], "@", "@",
    ]))
    .toEqual(["@", [
      "!invoke",
      ["$", "", "create"],
      ["$", "", "event"],
      ["$", "", ["@", ["!", ["$", "", "source"]]]],
      ["$", "", ["@",
        ["!", ["$", "", "body"]],
        ["!", ["$", "", "$V"]],
        ["!", ["$", "", "target"]],
        ["!", ["$", "", "name"]],
      ]],
    ]]);
    expect(expandVPath([
      "@!invoke:create:event:", ["@!:source@"], ":", ["@!:body@!:%24V@!:target@", "!:name@"], "@",
    ]))
    .toEqual(["@", [
      "!invoke",
      ["$", "", "create"],
      ["$", "", "event"],
      ["$", "", ["@", ["!", ["$", "", "source"]]]],
      ["$", "", ["@",
        ["!", ["$", "", "body"]],
        ["!", ["$", "", "$V"]],
        ["!", ["$", "", "target"]],
        ["!", ["$", "", "name"]]
      ]],
    ]]);
  });
});
