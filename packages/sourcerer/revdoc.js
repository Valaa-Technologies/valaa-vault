
const {
  extractee: {
    c, authors, em, pkg, ref,
    filterKeysWithAnyOf, filterKeysWithNoneOf, valosRaemFieldClasses,
  },
  ontologyHeaders,
} = require("@valos/revdoc");

const {
  VSourcerer: { preferredPrefix, baseIRI, prefixes, vocabulary, context },
} = require("./ontologies");

const { name, version, description } = require("./package");

module.exports = {
  "dc:title": description,
  "VDoc:tags": ["PRIMARY", "INTRODUCTORY", "ONTOLOGY", "LIBRARY"],
  "VRevdoc:package": name,
  "VRevdoc:preferredPrefix": preferredPrefix,
  "VRevdoc:baseIRI": baseIRI,
  "VRevdoc:version": version,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "sourcerer",
  },
  "chapter#abstract>0": {
    "#0": [
`This library provides the definitions and reference implementation
of the ValOS sourcerer architecture which is used to route `,
c("ValOS event streams"), `.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/sourcerer"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`ValOS Sourcerer API, schema\``,
    ],
  },
  "chapter#introduction>2": {
    "#0": [],
  },
  "chapter#ontology>8": {
    "dc:title": [`library `, em(name), ` ontology, preferred prefix `, em(preferredPrefix)],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": [
`${name} ontology specifies the Valospace core types and
properties directly to the @valos/kernel namespace. `,
    ],
    "chapter#section_prefixes>1": {
      "dc:title": [em(name), ` IRI prefixes`],
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
    },
    "chapter#section_classes>2": {
      "dc:title": [
em(preferredPrefix), ` `, ref("VKernel:Class", "@valos/kernel#Class"), " vocabulary",
      ],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:headers": ontologyHeaders.classes,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VKernel:Class", vocabulary),
      },
    },
    "chapter#section_properties>3": {
      "dc:title": [
em(preferredPrefix), ` `, ref("VKernel:Property", "@valos/kernel#Property"), " vocabulary",
      ],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:headers": ontologyHeaders.properties,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VKernel:Property", vocabulary),
      },
    },
    "chapter#section_types>4": {
      "dc:title": [
em(preferredPrefix), ` `, ref("VModel:Type", "@valos/raem#Type"), " vocabulary",
      ],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:headers": ontologyHeaders.types,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VModel:Type", vocabulary),
      },
    },
    "chapter#section_fields>5": {
      "dc:title": [
em(preferredPrefix), ` `, ref("VModel:Field", "@valos/raem#Field"), " vocabulary",
      ],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:headers": ontologyHeaders.fields,
        "VDoc:entries": filterKeysWithAnyOf("@type", valosRaemFieldClasses, vocabulary),
      },
    },
    "chapter#section_resolvers>6": {
      "dc:title": [
em(preferredPrefix), ` `, ref("VModel:Resolver", "@valos/raem#Resolver"), " vocabulary",
      ],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:headers": ontologyHeaders.verbs,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VModel:Resolver", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:headers": ontologyHeaders.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          "VKernel:Class", "VKernel:Property",
          "VModel:Type", ...valosRaemFieldClasses, "VModel:Resolver",
        ], vocabulary),
      },
    },
    "chapter#section_context>9": {
      "dc:title": [em(preferredPrefix), ` JSON-LD context term definitions`],
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
};
