
const {
  extractee: {
    ref,
    authors, pkg,
    filterKeysWithAnyOf, filterKeysWithNoneOf,
  },
  ontologyHeaders,
} = require("@valos/revdoc");

const { prefix, prefixIRI, prefixes, vocabulary, context } = require("./ontology");

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
  "chapter#abstract>0": [
    `This library provides the definitions and reference implementation
    for valoscript, the valospace ECMAScript dialect.`,
  ],
  "chapter#sotd>1": [
    "This document is part of the library workspace ",
    pkg("@valos/script"),
    " (of domain ", pkg("@valos/kernel"), ") which is ",
    "ValOS Script API, schema",
  ],
  "chapter#introduction>2": {
    "#0": [
`Valoscript extends ECMAScript 5 object model transparently for
manipulating valospace resources. The valoscript interpreter creates `,
ref("events", "@valos/raem#event"), ` from all valospace resource
modification side-effects and groups all such side effects into
transactions. Valoscript retains ECMAScript 5 syntax and semantics.`,
    ],
  },
  [`chapter#ontology>8;<em>${prefix}:</em> library ${name} ontology`]: {
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": [
      `${name} ontology specifies the Valospace core types and
      properties directly to the @valos/kernel namespace. `,
    ],
    [`chapter#section_prefixes>1;${name} IRI prefixes`]: {
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
    },
    [`chapter#section_classes>2;<em>${prefix}:* a valos:Class</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.classes,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos:Class", vocabulary),
      },
    },
    [`chapter#section_properties>3;<em>${prefix}:* a valos:Property</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.properties,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos:Property", vocabulary),
      },
    },
    [`chapter#section_types>4;<em>${prefix}:* a valos:Type</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.types,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos:Type", vocabulary),
      },
    },
    [`chapter#section_fields>5;<em>${prefix}:* a valos:Field*</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.fields,
        "vdoc:entries": filterKeysWithAnyOf("@type", [
          "valos:Field", "valos:PrimaryField", "valos:TransientField", "valos:InferredField",
          "valos:GeneratedField", "valos:AliasField",
        ], vocabulary),
      },
    },
    [`chapter#section_vocabulary_other>8;<em>${prefix}:*</em> other vocabulary:`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.vocabularyOther,
        "vdoc:entries": filterKeysWithNoneOf("@type", [
          "valos:Class", "valos:Type", "valos:Property", "valos:Field",
          "valos:PrimaryField", "valos:TransientField", "valos:InferredField",
          "valos:GeneratedField", "valos:AliasField",
        ], vocabulary),
      },
    },
    [`chapter#section_context>9;<em>${prefix}:*</em> JSON-LD context term definitions`]: {
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
};
