
const {
  ontologyColumns, revdocOntologyProperties,
  extractee: {
    em, ref,
    authors, pkg,
    filterKeysWithAnyOf, filterKeysWithNoneOf,
  },
} = require("@valos/revdoc");

const { name, version, description, valos: { type } = {} } = require("./package");

const title = `${name} ${type} workspace`;
const {
  V: {
    preferredPrefix, baseIRI, description: namespaceDescription,
    prefixes, context, referencedModules, vocabulary,
  },
  ...remainingOntology
} = require("./ontology");

module.exports = {
  "VDoc:tags": ["PRIMARY", "WORKSPACE", "VALOSPACE", "ONTOLOGY"],
  "@context": {
    ...prefixes,
    ...context,
  },

  "dc:title": title,
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  ...revdocOntologyProperties(
      { preferredPrefix, baseIRI, prefixes, context, referencedModules }, remainingOntology),

  respecConfig: {
    specStatus: "unofficial",
    shortName: "space",
    editors: authors("iridian"),
    authors: authors("iridian"),
  },
  "chapter#abstract>0": {
    "#0": [
description,
null,
`Valospace is the global collection of all valos resources and their
identifiers that can be programmatically manipulated using `,
ref(em("valoscript"), "VScript:"), `. This document specifies the
three primary resource types:`, ref(em("Entity"), "V:Entity"), ", ",
ref(em("Relation"), "V:Relation"), ", ", ref(em("Media"), "V:Media"),
` and their fields.`,
null,
`See `, ref(em("VState"), "VState:"), ` for the specification for the
underlying data model.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/space"), `
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
  "chapter#section_valospace>7": {
    "dc:title": [
      "The ", em(preferredPrefix), " valospace namespace of the library ontology of ", pkg(name),
    ],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_valospace_abstract>0": [
      namespaceDescription || "",
    ],
    "chapter#section_prefixes>1": {
      "dc:title": [em(name), " IRI prefixes"],
      "#0": [],
      "table#>0;prefixes": ontologyColumns.prefixes,
    },
    "chapter#section_types>2": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace types", "VState:Type")],
      "#0": [
"This section describes valospace types introduced by the 'VSP' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.types,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VState:Type", vocabulary),
      },
    },
    "chapter#section_fields>3": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace fields", "VState:Field")],
      "#0": [
"This section describes valospace fields introduced by the 'VSP' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.fields,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VState:Field", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), " remaining vocabulary terms"],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          "VState:Type", "VState:Field", "undefined", "undefined",
        ], vocabulary),
      },
    },
  },

};
