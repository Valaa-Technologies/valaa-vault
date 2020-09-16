
const {
  extractee: {
    em, ref,
    authors, pkg,
    filterKeysWithAnyOf, filterKeysWithNoneOf, valosRaemFieldClasses
  },
  ontologyColumns, revdocOntologyProperties,
} = require("@valos/revdoc");

const {
  VScript: {
    preferredPrefix, baseIRI, description: namespaceDescription,
    prefixes, context, referencedModules, vocabulary,
  },
  ...remainingOntology
} = require("./ontology");

const { name, version, description } = require("./package");

module.exports = {
  "dc:title": description,
  "VDoc:tags": ["PRIMARY", "INTRODUCTORY", "WORKSPACE", "ONTOLOGY"],
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  "VRevdoc:preferredPrefix": preferredPrefix,
  "VRevdoc:baseIRI": baseIRI,
  ...revdocOntologyProperties({ prefixes, context, referencedModules }, remainingOntology),

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
    "dc:title": [
      "The ", em(preferredPrefix), " valospace namespace of the library ontology of ", pkg(name),
    ],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": [ontologyDescription || ""],
    "chapter#section_prefixes>1": {
      "dc:title": [em(name), ` IRI prefixes`],
      "#0": [],
      "table#>0;prefixes": ontologyColumns.prefixes,
    },
    "chapter#section_classes>2": {
      "dc:title": [em(preferredPrefix), " ", ref("fabric classes", "@valos/kernel#Class")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.classes,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VKernel:Class", vocabulary),
      },
    },
    "chapter#section_properties>3": {
      "dc:title": [em(preferredPrefix), " ", ref("fabric properties", "@valos/kernel#Property")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.properties,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VKernel:Property", vocabulary),
      },
    },
    "chapter#section_types>4": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace resource types", "@valos/raem#Type")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.types,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VModel:Type", vocabulary),
      },
    },
    "chapter#section_fields>5": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace fields", "@valos/raem#Field")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.fields,
        "VDoc:entries": filterKeysWithAnyOf("@type", valosRaemFieldClasses, vocabulary),
      },
    },
    "chapter#section_resolvers>6": {
      "dc:title": [em(preferredPrefix), " ", ref("field resolvers", "@valos/raem#Resolver")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.verbs,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VModel:Resolver", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          "VKernel:Class", "VKernel:Property",
          "VModel:Type", ...valosRaemFieldClasses, "VModel:Resolver",
        ], vocabulary),
      },
    },
    "chapter#section_context>9": {
      "dc:title": [em(preferredPrefix), ` JSON-LD context term definitions`],
      "#0": [],
      "table#>0;context": ontologyColumns.context,
    },
  },
};
