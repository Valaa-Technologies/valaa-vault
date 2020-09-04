const path = require("path");

const {
  extractee: {
    authors, em, ref, pkg,
    filterKeysWithAnyOf, filterKeysWithNoneOf, prepareTestDoc,
  },
  ontologyColumns,
} = require("@valos/revdoc");

const { FabricEventTarget } = require("@valos/tools/FabricEvent");

const { lazyPatchRevelations, expose } = require("../Revelation");

const {
  VRevela: { preferredPrefix, baseIRI, ontologyDescription, prefixes, vocabulary, context },
 } = require("../ontologies");

const { name, version } = require("../package");

const title = "revela.json format specification";
const { itExpects, runTestDoc } = prepareTestDoc(title);

const posixPath = path.posix || path;

const gatewayMock = Object.assign(new FabricEventTarget(console, 2, "revela.gateway.mock"), {
  siteRoot: "/site",
  domainRoot: "/",
  revelationRoot: "/site/revelation/",
  reveal (origin, options) {
    let ret, revealOrigin;
    if ((origin[0] === "<") || options.fetch) {
      revealOrigin = origin.slice(1, -1);
      ret = Promise.resolve({
        options: { revealOrigin, ...options.fetch },
        fetchedField: 1,
      });
    } else {
      revealOrigin = (origin[0] === "/") ? posixPath.join("/site", origin)
          : (origin[0] === ".") ? posixPath.join(options.currentDir || "/site/revelation/", origin)
          : origin;
      ret = {
        revealOrigin,
        someField: 1,
        callMe (p) { return ({ [revealOrigin]: p }); },
      };
    }
    const originDir = path.dirname(revealOrigin);
    options.revealedDir = `${originDir}${!originDir || originDir.slice(-1) === "/" ? "" : "/"}`;
    return ret;
  },
});

module.exports = {
  "dc:title": title,
  "VDoc:tags": ["INTRODUCTORY", "ONTOLOGY", "TESTDOC"],
  "VRevdoc:package": name,
  "VRevdoc:preferredPrefix": preferredPrefix,
  "VRevdoc:baseIRI": baseIRI,
  "VRevdoc:version": version,
  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "revela",
  },
  "data#prefixes": prefixes,
  "data#vocabulary": vocabulary,
  "data#context": context,

  "chapter#abstract>0": {
    "#0": [
`revela.json (pronounced: `, em("revelation"), `) is a JSON
configuration file in which all "!!!" key values (`, em("spreads"), `)
are evaluated and their results then spread and merged on top of the
surrounding object.

The evaluation allows for VPath operations, most notably importing
relative config files and accessing their subsections. Together the
evaluation, spread and merge allow for fine-grained `,
ref("DRY", "https://en.wikipedia.org/wiki/Don%27t_repeat_yourself"), `
for various valos fabric config files.`],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/inspire"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`ValOS Inspire application gateway\`.`,
    ],
  },
  "chapter#introduction>2": {
    "#0": [
``,
    ],
    "example#1": itExpects(
        "trivial revelation patch",
() => lazyPatchRevelations(gatewayMock,
    { a: [1] },
    { a: [2] }),
"toEqual",
() => ({ a: [1, 2] })),
    "example#2": itExpects(
        "spread of a simple relative import",
() => lazyPatchRevelations(gatewayMock,
    {},
    { "!!!": "./path" }),
"toMatchObject",
() => ({ revealOrigin: "/site/revelation/path", someField: 1 })),
    "example#3": itExpects(
        "spread of an explicit site root import followed by field access",
() => lazyPatchRevelations(gatewayMock,
    "",
    { "!!!": ["/path", "revealOrigin"] }),
"toEqual",
"/site/path",
    ),
    "example#4": itExpects(
        "spread of a URI import followed by pick-array append",
async () => lazyPatchRevelations(gatewayMock,
    [0],
    { "!!!": [
      ["@$https.foobar.com%2Fpath"],
      [["@.:fetchedField"], ["@.:options@.:revealOrigin@@"]],
    ] },
    undefined,
    ["last"]),
"toEqual",
() => [0, 1, "https://foobar.com/path", "last"]),
    "example#5": itExpects("non-evaluated spreader contents to be segmented but non-cemented",
async () => lazyPatchRevelations(gatewayMock,
    {},
    { "!!!": ["@@", [{ value: ["@$expanded.but-unbound"] }]] }),
"toEqual",
() => ({ value: ["@$expanded", "but-unbound"] })
    ),
    "example#6": itExpects(
        "nested import & invoke spread to resolve all spreads",
async () => expose(lazyPatchRevelations(gatewayMock,
    {},
    {
      out: {
        "!!!": {
          prefixes: {
            "/test/v0": {
              name: "test",
              "test-lib": {
                preset: 10, overridden: 10, sessionDuration: 0,
                view: { focus: "focus to be overwritten", nulled: "nulled to be overwritten" },
                unboundAndUnsegmented: ["@$un.bound"],
              },
            },
          },
        },
        prefixes: {
          "/test/v0": {
            "!!!": ["@@", ["@!:test-lib"], ["@!invoke:callMe", [{
              view: {
                focus: "valaa-aws://example.org/deployment?id=@$~raw.f0c5-f0c5@@",
                nulled: null,
              },
              identity: { "!!!": ["./config", "revealOrigin"] },
              sessionDuration: 86400,
              unboundButSectioned: ["@$also.unbound"],
            }]]],
            "test-lib": { overridden: 20 },
          },
        }
      }
    })),
"toEqual",
() => ({
  out: {
    prefixes: {
      "/test/v0": {
        name: "test",
        "test-lib": {
          preset: 10, overridden: 20, sessionDuration: 86400,
          view: { focus: "valaa-aws://example.org/deployment?id=@$~raw.f0c5-f0c5@@", nulled: null },
          identity: "/site/revelation/config",
          unboundAndUnsegmented: ["@$un.bound"],
          unboundButSectioned: ["@$also", "unbound"],
        }
      }
    }
  }
})),
  },
  "chapter#ontology>8": {
    "dc:title": [em(preferredPrefix), ` ontology`],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": [ontologyDescription || ""],
    "chapter#section_prefixes>1": {
      "dc:title": [em(preferredPrefix), ` IRI prefixes`],
      "#0": [],
      "table#>0;prefixes": ontologyColumns.prefixes,
    },
    "chapter#section_verbs>6": {
      "dc:title": [
em(preferredPrefix), ` `, ref("VModel:Verb", "@valos/raem#Verb"), " vocabulary",
      ],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.verbs,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VModel:Verb", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          "VModel:Verb",
        ], vocabulary),
      },
    },
  },
};

runTestDoc();
