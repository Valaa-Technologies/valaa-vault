// @flow

import { validateVPath, formVPath, segmentVPath, segmentVKeyPath } from ".";

describe("VPath", () => {
  describe("VPath validation", () => {
    it("Validates VPath strings", () => {
      expect(validateVPath("@!$.scriptRoot@!random@@"))
          .toBeTruthy();
      expect(validateVPath("@$~u4.0000@@"))
          .toBeTruthy();
      expect(validateVPath("@!invoke$.create$.@!$.body$V.target$.name@@@@"))
          .toBeTruthy();
      expect(validateVPath("@$~u4.0000@!random@@"))
          .toBeTruthy();
      expect(validateVPath(
              "@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$V.target@.$.name@@@@"))
          .toBeTruthy();
    });
    it("Validates segmented VPaths", () => {
      expect(validateVPath(["@", ["!", ["$.", "scriptRoot"]], ["!random"]]))
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
    it("Validates segmented VPaths", () => {
      expect(validateVPath(["@", [
        "!invoke$.create$.event", ["!$.source"], ["@!$.body@!$.%24V@@", ["!$.target"], ["!$.name"]]
      ]])).toBeTruthy();
      expect(validateVPath(["@", [
        "!invoke$.create$.event", ["!$.source"], ["@!$.body@!$.%24V@!$.target@@"], ["!$.name"],
      ]])).toBeTruthy();
    });
  });
  describe("VPath forming", () => {
    it("Forms simple VPaths", () => {
      expect(formVPath(["!", "scriptRoot"], ["!random"]))
          .toEqual("@!$.scriptRoot@!random@@");
      expect(formVPath([
        "!invoke",
        "create",
        ["@", ["!", "body", ["$", "V", "target"], "name"]],
      ])).toEqual("@!invoke$.create$.@!$.body$V.target$.name@@@@");
      expect(formVPath(["$", "~u4", "0000"], ["!random"]))
          .toEqual("@$~u4.0000@!random@@");
    });
    it("Forms complex nested VPaths", () => {
      expect(formVPath([
        "!invoke",
        ["$.", "create"],
        "event",
        ["@", ["!", ["$.", "source"]]],
        ["$.", ["@",
          ["!", ["$.", "body"]],
          [".", ["$", "V", "target"]],
          [".", "name"],
        ]],
      ])).toEqual("@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$V.target@.$.name@@@@");
      expect(formVPath(
        ["$", "~u4", "55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0"],
        ["_", ["$", "~plt",
          ["@", [".", ["$", "pot"], ["@", [".O.", "7741938f-801a-4892-9cf0-dd59bd8c9166"]]]]
        ]],
        ["+", ["$", "pot_hypertwin", "inLinks"]],
        ["-in-", ["$", "pot", "ownerOf"],
          ["@", [".S--",
            ["@", ["$", "~plt",
              ["@", [".", ["$", "pot"], ["@", [".O.", "aa592f56-1d82-4484-8360-ad9b82d00592"]]]],
            ]],
          ]],
        ],
      )).toEqual(`@$~u4.55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0${""
        }@_$~plt.@.$pot$.@.O.$.7741938f-801a-4892-9cf0-dd59bd8c9166@@@@${""
        }@+$pot_hypertwin.inLinks@-in-$pot.ownerOf${""
        }$.@.S--$.@$~plt.@.$pot$.@.O.$.aa592f56-1d82-4484-8360-ad9b82d00592@@@@@@@@@@`);
    });
  });
  describe("VPath parsing", () => {
    it("Segments simple VPath's", () => {
      expect(() => segmentVPath(["!$."]))
          .toThrow(/Invalid vparam-value/);
      expect(() => segmentVPath(["!$a-"]))
          .toThrow(/Invalid context-term/);
      expect(() => segmentVPath(["!$1a"]))
          .toThrow(/Invalid context-term/);
      expect(() => segmentVPath(["!$over_three_thousand_and_two_longg"]))
          .toThrow(/Invalid context-term/);
      expect(() => segmentVPath(["@$~b@@"]))
          .toThrow(/Invalid vgrid/);
      expect(segmentVPath(["!$"]))
          .toEqual(["@", ["!", ["$"]]]);
      expect(segmentVPath(["@", ["!$"]]))
          .toEqual(["@", ["!", ["$"]]]);
      expect(segmentVPath(["!$a_1__b"]))
          .toEqual(["@", ["!", ["$", "a_1__b"]]]);
      expect(segmentVPath(["@$~b.c@@"]))
          .toEqual(["@", ["$", "~b", "c"]]);
      expect(segmentVPath(["@", ["!$.a"]]))
          .toEqual(["@", ["!", ["$.", "a"]]]);
      expect(() => segmentVPath(["@", ["!", ["$."]]]))
          .toThrow(/Invalid vparam/);
      expect(segmentVPath("@!$.scriptRoot@!random@@"))
          .toEqual(["@", ["!", ["$.", "scriptRoot"]], ["!random"]]);
      expect(segmentVPath("@$~u4.aaaabbbb-cccc-dddd-eeee-ffffffffffff@@"))
          .toEqual(["@", ["$", "~u4", "aaaabbbb-cccc-dddd-eeee-ffffffffffff"]]);
      expect(segmentVPath("@!invoke$.create$.@!$.body$V.target$.name@@@@"))
          .toEqual(["@", [
            "!invoke", ["$.", "create"],
            ["$.", ["@", ["!", ["$.", "body"], ["$", "V", "target"], ["$.", "name"]]]],
          ]]);
      expect(segmentVPath("@$~u4.0000@!random@@"))
          .toEqual(["@", ["$", "~u4", "0000"], ["!random"]]);
    });
    it("Parses complex nested VPath's", () => {
      expect(segmentVPath("@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$V.target@.$.name@@@@"))
          .toEqual(["@", [
            "!invoke", ["$.", "create"], ["$.", "event"],
            ["$.", ["@", ["!", ["$.", "source"]]]],
            ["$.", ["@",
              ["!", ["$.", "body"]],
              [".", ["$", "V", "target"]],
              [".", ["$.", "name"]],
            ]],
          ]]);
      expect(segmentVPath(
          `@$~u4.55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0${
            ""}@_$~plt.@.$pot$.@.O.$.7741938f-801a-4892-9cf0-dd59bd8c9166@@@@${
            ""}@+$pot_hypertwin.inLinks@-in-$pot.ownerOf${
            ""}$.@.S--$.@$~plt.@.$pot$.@.O.$.aa592f56-1d82-4484-8360-ad9b82d00592@@@@@@@@@@`
      )).toEqual([
        "@",
        ["$", "~u4", "55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0"],
        ["_", ["$", "~plt",
          ["@", [".",
            ["$", "pot"],
            ["$.", ["@", [".O.", ["$.", "7741938f-801a-4892-9cf0-dd59bd8c9166"]]]]
          ]],
        ]],
        ["+", ["$", "pot_hypertwin", "inLinks"]],
        ["-in-",
          ["$", "pot", "ownerOf"],
          ["$.", ["@", [".S--",
            ["$.", ["@", ["$", "~plt",
              ["@", [".",
                ["$", "pot"],
                ["$.", ["@", [".O.", ["$.", "aa592f56-1d82-4484-8360-ad9b82d00592"]]]]
              ]],
            ]]],
          ]]],
        ],
      ]);
    });
    it("Segments embedded VPath's", () => {
      expect(segmentVPath(["@", ["!invoke$.create$.event",
        ["!$.source"],
        ["@!$.body@!$.%24V@@", ["!$.target"], ["!$.name"]],
      ]]))
      .toEqual(["@", [
        "!invoke", ["$.", "create"], ["$.", "event"],
        ["@", ["!", ["$.", "source"]]],
        ["@",
          ["!", ["$.", "body"]],
          ["!", ["$.", "$V"]],
          ["!", ["$.", "target"]],
          ["!", ["$.", "name"]],
        ],
      ]]);
      expect(segmentVPath(["@", [
        "!invoke$.create$.event", ["@!$.source@@"], ["@!$.body@!$.%24V@!$.target@@", ["!$.name"]],
      ]]))
      .toEqual(["@", [
        "!invoke", ["$.", "create"], ["$.", "event"],
        ["@", ["!", ["$.", "source"]]],
        ["@",
          ["!", ["$.", "body"]],
          ["!", ["$.", "$V"]],
          ["!", ["$.", "target"]],
          ["!", ["$.", "name"]],
        ],
      ]]);
    });
    it("Segments VPath objects", () => {
      expect(segmentVPath([{ val: [] }]))
          .toEqual(["@", ["+", ["$"], ["@", [".", ["$.", "val"], ["@"]]]]]);
      expect(segmentVPath([{ val: ["@"] }]))
          .toEqual(["@", ["+", ["$"], ["@", [".", ["$.", "val"], ["@"]]]]]);
      expect(segmentVPath([{ val: undefined }]))
          .toEqual(["@", ["+", ["$"], ["@", [".", ["$.", "val"]]]]]);
      expect(segmentVPath([{ val: ["$"] }]))
          .toEqual(["@", ["+", ["$"], ["@", [".", ["$.", "val"], ["$"]]]]]);
    });
    it("Segments already segmented VPaths correctly", () => {
      expect(segmentVPath([["-out$.TAGS"], [".$V.target"]]))
          .toEqual(["@", ["-out", ["$.", "TAGS"]], [".", ["$", "V", "target"]]]);
      expect(segmentVPath(["@", ["-out", ["$.", "TAGS"]], [".", ["$", "V", "target"]]]))
          .toEqual(["@", ["-out", ["$.", "TAGS"]], [".", ["$", "V", "target"]]]);
      expect(segmentVPath([["-out", ["$.", "TAGS"]], [".", ["$", "V", "target"]]]))
          .toEqual(["@", ["-out", ["$.", "TAGS"]], [".", ["$", "V", "target"]]]);
      expect(segmentVPath([[".$V.owner"], [".$V.rawId"]]))
          .toEqual(["@", [".", ["$", "V", "owner"]], [".", ["$", "V", "rawId"]]]);
    });
    it("Doesn't segment spurious fields", () => {
      expect(segmentVPath(["!$"]))
          .toEqual(["@", ["!", ["$"]]]);
      expect(segmentVPath(["!$random"]))
          .toEqual(["@", ["!", ["$", "random"]]]);
      expect(segmentVPath(["!$random"])[1][1].length)
          .toEqual(2);
      expect(segmentVPath(["@!$.scriptRoot@!$random@@"]))
          .toEqual(["@", ["!", ["$.", "scriptRoot"]], ["!", ["$", "random"]]]);
    });
    it("Segments a non-trivial verb", () => {
      expect(segmentVPath(["!", ["$https.foobar.com%2Fpath"], [
        "fetchedField",
        ["@", [".$.fetchOptions"], [".$.input"]]
      ]])).toEqual(["@", ["!",
        ["$", "https", "foobar.com/path"],
        ["@",
          ["$.", "fetchedField"],
          ["$.", ["@", [".", ["$.", "fetchOptions"]], [".", ["$.", "input"]]]],
        ],
      ]]);
    });
    it("Segments key paths", () => {
      expect(segmentVKeyPath("$.", "value"))
          .toEqual(["$.", "value"]);
      expect(segmentVKeyPath(null, ["!$"]))
          .toEqual(["@", ["!", ["$"]]]);
      expect(segmentVKeyPath(null, ["@", ["!$"]]))
          .toEqual(["@", ["!", ["$"]]]);
      expect(segmentVKeyPath(null, ["@", ["!", ["$"]]]))
          .toEqual(["@", ["!", ["$"]]]);
      expect(segmentVKeyPath("@", ["!$"]))
          .toEqual(["@", ["!", ["$"]]]);
      expect(segmentVKeyPath("@", ["@", ["!$"]]))
          .toEqual(["@", ["$.", ["@", ["!", ["$"]]]]]);
      expect(segmentVKeyPath("@", ["@", ["!", ["$"]]]))
          .toEqual(["@", ["$.", ["@", ["!", ["$"]]]]]);
      expect(segmentVKeyPath("$.", ["!$"]))
          .toEqual(["$.", ["@", ["!", ["$"]]]]);
      expect(segmentVKeyPath("$.", ["@", ["!$"]]))
          .toEqual(["$.", ["@", ["!", ["$"]]]]);
      // expect(segmentVKeyPath("$.", ["$"]))
      //    .toEqual(["$.", ["@", ["$."]]]);
    });
  });
});
