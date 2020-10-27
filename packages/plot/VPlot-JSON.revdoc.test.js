
const {
  extractee: {
    authors, ref, pkg, /* c, context, cli, command, cpath, bulleted, */
    prepareTestDoc,
  },
} = require("@valos/revdoc");

const { conjoinVPlot, disjoinVPlotOutline, disjoinVPlotString } = require(".");

const title = "VPlot JSON representations";
const { itExpects, runTestDoc } = prepareTestDoc(title);

module.exports = {
  "dc:title": title,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors("iridian"),
    shortName: "vplotJSON",
  },
  "chapter#abstract>0": {
    "#0": [
`VPlot JSON is a JSON representation of VPlot strings. It
has two formats: generic 'VPlot outlines' and their strict subset
'sectioned VPlots'.

Sectioned VPlots are the verbose, machine-processible canonical
JSON 1-1 representation of VPlot strings. Outlines are the more
concise, writable and readable but non-canonical format: many different
outlines can have the same VPlot meaning. The normalization of an
outline into its canonical, sectioned VPlot is called disjoining.

As sectioned VPlots are a subset of VPlot outlines, a sectioned VPlot
always disjoins into itself.
`],
  },

  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/raem"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`ValOS Resources And Events Model (ValOS-RAEM) API, schema and ontology\`.`,
    ],
  },

  "chapter#introduction>2": {
    "#0": [
`VPlot JSON is a JSON representation of a VPlot string.
Different VPlot JSON objects can express the same VPlot which allows
the most suitable representation to be chosen based on use case.

The canonical subset of VPlot JSON (with 1-1 mapping to VPlot strings)
is called sectioned VPlots. These use a limited subset of JSON
primitives and are designed to be easily machine-processible.

Finally, the remaining, non-sectioned VPlot JSON objects are called
VPlot outlines. Arbitrary JSON objects can be trivially escaped as
VPlot outline, allowing for generic JSON <-> VPlot roundtripping.
Edit me - this is the first payload chapter. Abstract and SOTD are
essential `, ref("ReSpec boilerplate",
    "https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide#essential-w3c-boilerplate"), `

See `, ref("ReVDoc tutorial", "@valos/revdoc/tutorial"), ` for
instructions on how to write revdoc source documents.

See also `, ref("ReVdoc specification", "@valos/revdoc"), ` and `,
ref("VDoc specification", "@valos/vdoc"), ` for reference documentation.`,
    ],
  },

  "chapter#sectioned_vplot_json>2;Sectioned VPlot JSON": {
    "#0": [`
Sectioned VPlots are the canonical JSON representation of a VPlot.
They use only a limited subset of JSON primitives: objects are not
used; the literal 'null', the booleans 'true' and 'false', all string
values and all safe integers (ie. whole numbers from -(2^53-1) to
(2^53-1)) are used to represent their corresponding contextless vparam
values directly.

All remaining VPlot elements are represented with two-entry arrays
as the titular 'sections'. The mandatory first entry contains a
"@"-prefixed section type string. The optional second entry contains
the section payload.

The first two characters of the section type determine which vplot
element the section represents:`, [
  [`'@@' denote a vplot element. The type has no other characters. The
optional payload is an array of /two/ or more sections or values.`],
  [`'@$' denote a vparam element. The remaining type characters contain
the vparam context-term. If there are none the vparam is contextless.
The optional payload is a singular section or an unencoded string
value.`],
  [`'@' denotes a vgrid element or a verb without a type. The mandatory
payload is a non-empty array of vparam sections or values.`],
  [`Remaining types denote a verb element with the verb type contained
in the characters after initial '@'. The optional payload is a
non-empty array of sections or values.`],
], `

`],
    "example#0": itExpects(
        "forms a VPlot string from VPlot section of computing a random value between 2.5 and 10",
() => conjoinVPlot(
    ["@@", [                // declare two-step path
      ["@!random"],         // first step: compute a random value
      ["@!min", [           // second step: compute the min of
        10,                 // a whole number >= Number.MIN_SAFE_INTEGER, <= Number.MAX_SAFE_INTEGER
        ["@!max", [         // and the max of
          ["@$d", "2.5"],   // a double-precision fractional number
          ["@@"],           // and the 'head' ie. the result of first step random computation
        ]],
      ]],
    ]],
),
"toEqual",
"@!random@!min$d.10$.@!max$d.2.5$.@@@@@@",
    ),
    "#1": [`
During sectioning (be it from a vplot string or from an outline) all
redundant sections are elided or simplified:`,
[
  [`Single-step vplot sections are replaced with that step itself - a
vplot represents a sequential dependency between its
constitutient steps so a single-step vplot is redundant`],
  [`VParam sections that represent null, true, false or any integer
values are replaced with the direct JSON value`],
  [`Contextless vparam sections which contain a path or a verb section
as the payload are replaced with the payload section itself.`],
],
``],
    "example#1": itExpects("elides degenerate vplot elements during sectioning",
() => disjoinVPlotString("@!random@!min$d.10$.@!max$d.2.5$.@@@@@@"),
"toEqual",
["@@", [["@!random"], ["@!min", [10, ["@!max", [["@$d", "2.5"], ["@@"]]]]]]]
    ),
  },
  "chapter#vplot_json_outline>2;VPlot JSON outlines": {
    "#0": [`
VPlot outlines are JSON structures which use convenience constructs.
`],
    "example#0": itExpects("disjoins a configuration outline",
() => disjoinVPlotOutline([
  ["@$o.folder", "vault"],
  ["@$o.vlm", "@", "webpack"],
  ["@$o.folder", "build"],
  ["@$o.import", {
    "@.:workshop": [
      ["@$o.folder", "vault", {
        "@+:workers": {
          "@+:ot-worker-hyperbridge-dev": [],
        },
        "@+:env": {
          "@.:ot:@.:ot-dev@@": [
            ["@+:public-session"],
            ["@+:session"],
            ["@~:ot-identity.json"],
            ["@~:hyperbridge-identity.json"],
          ]
        },
        "@+:revelations": {
          "@+:sites": [
            ["@.:inspire", ["@$o.folder", "vault", "dist", "revealer", "sites", "inspire"]],
            ["@+:myworld-dev"],
          ]
        }
      }],
      ["@$o.folder", "opspace", "build", ["@+:env"]]
    ]
  }, {
    "workshop.tar.gz": ["@$o.tar-gz", ["@+:workshop"]],
  }]
], "@@"),
"toEqual",
["@@", [
  ["@", [["@$o", "folder"], "vault"]],
  ["@", [["@$o", "vlm"], "@", "webpack"]],
  ["@", [["@$o", "folder"], "build"]],
  ["@", [["@$o", "import"],
    ["@.", ["workshop",
      ["@", [["@$o", "folder"],
        "vault",
        ["@+", ["env",
          ["@.", ["ot",
            ["@.", ["ot-dev"]],
            ["@+", ["public-session"]],
            ["@+", ["session"]],
            ["@~", ["ot-identity.json"]],
            ["@~", ["hyperbridge-identity.json"]],
          ]]],
        ],
        ["@+", ["revelations",
          ["@+", ["sites",
            ["@.", ["inspire",
              ["@", [["@$o", "folder"], "vault", "dist", "revealer", "sites", "inspire"]],
            ]],
            ["@+", ["myworld-dev"]],
          ]],
        ]],
        ["@+", ["workers",
          ["@+", ["ot-worker-hyperbridge-dev"]],
        ]],
      ]],
      ["@", [["@$o", "folder"], "opspace", "build", ["@+", ["env"]]]],
    ]],
    ["@.", ["workshop.tar.gz",
      ["@", [["@$o", "tar-gz"], ["@+", ["workshop"]]]],
    ]],
  ]],
]],
    ),
  },
};

runTestDoc();
