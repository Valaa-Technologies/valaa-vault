// @flow

const { extension } = require("@valos/sbomdoc");
const {
  headers, extractee: { authors, ref, /* dfn, */ filterKeysWithAnyOf, filterKeysWithNoneOf },
} = require("@valos/revdoc");

const { name, version, description } = require("./package");

const { prefix, prefixIRI } = extension.ontology;

module.exports = {
  "dc:title": description,
  "revdoc:package": name,
  "revdoc:prefix": prefix,
  "revdoc:prefixIRI": prefixIRI,
  "revdoc:version": version,
  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    shortName: "sbomdoc",
    alternateFormats: [{ label: "VDoc", uri: "sbomdoc.vdocld" }],
  },
  "chapter#abstract>0": [
    `This document specifies SBomDoc, a `,
    ref("VDoc extension", "@valos/vdoc#extension"),
    ` for extracting and emitting `, ref("CycloneDX BOM documents", "https://cyclonedx.org/"),
    ` in various formats.`,
  ],
  "chapter#sotd>1": [
    `This document has not been reviewed. This is a draft document and
    may be updated, replaced or obsoleted by other documents at any
    time.`,
    null,
    `This document is part of the `, ref("ValOS core specification", "@valos/kernel/spec"),
    ".",
    null,
    `The format is implemented and supported by `,
    ref("@valos/sbomdoc npm package", "@valos/sbomdoc"), ".",
  ],
  "chapter#introduction>2": [
    `SBoMDoc is a VDoc extension which uses CycloneDX namespaces and
    can emit BOM documents in various formats.`,
  ],
  "chapter#ontology>8;SBoMDoc ontology": {
    "#0": [],
    "data#prefixes": extension.ontology.prefixes,
    "data#vocabulary": extension.ontology.vocabulary,
    "data#context": extension.ontology.context,
    "chapter#section_prefixes>0;SBoMDoc IRI prefixes": {
      "#0": [],
      "table#>0;prefixes": headers.prefixes,
    },
    [`chapter#section_classes>1;SBoMDoc rdfs:Class vocabulary, prefix ${prefix}:`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.classes,
        "vdoc:entries": filterKeysWithAnyOf("a", "rdfs:Class", extension.ontology.vocabulary),
      },
    },
    [`chapter#section_properties>2;SBoMDoc rdf:Property vocabulary, prefix ${prefix}:`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.properties,
        "vdoc:entries": filterKeysWithAnyOf("a", "rdf:Property", extension.ontology.vocabulary),
      },
    },
    [`chapter#section_other_vocabulary>3;Other SBoMDoc vocabulary, prefix ${prefix}:`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.vocabulary,
        "vdoc:entries": filterKeysWithNoneOf("a", ["rdfs:Class", "rdf:Property"],
            extension.ontology.vocabulary),
      },
    },
    "chapter#section_context>4;SBoMDoc JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context": headers.context,
    },
  },
  "chapter#transformations>9;SBoMDoc transformations": {
    "#0": [],
    "chapter#extraction_rules>0;SBoMDoc extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_data": headers.extractionRules,
      "data#extraction_rules_data": extension.ontology.extractionRules,
    },
    "chapter#extractee_api>1;SBoMDoc extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": headers.extractee,
      "data#extractee_api_lookup": extension.ontology.extractee,
    },
    "chapter#emission_output>2;SBoMDoc emission output": {
      "#0": [],
    },
    "chapter#emission_rules>3;SBoMDoc emission rules": {
      "#0": [
        `ReVDoc provides html emission overrides for `,
        { "vdoc:words": Object.keys(extension.emitters.html) },
      ],
    },
  },
};
