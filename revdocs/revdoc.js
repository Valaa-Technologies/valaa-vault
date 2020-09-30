
const {
  extractee: {
    authors, em, strong, pkg, ref, tooltip,
    filterKeysWithAnyOf, filterKeysWithNoneOf,
    valosRaemFieldClasses,
  },
  ontologyColumns, revdocOntologyProperties,
} = require("@valos/revdoc");

const { name, version } = require("../dist/packages/@valos/kernel/package");
const { documents } = require("../dist/packages/@valos/kernel");
const {
  V: {
    preferredPrefix, baseIRI, description: namespaceDescription,
    prefixes, context, referencedModules, vocabulary,
  },
  ...remainingOntology
} = require("../dist/packages/@valos/kernel/ontology");

const roleDocuments = Object.fromEntries(
    // filterKeysWithAllOf("tags", ["PRIMARY", "ROLE"], documents)
    ["valonaut", "technician", "voyager"]
    .map(key => [key, documents[key]]));

module.exports = {
  "dc:title": "Valos introduction and valospace API reference",
  "VDoc:tags": ["PRIMARY", "INTRODUCTION", "ONTOLOGY", "VALONAUT"],
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  ...revdocOntologyProperties(
      { preferredPrefix, baseIRI, prefixes, context, referencedModules }, remainingOntology),

  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "valos",
  },
  "data#documents": documents,
  "data#prefixes": prefixes,
  "data#vocabulary": vocabulary,
  "data#context": context,

  "chapter#abstract>0": {
    "#0": [
      [tooltip(
          em(strong(`'Valos extends boundlessly across the valospace-time fabric.'`),
              " (...in progress(tm))"),
          [
strong("-> Vertically"), `: as a full application development solution
valos radically simplifies the semantic web technology stack.`,
null,
strong("-> Horizontally"), `: as a global, de-centralized ecosystem
valos eases cross-organization interfacing.`,
null,
strong("-> In depth"), `: with its unified resource model valos blurs
the boundary between frontends and backends.`,
null,
strong("-> Temporally"), `: valos unifies document state and change
updates into seamless event stream *chronicles*.`,
          ])],
    null,
`In other words, valos is a bit ambitious and a lot to take in at once.

To address this the first part of this document provides separate
introduction paths into valos for a software developer
(referred to as `, em(ref("a valonaut", "/valonaut")), `), for a
systems operator (as `, em(ref("a technician", "/technician")), `) and
for a project manager (as `, em(ref("a voyager", "/voyager")), `).

Choosing the most familiar path helps you to get hands-on the quickest.

The second part of this document is the `, ref("valospace"),
` API reference and is aimed for valonauts for repeat viewing.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the vault workspace `, pkg("@valos/kernel"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`ValOS common infrastructure tools and libraries monorepository\`.`,
    ],
  },
  "chapter#introduction>2": {
    "dc:title": `First valosteps to the three primary valos roles`,
    "#0": [
`The three traditional roles of application developer, systems operator
and project manager have their own unique characteristics in valos
ecosystem and are called valonaut, technician and voyager respectively.

Each role has a detailed (editor's note: eventually) how-to guide which
are linked and briefly introduced below. The roles support each other
and the guides reflect this. The hands-on introduction section of each
guide also gives a high-level overview of the rest.`,
    ],
    "#1": {
      "VDoc:entries": roleDocuments,
      "VDoc:map": {
        "chapter#0": {
          "dc:title": em(
              ref(["How do ", { "VDoc:selectField": "title" }, "?"],
              ["VDoc:selectKey", "#introduction"])),
          "VDoc:content": [{ "VDoc:selectField": "introduction" }],
        },
      },
    },
  },
  "chapter#section_valospace>8": {
    "dc:title": [
      "The ", em(preferredPrefix), " valospace namespace",
    ],
    "#section_valospace_abstract>0": [namespaceDescription || ""],
    "chapter#section_prefixes>1": {
      "dc:title": [em(preferredPrefix), ` IRI prefixes`],
      "#0": [],
      "table#>0;prefixes": ontologyColumns.prefixes,
    },
    "chapter#section_types>2": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace resource types", "VState:Type")],
      "#0": [
`This section defines all valospace resource types introduced by the
@valos/kernel packages. Any instance of a resource type is always
recorded in an event log.`,
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.types,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VState:Type", vocabulary),
      },
    },
    "chapter#section_classes>3": {
      "dc:title": [em(preferredPrefix), " ", ref("valosheath classes", "VEngine:Class")],
      "#0": [
`This section describes all valosheath classes introduced by the
@valos/kernel packages. These classes are provided for scripts by the
@valos/engine and their instances are not recorded in event logs.`,
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.classes,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VEngine:Class", vocabulary),
      },
    },
    "chapter#section_fields>4": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace fields", "VState:Field")],
      "#0": [
`This section defines all valospace resource fields introduced by the
@valos/kernel packages. The values of these fields are either directly
recorded in or indirectly resolved from event log(s).`,
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.fields,
        "VDoc:entries": filterKeysWithAnyOf("@type", valosRaemFieldClasses, vocabulary),
      },
    },
    "chapter#section_properties>5": {
      "dc:title": [
        em(preferredPrefix), " ", ref("valosheath properties", "VEngine:Property"),
      ],
      "#0": [
`This section describes all valosheath properties introduced by the
@valos/kernel packages. These properties are provided for scripts by
the @valos/engine and their values are not recorded in event logs.`,
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.properties,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VEngine:Property", vocabulary),
      },
    },
    "chapter#section_methods>6": {
      "dc:title": [
        em(preferredPrefix), " ", ref("valosheath methods", "VEngine:Method"),
      ],
      "#0": [
`This section describes all valosheath methods introduced by the
@valos/kernel packages. `,
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.methods,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VEngine:Method", vocabulary),
      },
    },
    "chapter#section_object_properties>7": {
      "dc:title": [
        em(preferredPrefix), " ",
        ref("valosheath object properties", "VEngine:ObjectProperty"),
      ],
      "#0": [
`This section describes all valosheath object properties introduced by
the @valos/kernel packages. This includes direct properties on type and
class objects themselves. These properties are provided for scripts by
the  @valos/engine and their values are not recorded in event logs.`,
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.objectProperties,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VEngine:ObjectProperty", vocabulary),
      },
    },
    "chapter#section_object_methods>8": {
      "dc:title": [
        em(preferredPrefix), " ", ref("valosheath object methods", "VEngine:ObjectMethod"),
      ],
      "#0": [
`This section describes all valosheath object methods introduced by the
@valos/kernel packages. This includes direct methods on the type and
class objects themselves. These properties are provided for scripts by
the @valos/engine and their values are not recorded in event logs.`,
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.objectMethods,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VEngine:ObjectMethod", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          "VState:Type", ...valosRaemFieldClasses,
          "VEngine:Class",
          "VEngine:Property", "VEngine:Method", "VEngine:ObjectProperty", "VEngine:ObjectMethod",
        ], vocabulary),
      },
    },
    [`chapter#section_context>9;JSON-LD context term definitions`]: {
      "#0": [],
      "table#>0;context": ontologyColumns.context,
    },
  },
};
