
const {
  extractee: { authors, jsonld, pkg },
} = require("@valos/revdoc");

/* eslint-disable max-len */

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
    "$V": "https://valospace.org/0#",
    "@vocab": "urn:valos:.$.",

    "/.S": { "@id": "$V:subject", "@type": "@id" },
    "/.P": { "@id": "$V:name", "@type": "@id" },
    "/.O": { "@id": "$V:object" },

    "/.": { "@id": "$V:properties", "@type": "@id", "@container": "@index" },
    "/.S.": { "@id": "$V:scope", "@type": "@id" },
    "/.O.": { "@id": "$V:value", "@type": "@id" },

    "/+": { "@id": "$V:entities", "@type": "@id", "@container": "@index" },
    "/.S+": { "@id": "$V:parent", "@type": "@id" },
    "/.O+": { "@id": "$V:id", "@type": "@id" },

    "/~": { "@id": "$V:medias", "@type": "@id", "@container": "@index" },
    "/.S~": { "@id": "$V:folder", "@type": "@id" },
    "/.O~": { "@id": "$V:content", "@type": "@id" },

    "/*": { "@id": "$V:relations", "@type": "@id", "@container": "@list" },
    "/-out": { "@id": "$V:outRelations", "@type": "@id", "@container": "@list" },
    "/*in": { "@id": "$V:inRelations", "@type": "@id", "@container": "@list" },
    "/-out-": { "@id": "$V:pairedOutRelations", "@type": "@id", "@container": "@list" },
    "/-in-": { "@id": "$V:pairedInRelations", "@type": "@id", "@container": "@list" },
    "/-out--": { "@id": "$V:connectedOutRelations", "@type": "@id", "@container": "@list" },
    "/-in--": { "@id": "$V:connectedInRelations", "@type": "@id", "@container": "@list" },
    "/.S-": { "@id": "$V:source", "@type": "@id" },
    "/.O-": { "@id": "$V:target", "@type": "@id" },
    "/.S--": { "@id": "$V:pairedSource", "@type": "@id" },
    "/.O--": { "@id": "$V:pairedTarget", "@type": "@id" },
    "/.S---": { "@id": "$V:connectedSource", "@type": "@id" },
    "/.O---": { "@id": "$V:connectedTarget", "@type": "@id" },

    "--$V": "https://valospace.org/removed-from/0#",
    "--/.": { "@id": "--$V:properties", "@type": "@id" },
    "--/+": { "@id": "--$V:entities", "@type": "@id" },
    "--/~": { "@id": "--$V:medias", "@type": "@id" },
    "--/-": { "@id": "--$V:relations", "@type": "@id" },
    "--/-out-": { "@id": "--$V:pairedOutRelations", "@type": "@id" },
    "--/-in-": { "@id": "--$V:pairedInRelations", "@type": "@id" },

    "$~u4": { "@id": "urn:valos:$~u4.", "@prefix": true },
    "$~plt": { "@id": "urn:valos:$~plt.", "@prefix": true },

    "$VLog": "https://valospace.org/log/0#",
    "/hasGlobal": { "@id": "$VLog:hasGlobal", "@container": "@type" },
  }, {
    "$pot": "https://oftrust/#",
    "$pot_hypertwin": "https://pot.hypertwin.valospace.org/#",
  }, {
    "^a-0": "valaa-test:",
    "^a-0-c": "^a-0:?id=@",
    "^c-0": "^a-0-c:$~raw.testlane@_$~plt.@.$pot$.@.O.$.building1id@@@@@@",
    "^hyperlane": "^c-0:#@$~raw.testlane@_$~plt.@.$pot$.@.O.$.building1id@@@@@",
    "^thistwinroot": "^hyperlane:@_$~plt.@.$pot$.@.O.$.building1id@@@@@",
    "^user1": "^hyperlane:@_$~plt.@.$pot$.@.O.$.user1-hyperprime-id@@@@@",
    "^user2": "^hyperlane:@_$~plt.@.$pot$.@.O.$.user2-hyperprime-id@@@@@"
  }],
  "@id": "^c-0:",
  "/hasGlobal": {
    "$V:Entity": [{
      "@context": {
        "^0": "^thistwinroot:",
        "^0-0": "^0:*$pot_hypertwin.inLinks@"
      },
      "@id": "^0:@",
      "/.P": "thistwinname",
      "$pot:": "building1id",
      "$pot:area": 400,
      "blah%3Afoo": "content",
      "foo": { "@id": "^0:~$.foo.vs@" },
      "title": "sumtext",
      "/.": {
        "foo": { "@id": "^0:.$.foo@", "$V:isFrozen": true }
      },
      "/+": {
        "$pot_hypertwin:inLinks": {
          "@id": "^0-0:@",
          "/*": [{
            "@id": "^0-0:-in-$pot.ownerOf$.@.S--$.@$~plt.@.$pot$.@.O.$.aa592f56-1d82-4484-8360-ad9b82d00592@@@@@@@@@@",
            "/.S--": "^hyperlane:_$~plt.@.$pot$.@.O.$.aa592f56-1d82-4484-8360-ad9b82d00592@@@@@@"
            "/.P": "$pot.ownerOf",
            "/.O--": "^0:@",
          }]
        }
      },
      "/~": {
        "foo.vs": { "@id": "^0:~$.foo.vs@" }
      },
      "/-": [{
          "@id": "^0:-out-$.PERMISSIONS@_$.15-1@@",
          "/.S--": "^0:@", "/.P": "PERMISSIONS", "/.O-": "^user1:@",
          "write": true,
        },
        "@$~u4.b@@", {
          "@id": "^0:-out-$.PERMISSIONS@_$.234-3@@",
          "/.S--": "^0:@", "/.P": "PERMISSIONS", "/.O-": "^user2:@",
          "write": false,
        },
        "@$~u4.d@@",
      ],
      "/-out-": [
        "^0:-out-$.PERMISSIONS@_$.15-1@@",
        "^0:-out-$.PERMISSIONS@_$.234-3@@",
      ],
      "/-in-": [
        "@$~u4.b@@",
        "^0-0:-in-$pot.ownerOf:@.S--$.@$~plt.@.$pot$.@.O.$.aa592f56-1d82-4484-8360-ad9b82d00592@@@@@@@@@",
        "@$~u4.d@@"
      ]
    }],
    "$V:Relation": [{
      "@context": { "^0": "@$~u4.b@" }, "@id": "^0:@",
    }, {
      "@context": { "^0": "@$~u4.d@" }, "@id": "^0:@",
    }]
  }
}]`),
    ],
    "#1": `
TODO.`,
  },
};
