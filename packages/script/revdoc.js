
const {
  extractee: {
    em, ref,
    authors, pkg,
    filterKeysWithAnyOf, filterKeysWithNoneOf, valosRaemFieldClasses
  },
  ontologyHeaders,
} = require("@valos/revdoc");

const {
  "valos-script": { prefix, prefixIRI, prefixes, vocabulary, context },
 } = require("./ontologies");

const { name, version, description } = require("./package");

module.exports = {
  "dc:title": description,
  "vdoc:tags": ["PRIMARY", "INTRODUCTORY", "ONTOLOGY", "LIBRARY"],
  "revdoc:package": name,
  "revdoc:prefix": prefix,
  "revdoc:prefixIRI": prefixIRI,
  "revdoc:version": version,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "script",
  },
  "chapter#abstract>0": {
    "#0": [
`This library provides the definitions and reference implementation
for valoscript, the valospace ECMAScript dialect.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/script"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`ValOS Script API, schema\``,
    ],
  },
  "chapter#introduction>2": {
    "#0": [
`Valoscript extends ECMAScript 5 object model transparently for
manipulating valospace resources. The valoscript interpreter creates `,
ref("events", "@valos/raem#event"), ` from all valospace resource
modification side-effects and groups all such side effects into
transactions. Valoscript retains ECMAScript 5 syntax and semantics.`,
    ],
  },
  "chapter#ontology>8": {
    "dc:title": [`library `, em(name), ` ontology, prefix `, em(prefix)],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": [
`${name} ontology specifies the Valospace core types and properties
directly to the @valos/kernel namespace. `,
    ],
    "chapter#section_prefixes>1": {
      "dc:title": [em(name), ` IRI prefixes`],
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
    },
    "chapter#section_classes>2": {
      "dc:title":
          [em(prefix), ` `, ref("valos-kernel:Class", "@valos/kernel#Class"), ` vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.classes,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-kernel:Class", vocabulary),
      },
    },
    "chapter#section_properties>3": {
      "dc:title":
          [em(prefix), ` `, ref("valos-kernel:Property", "@valos/kernel#Property"), ` vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.properties,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-kernel:Property", vocabulary),
      },
    },
    "chapter#section_types>4": {
      "dc:title": [em(prefix), ` `, ref("valos-raem:Type", "@valos/raem#Type"), ` vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.types,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-raem:Type", vocabulary),
      },
    },
    "chapter#section_fields>5": {
      "dc:title": [em(prefix), ` `, ref("valos-raem:Field", "@valos/raem#Field"), ` vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.fields,
        "vdoc:entries": filterKeysWithAnyOf("@type", valosRaemFieldClasses, vocabulary),
      },
    },
    "chapter#section_resolvers>6": {
      "dc:title":
          [em(prefix), ` `, ref("valos-raem:Resolver", "@valos/raem#Resolver"), ` vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.resolvers,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-raem:Resolver", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(prefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.vocabularyOther,
        "vdoc:entries": filterKeysWithNoneOf("@type", [
          "valos-kernel:Class", "valos-kernel:Property",
          "valos-raem:Type", ...valosRaemFieldClasses, "valos-raem:Resolver",
        ], vocabulary),
      },
    },
    "chapter#section_context>9": {
      "dc:title": [em(prefix), ` JSON-LD context term definitions`],
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
};
