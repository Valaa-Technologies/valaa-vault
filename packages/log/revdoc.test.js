const { VPlot } = require("@valos/plot");

const {
  extractee: {
    c, authors, jsonld, ref, context, cli, command, cpath, bulleted, pkg,
    prepareTestDoc,
  },
} = require("@valos/revdoc");

const { baseContext, baseContextText } = require("@valos/state");

const patchWith = require("@valos/tools/patchWith").default;

const title = "VLog format specification";
const { itExpects, runTestDoc } = prepareTestDoc(title);

let state = {
  "@context": [baseContext],
};

/* eslint-disable quote-props */

const obj = {
  "*": {
    "0": { ".N": "parent", "V:authorityURI": "valaa-local:", "*": ["1", "2"] },
    "1": { ".S*": "0", ".N": "older", "toOutside": { "@id": "6:" }, "-": ["3"] },
    "2": { ".S*": "0", ".N": "unger", "toOlder": { "@id": "1" }, "-": ["4"] },
    "6": {
      "@context": { "@base": "6/" },
      ".I": "_:0", ".S*": "_:0", ".N": "instance",
      "_": {
        "1": { ".G": "_:1", ".N": "olderGhost" },
        "2": { ".G": "_:2", ".N": "ungerGhost" },
        "3": { ".G": "_:3", ".N": "toNephewOldceptGhost", ".O-": "_:6/6/1" },
        "4": { ".G": "_:4", ".N": "toNephewUngceptGhost", ".O-": "_:6/6/2" },
        "6": {
          "@context": { "@base": "6/" },
          ".G": "_:6", ".N": "inceptor",
          "_": {
            "1": { ".G": "_:6/1", ".N": "oldceptGhost" },
            "2": { ".G": "_:6/2", ".N": "ungceptGhost" }
          }
        }
      }
    }
  },
  "-": {
    "3": { ".S-!": "1", ".N": "SIBLING", ".O-": "2" },
    "4": { ".S-!": "2", ".N": "SIBLING", ".O-": "1" }
  }
};

const vobjplot = ["@-", [
  ["@*", [
    ["@**", [
      ["@0", [
        ["@**", ["1", "2"]],
        ["@.N", ["parent"]],
        ["@.", ["V:authorityURI", "valaa-local:"]]
      ]],
      ["@1", [
        ["@*-", ["3"]],
        ["@.N", ["older"]],
        ["@.S*", ["0"]],
        ["@.", ["toOutside", ["@id", ["6:"]]]]
      ]],
      ["@2", [
        ["@*-", ["4"]],
        ["@.N", ["unger"]],
        ["@.S*", ["0"]],
        ["@.", ["toOlder", ["@id", ["1"]]]]
      ]],
      ["@6", [
        ["@.I", ["_:0"]],
        ["@.N", ["instance"]],
        ["@.S*", ["_:0"]],
        ["@context", [["@base", ["6/"]]]],
        ["@*_", [
          ["@1", [
            ["@.G", ["_:1"]],
            ["@.N", ["olderGhost"]]
          ]],
          ["@2", [
            ["@.G", ["_:2"]],
            ["@.N", ["ungerGhost"]]
          ]],
          ["@3", [
            ["@.G", ["_:3"]],
            ["@.N", ["toNephewOldceptGhost"]],
            ["@.O-", ["_:6/6/1"]]
          ]],
          ["@4", [
            ["@.G", ["_:4"]],
            ["@.N", ["toNephewUngceptGhost"]],
            ["@.O-", ["_:6/6/2"]]
          ]],
          ["@6", [
            ["@.G", ["_:6"]],
            ["@.N", ["inceptor"]],
            ["@context", [["@base", ["6/"]]]],
            ["@*_", [
              ["@1", [
                ["@.G", ["_:6/1"]],
                ["@.N", ["oldceptGhost"]]
              ]],
              ["@2", [
                ["@.G", ["_:6/2"]],
                ["@.N", ["ungceptGhost"]]
              ]]
            ]]
          ]]
        ]]
      ]]
    ]],
    ["@*-", [
      ["@3", [
        ["@.N", ["SIBLING"]],
        ["@.O-", ["2"]],
        ["@.S-!", ["1"]]
      ]],
      ["@4", [
        ["@.N", ["SIBLING"]],
        ["@.O-", ["1"]],
        ["@.S-!", ["2"]]
      ]]
    ]]
  ]]
]];

