
const {
  extractee: {
    c, authors, jsonld, ref, context, cli, command, cpath, bulleted, pkg,
    prepareTestDoc,
  },
} = require("@valos/revdoc");

const { baseContext, baseContextText } = require(".");

const title = "VState specification";
const { itExpects, runTestDoc } = prepareTestDoc(title);

module.exports = {
  "dc:title": title,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors("iridian"),
    shortName: "vstate",
  },
  "chapter#abstract>0": {
    "#0": [
`ValOS state ('VState') format specifies an ontology and algorithms for
serializing valospace state, state changes and associated metadata as
a JSON-LD document.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/state"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`VState format specification and reference implementation\`.`,
    ],
  },
  "chapter#introduction>2;Valospace state JSON-LD serialization": {
    "#0": [
`JSON-LD is the primary state format. Some of this information is lost
when it is expanded as triples.`,
    ],
  },
  "chapter#principles>3;General principles": {
    "#0": [
`General design principles.`, {
  "bulleted#0": [
[""],
] }, `
`],
  },
  "chapter#examples>6;Examples": {
    "#0":
`JSON-LD is the primary state format. Some of this information is lost
when it is expanded as triples.
`,
    "example#1": itExpects("trivial testdoc test",
            () => ({ value: 10 }),
            "toEqual",
            { value: 10 }),
    "example#state_example>1;An example of state JSON-LD serialization": [
      jsonld(
`[{
  "@context": [${baseContextText}, {
    "pot": "https://oftrust/#",
    "pot_hypertwin": "https://pot.hypertwin.valospace.org/#",
  }, {
    ">a-0": "valaa-test:",
    ">a-0-c": ">a-0:?id=@",
    ">c-0": ">a-0-c:$~raw.testlane@_$~plt.@.$pot:@.O.:building1id@@@@@@",
    ">hyperlane": ">c-0:#@$~raw.testlane@_$~plt.@.$pot:@.O.:building1id@@@@@",
    ">thistwinroot": ">hyperlane:@_$~plt.@.$pot:@.O.:building1id@@@@@",
  }, {
    ">0": ">hyperlane:_$~plt.@.$pot:@.O.:aa592f56-1d82-4484-8360-ad9b82d00592@@@@@",
    ">1": ">hyperlane:@_$~plt.@.$pot:@.O.:user1-hyperprime-id@@@@@",
    ">2": ">hyperlane:@_$~plt.@.$pot:@.O.:user2-hyperprime-id@@@@@",
  }, {
  }, {
  }, {
    "^+0": ">thistwinroot:",
    "^+0+0": "^+0:+$pot_hypertwin.inLinks@",
    "^+0+0-0": "^+0+0:-in-$pot.ownerOf$.@.S--$.@$~plt.@.$pot$.@.O.$.aa592f56-1d82-4484-8360-ad9b82d00592@@@@@@@@@",
    "^+0~0": "^+0:~$.foo.vs@",
    "^+0-0": "^+0:-out-$.RIGHTS@_:15-1@",
    "^+0-1": "^+0:-out-$.RIGHTS@_:234-3@",
  }, {
    "^-0": "^:@$~raw.b@",
    "^-1": "^:@$~raw.d@"",
  }, {
    // ~
  }],
  "@id": ">c-0:",
  "VState:global": {
    "V:Entity": [{
      "@id": "^+0:@",
      "@.P": "thistwinname",
      "pot:": "building1id",
      "pot:area": 400,
      "blah%3Afoo": "content",
      "foo": { "@id": "^+0~0:@" },
      "title": "sumtext",
      "@.": {
        "foo": { "@id": "^+0:.$.foo@@", "V:isFrozen": true }
      },
      "@+": [{
        "@id": "^+0+0:@",
        "@-": [
          { "@id": "^+0+0-0:@", "@.S--": ">0:@", "@.P": "$pot.ownerOf", "@.O--": "^+0:@" }
        ]
      }],
      "@~": [
        { "@id": "^+0~0:@", "@.P": "foo.vs" }
      ],
      "@-": [
        { "@id": "^+0-0:@", "@.S--": "^+0:@", "@.P": "RIGHTS", "@.O-": ">1:@", "write": true },
        "^-0:@",
        { "@id": "^+0-1:@", "@.S--": "^+0:@", "@.P": "RIGHTS", "@.O-": ">2:@", "write": false },
        "^-1:@",
      ],
      "@-out-": [
        "^+0-0:@",
        "^+0-1:@",
      ],
      "@-in-": [
        "^-0:@",
        "^+0+0-0",
        "^-1:@",
      ]
    }],
    "V:Relation": [{
      "@id": "^-0:@",
    }, {
      "@id": "^-1:@",
    }]
  }
}]`),
    ],
    "#1": `
TODO.`,
  },
};

runTestDoc();
