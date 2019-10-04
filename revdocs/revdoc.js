
const {
  extractee: {
    authors, em, pkg,
    filterKeysWithAnyOf, filterKeysWithAllOf, filterKeysWithNoneOf,
  },
  ontologyHeaders,
} = require("@valos/revdoc");
const { domainHeaders } = require("@valos/type-vault");

const { name, version } = require("../package");
const { documents } = require("../packages/kernel");
const {
  ontologies: {
    valos: { prefix, prefixIRI, prefixes, vocabulary, context },
  },
} = require("../packages/kernel");

const roleDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "ROLE"], documents);

module.exports = {
  "dc:title": "Valospace reference",
  "vdoc:tags": ["PRIMARY", "INTRODUCTION", "ONTOLOGY", "VALONAUT"],
  "revdoc:package": name,
  "revdoc:prefix": prefix,
  "revdoc:prefixIRI": prefixIRI,
  "revdoc:version": version,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "valos",
  },
  "data#documents": documents,
  "data#prefixes": prefixes,
  "data#vocabulary": vocabulary,
  "data#context": context,

  "chapter#abstract>0": [
    "Overview of the valospace APIs and ontologies.",
  ],
  "chapter#sotd>1": [
    "This document is part of the vault workspace ",
    pkg("@valos/kernel"),
    " (of domain ", pkg("@valos/kernel"), ") which is ",
    "ValOS common infrastructure tools and libraries monorepository.",
  ],
  "chapter#introduction>2": {
    "dc:title": em(`"Greetings, I am Valma, the ValOS Mediator. Who are you?"`),
    "#0": [
      `ValOS ecosystem revolves around various roles. This document
      is a reference document of valospace systems and structures and
      is directed for more experienced valonauts. Check out the brief
      description and introductions of the other roles as well.`,
      null,
      ".",
    ],
    "table#>0;documents": {
      "vdoc:headers": domainHeaders.roles,
      "vdoc:entries": roleDocuments,
    },
  },
  [`chapter#ontology>8;Valospace ontology, prefix ${prefixIRI}, preferred label '${prefix}'`]: {
    "#section_ontology_abstract>0": [
      `Valospace ontology provides vocabulary and definitions of
      the primary ValOS resources.`
    ],
    [`chapter#section_prefixes>1;IRI prefixes`]: {
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
    },
    [`chapter#section_types>2;<em>${prefix}:* a valos-raem:Type</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.types,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-raem:Type", vocabulary),
      },
    },
    [`chapter#section_fields>3;<em>${prefix}:* a valos-raem:Field</em> vocabulary`]: {
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
    [`chapter#section_vocabulary_other>8;<em>${prefix}:*</em> other vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.vocabularyOther,
        "vdoc:entries": filterKeysWithNoneOf("@type", [
          "valos-raem:Type", "valos-kernel:Property", "valos-raem:Field",
          "valos-raem:ExpressedField", "valos-raem:EventLoggedField", "valos-raem:CoupledField",
          "valos-raem:GeneratedField", "valos-raem:TransientField", "valos-raem:AliasField",
        ], vocabulary),
      },
    },
    [`chapter#section_context>9;JSON-LD context term definitions`]: {
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
};
