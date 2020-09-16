// @flow

const { extension: { extractee } } = require("@valos/twindoc");
const {
  extractee: { authors, em, ref, pkg, /* dfn, */ filterKeysWithAnyOf, filterKeysWithNoneOf },
  ontologyColumns, revdocOntologyProperties,
} = require("@valos/revdoc");

const { name, description, version } = require("./package");

const {
  VTwindoc: {
    preferredPrefix, baseIRI, description: namespaceDescription,
    prefixes, context, referencedModules, vocabulary, extractionRules,
  },
  ...remainingOntology
} = require("./ontology");

module.exports = {
  "dc:title": description,
  "VDoc:tags": ["PRIMARY", "ONTOLOGY"],
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  "VRevdoc:preferredPrefix": preferredPrefix,
  "VRevdoc:baseIRI": baseIRI,
  ...revdocOntologyProperties({ prefixes, context, referencedModules }, remainingOntology),

  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    shortName: "twindoc",
    alternateFormats: [{ label: "VDoc", uri: "index.jsonld" }],
  },
  "chapter#abstract>0": {
    "#0": [
`This document specifies VTwindoc, a `, ref("VDoc extension", "@valos/vdoc#extension"), `
which specifies an isomorphism and synchronization transformations
between VDoc documents and valospace resources.

More specifically VTwindoc allows for the serialization and
deserialization of an arbitrary selection of valospace resources
into a VDoc document array and back even if the source resources
are not a representation of a VDoc document nor use any VDoc core
or extension ontologies.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document has not been reviewed. This is a draft document and
may be updated, replaced or obsoleted by other documents at any
time.

This document is part of the `, ref("ValOS core specification", "@valos/kernel/spec"), `.

The extension is specified and supported by `, pkg("@valos/twindoc"), `
npm package.`,
    ],
  },
  "chapter#introduction>2": {
    "#0": [
`VTwindoc provides both full isomorphic synchronization as well as
incremental, additive updates between VDoc documents and valospace
resources.
The fully isomoprhic extraction and emission transformations to
valospace resources provide lossless roundtrips to both directions:`,
{ "numbered#": [
  `emit + extract: a roundtrip starting from VDocState into valospace back into VDocState`,
  `extract + emit: a roundtrip starting from valospace into VDocState back into valospace`,
], }, `

VTwindoc also specifies incremental transformations which are given
a diff base in addition to the source and which compute a diffset and
then merge the resulting diffset to the pre-existing transformation
target. This not only gives performance advantages but also makes it
possible to have the final document be a combination of several
partial primary sources.`,
    ],
  },
  "chapter#ontology>8;TwinDoc ontology": {
    "dc:title": [
      "The ", em("VTwindoc"), " fabric namespace of the library ontology of ", pkg(name),
    ],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": {
      "#0": [namespaceDescription || ""],
    },
    "chapter#section_prefixes>1;VTwindoc IRI prefixes": {
      "#0": [],
      "table#>0;prefixes": ontologyColumns.prefixes,
    },
    "chapter#section_classes>2": {
      "dc:title": [em(preferredPrefix), ` `, ref("VDoc classes", "@valos/vdoc#Class")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.classes,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VDoc:Class", vocabulary),
      },
    },
    "chapter#section_properties>3": {
      "dc:title": [em(preferredPrefix), ` `, ref("VDoc properties", "@valos/vdoc#Property")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.properties,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VDoc:Property", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf(
            "@type", ["VDoc:Class", "VDoc:Property"], vocabulary),
      },
    },
    "chapter#section_context>9;VTwindoc JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context": ontologyColumns.context,
    },
  },
  "chapter#transformations>9;VTwindoc transformations": {
    "chapter#extraction_rules>0;VTwindoc extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_data": ontologyColumns.extractionRules,
      "data#extraction_rules_data": extractionRules,
    },
    "chapter#extractee_api>1;VTwindoc extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": ontologyColumns.extractee,
      "data#extractee_api_lookup": extractee,
    },
    "chapter#emission_output>2;VTwindoc emission output": {
      "#0": [
        `VTwindoc emits event log updates into valospace resources.`,
        pkg("@valos/hypertwin"), ` provides tools which implement this
        transformation using the gateway API.`,
      ],
    },
    "chapter#emission_rules>3;VTwindoc emission rules": {
      "#0": [],
    },
  },
};
