// @flow

const { extension: { ontology, extractee } } = require("@valos/twindoc");
const {
  extractee: { authors, em, ref, pkg, /* dfn, */ filterKeysWithAnyOf, filterKeysWithNoneOf },
  ontologyHeaders,
} = require("@valos/revdoc");

const { name, description, version } = require("./package");

const { prefix, prefixIRI, prefixes, vocabulary, context, extractionRules } = ontology;

module.exports = {
  "dc:title": description,
  "vdoc:tags": ["PRIMARY", "ONTOLOGY"],
  "revdoc:package": name,
  "revdoc:prefix": prefix,
  "revdoc:prefixIRI": prefixIRI,
  "revdoc:version": version,
  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    shortName: "twindoc",
    alternateFormats: [{ label: "VDoc", uri: "index.jsonld" }],
  },
  "chapter#abstract>0": {
    "#0": [
`This document specifies TwinDoc, a `, ref("VDoc extension", "@valos/vdoc#extension"), `
which specifies an isomorphism and synchronization transformations
between VDoc documents and valospace resources.

More specifically TwinDoc allows for the serialization and
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
`TwinDoc provides both full isomorphic synchronization as well as
incremental, additive updates between VDoc documents and valospace
resources.
The fully isomoprhic extraction and emission transformations to
valospace resources provide lossless roundtrips to both directions:`,
{ "numbered#": [
  `emit + extract: a roundtrip starting from VDocLD into valospace back into VDocLD`,
  `extract + emit: a roundtrip starting from valospace into VDocLD back into valospace`,
], }, `

TwinDoc also specifies incremental transformations which are given
a diff base in addition to the source and which compute a diffset and
then merge the resulting diffset to the pre-existing transformation
target. This not only gives performance advantages but also makes it
possible to have the final document be a combination of several
partial primary sources.`,
    ],
  },
  "chapter#ontology>8;TwinDoc ontology": {
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": {
      "#0": [
`TwinDoc ontology provides vocabulary for defining hypertwin mappings
and configurations; actual hypertwin content is represented using the
valos core ontologies and possible extension content ontologies.`,
      ],
    },
    "chapter#section_prefixes>1;TwinDoc IRI prefixes": {
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
    },
    "chapter#section_classes>2": {
      "dc:title": [em(prefix), ` `, ref("vdoc:Class", "@valos/vdoc#Class"), ` vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.classes,
        "vdoc:entries": filterKeysWithAnyOf("@type", "vdoc:Class", vocabulary),
      },
    },
    "chapter#section_properties>3": {
      "dc:title": [em(prefix), ` `, ref("vdoc:Property", "@valos/vdoc#Property"), ` vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.properties,
        "vdoc:entries": filterKeysWithAnyOf("@type", "vdoc:Property", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(prefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.vocabularyOther,
        "vdoc:entries": filterKeysWithNoneOf(
            "@type", ["vdoc:Class", "vdoc:Property"], vocabulary),
      },
    },
    "chapter#section_context>9;TwinDoc JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
  "chapter#transformations>9;TwinDoc transformations": {
    "chapter#extraction_rules>0;TwinDoc extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_data": ontologyHeaders.extractionRules,
      "data#extraction_rules_data": extractionRules,
    },
    "chapter#extractee_api>1;TwinDoc extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": ontologyHeaders.extractee,
      "data#extractee_api_lookup": extractee,
    },
    "chapter#emission_output>2;TwinDoc emission output": {
      "#0": [
        `TwinDoc emits event log updates into valospace resources.`,
        pkg("@valos/hypertwin"), ` provides tools which implement this
        transformation using the gateway API.`,
      ],
    },
    "chapter#emission_rules>3;TwinDoc emission rules": {
      "#0": [],
    },
  },
};
