// @flow

import {
  validateVPlot, validateVPlotSection, validateVRIDString, validateVRID,
  formVPlot,
  disjoinVPlot, disjoinVPlotOutline, disjoinVPlotString,
  conjoinVPlot,
} from ".";
import { wrapOutputError } from "~/tools/thenChainEagerly";

describe("VPlot", () => {
  describe("VPlot validation", () => {
    it("validates generic VPlot strings", wrapOutputError(() => {
      expect(validateVPlot("@!$.scriptRoot@!random@@"))
          .toBeTruthy();
      expect(() => validateVPlot("@!$.scriptRoot@!random"))
          .toThrow(/closing "@"/);
      expect(validateVPlot("@$~raw.0000@@"))
          .toBeTruthy();
      expect(() => validateVPlot("@$~raw.@@"))
          .toThrow(/closing "@"/);
      expect(validateVPlot("@-$.F$focus.@+$.1@@@@"))
          .toBeTruthy();
      expect(validateVPlot("@!invoke$.create$.@!$.body$V.target$.name@@@@"))
          .toBeTruthy();
      expect(validateVPlot("@$~raw.0000@$foo@@"))
          .toBeTruthy();
      expect(validateVPlot("@$~raw.0000@$foo.bar@@"))
          .toBeTruthy();
      expect(validateVPlot(
              "@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$V.target@.$.name@@@@"))
          .toBeTruthy();
    }));
    it("validates VRID strings", () => {
      expect(() => validateVRID("@!$.scriptRoot@!random@@"))
          .toThrow(/expected "@\$".*got "@!"/);
      expect(validateVRID("@$~raw.0000@@"))
          .toBeTruthy();
      expect(() => validateVRID("@-$.F$focus.@+$.1@@@@"))
          .toThrow(/expected "@\$" as section type, got "@-"/);
      expect(() => validateVRID("@!invoke$.create$.@!$.body$V.target$.name@@@@"))
          .toThrow(/expected "@\$".*got "@!invoke"/);
      expect(() => validateVRID("@$~raw.0000@$foo@@"))
          .toThrow(/Invalid verb-type.*doesn't match/);
      expect(() => validateVRID("@$~raw.0000@$foo.bar@@"))
          .toThrow(/Invalid verb-type.*doesn't match/);
      expect(() => validateVRID(
              "@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$V.target@.$.name@@@@"))
          .toThrow(/expected "@\$".*got "@!invoke"/);
      expect(() => validateVRIDString("aaaabbbb-cccc-dddd-eeee-ffffffffffff"))
          .toThrow(/must be a string beginning with "@"/);
    });
    it("validates fully disjoint VPlots", () => {
      expect(validateVPlotSection(["@@", [["@$~raw", "0000"], ["@!random"]]]))
          .toBeTruthy();
      expect(() => validateVPlotSection(["@@", ["@$~raw", "0000"], ["@!random", []]]))
          .toThrow(/Invalid full vplot.*at most two entries/);
      expect(() => validateVPlotSection(["@@", [["@$~raw", "0000"], ["@!random", []]]]))
          .toThrow(/non-empty/);
      expect(() => validateVPlotSection(["@@", [["@$~raw", "0000"]]]))
          .toThrow(/Invalid full vplot.*two or more/);
      expect(validateVPlotSection(["@!random"]))
          .toBeTruthy();
      expect(() => validateVPlotSection(["!random"]))
          .toThrow(/Invalid vplot.*must begin with "@"/);
      expect(() => validateVPlotSection(["@@", [["@!", ["scriptRoot"]], ["@!random", []]]]))
          .toThrow(/Invalid vverb.*non-empty/);
      expect(validateVPlotSection(
          ["@!invoke", ["create", ["@!", ["body", ["@$V", "target"], "name"]]]]
      )).toBeTruthy();
      expect(validateVPlotSection(
        ["@-", ["F", ["@$focus", ["@+", ["1"]]]]]
      )).toBeTruthy();
      expect(validateVPlotSection(
          ["@!invoke", ["create", "event",
            ["@!", ["source"]],
            ["@@", [["@!", ["body"]], ["@.", [["@$V", "target"]]], ["@.", ["name"]]]],
          ]],
      )).toBeTruthy();
    });
    it("fails to validate non-disjoint VPlots outlines", wrapOutputError(() => {
      expect(() => validateVPlotSection(
          ["@!invoke$.create$.event", [
            "@!$.source", ["@@!$.body@!$.%24V", ["@!$.target", "@!$.name"]],
          ]]
      )).toThrow(/Invalid verb-type.*doesn't match/);
      expect(() => validateVPlotSection(
          ["@!invoke", [
            "create", "event", "@!$.source", ["@!$.body@!$.%24V@!$.target"], "!$.name",
          ]]
      )).toThrow(/Invalid verb-type.*doesn't match/);
    }));
  });
  describe("VPlot sectioning", () => {
    it("disjoins simple VPlot strings", () => {
      expect(() => disjoinVPlotString("!$."))
          .toThrow(/Invalid vparam-value/);
      expect(() => disjoinVPlotString("!$a-"))
          .toThrow(/Invalid context-term/);
      expect(() => disjoinVPlotString("!$1a"))
          .toThrow(/Invalid context-term/);
      expect(() => disjoinVPlotString("!$over_three_thousand_and_two_longg"))
          .toThrow(/Invalid context-term/);
      expect(() => disjoinVPlotString("@$~b@@"))
          .toThrow(/Invalid vgrid/);
      expect(disjoinVPlotString("!$"))
          .toEqual(["@!", [["@$"]]]);
      expect(disjoinVPlotString("!$a_1__b"))
          .toEqual(["@!", [["@$a_1__b"]]]);
      expect(disjoinVPlotString("@$~b.c@@"))
          .toEqual(["@$~b", "c"]);
      expect(disjoinVPlotString("@-$.F$focus.@+$.1@@@@"))
          .toEqual(["@-", ["F", ["@$focus", ["@+", ["1"]]]]]);
      expect(disjoinVPlotString("@!$.scriptRoot@!random@@"))
          .toEqual(["@@", [["@!", ["scriptRoot"]], ["@!random"]]]);
      expect(disjoinVPlotString("@$~u4.aaaabbbb-cccc-dddd-eeee-ffffffffffff@@"))
          .toEqual(["@$~u4", "aaaabbbb-cccc-dddd-eeee-ffffffffffff"]);
      expect(disjoinVPlotString("@!invoke$.create$.@!$.body$V.target$.name@@@@"))
          .toEqual(["@!invoke", ["create", ["@!", ["body", ["@$V", "target"], "name"]]]]);
      expect(disjoinVPlotString("@$~raw.0000@!random@@"))
          .toEqual(["@@", [["@$~raw", "0000"], ["@!random"]]]);
      expect(disjoinVPlotString("12345678-90ab-cdef-fedc-ba0987654321"))
          .toEqual(["@12345678-90ab-cdef-fedc-ba0987654321"]);
    });
    it("disjoins complex nested VPlot strings", () => {
      expect(disjoinVPlot(
          "@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$V.target@.$.name@@@@",
      )).toEqual(["@!invoke", ["create", "event", ["@!", ["source"]], ["@@", [
          ["@!", ["body"]],
          ["@.", [["@$V", "target"]]],
          ["@.", ["name"]],
        ]],
      ]]);
      expect(disjoinVPlot(
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
    it("disjoinVPlot and disjoinVPlotOutline strips redundant top-level '@@'", () => {
      expect(disjoinVPlot(["@@", ["@!$"]]))
          .toEqual(["@!", [["@$"]]]);
      expect(disjoinVPlot(["@!$"]))
          .toEqual(["@!", [["@$"]]]);
      expect(disjoinVPlotOutline(["@@", ["@!$"]]))
          .toEqual(["@!", [["@$"]]]);
      expect(disjoinVPlotOutline(["@!$"]))
          .toEqual(["@!", [["@$"]]]);
    });
    it("disjoins VPlot outlines", wrapOutputError(() => {
      expect(disjoinVPlotOutline(["@@", ["@!$.a"]]))
          .toEqual(["@!", ["a"]]);
      expect(() => disjoinVPlotOutline(["@@", ["@!", ["@$."]]]))
          .toThrow(/Invalid vparam/);
      expect(disjoinVPlotOutline(["@@", ["@$a", ["@$~raw.b"]]]))
          .toEqual(["@$a", ["@$~raw", "b"]]);
      expect(conjoinVPlot(disjoinVPlotOutline(["@@", ["@$a", ["@$~raw.b"]]])))
          .toEqual("@$a.@$~raw.b@@@@");
      expect(disjoinVPlotOutline(["@!invoke$.create$.event",
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
      expect(disjoinVPlotOutline([
        "@!invoke$.create$.event", ["@!$.source@@"], ["@!$.body@!$.%24V@!$.target@", ["@!$.name"]],
      ]))
      .toEqual(["@!invoke", [
        "create", "event",
        ["@!", ["source"]],
        ["@@", [["@!", ["body"]], ["@!", ["$V"]], ["@!", ["target"]], ["@!", ["name"]]]],
      ]]);
    }));
    it("disjoins VPlot outlines with objects", () => {
      expect(disjoinVPlotOutline({ arr: [] }))
          .toEqual(["@+", [["@.", ["arr", ["@-"]]]]]);
      expect(disjoinVPlotOutline({ head: ["@@"] }))
          .toEqual(["@+", [["@.", ["head", ["@@"]]]]]);
      expect(disjoinVPlotOutline({ und: undefined }))
          .toEqual(["@+", [["@.", ["und"]]]]);
      expect(disjoinVPlotOutline({ und: ["@$"] }))
          .toEqual(["@+", [["@.", ["und", ["@$"]]]]]);
      expect(disjoinVPlotOutline(["@$foo.bar", { v1: "v1v", v2: 10, v3: ["a", 10] }]))
          .toEqual(["@", [["@$foo", "bar"],
            ["@.", ["v1", "v1v"]],
            ["@.", ["v2", 10]],
            ["@.", ["v3", ["@-", ["a", 10]]]],
          ]]);
    });
    it("disjoins already disjoint VPlots correctly", () => {
      expect(disjoinVPlot([["@-out$.TAGS"], ["@.$V.target"]]))
          .toEqual(["@@", [["@-out", ["TAGS"]], ["@.", [["@$V", "target"]]]]]);
      expect(disjoinVPlot(["@@", [["@-out", ["TAGS"]], ["@.", [["@$V", "target"]]]]]))
          .toEqual(["@@", [["@-out", ["TAGS"]], ["@.", [["@$V", "target"]]]]]);
      expect(disjoinVPlot([["@-out", ["@$", "TAGS"]], ["@.", ["@$V", "target"]]]))
          .toEqual(["@@", [["@-out", ["TAGS"]], ["@.", [["@$V", "target"]]]]]);
      expect(disjoinVPlot([["@.$V.owner"], ["@.$V.rawId"]]))
          .toEqual(["@@", [["@.", [["@$V", "owner"]]], ["@.", [["@$V", "rawId"]]]]]);
    });
    it("Doesn't disjoin into spurious fields", () => {
      expect(disjoinVPlotString("!$"))
          .toEqual(["@!", [["@$"]]]);
      expect(disjoinVPlotString("!$random"))
          .toEqual(["@!", [["@$random"]]]);
      expect(disjoinVPlotString("!$random")[1][0].length)
          .toEqual(1);
      expect(disjoinVPlotString("@!$.scriptRoot@!$random@@"))
          .toEqual(["@@", [["@!", ["scriptRoot"]], ["@!", [["@$random"]]]]]);
    });
    it("disjoins a non-trivial verb template", () => {
      expect(disjoinVPlot(["@!", ["@$https.foobar.com%2Fpath"], [[
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
      expect(disjoinVPlotOutline(["@$ex"], "@!"))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPlotOutline(["@!$ex"]))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPlotOutline(["@@", ["@!$ex"]]))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPlotOutline(["@@", ["@!", ["@$ex"]]]))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPlotOutline(["@!$ex"], "@@"))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPlotOutline(["@@", ["@!$ex"]], "@@"))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPlotOutline(["@@", ["@!", ["@$ex"]]], "@@"))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPlotOutline(["@!$ex"], "@$"))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPlotOutline(["@@", ["@!$ex"]], "@$."))
          .toEqual(["@!", [["@$ex"]]]);
      expect(disjoinVPlotOutline(["@$ex"], "@$.@!"))
          .toEqual(["@!", [["@$ex"]]]);
    });
    it("disjoins object outline into verb params", wrapOutputError(() => {
      expect(disjoinVPlotOutline(["@$o.vlm", "@", "webpack"]))
          .toEqual(["@", [["@$o", "vlm"], "@", "webpack"]]);
      expect(disjoinVPlotOutline({
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
      expect(disjoinVPlotOutline(
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
  describe("VPlot formation", () => {
    it("Forms simple VPlots", wrapOutputError(() => {
      expect(formVPlot(["@$V", "target"]))
          .toEqual("@$V.target@@");
      expect(formVPlot(["@!", "scriptRoot"]))
          .toEqual("@!$.scriptRoot@@");
      expect(formVPlot(["@!", "scriptRoot"], ["@!random"]))
          .toEqual("@!$.scriptRoot@!random@@");
      expect(formVPlot([["@!", "scriptRoot"], ["@!random"]]))
          .toEqual("@-$.@!$.scriptRoot@@$.@!random@@@@");
      expect(formVPlot(["@!invoke", "create", ["@!", "body", ["@$V", "target"], "name"]]))
          .toEqual("@!invoke$.create$.@!$.body$V.target$.name@@@@");
      expect(formVPlot(["@$~raw", "0000"], ["@!random"]))
          .toEqual("@$~raw.0000@!random@@");
      expect(formVPlot([["@$~raw", "0000"], ["@!random"]]))
          .toEqual("@-$~raw.0000$.@!random@@@@");
      expect(formVPlot(["@.", ["@$ot"], ["@.O.", "7741938f-801a-4892-9cf0-dd59bd8c9166"]]))
          .toEqual("@.$ot$.@.O.$.7741938f-801a-4892-9cf0-dd59bd8c9166@@@@");
    }));
    it("Forms complex nested VPlots", () => {
      expect(formVPlot([
        "@!invoke", "create", "event",
        ["@!", "source"],
        ["@@",
          ["@!", "body"],
          ["@.", ["@$V", "target"]],
          ["@.", "name"],
        ],
      ])).toEqual("@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$V.target@.$.name@@@@");
      expect(formVPlot(
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
    it("Forms a big VPlot", () => {
      const bigComplexObject = JSON.parse(`{
        "actions": [
          {
            "type": "CREATED",
            "typeName": "Entity",
            "id": [ "@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@@",
              { "partition": "valaa-test:?id=@$~raw.test_chronicle@@" }
            ],
            "initialState": {
              "name": "Callback Target",
              "owner": ["@$~raw.test_chronicle@@",
                { "partition": "valaa-test:?id=@$~raw.test_chronicle@@" },
                { "coupling": "unnamedOwnlings" }
              ]
            }
          },
          {
            "type": "CREATED",
            "typeName": "Property",
            "initialState": {
              "owner": ["@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@@",
                { "partition": "valaa-test:?id=@$~raw.test_chronicle@@" },
                { "coupling": "properties" }
              ],
              "name": "result",
              "value": { "typeName": "Literal", "value": 10 }
            },
            "id": ["@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@.$.result@@",
              { "partition": "valaa-test:?id=@$~raw.test_chronicle@@" }
            ]
          },
          {
            "type": "CREATED",
            "typeName": "Property",
            "id": ["@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@.$.antiresult@@",
              { "partition": "valaa-test:?id=@$~raw.test_chronicle@@" }
            ],
            "initialState": {
              "name": "antiresult",
              "value": {
                "typeName": "KueryExpression",
                "vakon": [
                  "§->",["§$<-",{"this":["§->",null]}],{},
                  ["§@",["§void",["§.<-",{
                    "return":{"result":["§negate",["§->",["§$","this"],["§..","result"]]]},
                    "looping":0
                  }]]],"return",false,"result"]
              },
              "owner": ["@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@@",
                { "partition": "valaa-test:?id=@$~raw.test_chronicle@@" },
                { "coupling": "properties" }
              ]
            }
          },
          {
            "type": "FIELDS_SET",
            "typeName": "Property",
            "sets": { "value": { "typeName": "Literal", "value": 12 } },
            "id": ["@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@.$.result@@",
              { "partition": "valaa-test:?id=@$~raw.test_chronicle@@" }
            ]
          },
          {
            "type": "CREATED",
            "typeName": "Property",
            "initialState": {
              "owner": ["@$~raw.test_chronicle@@",
                { "partition": "valaa-test:?id=@$~raw.test_chronicle@@" },
                { "coupling": "properties" }
              ],
              "name": "obj",
              "value": {
                "typeName": "Literal",
                "value": {
                  "increment": 1,
                  "callbackEntity": ["§vrl",
                    ["@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@@",
                      { "partition": "valaa-test:?id=@$~raw.test_chronicle@@"}
                    ]
                  ],
                  "callback": ["§capture",["§'",["§->",
                    ["§$<-",{
                      "obj":{
                        "increment":1,
                        "callbackEntity":["§vrl",
                          ["@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@@",
                            {"partition":"valaa-test:?id=@$~raw.test_chronicle@@"}
                        ]]
                      },
                      "callbackEntity":["§vrl",
                        ["@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@@",
                          {"partition":"valaa-test:?id=@$~raw.test_chronicle@@"}
                        ]]
                    }],
                    ["§->",
                      ["§$<-",{"this":["§->",null]}],
                      {},
                      ["§@",["§void",["§.<-",{
                        "return":{"result":["§..<->","result",
                          ["§expression","§+",
                            ["§'",["§->",null]],
                            ["§literal",["§+",
                              ["§->",["§$","this"],["§..","increment"]],
                              ["§->",["§$$","obj"],["§..","increment"]]
                          ]]],
                          ["§$$","callbackEntity"]
                        ]},
                        "looping":0
                      }]]],
                      "return",false,"result"
                    ]]],
                    null,"literal"
                  ]
                }
              }
            },
            "id": ["@$~raw.test_chronicle@.$.obj@@",
              {"partition": "valaa-test:?id=@$~raw.test_chronicle@@"}
            ]
          },
          {
            "type": "FIELDS_SET",
            "typeName": "Property",
            "sets": { "value": { "typeName": "Literal", "value": 16 } },
            "id": ["@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@.$.result@@",
              { "partition": "valaa-test:?id=@$~raw.test_chronicle@@" }
            ]
          },
          {
            "type": "FIELDS_SET",
            "typeName": "Property",
            "sets": { "value": { "typeName": "Literal", "value": 18 } },
            "id": ["@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@.$.result@@",
              { "partition": "valaa-test:?id=@$~raw.test_chronicle@@" }
            ]
          }
        ],
        "type": "TRANSACTED"
      }`);
      expect(formVPlot(bigComplexObject))
          .toEqual(`@-$.@+$.@.$.actions$.@-$.@+$.@.$.id$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZ\
un@@$.@.$.initialState$.@+$.@.$.name$.Callback%20Target@@$.@.$.owner$~raw.test_chronicle@@@@@@$.@.$\
.type$.CREATED@@$.@.$.typeName$.Entity@@@@$.@+$.@.$.id$.@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5\
rZun@.$.result@@@@$.@.$.initialState$.@+$.@.$.name$.result@@$.@.$.owner$~cih.iNbc6KTSicF1AJ0_kiSEKK\
SlB89vDIhWFFA5rZun@@$.@.$.value$.@+$.@.$.typeName$.Literal@@$.@.$.value$d.10@@@@@@@@@@$.@.$.type$.C\
REATED@@$.@.$.typeName$.Property@@@@$.@+$.@.$.id$.@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@.\
$.antiresult@@@@$.@.$.initialState$.@+$.@.$.name$.antiresult@@$.@.$.owner$~cih.iNbc6KTSicF1AJ0_kiSE\
KKSlB89vDIhWFFA5rZun@@$.@.$.value$.@+$.@.$.typeName$.KueryExpression@@$.@.$.vakon$.@-$.%C2%A7-%3E$.\
@-$.%C2%A7%24%3C-$.@+$.@.$.this$.@-$.%C2%A7-%3E$n@@@@@@@@$.@+@@$.@-$.%C2%A7%40$.@-$.%C2%A7void$.@-$\
.%C2%A7.%3C-$.@+$.@.$.looping$d.0@@$.@.$.return$.@+$.@.$.result$.@-$.%C2%A7negate$.@-$.%C2%A7-%3E$.\
@-$.%C2%A7%24$.this@@$.@-$.%C2%A7..$.result@@@@@@@@@@@@@@@@@@@@$.return$f$.result@@@@@@@@@@@@$.@.$.\
type$.CREATED@@$.@.$.typeName$.Property@@@@$.@+$.@.$.id$.@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA\
5rZun@.$.result@@@@$.@.$.sets$.@+$.@.$.value$.@+$.@.$.typeName$.Literal@@$.@.$.value$d.12@@@@@@@@@@\
$.@.$.type$.FIELDS_SET@@$.@.$.typeName$.Property@@@@$.@+$.@.$.id$.@$~raw.test_chronicle@.$.obj@@@@$\
.@.$.initialState$.@+$.@.$.name$.obj@@$.@.$.owner$~raw.test_chronicle@@$.@.$.value$.@+$.@.$.typeNam\
e$.Literal@@$.@.$.value$.@+$.@.$.callback$.@-$.%C2%A7capture$.@-$.%C2%A7'$.@-$.%C2%A7-%3E$.@-$.%C2%\
A7%24%3C-$.@+$.@.$.callbackEntity$.@-$.%C2%A7vrl$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@@@@$\
.@.$.obj$.@+$.@.$.callbackEntity$.@-$.%C2%A7vrl$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@@@@$.\
@.$.increment$d.1@@@@@@@@@@$.@-$.%C2%A7-%3E$.@-$.%C2%A7%24%3C-$.@+$.@.$.this$.@-$.%C2%A7-%3E$n@@@@@\
@@@$.@+@@$.@-$.%C2%A7%40$.@-$.%C2%A7void$.@-$.%C2%A7.%3C-$.@+$.@.$.looping$d.0@@$.@.$.return$.@+$.@\
.$.result$.@-$.%C2%A7..%3C-%3E$.result$.@-$.%C2%A7expression$.%C2%A7%2B$.@-$.%C2%A7'$.@-$.%C2%A7-%3\
E$n@@@@$.@-$.%C2%A7literal$.@-$.%C2%A7%2B$.@-$.%C2%A7-%3E$.@-$.%C2%A7%24$.this@@$.@-$.%C2%A7..$.inc\
rement@@@@$.@-$.%C2%A7-%3E$.@-$.%C2%A7%24%24$.obj@@$.@-$.%C2%A7..$.increment@@@@@@@@@@$.@-$.%C2%A7%\
24%24$.callbackEntity@@@@@@@@@@@@@@@@@@$.return$f$.result@@@@@@$n$.literal@@@@$.@.$.callbackEntity$\
.@-$.%C2%A7vrl$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIhWFFA5rZun@@@@$.@.$.increment$d.1@@@@@@@@@@@@@@$.\
@.$.type$.CREATED@@$.@.$.typeName$.Property@@@@$.@+$.@.$.id$.@$~cih.iNbc6KTSicF1AJ0_kiSEKKSlB89vDIh\
WFFA5rZun@.$.result@@@@$.@.$.sets$.@+$.@.$.value$.@+$.@.$.typeName$.Literal@@$.@.$.value$d.16@@@@@@\
@@@@$.@.$.type$.FIELDS_SET@@$.@.$.typeName$.Property@@@@$.@+$.@.$.id$.@$~cih.iNbc6KTSicF1AJ0_kiSEKK\
SlB89vDIhWFFA5rZun@.$.result@@@@$.@.$.sets$.@+$.@.$.value$.@+$.@.$.typeName$.Literal@@$.@.$.value$d\
.18@@@@@@@@@@$.@.$.type$.FIELDS_SET@@$.@.$.typeName$.Property@@@@@@@@$.@.$.type$.TRANSACTED@@@@@@`);
    });
  });
});
