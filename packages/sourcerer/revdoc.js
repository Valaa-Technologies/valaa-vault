
const {
  extractee: {
    c, authors, pkg,
    filterKeysWithAnyOf, filterKeysWithNoneOf,
  },
  ontologyHeaders,
} = require("@valos/revdoc");

const {
  "valos-sourcerer": { prefix, prefixIRI, prefixes, vocabulary, context },
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
    shortName: "sourcerer",
  },
  "chapter#abstract>0": [
    `This library provides the definitions and reference implementation
    of the ValOS sourcerer architecture which is used to route `,
    c("ValOS event streams"), `.`,
  ],
  "chapter#sotd>1": [
    "This document is part of the library workspace ",
    pkg("@valos/sourcerer"),
    " (of domain ", pkg("@valos/kernel"), ") which is ",
    "ValOS Sourcerer API, schema",
  ],
  "chapter#introduction>2": {
    "#0": [],
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
    [`chapter#section_classes>2;<em>${prefix}:* a valos-kernel:Class</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.classes,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-kernel:Class", vocabulary),
      },
    },
    [`chapter#section_properties>3;<em>${prefix}:* a valos-kernel:Property</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.properties,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-kernel:Property", vocabulary),
      },
    },
    [`chapter#section_types>4;<em>${prefix}:* a valos-raem:Type</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.types,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-raem:Type", vocabulary),
      },
    },
    [`chapter#section_fields>5;<em>${prefix}:* a valos-raem:Field</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.fields,
        "vdoc:entries": filterKeysWithAnyOf("@type", [
          "valos-raem:Field",
          "valos-raem:ExpressedField", "valos-raem:EventLoggedField", "valos-raem:CoupledField",
          "valos-raem:GeneratedField", "valos-raem:TransientField", "valos-raem:AliasField",
        ], vocabulary),
      },
    },
    [`chapter#section_resolvers>6;<em>${prefix}:* a valos-raem:Resolver</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.resolvers,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-raem:Resolver", vocabulary),
      },
    },
    [`chapter#section_vocabulary_other>8;<em>${prefix}:*</em> other vocabulary:`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.vocabularyOther,
        "vdoc:entries": filterKeysWithNoneOf("@type", [
          "valos-kernel:Class", "valos-kernel:Property",
          "valos-raem:Type", "valos-raem:Field", "valos-raem:Resolver",
          "valos-raem:ExpressedField", "valos-raem:EventLoggedField", "valos-raem:CoupledField",
          "valos-raem:GeneratedField", "valos-raem:TransientField", "valos-raem:AliasField",
        ], vocabulary),
      },
    },
    [`chapter#section_context>9;<em>${prefix}:*</em> JSON-LD context term definitions`]: {
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
};
