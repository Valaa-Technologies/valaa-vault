// @flow

const {
  extension: { extractee, emitters },
  extractee: { authors, em, ref, /* dfn, */ pkg, filterKeysWithAnyOf, filterKeysWithNoneOf },
  ontologyColumns, revdocOntologyProperties,
} = require("@valos/revdoc");

const { name, version, description } = require("./package");

const {
  VRevdoc: {
    preferredPrefix, baseIRI, description: namespaceDescription,
    prefixes, context, referencedModules, vocabulary, extractionRules,
  },
  ...remainingOntology
} = require("./ontology");

module.exports = {
  "dc:title": description,
  "VDoc:tags": ["PRIMARY", "WORKSPACE", "FABRIC", "ONTOLOGY"],
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  ...revdocOntologyProperties(
      { preferredPrefix, baseIRI, prefixes, context, referencedModules }, remainingOntology),

  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    shortName: "revdoc",
    alternateFormats: [{ label: "VDoc", uri: "revdoc.jsonld" }],
  },
  "chapter#abstract>0": {
    "#0": [
`This document specifies VRevdoc, a `, ref("VDoc extension", "@valos/vdoc#extension"), `
for extracting and emitting `, ref("ReSpec documents", "https://github.com/w3c/respec"), `.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document has not been reviewed. This is a draft document and may
be updated, replaced or obsoleted by other documents at any time.

This document is part of the `, ref("ValOS kernel specification", "@valos/kernel"), `.

The format is implemented and supported by `, pkg("@valos/revdoc"), `
npm package.`,
    ],
  },
  "chapter#introduction>2": {
    "#0":
`VRevdoc is a VDoc extension which can produce ReSpec documents.`
  },
  "chapter#section_fabric>8": {
    "dc:title": ["The ", em("VRevdoc"), " fabric namespace of the library ontology of ", pkg(name)],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_fabric_abstract>0": [namespaceDescription || ""],
    "chapter#section_prefixes>1;VRevdoc IRI prefixes": {
      "#0": [],
      "table#>0;prefixes": ontologyColumns.prefixes,
    },
    "chapter#section_classes>2": {
      "dc:title": [em(preferredPrefix), ` `, ref("VDoc classes", "VDoc:Class")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.classes,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VDoc:Class", vocabulary),
      },
    },
    "chapter#section_properties>3": {
      "dc:title": [em(preferredPrefix), ` `, ref("VDoc properties", "VDoc:Property")],
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
    "chapter#section_context>9;VRevdoc JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context": ontologyColumns.context,
    },
  },
  "chapter#transformations>9:VRevdoc transformations": {
    "#0": [
`VRevdoc lightly extends basic VDoc extraction with some ReSpec specific
primitives and specifies a ReSpec html emission transformation.`,
    ],
    "chapter#extraction_rules>0;VRevdoc extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_data": ontologyColumns.extractionRules,
      "data#extraction_rules_data": extractionRules,
    },
    "chapter#extractee_api>1;VRevdoc extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": ontologyColumns.extractee,
      "data#extractee_api_lookup": extractee,
    },
    "chapter#emission_output>2;VRevdoc emission output": {
      "#0": [
`VRevdoc emits html which makes use of ReSpec primitives.`,
      ],
    },
    "chapter#emission_rules>3;VRevdoc emission rules": {
      "#0": [
`VRevdoc provides html emission rules for `, { "VDoc:words": Object.keys(emitters.html) },
      ],
    },
  },
};
