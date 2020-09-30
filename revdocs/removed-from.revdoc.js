
const {
  extractee: {
    authors, em, pkg, ref,
    filterKeysWithAnyOf, filterKeysWithNoneOf, valosRaemFieldClasses,
  },
  ontologyColumns, revdocOntologyProperties,
} = require("@valos/revdoc");

const { name, version } = require("../packages/kernel/package");
const {
  VRemovedFrom: {
    preferredPrefix, baseIRI, description: namespaceDescription,
    prefixes, context, referencedModules, vocabulary,
  },
  ...remainingOntology
} = require("../dist/packages/@valos/kernel/ontology");

module.exports = {
  "dc:title": `${name} removed-from field reference`,
  "VDoc:tags": ["VALOSPACE", "ONTOLOGY", "TECHNICIAN"],
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  "VRevdoc:preferredPrefix": preferredPrefix,
  "VRevdoc:baseIRI": baseIRI,
  ...revdocOntologyProperties({ prefixes, context, referencedModules }, remainingOntology),

  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "valosRemovedFrom",
  },
  "data#prefixes": prefixes,
  "data#vocabulary": vocabulary,
  "data#context": context,

  "chapter#abstract>0": {
    "#0":
`Ontology of the secondary \`removed-from\` fields of the primary
valospace fields which have them (ie. those which statefully track
entries that have been removed from them).`,
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the vault workspace `, pkg("@valos/kernel"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`ValOS common infrastructure tools and libraries monorepository.\`.`,
    ],
  },
  "chapter#introduction>2;": {
    "#0": [
`Some container fields maintain a hidden list of entries that have been
removed from them, f.ex. for expressing removals from ghost fields
which are empty as they inherit their entries from the prototype.`,
    ],
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
    "chapter#section_fields>5": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace fields", "VState:Field")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.fields,
        "VDoc:entries": filterKeysWithAnyOf("@type", valosRaemFieldClasses, vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [...valosRaemFieldClasses], vocabulary),
      },
    },
    "chapter#section_context>9;JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context": ontologyColumns.context,
    },
  },
};
