
const {
  ontologyColumns,
  extractee: {
    em, ref,
    authors, pkg,
    filterKeysWithAnyOf, filterKeysWithNoneOf, valosRaemFieldClasses,
  },
} = require("@valos/revdoc");

const { name, version, description } = require("./../package");

const title = `The valospace 'undefined' namespace reference`;
const {
  On: {
    preferredPrefix, baseIRI, ontologyDescription, prefixes, vocabulary, context,
  },
} = require("./../ontologies");

module.exports = {
  "VDoc:tags": ["VALOSHEATH", "ONTOLOGY"],
  "@context": {
    ...prefixes,
    ...context,
  },

  "dc:title": title,
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  "VRevdoc:preferredPrefix": preferredPrefix,
  "VRevdoc:baseIRI": baseIRI,

  respecConfig: {
    specStatus: "unofficial",
    shortName: "onNamespace",
    editors: authors("iridian"),
    authors: authors("iridian"),
  },
  "chapter#abstract>0": {
    "#0": [
`This document is a revdoc template document 'onNamespace' created by
write-revdoc.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/inspire"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`${description}\`.`,
    ],
  },
  "chapter#introduction>2": {
    "#0": [
`Edit me - this is the first payload chapter. Abstract and SOTD are
essential `, ref("ReSpec boilerplate",
    "https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide#essential-w3c-boilerplate"), `

See `, ref("ReVDoc tutorial", "@valos/revdoc/tutorial"), ` for
instructions on how to write revdoc source documents.

See also `, ref("ReVdoc specification", "@valos/revdoc"), ` and `,
ref("VDoc specification", "@valos/vdoc"), ` for reference documentation.`,
    ],
  },
  "chapter#section_valosheath>8": {
    "dc:title": [
      "The ", em(preferredPrefix), " valosheath namespace of the library ", pkg(name), " ontology",
    ],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": [
      ontologyDescription || "",
    ],
    "chapter#section_prefixes>1": {
      "dc:title": [em(name), " IRI prefixes"],
      "#0": [],
      "table#>0;prefixes": ontologyColumns.prefixes,
    },
    "chapter#section_classes>2": {
      "dc:title": [em(preferredPrefix), " ", ref("valosheath classes", "VEngine:Class")],
      "#0": [
"This section describes valosheath classes introduced by the 'On' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.classes,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VEngine:Class", vocabulary),
      },
    },
    "chapter#section_properties>3": {
      "dc:title": [em(preferredPrefix), " ", ref("valosheath properties", "VEngine:Property")],
      "#0": [
"This section describes valosheath properties introduced by the 'On' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": {
          ...ontologyColumns.properties,
          "column#06": {
            "VDoc:content": ["tags"],
            "VDoc:cell": {
              "VDoc:words": { "VDoc:selectField": "tags" },
              "VDoc:map": em("VDoc:selectValue"),
            },
          },
          "column#08": {
            "VDoc:content": [em("value")],
            "VDoc:wide": true,
            "VDoc:elidable": true,
            "VDoc:cell": { "VDoc:selectField": "value" },
          },
          "column#09": {
            "VDoc:content": [em("default value")],
            "VDoc:wide": true,
            "VDoc:elidable": true,
            "VDoc:cell": { "VDoc:selectField": "defaultValue" },
          },
        },
        "VDoc:entries": filterKeysWithAnyOf("@type", "VEngine:Property", vocabulary),
      },
    },
    "chapter#section_methods>4": {
      "dc:title": [
        em(preferredPrefix), " ", ref("valosheath methods", "VEngine:Method"),
      ],
      "#0": [
"This section describes valosheath methods introduced by the 'On' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.methods,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VEngine:Method", vocabulary),
      },
    },
    "chapter#section_globals>5": {
      "dc:title": [
        em(preferredPrefix), " ", ref("valosheath globals", "VEngine:Global"),
      ],
      "#0": [
"This section describes valosheath global objects introduced by the 'On' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.globals,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VEngine:Global", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), " remaining vocabulary terms"],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          "VEngine:Class", "VEngine:Property", "VEngine:Method", "VEngine:Global",
        ], vocabulary),
      },
    },
  },

};
