// @flow

import { validateVPath, mintVPath, expandVPath } from "./VPath";

describe("VPath", () => {
  describe("VPath validation", () => {
    it("Validates VPath strings", () => {
      expect(validateVPath("@!:scriptRoot@!random@"))
          .toBeTruthy();
      expect(validateVPath("@!invoke:create:@!:body$V:target:name@@"))
          .toBeTruthy();
      expect(validateVPath("@$iu4:0000@!random@"))
          .toBeTruthy();
      expect(validateVPath("@!invoke:create:event:@!:source@:@!:body@.$V:target@.:name@@"))
          .toBeTruthy();
    });
    it("Validates expanded VPaths", () => {
      expect(validateVPath(["@", ["!", ["$", "", "scriptRoot"]], ["!random"]]))
          .toBeTruthy();
      expect(validateVPath(["@", [
        "!invoke",
        ["$", "", "create"],
        ["$", "", ["@", ["!", ["$", "", "body"], ["$", "V", "target"], ["$", "", "name"]]]],
      ]])).toBeTruthy();
      expect(validateVPath(["@", ["$", "iu4", "0000"], ["!random"]]))
          .toBeTruthy();
      expect(validateVPath(["@", [
        "!invoke",
        ["$", "", "create"],
        ["$", "", "event"],
        ["$", "", ["@", ["!", ["$", "", "source"]]]],
        ["$", "", ["@",
          ["!", ["$", "", "body"]],
          [".", ["$", "V", "target"]],
          [".", ["$", "", "name"]],
        ]],
      ]])).toBeTruthy();
    });
    it("Validates expanded VPaths", () => {
      expect(validateVPath([
        "@!invoke:create:event:", ["@!:source@"], ":",
        "@!:body@!:%24V@", ["!:target"], "@", ["!:name"], "@", "@",
      ])).toBeTruthy();
      expect(validateVPath([
        "@!invoke:create:event:", ["@!:source@"], ":",
        ["@!:body@!:%24V@!:target@", "!:name@"], "@",
      ])).toBeTruthy();
    });
  });
  describe("VPath minting", () => {
    it("Mints simple VPaths", () => {
      expect(mintVPath(["!", ["$", "", "scriptRoot"]], ["!random"]))
          .toEqual("@!:scriptRoot@!random@");
      expect(mintVPath([
        "!invoke",
        ["$", "", "create"],
        ["$", "", ["@", ["!", ["$", "", "body"], ["$", "V", "target"], ["$", "", "name"]]]],
      ])).toEqual("@!invoke:create:@!:body$V:target:name@@");
      expect(mintVPath(["$", "iu4", "0000"], ["!random"]))
          .toEqual("@$iu4:0000@!random@");
    });
    it("Mints complex nested VPaths", () => {
      expect(mintVPath([
        "!invoke",
        ["$", "", "create"],
        ["$", "", "event"],
        ["$", "", ["@", ["!", ["$", "", "source"]]]],
        ["$", "", ["@",
          ["!", ["$", "", "body"]],
          [".", ["$", "V", "target"]],
          [".", ["$", "", "name"]],
        ]],
      ])).toEqual("@!invoke:create:event:@!:source@:@!:body@.$V:target@.:name@@");
    });
  });
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
});
