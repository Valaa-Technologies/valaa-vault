// @flow

import { validateVPath, mintVPath, expandVPath } from "./VPath";

describe("VPath", () => {
  describe("VPath validation", () => {
    it("Validates VPath strings", () => {
      expect(validateVPath("@!:scriptRoot@!random@"))
          .toBeTruthy();
      expect(validateVPath("$~u4:0000"))
          .toBeTruthy();
      expect(validateVPath("@!invoke:create:@!:body$V:target:name@@"))
          .toBeTruthy();
      expect(validateVPath("@$~u4:0000@!random@"))
          .toBeTruthy();
      expect(validateVPath("@!invoke:create:event:@!:source@:@!:body@.$V:target@.:name@@"))
          .toBeTruthy();
    });
    it("Validates expanded VPaths", () => {
      expect(validateVPath(["@", ["!", [":", "scriptRoot"]], ["!random"]]))
          .toBeTruthy();
      expect(validateVPath(["@", [
        "!invoke", "create",
        ["@", ["!", "body", ["$", "V", "target"], "name"]],
      ]])).toBeTruthy();
      expect(validateVPath(["@", ["$", "~u4", "0000"], ["!random"]]))
          .toBeTruthy();
      expect(validateVPath(["@", [
        "!invoke", "create", "event",
        ["@", ["!", "source"]],
        ["@",
          ["!", "body"],
          [".", ["$", "V", "target"]],
          [".", "name"],
        ],
      ]])).toBeTruthy();
    });
    it("Validates expanded VPaths", () => {
      expect(validateVPath([
        "@", ["!invoke:create:event", ["!:source"], ["@!:body@!:%24V@", ["!:target"], ["!:name"]]],
      ])).toBeTruthy();
      expect(validateVPath([
        "@", ["!invoke:create:event", ["!:source"], ["@!:body@!:%24V@!:target@"], ["!:name"]],
      ])).toBeTruthy();
    });
  });
  describe("VPath minting", () => {
    it("Mints simple VPaths", () => {
      expect(mintVPath(["!", "scriptRoot"], ["!random"]))
          .toEqual("@!:scriptRoot@!random@");
      expect(mintVPath([
        "!invoke",
        "create",
        ["@", ["!", "body", ["$", "V", "target"], "name"]],
      ])).toEqual("@!invoke:create:@!:body$V:target:name@@");
      expect(mintVPath(["$", "~u4", "0000"], ["!random"]))
          .toEqual("@$~u4:0000@!random@");
    });
    it("Mints complex nested VPaths", () => {
      expect(mintVPath([
        "!invoke",
        [":", "create"],
        "event",
        ["@", ["!", [":", "source"]]],
        [":", ["@",
          ["!", [":", "body"]],
          [".", ["$", "V", "target"]],
          [".", "name"],
        ]],
      ])).toEqual("@!invoke:create:event:@!:source@:@!:body@.$V:target@.:name@@");
      expect(mintVPath(
        ["$", "~u4", "55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0"],
        ["_", ["$", "~pw",
          ["@", [".", ["$", "pot"], ["@", [".O.", "7741938f-801a-4892-9cf0-dd59bd8c9166"]]]]
        ]],
        ["-", ["$", "pot-hypertwin", "inLinks"]],
        ["*in~", ["$", "pot", "ownerOf"],
          ["@", [".S*~",
            ["@", ["$", "~pw",
              ["@", [".", ["$", "pot"], ["@", [".O.", "aa592f56-1d82-4484-8360-ad9b82d00592"]]]],
            ]],
          ]],
        ],
      )).toEqual(`@$~u4:55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0${""
        }@_$~pw:@.$pot$:@.O.:7741938f-801a-4892-9cf0-dd59bd8c9166@@${""
        }@-$pot-hypertwin:inLinks${""
        }@*in~$pot:ownerOf:@.S*~:@$~pw:@.$pot$:@.O.:aa592f56-1d82-4484-8360-ad9b82d00592@@@@@`);
    });
  });
  describe("VPath parsing", () => {
    it("Parses simple VPath's", () => {
      expect(expandVPath("@!:scriptRoot@!random@"))
          .toEqual(["@", ["!", [":", "scriptRoot"]], ["!random"]]);
      expect(expandVPath("$~u4:aaaabbbb-cccc-dddd-eeee-ffffffffffff"))
          .toEqual(["$", "~u4", "aaaabbbb-cccc-dddd-eeee-ffffffffffff"]);
      expect(expandVPath("@!invoke:create:@!:body$V:target:name@@"))
          .toEqual(["@", [
            "!invoke", [":", "create"],
            [":", ["@", ["!", [":", "body"], ["$", "V", "target"], [":", "name"]]]],
          ]]);
      expect(expandVPath("@$~u4:0000@!random@"))
          .toEqual(["@", ["$", "~u4", "0000"], ["!random"]]);
    });
    it("Parses complex nested VPath's", () => {
      expect(expandVPath("@!invoke:create:event:@!:source@:@!:body@.$V:target@.:name@@"))
          .toEqual(["@", [
            "!invoke", [":", "create"], [":", "event"],
            [":", ["@", ["!", [":", "source"]]]],
            [":", ["@",
              ["!", [":", "body"]],
              [".", ["$", "V", "target"]],
              [".", [":", "name"]],
            ]],
          ]]);
      expect(expandVPath(
          `@$~u4:55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0${
            ""}@_$~pw:@.$pot$:@.O.:7741938f-801a-4892-9cf0-dd59bd8c9166@@${
            ""}@-$pot-hypertwin:inLinks${
            ""}@*in~$pot:ownerOf:@.S*~:@$~pw:@.$pot$:@.O.:aa592f56-1d82-4484-8360-ad9b82d00592@@@@@`
      )).toEqual([
        "@",
        ["$", "~u4", "55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0"],
        ["_", ["$", "~pw",
          ["@", [".",
            ["$", "pot"],
            [":", ["@", [".O.", [":", "7741938f-801a-4892-9cf0-dd59bd8c9166"]]]]
          ]],
        ]],
        ["-", ["$", "pot-hypertwin", "inLinks"]],
        ["*in~",
          ["$", "pot", "ownerOf"],
          [":", ["@", [".S*~",
            [":", ["@", ["$", "~pw",
              ["@", [".",
                ["$", "pot"],
                [":", ["@", [".O.", [":", "aa592f56-1d82-4484-8360-ad9b82d00592"]]]]
              ]],
            ]]],
          ]]],
        ],
      ]);
    });
    it("Parses embedded VPath's", () => {
      expect(expandVPath(["@", ["!invoke:create:event",
        ["!:source"],
        ["@!:body@!:%24V@", ["!:target"], ["!:name"]],
      ]]))
      .toEqual(["@", [
        "!invoke", [":", "create"], [":", "event"],
        ["!", [":", "source"]],
        ["@",
          ["!", [":", "body"]],
          ["!", [":", "$V"]],
          ["!", [":", "target"]],
          ["!", [":", "name"]],
        ],
      ]]);
      expect(expandVPath([
        "@", ["!invoke:create:event", ["@!:source@"], ["@!:body@!:%24V@!:target@", ["!:name"]]],
      ]))
      .toEqual(["@", [
        "!invoke", [":", "create"], [":", "event"],
        ["@", ["!", [":", "source"]]],
        ["@",
          ["!", [":", "body"]],
          ["!", [":", "$V"]],
          ["!", [":", "target"]],
          ["!", [":", "name"]],
        ],
      ]]);
    });
    it("Expands already expanded VPaths correctly", () => {
      expect(expandVPath(["out*", [":", "TAGS"]]))
      .toEqual(["out*", [":", "TAGS"]]);
    });
  });
});
