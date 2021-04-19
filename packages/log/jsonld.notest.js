import * as jsonld from "jsonld";

const vdocContext = {
  "@base": "http://valospace.org/vdoc#",
  "@vocab": "http://valospace.org/Property#",
  "v": "http://valospace.org/vdoc#",
  "v:after": { "@id": "http://valospace.org/vdoc#after", "@type": "@id" },
  ">": { "@id": "http://section/#", "@container": "@list" },
  ">:0": { "@id": "http://section/#1", "@container": "@list" },
  ">:1": { "@id": "http://section/#1", "@container": "@list" },
  ">:2": { "@id": "http://section/#2", "@container": "@list" },
  ">:3": { "@id": "http://section/#3", "@container": "@list" },
  ">:4": { "@id": "http://section/#4", "@container": "@list" },
  ">:5": { "@id": "http://section/#5", "@container": "@list" }
};

const vdocCompact = {
  "@id": "_:",
  "v:heading": "ValOS style guide",
  ">": [
    "[//]: # (don't edit auto-generated file - generated at @valos/vault root with)",
    "[//]: # (vlm --markdown . require packages/toolset-vault/template.vdon/STYLE.vdon > STYLE.md)",
    "",
    "The ValOS style is split into three main sections: general semantic principles, informal text production guidelines and formal linter-enforceable style rules.",
    "",
    "Additional files specifying formal style rules:"
  ],
  style_rule_files: [
    "@valos/toolset-vault/shared/.eslintrc.js",
    "@valos/toolset-vault/templates/.editorconfig"
  ],
  ">:1": [
    "",
    "Note: while formal ValOS linter rules are formally based on airbnb style there is a lot of divergence in practice.",
    "",
    "Like all ValOS specifications this style guide applies only to"
  ],
  semantic_principles: { "v:after": ">:1",
    "v:heading": "Semantic principles",
    ">": "This section lists generic semantic ValOS design principles and their rationales.",
    use_ECMAScript: {
      "v:heading": "Use ECMAScript everywhere",
      ">": [
        "ECMAScript should be used as the text-based turing language of choice in all ValOS contexts (valoscript is acceptable as an ECMAScript derivative).",
        "",
        "ValOS ecosystem as a distributed, multitenant architecture is",
        "",
        "These advances makes it feasible to stick to one language, ",
        "",
        "When solutions necessitate other languages, they should be implemented in following order of preference:"
      ]
    }
  },
};

const doc = { "@context": vdocContext, ...vdocCompact };

describe("Engine bug tests", async () => {
  xit("expands vdoc", async () => {
    const vdocExpanded = await jsonld.expand(doc);
    console.log("vdocExpanded:", JSON.stringify(vdocExpanded, null, 2));
    console.log("rdf quads:", await jsonld.toRDF(doc, { format: "application/n-quads" }));
  });
  it("expands vdoc", async () => {
    const context = { "@context": { p: { "@id": "e:", "@container": "@list" } } };
    const dupSeq = ["r", "r"];
    const listExpansion = [{ "@list": [{ "@value": "r" }, { "@value": "r" }] }];
    const setExpansion = [{ "@value": "r" }, { "@value": "r" }];

    // Fails unexpectedly:
    expect(await jsonld.expand({ ...context, "p:s": dupSeq })).toEqual([{ "e:s": listExpansion }]);
    // Passes unexpectedly:
    expect(await jsonld.expand({ ...context, "p:s": dupSeq })).toEqual([{ "e:s": setExpansion }]);
    // Passes expectedly:
    expect(await jsonld.expand({ ...context, p: dupSeq })).toEqual([{ "e:": listExpansion }]);
  });
});