const objplot = VPlot.section(obj, {
  "@context": [
    ...state["@context"], {
      "_": "_",
      "0": "~u4:cccccccc-6600-2211-cc77-333333333333",
      "1": "~u4:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "2": "~u4:bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
      "3": "~u4:abababab-bbbb-cccc-dddd-eeeeeeeeeeee",
      "4": "~u4:babababa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "5": "valaa-test:?id=@$~raw:out@@#",
      "6": "~u4:11111111-2255-7744-22cc-eeeeeeeeeeee"
    },
  ],
});
console.log("vplot section:", JSON.stringify(objplot));
const vplot = VPlot.stringify(objplot);
console.log("vplot string:", vplot);
// console.log("obj:", JSON.stringify(VPlot.section(objplot), null, 2));

const vplotOutline = VPlot.outline(vplot);
console.log("vplot outline:", vplotOutline);

module.exports = {
  "dc:title": title,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors("iridian"),
    shortName: "vlog",
  },

  "chapter#abstract>0": {
    "#0": [
`ValOS log ('VaLog') format specifies an ontology and algorithms for
expressing a ValOS chronicle change event history as a sequence of
`, ref("VState", "@valos/state"), `-formatted JSON-LD document
entries.`,
    ],
  },

  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/log"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`VaLog specification and reference implementation\`.`,
    ],
  },

  "chapter#introduction>2": {
    "#0": [
`Edit me - this is the first payload chapter. Abstract and SOTD are
essential `, ref("ReSpec boilerplate",
    "https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide#essential-w3c-boilerplate"), `

See `, ref("ReVDoc tutorial", "@valos/revdoc/tutorial"), ` for
instructions on how to write revdoc source documents.

See also `, ref("ReVdoc specification", "@valos/revdoc"), ` and `,
ref("VDoc specification", "@valos/vdoc"), ` for reference documentation.`,
    ],
  },

  "chapter#principles>3;General principles": {
    "#0": [
`General design concepts, aims and ideas and out-right in a mish-mash
wish-list:`,
      { "bulleted#0": [
[`Each event is a named graph with a name that is a monotonically
  increasing vpath-name derived based on the chronicle id itself.`],
[`Event graphs are thus disjoint when flattened.`],
[`Reduction is the process of applying the events in succession from
  the very beginning of the vlog and yields a snapshot vstate graph.`],
[`Reduction consists of validation, stripping and update steps.`],
[`Validation rejects heretical events. Stripping removes event metadata
  and splits the remaining payload to separate update stages. Update
  applies these parts to state.`],
[`Stripping and update should be computationally simple, naive even, as
  they are unavoidable and often heavily repeated.`],
[`Validation can often be selectivelly waived and thus can be
  incrementally, if not outrageously, costlier.`],
[`Event payload should be bytewise minimal. VLogs can appear anywhere
  and compression aint free either.`],
[`Event payload should be as flat as possible to facilitate easy
  introspection APIs`],
[`Events must be valid and internally consistent JSON-LD even in
  isolation but they don't need to be semantically complete.`],
[`Events need to be semantically complete when evaluated using the
  accumulated parent context of all previous vlog events.`],
[`Cryptographical signing of event payloads by user signatures should
  be simple.`],
[`Event creators can specify crypto-behaviors that add validateable
  constraints to the future vlog operations.`],
[`Constraints can be used to limit the addition of new
  crypto-behaviors`],
[`Reordering of events by vlog authorities should be possible whenever
  it can be proven that reordering doesn't change essential semantics`],
[`Event creators can specify what is considered essential semantics by
  crypto-behaviors`],
[`Dual construct is a triple which is directly 'reified' by a resource
  in the same named graph. Properties and Relations have dual nature.`],
      ] },
``
    ],
  },

  "chapter#examples>6;Examples": {
    "#0": [
`The examples use the standard context as the initial starting context.
Each successive example uses the output state of the previous example
as its input state.`
    ],
    "example#>0;Initial state @context": jsonld(baseContextText),
    "#1": [
`The first vlog event shall create the chronicle root resource with an
id equal to the vlog chronicle id itself. The id URN of the root
resource is added into the context with key "0". The root resource is
assigned a blank node '_:0' that corresponds to id context entry URN.`,
    ],
    "example#>1": itExpects(
        "creates chronicle root entity",
() => (state = applyVLogDelta(state, {
  "@context": [{
    "0": "~u4:cccccccc-6600-2211-cc77-333333333333"
  }],
  "*": { "0": { ".N": "rootName", "V:authorityURI": "valaa-local:" } }
})),
        "toMatchObject",
{
  "@context": [{}, {
    "0": "~u4:cccccccc-6600-2211-cc77-333333333333"
  }],
  "*": { "0": { ".N": "rootName", "V:authorityURI": "valaa-local:" } }
}),
    "#2": [
`New resources have chronicle-local index names.
These local names are valid only within the event itself
and start counting from 0 for each event.

During reduction these names are translated into vlog names, which
start with '^+', '^~' or '^-' (for Entity, Media and Relation types
respectively) and are followed by an integer which identifies the
resource within that chronicle with that type uniquely in perpetuity.
These relative names can be used within all contexts that have this
chronicle as their primary context, most notably in all future vlog
events of this chronicle.

References to resources in other chronicles ('global names') use the
vgrid (combined with chronicle URI) of the resource.
.`
    ],
    "example#>2": itExpects(
        "creates a resource with various references",
() => (state = applyVLogDelta(state,
{
  "@context": [{
    "1": "~u4:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "2": "~u4:bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
    "3": "~u4:abababab-bbbb-cccc-dddd-eeeeeeeeeeee",
    "4": "~u4:babababa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "5": "valaa-test:?id=@$~raw:out@@#"
  }],
  "*": {
    "0": { ".N": "newRootName" },
    "1": { ".S*": "0", ".N": "older", toOutside: { "@id": "5:" } },
    "2": { ".S*": "0", ".N": "unger", toOlder: { "@id": "1:" } }
  },
  "-": {
    "3": { ".S-!": "1", ".N": "SIBLING", ".O-": "2" },
    "4": { ".S-!": "2", ".N": "SIBLING", ".O-": "1" }
  },
})),
        "toMatchObject",
{
  "@context": [{}, {
    "0": "~u4:cccccccc-6600-2211-cc77-333333333333",
    "1": "~u4:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "2": "~u4:bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
    "3": "~u4:abababab-bbbb-cccc-dddd-eeeeeeeeeeee",
    "4": "~u4:babababa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "5": "valaa-test:?id=@$~raw:out@@#"
  }],
  "*": {
    "0": { ".N": "newRootName", "V:authorityURI": "valaa-local:", "*": ["1", "2"] },
    "1": { ".S*": "0", ".N": "older", toOutside: { "@id": "5:" }, "-": ["3"] },
    "2": { ".S*": "0", ".N": "unger", toOlder: { "@id": "_:1" }, "-": ["4"] }
  },
  "-": {
    "3": { ".S-!": "1", ".N": "SIBLING", ".O-": "2" },
    "4": { ".S-!": "2", ".N": "SIBLING", ".O-": "1" }
  },
}
    ),
    "#3": [`
Ghost instancing and the subscript vpath verb '_' are the cornerstone
of the unified valos resource model. Blank nodes are used to express
vplots with the added ability of being able to refer to vlog context
resource terms.
`],
    "example#>3": itExpects(
        "instances a resource with ghosts",
() => (state = applyVLogDelta(state,
{
  "@context": [{
    "6": "~u4:11111111-2255-7744-22cc-eeeeeeeeeeee",
  }],
  "*": {
    "6": {
      ".S*": "0", ".I": "0", ".N": "instance",
      _: {
        "1": { ".N": "olderGhost" },
        "6": { ".N": "inceptor",
          _: { "2": { ".N": "ungceptGhost" } }
        }
      }
    },
    "6/2": { ".N": "ungerGhost" },
    "6/6/1": { ".N": "oldceptGhost" }
  },
  "-": {
    "6/3": { ".N": "toNephewOldceptGhost", ".O-": "6/6/1" },
    "6/4": { ".N": "toNephewUngceptGhost", ".O-": "6/6/2" }
  }
})),
        "toMatchObject",
{
  "@context": [{
    "^": "urn:valos:",
    "@base": "_:",
    "@vocab": "urn:valos:.$.",

    "V": "https://valospace.org/0#",

    "*": { "@id": "V:ownsEntity", "@type": "@id", "@container": "@id" },
    "-": { "@id": "V:ownsRelation", "@type": "@id", "@container": "@id" },
    "~": { "@id": "V:ownsMedia", "@type": "@id", "@container": "@id" },
    ".": { "@id": "V:ownsProperty", "@type": "@id", "@container": "@id" },
    "_": { "@id": "V:ownsGhost", "@type": "@id", "@container": "@id" },

    ".I": { "@id": "V:instanceOf", "@type": "@id" },
    ".G": { "@id": "V:ghostOf", "@type": "@id" },

    ".N": { "@id": "V:name" },
    ".P": { "@id": "V:name", "@type": "@id" },

    ".S": { "@id": "V:subject", "@type": "@id" },
    ".O": { "@id": "V:object" },

    ".S.": { "@id": "V:scope", "@type": "@id" },
    ".O.": { "@id": "V:value", "@type": "@id" },

    ".S*": { "@id": "V:parent", "@type": "@id" },
    ".O*": { "@id": "V:id", "@type": "@id" },

    ".S~": { "@id": "V:folder", "@type": "@id" },
    ".O~": { "@id": "V:content", "@type": "@id" },

    ".S-": { "@id": "V:source", "@type": "@id" },
    ".O-": { "@id": "V:target", "@type": "@id" },

    ".S-!": { "@id": "V:graphSource", "@type": "@id" },
    ".O-!": { "@id": "V:graphTarget", "@type": "@id" },

    "-out": { "@id": "V:outRelation", "@type": "@id", "@container": "@list" },
    "-in": { "@id": "V:inRelation", "@type": "@id", "@container": "@list" },

    "VLog": "https://valospace.org/log/0#",
    "VSourcerer": "https://valospace.org/sourcerer/0#",
    "VState": "https://valospace.org/state/0#",

    "~u4": "https://valospace.org/state/u4/0#",
  }, {
    "0": "~u4:cccccccc-6600-2211-cc77-333333333333",
    "1": "~u4:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "2": "~u4:bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
    "3": "~u4:abababab-bbbb-cccc-dddd-eeeeeeeeeeee",
    "4": "~u4:babababa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "5": "valaa-test:?id=@$~raw:out@@#",
    "6": "~u4:11111111-2255-7744-22cc-eeeeeeeeeeee"
  }],
  "*": {
    "0": { ".N": "parent", "V:authorityURI": "valaa-local:", "*": ["1", "2"] },
    "1": { ".S*": "0", ".N": "older", "toOutside": { "@id": "6:" }, "-": ["3"] },
    "2": { ".S*": "0", ".N": "unger", "toOlder": { "@id": "1" }, "-": ["4"] },
    "6": {
      "@context": { "@base": "6/" },
      ".I": "_:0", ".S*": "_:0", ".N": "instance",
      "_": {
        "1": { ".G": "_:1", ".N": "olderGhost" },
        "2": { ".G": "_:2", ".N": "ungerGhost" },
        "3": { ".G": "_:3", ".N": "toNephewOldceptGhost", ".O-": "_:6/6/1" },
        "4": { ".G": "_:4", ".N": "toNephewUngceptGhost", ".O-": "_:6/6/2" },
        "6": {
          "@context": { "@base": "6/" },
          ".G": "_:6", ".N": "inceptor",
          "_": {
            "1": { ".G": "_:6/1", ".N": "oldceptGhost" },
            "2": { ".G": "_:6/2", ".N": "ungceptGhost" }
          }
        },
      }
    }
  },
  "-": {
    "3": { ".S-!": "1", ".N": "SIBLING", ".O-": "2" },
    "4": { ".S-!": "2", ".N": "SIBLING", ".O-": "1" }
  }
}

    ),
  },
};

runTestDoc();

function applyVLogDelta (currentState, valogEvent) {
  return patchWith({}, ["...", currentState, valogEvent], {});
}

/*
rootEntity.subEntity.dataContainer.$V.log = [
  { value: 15, aspects: { command: { timeStamp } } },
  { value: 16, aspects: {} },
  { value: 15, aspects: {} },
  { value: 16, aspects: {} },
  { value: 20, aspects: {} },
  { value: 15, aspects: {} },
  { value: 15, aspects: {} },
  { value: 15, aspects: {} },
];
*/
