// @flow

const { ontology: vdocOntology } = require("@valos/toolset-vault/vdoc");
const {
  ontologyTables, extractee: { editors, ref, dfn },
} = require("@valos/toolset-vault/revdoc");

module.exports = {
  "vdoc:title": "ValOS document interchange specification",
  respecConfig: {
    specStatus: "unofficial",
    editors: editors("iridian"),
    shortName: "vdoc",
  },
  "chapter#abstract>0": [
    `This document specifies`, ref("a JSON-LD -based", "https://www.w3.org/TR/json-ld11/"),
    `documentation human-machine-valospace interchange format.`,
  ],
  "chapter#sotd>1": [
    `This document has not been reviewed. This is a draft document
    and may be updated, replaced or obsoleted by other documents at
    any time.`,
    null,
    `This document is part of the`, ref("ValOS core specification", "@valos/vault"), ".",
    null,
    `The format is implemented and supported by`,
    ref("@valos/toolset-vault npm package", "@valos/toolset-vault"), ".",
  ],
  "chapter#introduction>2;Introduction": [
    dfn(`VDoc`, "#vdoc", `is a extensible JSON-LD interchange
      specification for extracting documents from varying sources,
      passing the now-machine-manipulable interchange document around
      and subsequently producing documents of specific formats such
      as Valospace resources, markdown, ReSpec HTML and browser and
      ansi-colored console outputs.`),
    null,
    `Motivation for this specification is to provide the foundation
    for documentation`, ref("Valospace hypertwins", "@valos/hypertwin"),
    `by supporting the ValOS resources as an emission target. This
    allows all kinds of documentation to be accessible from within
    Valospace with minimal additional tooling. This is not made
    an explicit design goal unto itself; instead the design goals are
    chosen to be generic in a way that satisfies this goal as the
    original author believes this leads to better design.`,
  ],
  "chapter#goals_and_non_goals>3;Goals and non-goals": {
    "#0": "VDoc design goals are:",
    "numbered#design_goals>0": {
      "#robustly_writable>0":
        `Manual writing VDoc should be robust and must rely on minimal
        number of intuitive rules. The more there is to remember the
        higher the threshold to writing docs.`,
      "#programmatically_manipulable>1":
        `VDoc should be programmatically manipulable with minimal
        boilerplate. Complex array and other wrapper nestings make
        introspection and comprehension harder for a less than
        dedicated developer.`,
      "#semantically_modeled>2":
        `VDoc should have semantic structure with a globally
        referenceable underlying model. Documents should be combinable
        and allowed to evolve; identifying document parts by their
        position in a document is brittle.`,
      "#contextually_extensible>3":
        `VDoc should be contextually extensible. Formats often have
        details which resist universalization but must still be
        accessible during document emission.`,
    },
    "#1": "Design non-goals are:",
    "numbered#design_non_goals>1": {
      "#no_unified_ontology>0":
        `VDoc does not attempt at providing a unified ontology.
        Documentation formats are contextual and often evolve. Common
        structures may be represented in unified manner using existing
        ontologies where possible but providing an interchange ontology
        is outside the scope of this document.`,
      "#no_complete_model>1":
        `Documentation formats are contextual. Not all information
        needs to survive the roundtrip via the underlying unified
        model and back. As a corollary a specific format generator can
        know about other formats explicitly and consumer their
        contextual data.`,
    },
    "#2": [
      `To satisfy the goals VDoc chooses JSON-LD as the format for
      primary source of truth and RDF as the underlying object model.`,
      null,
      `Additionally VDoc provides extensibility via custom`,
      ref("VDoc extension formats", "#formats"), `which
      can introduce domain-specific namespaces and ontologies,
      extraction and transformation operations and product document
      formats.`,
    ],
  },
  "chapter#document_flow>4;Document phases and transformations": {
    "#0":
      `VDoc defines the central document flow in terms of three
      document phases:`,
    "numbered#document_phases>0": [[
      dfn("Source graph", "#source_graph", `is a cyclic graph of
        native objects with some of its sub-graphs matching some of the`,
        ref("VDoc extraction rules", "#extension_extraction_rules"), ".",
      ), `It can be manually hand-written, programmatically generated
      or even dynamically introspected.`,
    ], [
      dfn("A VSONLDoc", "#vdocson", `is a JSON-LD construct and the
        primary VDoc interchange format. It is a normalized, complete
        and self-contained structure with potentially multiple
        different format-specific @context(s).`,
      ),
    ], [
      dfn("Emission output", "#extension_output", `is a format specific
        output that is produced by`, ref("emission", "#emission"),
        `from a VSONLDoc and format specific set of emission parameters.`
      ),
    ]],
    "#1":
      `VDoc defines two transformations between the phases:`,
    "numbered#document_transformations>1": [[
      dfn("Extraction", "#extraction", `transforms a source graph into
        a VSONLDoc by applying the idempotent`,
        ref("VDoc extraction rules", "#extension_extraction_rules"),
        "until the output no longer changes.",
      ), `Due to idempotence the source graph can wildly different or
      arbitrarily close to the resulting VSONLDoc; in fact a VSONLDoc is
      always its own source graph.`,
    ], [
      dfn("Emission", "#emission", `is a format specific transformation
        which emits the`, ref("format specific output", "#output_format"),
        "from VSONLDoc.",
      ),
    ]],
    "#2": [
      `In addition to these phases and transformations VDoc makes use of`,
      ref("JSON-LD 1.1 format", "https://www.w3.org/TR/json-ld11/"),
      `, its`, ref("API and algorithms", "https://www.w3.org/TR/json-ld11-api/"),
      `and (maybe)`, ref("its framing", "https://www.w3.org/TR/json-ld11-framing/"),
      "for providing a mapping from VSONLDoc to RDF model.",
    ],
  },
  "chapter#vdocson>5;VSONLDoc - primary interchange format": {
    "#0": `VSONLDoc is a JSON-LD document with a well-formed tree
      structure consisting of three types of nodes, corresponding to
      the first, second and remaining levels of the tree:`,
    "numbered#node_types>0": [
      dfn("Document node", "#document_node", `is an always-first-level
        node identified by a`, ref("a global document IRI", "#document_iri"),
        "as its", ref("JSON-LD @id", "https://www.w3.org/TR/json-ld11/#node-identifiers"),
        "."),
      dfn("Resource node", "#resource_node", `is an always-second-level
        node which is directly accessible from the first-level document
        via its document relative`, ref("resource identifier", "#resource_id"),
        `as the dictionary key.`),
      dfn("Element node", "#element_node", `is a third-or-more-level
        node. It might be anonymous and lacks a stable and unique
        identifiers. It MAY have a locally unique identifier. If the
        element node and all its parent element nodes have locally
        unique identifier then the ordered set of those identifiers
        can be considered a document local unique identifier of the
        element node, similar to `, ref("the resource identifier", "#resource_id")),
    ],
    "#1": [
      `There can be multiple first-level document nodes in a single
      VSONLDoc (as per JSON-LD).`,
      dfn("The tree root node", "#root_node", `is the singular,
        implicit '0th-level' VSONLDoc node without semantics defined by
        VDoc itself.`),
    ],
    "chapter#node_keys>1;Node keys": {
      "#0": `The keys of the VSONLDoc nodes have four categories
        depending on whether the key is an IRI or not and whether an
        IRI key has semantics defined VDoc or extension format
        specifications:`,
      "numbered#node_key_categories>0": [
        dfn("VDoc node key", "#vdoc_key", `is any IRI which matches
          a VDoc ontology context term. Its semantics are defined by
          this specification.`),
        dfn("Extension node key", "#extension_key", `is any IRI which
          matches an extension ontology context term. Its semantics
          are defined by the corresponding extension specification`),
        dfn("Generic IRI key", "#generic_key", `is any IRI key without
          recognized ontology. It has no semantics in addition to what
          JSON-LD specifies.`),
        dfn("Identifier key", "#identifier_key", `is any non-IRI key.
          The semantics of an identifier key is defined by the node.`),
      ],
    },
    "chapter#document_node>2;Document nodes": [
      dfn(`The document IRI`, "#document_iri", `is a global
        identifier of a document. It must not have a fragment part.`),
      `All`, ref("identifier keys", "#identifier_key"), `of a
      document node must have a resource node as their value.`,
    ],
    "chapter#resource_node>3;Resource nodes": [
      dfn(`The resource identifier`, "#resource_id", `is a
        'identifier-restricted' string which is unique within
        a document and identifies a resource node inside that document.`),
      `When the resource identifier is appended to`, ref("the document IRI", "#document_iri"),
      `as an IRI fragment part the resource node has a stable,
      global identity over time.`,
    ],
    "chapter#element_node>4;Element nodes": [
      `Element nodes are structural document building blocks which
      lack a stable identity even within the document.`
    ],
  },
  "chapter#extraction_transformation>6;Document extraction transformation": {
    "#0": [],
  },
  "chapter#emission_transformation>7;Document emission transformation": {
    "#0": [],
  },
  "chapter#formats>8;VDoc ontologies": {
    "#0": [
      `A VDoc ontology is a collection `
    ],
    "chapter#extension_prefixes>0": {
      "#0": [],
    },
    "chapter#extension_context>1": {
      "#0": [],
    },
    "chapter#extension_vocabulary>2": {
      "#0": [],
    },
    "chapter#extension_extraction_rules>3;Extraction transformation rules": [
      `Extraction transformation rules specify how a source graph is
      interpreted as mutations against a given target vdocson document.
      The idiomatic transformation rule consists of two parts:`,
      { "bulleted#": [
        dfn("key matching pattern", "#transformation_key_pattern", `is
            matched against source graph node dictionary key to see if
            the rule applies in that `, ref("transformation context")),
        dfn("transformation rule", "#transformation_rule", `specifies
            how the `, ref("transformation context"), ` is interpreted
            as a set of mutations on the current target vdocson
            document node`),
      ] },
      dfn("Transformation context", "#transformation_context", `is
          defined as a collection of `, ...[].concat(...[
            "transformation key",
            "source graph parent node",
            "source graph node value",
            "target document parent node",
            "target document value"
          ].map((k, i, a) => (!i ? [ref(k)] : [(i + 1 === a.length) ? " and " : ", ", ref(k)])))),
    ],
    "chapter#extension_extractee_apis>4;Extraction extractee tool APIs": [
      `An extension MAY specify an extractee API as a collection
      of `, ref("WebIDL interfaces", "https://www.w3.org/TR/WebIDL-1/"),
      `for constructing of extension extraction source graphs. By doing
      this the native implementations gain the benefits of integrated
      toolchains:`,
      { "bulleted#0": [
        `Improved discoverability via integrated documentation and code
        completion`,
        `Implicitly well-formed primitives and structures where
        possible, validation of input where not`,
        `Improved readability of the document in contexts where the
        primary document source graph is expressed in native code`
      ] },
      `Altogether the extraction APIs are intended to lower the
      threshold of adoption of new extensions and as such make the
      introduction of new extensions easier.`
    ],
    "chapter#extension_output>4;Emission outputs": {
      "#0": [],
    },
    "chapter#extension_emission>5;Emission transformation": {
      "#0": [],
    },
  },
  "chapter#ontology>9;VDoc Core ontology": {
    "#0": [
      `VDoc core ontology specifies the vocabulary for the human facing
      document structure by means of primitives which are sufficiently
      common and meaningful across all types documents.
      These primitives include constructs such as chapters, titles,
      lists, tables, cross-references, etc.`,
      `VDoc core ontology explicitly does not specify any semantic
      meanings outside the document structure itself.`,
    ],
    "chapter#prefixes>0;VDoc Core JSON-LD prefixes": {
      "#0": [],
      "table#>0;prefixes_data": ontologyTables.prefixes,
      "data#prefixes_data": vdocOntology.prefixes,
    },
    "chapter#context>1;VDoc Core JSON-LD context": {
      "#0": [],
      "table#>0;context_data": ontologyTables.context,
      "data#context_data": vdocOntology.context,
    },
    "chapter#vocabulary>2;VDoc Core JSON-LD vocabulary": {
      "#0": [],
      "table#>0;vocabulary_data": ontologyTables.vocabulary,
      "data#vocabulary_data": vdocOntology.vocabulary,
    },
    "chapter#extraction_rules>3;VDoc Core extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_lookup": ontologyTables.extractionRules,
      "data#extraction_rules_lookup": vdocOntology.extractionRules,
    },
    "chapter#extractee_api>4;VDoc Core extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": ontologyTables.extracteeAPI,
      "data#extractee_api_lookup": vdocOntology.extracteeAPI,
    },
    "chapter#output>5;VDoc Core output formats": {
      "#0": [],
    },
    "chapter#emission>6;VDoc Core emission rules": {
      "#0": [],
    },
  },
};
