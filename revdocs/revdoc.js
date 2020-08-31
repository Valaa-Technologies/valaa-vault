
const {
  extractee: {
    authors, em, pkg, ref,
    filterKeysWithAnyOf, filterKeysWithAllOf, filterKeysWithNoneOf,
    valosRaemFieldClasses,
  },
  ontologyHeaders,
} = require("@valos/revdoc");
const { domainHeaders } = require("@valos/type-vault");

const { name, version } = require("../packages/kernel/package");
const {
  documents,
  ontologies: {
    V: { preferredPrefix, baseIRI, prefixes, vocabulary, context } = { vocabulary: {} },
  },
} = require("../packages/kernel");

const roleDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "ROLE"], documents);

module.exports = {
  "dc:title": "Valospace reference",
  "VDoc:tags": ["PRIMARY", "INTRODUCTION", "ONTOLOGY", "VALONAUT"],
  "VRevdoc:package": name,
  "VRevdoc:preferredPrefix": preferredPrefix,
  "VRevdoc:baseIRI": baseIRI,
  "VRevdoc:version": version,
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
      "VDoc:headers": domainHeaders.roles,
      "VDoc:entries": roleDocuments,
    },
  },
  [`chapter#ontology>8;Valospace ontology '${preferredPrefix}'`]: {
    "#section_ontology_abstract>0": [
`Valospace ontology provides vocabulary and definitions of the primary
ValOS resources.`
    ],
    "chapter#section_prefixes>1": {
      "dc:title": [em(preferredPrefix), ` IRI prefixes`],
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
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
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:headers": ontologyHeaders.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          "VModel:Type", "VKernel:Property", ...valosRaemFieldClasses,
        ], vocabulary),
      },
    },
    [`chapter#section_context>9;JSON-LD context term definitions`]: {
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
};
