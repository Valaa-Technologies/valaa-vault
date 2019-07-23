// @flow

const { extension } = require("@valos/twindoc");
const {
  ontologyTables, extractee: { authors, ref, pkg, /* dfn, */  }
} = require("@valos/revdoc");

const { description, version } = require("./package");

module.exports = {
  "dc:title": description,
  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    shortName: "twindoc",
    alternateFormats: [{ label: "VDoc", uri: "index.jsonld" }],
  },
  "chapter#abstract>0": [
    `This document specifies TwinDoc, a `,
    ref("VDoc extension", "@valos/vdoc#extension"),
    ` which specifies an isomorphism and synchronization
    transformations between VDoc documents and valospace resources.`,
    null,
    `More specifically TwinDoc allows for the serialization and
    deserialization of an arbitrary selection of valospace resources
    into a VDoc document array and back even if the source resources
    are not a representation of a VDoc document nor use any VDoc core
    or extension ontologies.`
  ],
  "chapter#sotd>1": [
    `This document has not been reviewed. This is a draft document and
    may be updated, replaced or obsoleted by other documents at any
    time.`,
    null,
    `This document is part of the `, ref("ValOS core specification", "@valos/kernel/spec"),
    ".",
    null,
    `The extension is specified and supported by `,
    ref("@valos/twindoc npm package", "@valos/twindoc"), ".",
  ],
  "chapter#introduction>2": [
    `TwinDoc provides both full isomorphic synchronization as well as
    incremental, additive updates between VDoc documents and valospace
    resources.
    The fully isomoprhic extraction and emission transformations to
    valospace resources provide lossless roundtrips to both directions:`,
    { "numbered#": [
      `emit + extract: a roundtrip starting from vdocson into valospace back into vdocson`,
      `extract + emit: a roundtrip starting from valospace into vdocson back into valospace`,
    ], },
    null,
    `TwinDoc also specifies incremental transformations which are given
    a diff base in addition to the source and which compute a diffset
    and then merge the resulting diffset to the pre-existing
    transformation target.
    This not only gives performance advantages but also makes it
    possible to have the final document be a combination of several
    partial primary sources.`
  ],
  "chapter#ontology>8;TwinDoc ontology": {
    "chapter#prefixes>0;TwinDoc IRI prefixes": {
      "#0": [],
      "table#>0;prefixes_data": ontologyTables.prefixes,
      "data#prefixes_data": extension.ontology.prefixes,
    },
    [`chapter#vocabulary>1;TwinDoc RDF vocabulary with prefix ${extension.ontology.prefix}:`]: {
      "#0": [],
      "table#>0;vocabulary_data": ontologyTables.vocabulary,
      "data#vocabulary_data": extension.ontology.vocabulary,
    },
    "chapter#context>2;TwinDoc JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context_data": ontologyTables.context,
      "data#context_data": extension.ontology.context,
    },
  },
  "chapter#transformations>9;TwinDoc transformations": {
    "chapter#extraction_rules>0;TwinDoc extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_data": ontologyTables.extractionRules,
      "data#extraction_rules_data": extension.ontology.extractionRules,
    },
    "chapter#extractee_api>1;TwinDoc extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": ontologyTables.extractee,
      "data#extractee_api_lookup": extension.extractee,
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
