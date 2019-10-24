
const {
  extractee: {
    authors, em, pkg, ref,
    filterKeysWithAnyOf, filterKeysWithAllOf, filterKeysWithNoneOf,
    valosRaemFieldClasses,
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
`Overview of the valospace APIs and ontologies.`,
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
    "dc:title": em(`"Greetings, I am Valma, the ValOS Mediator. Who are you?"`),
    "#0": [
`ValOS ecosystem revolves around various roles. This document is
a reference document of valospace systems and structures and is
directed for more experienced valonauts. Check out the brief description
and introductions of the other roles as well.`,
    ],
    "table#>0;documents": {
      "vdoc:headers": domainHeaders.roles,
      "vdoc:entries": roleDocuments,
    },
  },
  [`chapter#ontology>8;Valospace ontology, prefix ${prefixIRI}, preferred label '${prefix}'`]: {
    "#section_ontology_abstract>0": [
`Valospace ontology provides vocabulary and definitions of the primary
ValOS resources.`
    ],
    "chapter#section_prefixes>1": {
      "dc:title": [em(prefix), ` IRI prefixes`],
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
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
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(prefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.vocabularyOther,
        "vdoc:entries": filterKeysWithNoneOf("@type", [
          "valos-raem:Type", "valos-kernel:Property", ...valosRaemFieldClasses,
        ], vocabulary),
      },
    },
    [`chapter#section_context>9;JSON-LD context term definitions`]: {
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
};
