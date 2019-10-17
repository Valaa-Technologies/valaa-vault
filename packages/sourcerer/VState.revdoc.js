
const {
  extractee: { authors, jsonld, pkg },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": "ValOS state serialization format",
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "stateFormat",
  },
  "chapter#abstract>0": {
    "#0": [
`ValOS state format specification for serializing valospace state into
a JSON-LD document with a well-defined underlying semantic ontology.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is a stub of a specification and only contains a single
example that is used as the model for the specification.

This document is part of the library workspace `, pkg("@valos/sourcerer"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`ValOS Sourcerer API, schema\``,
    ],
  },
  "chapter#introduction>2;Valospace state JSON-LD serialization": {
    "#0":
`JSON-LD is the primary state format. Some of this information is lost
when it is expanded as triples.
`,
    "example#state_example>0;An example of state JSON-LD serialization": [
      jsonld(
`[{
  "@context": [{
    "$": "https://valospace.org/#",
    "@vocab": "urn:valos:.:",

    "/.": { "@id": "$:properties", "@type": "@id", "@container": "@index" },
    "/-.": { "@id": "$:value", "@type": "@id" },
    "/+": { "@id": "$:entities", "@type": "@id", "@container": "@index" },
    "/-+": { "@id": "$:parent", "@type": "@id" },
    "/'": { "@id": "$:medias", "@type": "@id", "@container": "@index" },
    "/-'": { "@id": "$:content", "@type": "@id" },
    "/*": { "@id": "$:connectedRelations", "@type": "@id", "@container": "@list" },
    "/*)~": { "@id": "$:pairedOutRelations", "@type": "@id" },
    "/*(~": { "@id": "$:pairedInRelations", "@type": "@id" },

    "/-(": { "@id": "$:source", "@type": "@id" },
    "/-)": { "@id": "$:target", "@type": "@id" },
    "/~(": { "@id": "$:pairedSource", "@type": "@id" },
    "/~)": { "@id": "$:pairedTarget", "@type": "@id" },

    "$!u4": { "@id": "urn:valos:$!u4:", "@prefix": true },
    "$!pw": { "@id": "urn:valos:$!pw:", "@prefix": true },

    "$valos-sourcerer": "https://valospace.org/sourcerer#",
    "/hasGlobal": { "@id": "$valos-sourcerer:hasGlobal", "@container": "@type" },

    "$pot": "https://oftrust/#",
    "$pot-hypertwin": "https://pot.hypertwin.valospace.org/#",
    "^pot-hypertwin-index": "$!u4:55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0"
  }, {
    "^thistwinroot": "^pot-hypertwin-index:@~$!pw$:@.$pot@-:7741938f-801a-4892-9cf0-dd59bd8c9166@",
    "^user1": "^pot-hypertwin-index:@~$!pw$:@.$pot@-:u535-b457-1710-aaaa-bbbbccccdddd@",
    "^user2": "^pot-hypertwin-index:@~$!pw$:@.$pot@-:u535-b457-1710-dddd-eeeeffff0000@"
  }],
  "@id": "http://foobar.com/?id=$!u4:55a5c4fb-1fd4-424f-8578-7b06ffdb3ef0:@~$!pw$:@.$pot@-:7741938f-801a-4892-9cf0-dd59bd8c9166@",
  "/hasGlobal": {
    "$:Entity": [{
      "@context": {
        "^0": "^thistwinroot:",
        "^0-1": "^0:@+$pot-hypertwin:inLinks"
      },
      "@id": "^0:",
      "$:name": "thistwinname",
      "$pot:": "7741938f-801a-4892-9cf0-dd59bd8c9166",
      "$pot:area": 400,
      "blah%3Afoo": "content",
      "foo": { "@id": "^0:@':foo.vs" },
      "title": "sumtext",
      "/.": {
        "foo": { "@id": "^0:@.:foo", "$:isFrozen": true }
      },
      "/'": {
        "foo.vs": { "@id": "^0:@':foo.vs" }
      },
      "/+": {
        "$pot-hypertwin:inLinks": {
          "@id": "^0-1:",
          "/*": [{
            "@id":
                "^0-1:@*(~$pot:ownerOf@~(:@$!pw$:@.$pot@-:aa592f56-1d82-4484-8360-ad9b82d00592@@",
            "$:name": { "@id": "$pot:ownerOf" },
            "/~)": "^0:",
            "/~(": "^pot-hypertwin-index:@~$!pw$:@.$pot@-:aa592f56-1d82-4484-8360-ad9b82d00592@"
          }]
        }
      },
      "/'": {
        "foo.vs": { "@id": "^0:@':foo.vs" }
      },
      "/*": [{
          "@id": "^0:@*)~:PERMISSIONS@_:15-1",
          "$:name": "PERMISSIONS",
          "/~(": "^0:", "/-)": "^user1:",
          "write": true
        },
        "$!u4:b",
        "^0-1:@*(~$pot:ownerOf@~(:@$!pw$:@.$pot@-:aa592f56-1d82-4484-8360-ad9b82d00592@@", {
          "@id": "^0:@*)~:PERMISSIONS@_:234-3",
          "$:name": "PERMISSIONS",
          "/~(": "^0:", "/-)": "^user2:",
          "write": false
        },
        "$!u4:d"
      ],
      "/*)~": [
        "^0:@*:PERMISSIONS@_:15-1",
        "^0:@*:PERMISSIONS@_:234-3"
      ],
      "/*(~": [
        "$!u4:b",
        "^0:@*(~$pot:ownerOf@-:@$!pw$:@.$pot@-:aa592f56-1d82-4484-8360-ad9b82d00592@@"],
        "$!u4:d"
      ]
    }],
    "$:Relation": [{
      "@context": { "^0": "$!u4:b" }, "@id": "^0:"
    }, {
      "@context": { "^0": "$!u4:d" }, "@id": "^0:"
    }]
  }
}]`),
    ],
    "#1": `
TODO.`,
  },
};
