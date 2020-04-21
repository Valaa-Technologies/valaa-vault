// @flow

import {
  validateVPath, validateVPathSection, validateVRID,
  formVPath,
  disjoinVPath, disjoinVPathOutline, disjoinVPathString,
} from ".";
import { wrapOutputError } from "~/tools/thenChainEagerly";

describe("VPath", () => {
  describe("VPath validation", () => {
    it("validates generic VPath strings", wrapOutputError(() => {
      expect(validateVPath("@!$.scriptRoot@!random@@"))
          .toBeTruthy();
      expect(() => validateVPath("@!$.scriptRoot@!random"))
          .toThrow(/closing "@"/);
      expect(validateVPath("@$~raw.0000@@"))
          .toBeTruthy();
      expect(() => validateVPath("@$~raw.@@"))
          .toThrow(/closing "@"/);
      expect(validateVPath("@!invoke$.create$.@!$.body$V.target$.name@@@@"))
          .toBeTruthy();
      expect(validateVPath("@$~raw.0000@$foo@@"))
          .toBeTruthy();
      expect(validateVPath("@$~raw.0000@$foo.bar@@"))
          .toBeTruthy();
      expect(validateVPath(
              "@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$V.target@.$.name@@@@"))
          .toBeTruthy();
    }));
    it("validates VRID strings", () => {
      expect(() => validateVRID("@!$.scriptRoot@!random@@"))
          .toThrow(/expected "@\$".*got "@!"/);
      expect(validateVRID("@$~raw.0000@@"))
          .toBeTruthy();
      expect(() => validateVRID("@!invoke$.create$.@!$.body$V.target$.name@@@@"))
          .toThrow(/expected "@\$".*got "@!invoke"/);
      expect(() => validateVRID("@$~raw.0000@$foo@@"))
          .toThrow(/Invalid verb-type.*doesn't match/);
      expect(() => validateVRID("@$~raw.0000@$foo.bar@@"))
          .toThrow(/Invalid verb-type.*doesn't match/);
      expect(() => validateVRID(
              "@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$V.target@.$.name@@@@"))
      .toThrow(/expected "@\$".*got "@!invoke"/);
    });
    it("validates fully disjoint VPaths", () => {
      expect(validateVPathSection(["@@", [["@$~raw", "0000"], ["@!random"]]]))
          .toBeTruthy();
      expect(() => validateVPathSection(["@@", ["@$~raw", "0000"], ["@!random", []]]))
          .toThrow(/Invalid full vpath.*at most two entries/);
      expect(() => validateVPathSection(["@@", [["@$~raw", "0000"], ["@!random", []]]]))
          .toThrow(/non-empty/);
      expect(() => validateVPathSection(["@@", [["@$~raw", "0000"]]]))
          .toThrow(/Invalid full vpath.*two or more/);
      expect(validateVPathSection(["@!random"]))
          .toBeTruthy();
      expect(() => validateVPathSection(["!random"]))
          .toThrow(/Invalid vpath.*must begin with "@"/);
      expect(() => validateVPathSection(["@@", [["@!", ["scriptRoot"]], ["@!random", []]]]))
          .toThrow(/Invalid vverb.*non-empty/);
      expect(validateVPathSection(
          ["@!invoke", ["create", ["@!", ["body", ["@$V", "target"], "name"]]]]
      )).toBeTruthy();
      expect(validateVPathSection(
          ["@!invoke", ["create", "event",
            ["@!", ["source"]],
            ["@@", [["@!", ["body"]], ["@.", [["@$V", "target"]]], ["@.", ["name"]]]],
          ]],
      )).toBeTruthy();
    });
    it("fails to validate non-disjoint VPaths outlines", wrapOutputError(() => {
      expect(() => validateVPathSection(
          ["@!invoke$.create$.event", [
            "@!$.source", ["@@!$.body@!$.%24V", ["@!$.target", "@!$.name"]],
          ]]
      )).toThrow(/Invalid verb-type.*doesn't match/);
      expect(() => validateVPathSection(
          ["@!invoke", [
            "create", "event", "@!$.source", ["@!$.body@!$.%24V@!$.target"], "!$.name",
          ]]
      )).toThrow(/Invalid verb-type.*doesn't match/);
    }));
  });
  describe("VPath sectioning", () => {
    it("disjoins simple VPath strings", () => {
      expect(() => disjoinVPathString("!$."))
          .toThrow(/Invalid vparam-value/);
      expect(() => disjoinVPathString("!$a-"))
          .toThrow(/Invalid context-term/);
      expect(() => disjoinVPathString("!$1a"))
          .toThrow(/Invalid context-term/);
      expect(() => disjoinVPathString("!$over_three_thousand_and_two_longg"))
          .toThrow(/Invalid context-term/);
      expect(() => disjoinVPathString("@$~b@@"))
          .toThrow(/Invalid vgrid/);
      expect(disjoinVPathString("!$"))
          .toEqual(["@!", [["@$"]]]);
      expect(disjoinVPathString("!$a_1__b"))
          .toEqual(["@!", [["@$a_1__b"]]]);
      expect(disjoinVPathString("@$~b.c@@"))
          .toEqual(["@$~b", "c"]);
      expect(disjoinVPathString("@!$.scriptRoot@!random@@"))
          .toEqual(["@@", [["@!", ["scriptRoot"]], ["@!random"]]]);
      expect(disjoinVPathString("@$~u4.aaaabbbb-cccc-dddd-eeee-ffffffffffff@@"))
          .toEqual(["@$~u4", "aaaabbbb-cccc-dddd-eeee-ffffffffffff"]);
      expect(disjoinVPathString("@!invoke$.create$.@!$.body$V.target$.name@@@@"))
          .toEqual(["@!invoke", ["create", ["@!", ["body", ["@$V", "target"], "name"]]]]);
      expect(disjoinVPathString("@$~raw.0000@!random@@"))
          .toEqual(["@@", [["@$~raw", "0000"], ["@!random"]]]);
    });
    it("disjoins complex nested VPath strings", () => {
      expect(disjoinVPath(
          "@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$V.target@.$.name@@@@",
      )).toEqual(["@!invoke", ["create", "event", ["@!", ["source"]], ["@@", [
          ["@!", ["body"]],
          ["@.", [["@$V", "target"]]],
          ["@.", ["name"]],
        ]],
      ]]);
      expect(disjoinVPath(
          `@$~u4.55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0${
            ""}@_$~plt.@.$ot$.@.O.$.7741938f-801a-4892-9cf0-dd59bd8c9166@@@@${
            ""}@+$pot_hypertwin.inLinks@-in-$ot.ownerOf${
            ""}$.@.S--$.@$~plt.@.$ot$.@.O.$.aa592f56-1d82-4484-8360-ad9b82d00592@@@@@@@@@@`
      )).toEqual(["@@", [
        ["@$~u4", "55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0"],
        ["@_", [["@$~plt",
          ["@.", [["@$ot"], ["@.O.", ["7741938f-801a-4892-9cf0-dd59bd8c9166"]]]],
        ]]],
        ["@+", [["@$pot_hypertwin", "inLinks"]]],
        ["@-in-", [
          ["@$ot", "ownerOf"],
          ["@.S--", [["@$~plt",
            ["@.", [["@$ot"], ["@.O.", ["aa592f56-1d82-4484-8360-ad9b82d00592"]]]],
          ]]],
        ]],
      ]]);
    });
    it("disjoinVPath and disjoinVPathOutline strips redundant top-level '@@'", () => {
      expect(disjoinVPath(["@@", ["@!$"]]))
          .toEqual(["@!", [["@$"]]]);
      expect(disjoinVPath(["@!$"]))
          .toEqual(["@!", [["@$"]]]);
      expect(disjoinVPathOutline(["@@", ["@!$"]]))
          .toEqual(["@!", [["@$"]]]);
      expect(disjoinVPathOutline(["@!$"]))
          .toEqual(["@!", [["@$"]]]);
    });
    it("disjoins VPath outlines", wrapOutputError(() => {
      expect(disjoinVPathOutline(["@@", ["@!$.a"]]))
          .toEqual(["@!", ["a"]]);
      expect(() => disjoinVPathOutline(["@@", ["@!", ["@$."]]]))
          .toThrow(/Invalid vparam/);
      expect(disjoinVPathOutline(["@!invoke$.create$.event",
        ["@!$.source"],
        ["@!$.body@!$.%24V@", ["@!$.target"], ["@!$.name"]],
      ]))
      .toEqual(["@!invoke", [
        "create", "event",
        ["@!", ["source"]],
        ["@@", [
          ["@!", ["body"]],
          ["@!", ["$V"]],
          ["@!", ["target"]],
          ["@!", ["name"]],
        ]],
      ]]);
      expect(disjoinVPathOutline([
        "@!invoke$.create$.event", ["@!$.source@@"], ["@!$.body@!$.%24V@!$.target@", ["@!$.name"]],
      ]))
      .toEqual(["@!invoke", [
        "create", "event",
        ["@!", ["source"]],
        ["@@", [["@!", ["body"]], ["@!", ["$V"]], ["@!", ["target"]], ["@!", ["name"]]]],
      ]]);
    }));
    it("disjoins VPath outlines with objects", () => {
      expect(disjoinVPathOutline({ arr: [] }))
          .toEqual(["@+", [["@.", ["arr", ["@-"]]]]]);
      expect(disjoinVPathOutline({ head: ["@@"] }))
          .toEqual(["@+", [["@.", ["head", ["@@"]]]]]);
      expect(disjoinVPathOutline({ und: undefined }))
          .toEqual(["@+", [["@.", ["und"]]]]);
      expect(disjoinVPathOutline({ und: ["@$"] }))
          .toEqual(["@+", [["@.", ["und", ["@$"]]]]]);
      expect(disjoinVPathOutline(["@$foo.bar", { v1: "v1v", v2: 10, v3: ["a", 10] }]))
          .toEqual(["@", [["@$foo", "bar"],
            ["@.", ["v1", "v1v"]],
            ["@.", ["v2", 10]],
            ["@.", ["v3", ["@-", ["a", 10]]]],
          ]]);
    });
    it("disjoins already disjoint VPaths correctly", () => {
      expect(disjoinVPath(["@-out$.TAGS"], ["@.$V.target"]))
          .toEqual(["@@", [["@-out", ["TAGS"]], ["@.", [["@$V", "target"]]]]]);
      expect(disjoinVPath(["@@", [["@-out", ["TAGS"]], ["@.", [["@$V", "target"]]]]]))
          .toEqual(["@@", [["@-out", ["TAGS"]], ["@.", [["@$V", "target"]]]]]);
      expect(disjoinVPath(["@-out", ["@$", "TAGS"]], ["@.", ["@$V", "target"]]))
          .toEqual(["@@", [["@-out", ["TAGS"]], ["@.", [["@$V", "target"]]]]]);
      expect(disjoinVPath(["@.$V.owner"], ["@.$V.rawId"]))
          .toEqual(["@@", [["@.", [["@$V", "owner"]]], ["@.", [["@$V", "rawId"]]]]]);
    });
    it("Doesn't disjoin into spurious fields", () => {
      expect(disjoinVPathString("!$"))
          .toEqual(["@!", [["@$"]]]);
      expect(disjoinVPathString("!$random"))
          .toEqual(["@!", [["@$random"]]]);
      expect(disjoinVPathString("!$random")[1][0].length)
          .toEqual(1);
      expect(disjoinVPathString("@!$.scriptRoot@!$random@@"))
          .toEqual(["@@", [["@!", ["scriptRoot"]], ["@!", [["@$random"]]]]]);
    });
    it("disjoins a non-trivial verb template", () => {
      expect(disjoinVPath(["@!", ["@$https.foobar.com%2Fpath"], [[
        "fetchedField",
        ["@.$.fetchOptions@.$.input"]
      ]]])).toEqual(["@!", [
        ["@$https", "foobar.com/path"],
        ["@-", [
          "fetchedField",
          ["@@", [["@.", ["fetchOptions"]], ["@.", ["input"]]]],
        ]],
      ]]);
    });
    it("disjoins distinct outlines into the same section", () => {
      expect(disjoinVPathOutline(["@$ex"], "@!"))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPathOutline(["@!$ex"]))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPathOutline(["@@", ["@!$ex"]]))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPathOutline(["@@", ["@!", ["@$ex"]]]))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPathOutline(["@!$ex"], "@@"))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPathOutline(["@@", ["@!$ex"]], "@@"))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPathOutline(["@@", ["@!", ["@$ex"]]], "@@"))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPathOutline(["@!$ex"], "@$"))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPathOutline(["@@", ["@!$ex"]], "@$."))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPathOutline(["@$ex"], "@$.@!"))
          .toEqual(["@!", [["@$ex"]]]);
    });
    it("disjoins object outline into verb params", wrapOutputError(() => {
      expect(disjoinVPathOutline(["@$o.vlm", "@", "webpack"]))
          .toEqual(["@", [["@$o", "vlm"], "@", "webpack"]]);
      expect(disjoinVPathOutline({
        "@.$.ot": [
          ["@.$.ot-dev"],
          ["@+$.public-session"],
          ["@+$.session"],
          ["@~$.ot-identity.json"],
          ["@~$.hyperbridge-identity.json"],
        ]
      }, "@@")).toEqual(["@.", ["ot",
        ["@.", ["ot-dev"]],
        ["@+", ["public-session"]],
        ["@+", ["session"]],
        ["@~", ["ot-identity.json"]],
        ["@~", ["hyperbridge-identity.json"]],
      ]]);
      expect(disjoinVPathOutline(
          { "workshop.tar.gz": ["@$o.tar-gz", ["@+$.workshop"]] },
          "@$o.import",
      )).toEqual(["@", [
        ["@$o", "import"],
        ["@.", ["workshop.tar.gz", ["@",
          [["@$o", "tar-gz"], ["@+", ["workshop"]]],
        ]]],
      ]]);
    }));
  });
  describe("VPath formation", () => {
    it("Forms simple VPaths", wrapOutputError(() => {
      expect(formVPath(["@$V", "target"]))
          .toEqual("@$V.target@@");
      expect(formVPath(["@!", "scriptRoot"]))
          .toEqual("@!$.scriptRoot@@");
      expect(formVPath(["@!", "scriptRoot"], ["@!random"]))
          .toEqual("@!$.scriptRoot@!random@@");
      expect(formVPath([["@!", "scriptRoot"], ["@!random"]]))
          .toEqual("@-$.@!$.scriptRoot@@$.@!random@@@@");
      expect(formVPath(["@!invoke", "create", ["@!", "body", ["@$V", "target"], "name"]]))
          .toEqual("@!invoke$.create$.@!$.body$V.target$.name@@@@");
      expect(formVPath(["@$~raw", "0000"], ["@!random"]))
          .toEqual("@$~raw.0000@!random@@");
      expect(formVPath([["@$~raw", "0000"], ["@!random"]]))
          .toEqual("@-$~raw.0000$.@!random@@@@");
      expect(formVPath(["@.", ["@$ot"], ["@.O.", "7741938f-801a-4892-9cf0-dd59bd8c9166"]]))
          .toEqual("@.$ot$.@.O.$.7741938f-801a-4892-9cf0-dd59bd8c9166@@@@");
    }));
    it("Forms complex nested VPaths", () => {
      expect(formVPath([
        "@!invoke", "create", "event",
        ["@!", "source"],
        ["@@",
          ["@!", "body"],
          ["@.", ["@$V", "target"]],
          ["@.", "name"],
        ],
      ])).toEqual("@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$V.target@.$.name@@@@");
      expect(formVPath(
        ["@$~u4", "55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0"],
        ["@_", ["@$~plt", ["@.", ["@$ot"], ["@.O.", "7741938f-801a-4892-9cf0-dd59bd8c9166"]]]],
        ["@+", ["@$pot_hypertwin", "inLinks"]],
        ["@-in-",
          ["@$ot", "ownerOf"],
          ["@@", ["@.S--",
            ["@$~plt", ["@.", ["@$ot"], ["@.O.", "aa592f56-1d82-4484-8360-ad9b82d00592"]]],
          ]],
        ],
      )).toEqual(`@$~u4.55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0${""
        }@_$~plt.@.$ot$.@.O.$.7741938f-801a-4892-9cf0-dd59bd8c9166@@@@${""
        }@+$pot_hypertwin.inLinks@-in-$ot.ownerOf${""
        }$.@.S--$~plt.@.$ot$.@.O.$.aa592f56-1d82-4484-8360-ad9b82d00592@@@@@@@@`);
    });
  });
});
