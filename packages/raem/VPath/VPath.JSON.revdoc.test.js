
const {
  extractee: {
    authors, ref, pkg, /* c, context, cli, command, cpath, bulleted, */
    prepareTestDoc,
  },
} = require("@valos/revdoc");

const { conjoinVPath, disjoinVPathOutline, disjoinVPathString } = require(".");

const title = "VPath JSON representations";
const { itExpects, runTestDoc } = prepareTestDoc(title);

module.exports = {
  "dc:title": title,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors("iridian"),
    shortName: "vpathJSON",
  },
  "chapter#abstract>0": {
    "#0": [`VPath JSON is a JSON representation of VPath strings. It
has two formats: generic 'VPath outlines' and their strict subset
'sectioned VPaths'.

Sectioned VPaths are the verbose, machine-processible canonical
JSON 1-1 representation of VPath strings. Outlines are the more
concise, writable and readable but non-canonical format: many different
outlines can have the same VPath meaning. The normalization of an
outline into its canonical, sectioned VPath is called disjoining.

As sectioned VPaths are a subset of VPath outlines, a sectioned VPath
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
`VPath JSON is a JSON representation of a VPath string.
Different VPath JSON objects can express the same VPath which allows
the most suitable representation to be chosen based on use case.

The canonical subset of VPath JSON (with 1-1 mapping to VPath strings)
is called sectioned VPaths. These use a limited subset of JSON
primitives and are designed to be easily machine-processible.

Finally, the remaining, non-sectioned VPath JSON objects are called
VPath outlines. Arbitrary JSON objects can be trivially escaped as
VPath outline, allowing for generic JSON <-> VPath roundtripping.
Edit me - this is the first payload chapter. Abstract and SOTD are
essential `, ref("ReSpec boilerplate",
    "https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide#essential-w3c-boilerplate"), `

See `, ref("ReVDoc tutorial", "@valos/revdoc/tutorial"), ` for
instructions on how to write revdoc source documents.

See also `, ref("ReVdoc specification", "@valos/revdoc"), ` and `,
ref("VDoc specification", "@valos/vdoc"), ` for reference documentation.`,
    ],
  },

  "chapter#sectioned_vpath_json>2;Sectioned VPath JSON": {
    "#0": [`
Sectioned VPaths are the canonical JSON representation of a VPath.
They use only a limited subset of JSON primitives: objects are not
used; the literal 'null', the booleans 'true' and 'false', all string
values and all safe integers (ie. whole numbers from -(2^53-1) to
(2^53-1)) are used to represent their corresponding contextless vparam
values directly.

All remaining VPath elements are represented with two-entry arrays
as the titular 'sections'. The mandatory first entry contains a
"@"-prefixed section type string. The optional second entry contains
the section payload.

The first two characters of the section type determine which vpath
element the section represents:`, [
  [`'@@' denote a vpath element. The type has no other characters. The
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
        "forms a VPath string from VPath section of computing a random value between 2.5 and 10",
() => conjoinVPath(
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
During sectioning (be it from a vpath string or from an outline) all
redundant sections are elided or simplified:`,
[
  [`Single-step vpath sections are replaced with that step itself - a
vpath represents a sequential dependency between its
constitutient steps so a single-step vpath is redundant`],
  [`VParam sections that represent null, true, false or any integer
values are replaced with the direct JSON value`],
  [`Contextless vparam sections which contain a path or a verb section
as the payload are replaced with the payload section itself.`],
],
``],
    "example#1": itExpects("elides degenerate vpath elements during sectioning",
() => disjoinVPathString("@!random@!min$d.10$.@!max$d.2.5$.@@@@@@"),
"toEqual",
["@@", [["@!random"], ["@!min", [10, ["@!max", [["@$d", "2.5"], ["@@"]]]]]]]
    ),
  },
  "chapter#vpath_json_outline>2;VPath JSON outlines": {
    "#0": [`
VPath outlines are JSON structures which use convenience constructs.
`],
    "example#0": itExpects("disjoins a configuration outline",
() => disjoinVPathOutline([
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
