
const {
  extractee: {
    em, ref,
    authors, pkg,
    filterKeysWithAnyOf, filterKeysWithNoneOf, valosRaemFieldClasses,
  },
  ontologyColumns, revdocOntologyProperties,
} = require("@valos/revdoc");

const { name, version, description, valos: { type } = {} } = require("./package");

const title = `${name} ${type} workspace`;
const {
  VEngine: {
    preferredPrefix, baseIRI, description: namespaceDescription,
    prefixes, context, referencedModules, vocabulary,
  },
  ...remainingOntology
} = require("./ontology");

module.exports = {
  "dc:title": title,
  "VDoc:tags": ["FABRIC", "WORKSPACE", "ONTOLOGY"],
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  ...revdocOntologyProperties(
      { preferredPrefix, baseIRI, prefixes, context, referencedModules }, remainingOntology),

  respecConfig: {
    specStatus: "unofficial",
    shortName: "engine",
    editors: authors("iridian"),
    authors: authors("iridian"),
  },
  "chapter#abstract>0": {
    "#0": [
      description,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/engine"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`${description}\`.`,
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
  "chapter#section_fabric>8": {
    "dc:title": [
      "The ", em(preferredPrefix), " fabric namespace of the library ontology of ", pkg(name),
    ],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_fabric_abstract>0": [
      namespaceDescription,
    ],
    "chapter#section_prefixes>1": {
      "dc:title": [em(name), " IRI prefixes"],
      "#0": [],
      "table#>0;prefixes": ontologyColumns.prefixes,
    },
    "chapter#section_classes>2": {
      "dc:title": [em(preferredPrefix), " ", ref("fabric classes", "VKernel:Class")],
      "#0": [
"This section describes fabric classes introduced by the 'VEngine' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.classes,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VKernel:Class", vocabulary),
      },
    },
    "chapter#section_properties>3": {
      "dc:title": [em(preferredPrefix), " ", ref("fabric properties", "VKernel:Property")],
      "#0": [
"This section describes fabric properties introduced by the 'VEngine' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.properties,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VKernel:Property", vocabulary),
      },
    },
    "chapter#section_methods>4": {
      "dc:title": [
        em(preferredPrefix), " ", ref("valosheath methods", "VEngine:Method"),
      ],
      "#0": [
"This section describes fabric methods introduced by the 'VEngine' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.methods,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VEngine:Method", vocabulary),
      },
    },
    "chapter#section_resolvers>5": {
      "dc:title": [em(preferredPrefix), " ", ref("field resolvers", "VValk:Resolver")],
      "#0": [
"This section describes valospace-to-fabric resolvers introduced by the 'VEngine' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.verbs,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VValk:Resolver", vocabulary),
      },
    },
    "chapter#section_globals>7": {
      "dc:title": [
        em(preferredPrefix), " ", ref("valosheath globals", "VEngine:Global"),
      ],
      "#0": [
"This section describes valosheath global objects introduced by the 'VEngine' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.globals,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VEngine:Global", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>9": {
      "dc:title": [
em(preferredPrefix), " remaining vocabulary names",
      ],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          "VKernel:Class", "VKernel:Property",
          "VState:Type", ...valosRaemFieldClasses, "VValk:Resolver",
          "VEngine:Global", "VEngine:Method",
        ], vocabulary),
      },
    },
  },

};
