
const {
  extractee: {
    authors, em, pkg, ref,
    filterKeysWithAnyOf, filterKeysWithNoneOf, valosRaemFieldClasses,
  },
  ontologyColumns, revdocOntologyProperties,
} = require("@valos/revdoc");

const {
  VSourcerer: {
    preferredPrefix, baseIRI, description: namespaceDescription,
    prefixes, context, referencedModules, vocabulary,
  },
  ...remainingOntology
} = require("./ontology");

const { name, version, description } = require("./package");

module.exports = {
  "@context": { ...prefixes, ...context },
  "dc:title": description,
  "VDoc:tags": ["PRIMARY", "INTRODUCTORY", "WORKSPACE", "VALOSPACE", "ONTOLOGY"],
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  ...revdocOntologyProperties(
      { preferredPrefix, baseIRI, prefixes, context, referencedModules }, remainingOntology),

  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "sourcerer",
  },
  "chapter#abstract>0": {
    "#0": [
`This library provides the definitions and reference implementation
of the ValOS sourcerer architecture which is used to route `,
em("ValOS event streams"), `.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/sourcerer"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`ValOS Sourcerer API, schema\``,
    ],
  },
  "chapter#introduction>2": {
    "#0": [],
  },
  "chapter#section_valosp>3;The ValOS protocol: 'valosp:'": {
    "#0": [
`valosp: scheme specifies remote chronicle sourcery as a combination of
four primary https operations:`,
      { "bulleted#": [
[`narrate events via GET`],
[`proclaim commands via PUT (single command) and POST (multi-command)`],
[`bvob upload via multipart POST`],
[`bvob download via GET`],
      ] },
`A valid `, em("valosp:"), ` authority URI has no query or fragment
parts and its hierarchy part (which can be arbitrarily deep) must
terminate to '/', (f.ex.:`, em("valosp://localhost:5443/deep/taur/"), `).`,
null,
`Given an authority URI, a chronicle URI is an immediate sub-path with
chronicle id `, ref("route-vplot", "@valos/vplot#route-vplot"), ` as
the step, f.ex.:`, em("valosp://localhost:5443/deep/taur/~raw!example-chronicle/"),
null,
`The primary operations of the chronicle are sub-paths of the chronicle
URI. These operations are grouped into three different route signatures
(assuming authority URI sans terminating "/" as base):`,
      { "bulleted#": [
[em("/:chroniclePlot/-log!:eventIndex/"),
  ` GET, PUT, OPTIONS: single-event, restful application/json single object operations`],
[em("/:chroniclePlot/-log{'!:startIndex}{'!:endIndex}"),
  ` GET, POST, OPTIONS: multi-event, application/json array operations. Note no terminating "/"`],
[em("/:chroniclePlot/~bvob!:contentHash/"),
  ` GET, POST, OPTIONS: bvob operations, with application/octet-stream download and`,
    ref("multipart/form-data upload as per rfc1887", "https://tools.ietf.org/html/rfc1867")],
      ] },
`The event objects are version "0.3" events with the delta aspect as
their root aspect.`,
    ],
  },
  "chapter#section_valospace>8": {
    "dc:title": [
      "The ", em(preferredPrefix), " valospace namespace of the library ontology of ", em(name),
    ],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_valospace_abstract>0": [namespaceDescription || ""],
    "chapter#section_prefixes>1": {
      "dc:title": [em(name), ` IRI prefixes`],
      "#0": [],
      "table#>0;prefixes": ontologyColumns.prefixes,
    },
    "chapter#section_classes>2": {
      "dc:title": [em(preferredPrefix), " ", ref("fabric classes", "VKernel:Class")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.classes,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VKernel:Class", vocabulary),
      },
    },
    "chapter#section_properties>3": {
      "dc:title": [em(preferredPrefix), " ", ref("fabric properties", "VKernel:Property")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.properties,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VKernel:Property", vocabulary),
      },
    },
    "chapter#section_types>4": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace resource types", "VState:Type")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.types,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VState:Type", vocabulary),
      },
    },
    "chapter#section_fields>5": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace fields", "VState:Field")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.fields,
        "VDoc:entries": filterKeysWithAnyOf("@type", valosRaemFieldClasses, vocabulary),
      },
    },
    "chapter#section_resolvers>6": {
      "dc:title": [em(preferredPrefix), " ", ref("field resolvers", "VValk:Resolver")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.verbs,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VValk:Resolver", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          "VKernel:Class", "VKernel:Property",
          "VState:Type", ...valosRaemFieldClasses, "VValk:Resolver",
        ], vocabulary),
      },
    },
    "chapter#section_context>9": {
      "dc:title": [em(preferredPrefix), ` JSON-LD context term definitions`],
      "#0": [],
      "table#>0;context": ontologyColumns.context,
    },
  },
};
