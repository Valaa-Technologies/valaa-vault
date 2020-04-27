
const {
  extractee: {
    authors, em, pkg, ref,
    filterKeysWithAnyOf, filterKeysWithNoneOf, valosRaemFieldClasses,
  },
  ontologyHeaders,
} = require("@valos/revdoc");

const { name, version } = require("../packages/kernel/package");
const {
  ontologies: {
    valos_removed_from: { prefix, prefixIRI, prefixes, vocabulary, context },
  },
} = require("../packages/kernel");

module.exports = {
  "dc:title": `${name} removed-from field reference`,
  "vdoc:tags": ["ONTOLOGY", "TECHNICIAN"],
  "revdoc:package": name,
  "revdoc:prefix": prefix,
  "revdoc:prefixIRI": prefixIRI,
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
  [`chapter#ontology>8;Valospace ontology, prefix ${prefixIRI}, preferred label '${prefix}'`]: {
    "#section_ontology_abstract>0": [
`Valospace removed-from ontology provides vocabulary and definitions of
the primary ValOS resources removed-from fields.`
    ],
    "chapter#section_prefixes>1": {
      "dc:title": [em(prefix), ` IRI prefixes`],
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
    },
    "chapter#section_fields>5": {
      "dc:title": [em(prefix), ` `, ref("valos_raem:Field", "@valos/raem#Field"), ` vocabulary`],
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
        "vdoc:entries": filterKeysWithNoneOf("@type", [...valosRaemFieldClasses], vocabulary),
      },
    },
    "chapter#section_context>9;JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
};
