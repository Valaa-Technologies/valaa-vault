
const {
  extractee: {
    authors, em, ref, pkg,
    filterKeysWithAnyOf, filterKeysWithNoneOf, prepareTestDoc,
  },
  ontologyHeaders,
} = require("@valos/revdoc");

const { wrapError } = require("@valos/tools/wrapError");

const { lazyPatchRevelations } = require("./Revelation");

const {
  revela: { prefix, prefixIRI, prefixes, vocabulary, context },
 } = require("./ontologies");

const { name, version } = require("./package");

const title = "revela.json format specification";
const { itExpects, runTestDoc } = prepareTestDoc(title);

const gatewayMock = {
  siteRoot: "/site",
  domainRoot: "/",
  revelationRoot: "/site/revelation/",
  require (requireKey) {
    return {
      requireKey,
      someField: 1,
      callMe (p) { return ({ [requireKey]: p }); },
    };
  },
  fetch (fetchOptions) {
    return {
      fetchOptions,
      fetchedField: 1,
    };
  },
  wrapErrorEvent: wrapError,
};

module.exports = {
  "dc:title": title,
  "vdoc:tags": ["INTRODUCTORY", "ONTOLOGY", "TESTDOC"],
  "revdoc:package": name,
  "revdoc:prefix": prefix,
  "revdoc:prefixIRI": prefixIRI,
  "revdoc:version": version,
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
() => lazyPatchRevelations(gatewayMock, { a: [1] }, { a: [2] }),
        "toEqual",
() => ({ a: [1, 2] })),
    "example#2": itExpects(
        "spread of a simple relative import",
() => lazyPatchRevelations(gatewayMock, {}, { "!!!": "./path" }),
        "toMatchObject",
() => ({ requireKey: "/site/revelation/path", someField: 1 })),
    "example#3": itExpects(
        "spread of an explicit site root import followed by field access",
() => lazyPatchRevelations(gatewayMock, "", {
  "!!!": ["/path", "requireKey"],
}),
        "toEqual",
"/site/path"),
    "example#4": itExpects(
        "spread of a URI import followed by pick-array append",
async () => lazyPatchRevelations(gatewayMock, [0], {
  "!!!": [["$https:foobar.com/path"], [
    ["@", [".:fetchedField"]],
    ["@", [".:fetchOptions"], [".:input"]],
  ]],
}),
        "toEqual",
() => [0, 1, "https://foobar.com/path"]),
    "example#5": itExpects(
        "nested import & invoke spread to resolve all spreads",
async () => lazyPatchRevelations(gatewayMock, {}, {
  out: {
    "!!!": {
      prefixes: {
        "/test/v0": {
          name: "test",
          "test-lib": {
            preset: 10, overridden: 10, sessionDuration: 0,
            view: { focus: "focus to be overwritten", nulled: "nulled to be overwritten" },
            expandedButUnbound: ["$un:bound"],
          },
        },
      },
    },
    prefixes: {
      "/test/v0": {
        "!!!": ["test-lib", ["!$valk:invoke:callMe", {
          view: {
            focus: "valaa-aws://example.org/deployment?id=f0c5-f0c5",
            nulled: null,
          },
          identity: { "!!!": ["./config", "requireKey"] },
          sessionDuration: 86400,
          expandedAlsoUnbound: ["$also:unbound"],
        }]],
        "test-lib": { overridden: 20 },
      },
    }
  }
}),
        "toEqual",
() => ({
  out: {
    prefixes: {
      "/test/v0": {
        name: "test",
        "test-lib": {
          preset: 10, overridden: 20, sessionDuration: 86400,
          view: { focus: "valaa-aws://example.org/deployment?id=f0c5-f0c5", nulled: null },
          identity: "/site/revelation/config",
          expandedButUnbound: ["$un:bound"],
          expandedAlsoUnbound: ["$", "also", "unbound"],
        }
      }
    }
  }
})),
  },
  "chapter#ontology>8": {
    "dc:title": [em(prefix), ` ontology`],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": [
em(prefix), ` ontology specifies the verbs specific to revela.json
files.`,
    ],
    "chapter#section_prefixes>1": {
      "dc:title": [em(prefix), ` IRI prefixes`],
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
    },
    "chapter#section_verbs>6": {
      "dc:title": [em(prefix), ` `, ref("valos-raem:Verb", "@valos/raem#Verb"), ` vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.verbs,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-raem:Verb", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(prefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.vocabularyOther,
        "vdoc:entries": filterKeysWithNoneOf("@type", [
          "valos-raem:Verb",
        ], vocabulary),
      },
    },
  },
};

runTestDoc();
