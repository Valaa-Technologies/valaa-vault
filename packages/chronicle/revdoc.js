
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
  VChronicle: {
    preferredPrefix, baseIRI, description: namespaceDescription,
    prefixes, context, referencedModules, vocabulary,
  },
  ...remainingOntology
} = require("./ontology");

module.exports = {
  "VDoc:tags": ["WORKSPACE", "VALOSPACE", "ONTOLOGY"],
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
    shortName: "chronicle",
    editors: authors("iridian"),
    authors: authors("iridian"),
  },
  "chapter#abstract>0": {
    "#0": [
description,
null,
`A chronicle is a document with a history. In ValOS a chronicle has two
facets. The valospace facet of a chronicle is the set of all *state resources*
that are recursively owned by the chronicle *root resource*. The fabric
facet of a chronicle is the *event log* ie. the linear sequence of
*events* that describe the incremental changes to the chronicle state
resources.`,
null,
`The valospace facet is specified by the `, ref(["primary ", em("V")], "V:"),
` namespace. The fabric facet is specified by the `, ref(em("VState"), "VState:"),
` and the `, ref(em("VLog"), "VLog:"), ` namespaces.`,
null,
`This document specifies the `, ref("VChronicle", "VChronicle:"),
` namespace for defining *chronicle behaviors* ie. constraints to the
changes that can be made to a chronicle. These behaviors are defined
via the chronicle root resource properties that are named using `,
em("VChronicle"), ` namespace terms.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/chronicle"), `
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
"This section describes valospace types introduced by the 'VChronicle' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.types,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VState:Type", vocabulary),
      },
    },
    "chapter#section_fields>3": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace fields", "VKernel:Property")],
      "#0": [
"This section describes valospace fields introduced by the 'VChronicle' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.fields,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VKernel:Property", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), " remaining vocabulary terms"],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          "VState:Type", "VKernel:Property",
        ], vocabulary),
      },
    },
  },

};
