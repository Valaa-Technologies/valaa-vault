// @flow

const { extension: { ontology, extractee, emitters } } = require("@valos/vdoc");
const {
  extractee: { authors, ref, dfn, em, pkg, filterKeysWithAnyOf, filterKeysWithNoneOf },
  ontologyHeaders,
} = require("@valos/revdoc");

const { name, version, description } = require("./package");

const { preferredPrefix, baseIRI, prefixes, vocabulary, context, extractionRules } = ontology;

module.exports = {
  "dc:title": description,
  "VDoc:tags": ["PRIMARY", "ONTOLOGY"],
  "VRevdoc:package": name,
  "VRevdoc:preferredPrefix": preferredPrefix,
  "VRevdoc:baseIRI": baseIRI,
  "VRevdoc:version": version,
  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    shortName: "vdoc",
    alternateFormats: [{ label: "VDoc", uri: "vdoc.jsonld" }],
  },
  "chapter#abstract>0": {
    "#0": [
`This document specifies VDoc, a `, ref("a JSON-LD",
    "https://www.w3.org/TR/json-ld11/"), `-based documentation
human-machine-valospace interchange format.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document has not been reviewed. This is a draft document and may
be updated, replaced or obsoleted by other documents at any time.

This document is part of the `, ref("ValOS core specification", "@valos/kernel"), `.

The format is implemented and supported by `, pkg("@valos/vdoc"), ` npm package.`,
    ],
  },
  "chapter#introduction>2;Introduction": {
    "#0": [
dfn(`VDoc`, "#vdoc", ` is an extensible JSON-LD interchange
  specification for extracting documents from varying sources,
  passing the now-machine-manipulable interchange document around
  and subsequently producing documents of specific formats such
  as Valospace resources, markdown, ReSpec HTML and browser and
  ansi-colored console outputs.`), `

Motivation for this specification is to provide the foundation for
document `, ref("Valospace hypertwins", "@valos/hypertwin"), ` by
supporting the ValOS resources as an emission target. This allows all
kinds of documents to be accessible from within Valospace with minimal
additional tooling.
This is not made an explicit design goal unto itself; instead the
design goals are chosen to be generic in a way that satisfies this goal
as the original author believes this leads to better design.`,
    ],
  },
  "chapter#goals_and_non_goals>3;Goals and non-goals": {
    "#0":
`VDoc design goals are:`,
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
    "#1":
`Design non-goals are:`,
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
know about other formats explicitly and consume their
contextual data.`,
    },
    "#2": [
`To satisfy the goals VDoc chooses `, ref("JSON-LD 1.1", "https://www.w3.org/TR/json-ld11/"),
` as the primary interchange format and as a consequence RDF as
the underlying document object model.

Additionally VDoc provides extensibility via custom `,
ref("VDoc extensions", "#extension"), ` which can introduce
domain-specific namespaces and ontologies, extraction and emission
transformation operations and document output formats.`,
    ],
  },
  "chapter#document_flow>4;Document phases and transformations": {
    "#0":
`VDoc defines the central document flow in terms of three
document phases:`,
    "numbered#document_phases>0": [[
dfn("Source graph", "#source_graph", ` is a cyclic graph of
  native objects with some of its sub-graphs matching some of the `,
  ref("VDoc extraction rules", "#extension_extraction_rules"), ".",
), ` It can be manually hand-written, programmatically generated
or even dynamically introspected.`,
    ], [
dfn("VDocState", "#vdocstate", ` is a JSON-LD construct and the
  primary VDoc interchange format. It is a normalized, complete
  and self-contained structure with potentially multiple
  different format-specific @context(s).`,
),
    ], [
dfn("Emission output", "#extension_output", ` is a format specific
  output that is produced by `, ref("emission", "#emission"),
  ` from a VDocState and format specific set of emission parameters.`
),
    ]],
    "#1":
`VDoc defines two transformations between the phases:`,
    "numbered#document_transformations>1": [[
dfn("Extraction", "#extraction", ` transforms a source graph into
  a VDocState by applying the idempotent `,
  ref("VDoc extraction rules", "#extension_extraction_rules"),
  " until the output no longer changes.",
), `Due to idempotence the source graph can wildly different or
arbitrarily close to the resulting VDocState; in fact a VDocState is
always its own source graph.`,
    ], [
dfn("Emission", "#emission", ` is a format specific transformation
  which emits the `, ref("format specific output", "#output_format"),
  " from VDocState.",
),
    ]],
    "#2": [
`In addition to these phases and transformations VDoc makes use of `,
ref("JSON-LD 1.1 format", "https://www.w3.org/TR/json-ld11/"),
`, its `, ref("API and algorithms", "https://www.w3.org/TR/json-ld11-api/"),
` and (maybe) `, ref("its framing", "https://www.w3.org/TR/json-ld11-framing/"),
" for providing a mapping from VDocState to RDF model.",
    ],
  },
  "chapter#vdocstate>5;VDocState - primary interchange format": {
    "#0": `
VDocState is a VState JSON-LD document with a well-formed tree structure
consisting of three types of nodes, corresponding to the first, second
and remaining levels of the tree:`,
    "numbered#node_types>0": [
[dfn("Document node", "#document_node", ` is an always-first-level
  node identified by a `, ref("a global document IRI", "#document_iri"),
  "as its ", ref("JSON-LD @id", "https://www.w3.org/TR/json-ld11/#node-identifiers"),
  "."), " Links to document nodes in bold and italics."],
[dfn("Resource node", "#resource_node", ` is an always-second-level
  node which is directly accessible from the first-level document
  via its document relative `, ref("resource identifier", "#resource_id"),
  `as the dictionary key.`), " Links to resource nodese are in italics."],
[dfn("Element node", "#element_node", ` is a third-or-more-level
  node. It might be anonymous and lacks a stable and unique
  identifiers. It MAY have a locally unique identifier. If the
  element node and all its parent element nodes have locally
  unique identifier then the ordered set of those identifiers
  can be considered a document local unique identifier of the
  element node, similar to `, ref("the resource identifier", "#resource_id"))],
    ],
    "#1": [
`There can be multiple first-level document nodes in a single
VDocState (as per JSON-LD). `,
dfn("The tree root node", "#root_node", ` is the singular,
  implicit '0th-level' VDocState node without semantics defined by
  VDoc itself.`),
    ],
    "chapter#node_keys>1;Node keys": {
      "#0": `
The keys of the VDocState nodes have four categories depending on whether
the key is an IRI or not and whether an IRI key has semantics defined
VDoc or extension format specifications:`,
      "numbered#node_key_categories>0": [
[dfn("VDoc node key", "#vdoc_key", ` is any IRI which matches
  a VDoc ontology context term. Its semantics are defined by
  this specification.`)],
[dfn("Extension node key", "#extension_key", ` is any IRI which
  matches an extension ontology context term. Its semantics
  are defined by the corresponding extension specification`)],
[dfn("Generic IRI key", "#generic_key", ` is any IRI key lacking
  recognized ontology. It has no semantics in addition to what
  JSON-LD specifies.`)],
[dfn("Identifier key", "#identifier_key", ` is any non-IRI key.
  The semantics of an identifier key is defined by the node.`)],
      ],
    },
    "chapter#document_node>2;Document nodes": {
      "#0": [
dfn(`The document IRI`, "#document_iri", ` is a global
  identifier of a document. It must not have a fragment part.`),
`All `, ref("identifier keys", "#identifier_key"), ` of a
document node must have a resource node as their value.`,
      ],
    },
    "chapter#resource_node>3;Resource nodes": {
      "#0": [
dfn(`The resource identifier`, "#resource_id", ` is a string using
character set restricted to valid javascript identifiers, is
unique within a document and which identifies a resource node
inside that document.`),
`When the resource identifier is appended to `, ref("the document IRI", "#document_iri"),
` as an IRI fragment part the resource node has a stable,
global identity over time.`,
      ],
    },
    "chapter#element_node>4;Element nodes": {
      "#0": [
`Element nodes are structural document building blocks which
lack a stable identity even within the document.`
      ],
    },
  },
  "chapter#transformations_spec>6;Transformations convert documents to and from VDocState": {
    "#0": [],
    "chapter#extraction_transformation>6;Extraction transforms source graphs into VDocState": {
      "#0": [],
    },
    "chapter#emission_transformation>7;Emission transforms VDocState into output targets": {
      "#0": [],
    },
  },
  "chapter#extension>7;Extensions provide new ontologies and transformations": {
    "#0": [
`A VDoc extension is a specification which can extend the VDoc
specification in different ways in the different transformation
stages. An extension has two main parts; the extension ontology
introduces new vocabulary for the VDoc interchange format itself
and the extension transformations introduces new algorithms for
extracting and emitting said vocabulary.

Multiple VDoc extensions can co-exist; extensions must be
specified in a manner that a VDoc document itself and all
transformation operations are well-defined and deterministic even
if multiple extensions are used at the same time. There are two
primary mechanisms to reach this goal: global dns-registration
based ontology base IRI's and and extension ordering primacy
during transformations.`,
    ],
    "chapter#extension_ontology>0;VDoc extension ontology": {
      "#0": [
`VDoc extension ontology is the combination of the extension`,
{ "numbered#": [
  `namespace preferred prefix and its associated baseIRI`,
  `depended ontologies with their prefix definitions`,
  `extension RDF vocabulary`,
  `JSON-LD context term definitions`,
] },
`Together these fully specify the semantics of an extension
ontology. More specifically the ontologies of all extensions
listed in the @context section of a VDoc JSON-LD document fully
define all the semantics of that particular document itself.`
      ],
      "chapter#extension_prefixes>1": {
        "#0": [
`Mappings from short, document-local strings into a globally unique IRIs.`
        ],
      },
      "chapter#extension_vocabulary>2": {
        "#0": [
`A collection of RDF classes, properties and other names, all
of which have the ontology baseIRI as a prefix.`,
        ],
      },
      "chapter#extension_context>3": {
        "#0": [
`A collection of JSON-LD context term definitions.`,
        ],
      },
    },
    "chapter#extension_transformations>1;VDoc extension transformations: extraction and emission": {
      "#0": [
`An extension can specify an arbitrary number of extraction and
emission transformation algorithms and rules from various source graphs
via the VDoc interchange format into various output formats.`,
      ],
      "chapter#extension_extraction_rules>4;Extraction transformation rules": {
        "#0": [
`Extraction rules specify how a source graph is interpreted as
mutations (usually additions) to a given target VDocState document.
An extraction rule consists of two parts:`,
          { "bulleted#": [
[dfn("key pattern matcher", "#extraction_key_pattern", ` is
    matched against each source graph node dictionary key to
    see if the key matches the rule and to parse the
    extraction rule parameters`)],
[dfn("extraction action", "#extraction_action", ` specifies
    how the extraction rule parameters and `, ref("extraction context"),
    ` is interpreted as a set of mutations on the current
    target VDocState document node`)],
          ] },
dfn("Extraction context", "#extraction_context", ` is
    defined as a collection of `, ...[].concat(...[
      "rule key",
      "source graph parent node",
      "source graph node value",
      "target document parent node",
      "target document value"
    ].map((k, i, a) => (!i ? [ref(k)] : [(i + 1 === a.length) ? " and " : ", ", ref(k)])))),
`Typical extraction rule creates a new Node, adds it to target document
parent (directly or as a reference depending on the `,
ref("Node type", "#node_type"), `) and adds the source node value to
some specific property of the new Node.`,
        ],
      },
      "chapter#extension_extractee_apis>5;Extraction extractee tool APIs": {
        "#0": [
`An extension MAY specify an extractee API as a collection
of `, ref("WebIDL interfaces", "https://www.w3.org/TR/WebIDL-1/"), ` for
constructing of extension extraction source graphs. By doing this the
native implementations gain the benefits of integrated toolchains:`,
          { "bulleted#": [
[`Improved discoverability via integrated documentation and code
  completion`],
[`Implicitly well-formed primitives and structures where
  possible, validation of input where not`],
[`Improved readability of the document in contexts where the
  primary document source graph is expressed in native code`],
          ] },
`All put together the extraction APIs are intended to lower the
threshold of adoption of new extensions and as such make the
introduction of new extensions easier.`
        ],
      },
      "chapter#extension_output>6;Emission outputs": {
        "#0": [],
      },
      "chapter#extension_emission>7;Emission transformation": {
        "#0": [],
      },
    },
  },
  "chapter#ontology>8;VDoc Core ontology": {
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": [
`VDoc core ontology specifies the vocabulary for the human facing
document structure by means of primitives which are sufficiently
common and meaningful across all types of documents. These primitives
include constructs such as chapters, titles, lists, tables,
cross-references, etc.

VDoc core ontology explicitly does not specify any semantic
meanings outside the document structure itself.`,
    ],
    "chapter#section_prefixes>1;VDoc Core IRI prefixes": {
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
    },
    "chapter#section_classes>2": {
      "dc:title": [
em(preferredPrefix), ` `, ref("VDoc:Class", "@valos/vdoc#Class"), " vocabulary",
      ],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:headers": ontologyHeaders.classes,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VDoc:Class", vocabulary),
      },
    },
    "chapter#section_properties>3": {
      "dc:title": [
em(preferredPrefix), ` `, ref("VDoc:Property", "@valos/vdoc#Property"), " vocabulary",
      ],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:headers": ontologyHeaders.properties,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VDoc:Property", vocabulary),
      },
    },
    "chapter#section_html_element_properties>4": {
      "dc:title": [
em(preferredPrefix), ` `, ref("VDoc:HTMLElementProperty", "#HTMLElementProperty"), " vocabulary",
      ],
      "#0": [
`Properties instanced from `, ref("VDoc:HTMLElementProperty", "#HTMLElementProperty"), `
inherit HTML5 element semantics directly. Only those HTMl5 elements
with structural semantic meaning are exposed via VDoc core ontology.`,
      ],
      "table#>0;vocabulary": {
        "VDoc:headers": {
          ...ontologyHeaders.properties,
          "header#1;rdfs:subPropertyOf": undefined,
          "header#1": {
            "VDoc:content": ["HTML5 element"],
            "VDoc:cell": ref(
                { "VDoc:selectField": "VDoc:elementName" },
                { "VDoc:selectField": "VDoc:elementSpec" }),
          },
        },
        "VDoc:entries": filterKeysWithAnyOf("@type", "VDoc:HTMLElementProperty", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:headers": ontologyHeaders.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf(
            "@type", ["VDoc:Class", "VDoc:Property", "VDoc:HTMLElementProperty"], vocabulary),
      },
    },
    "chapter#section_context>9;VDoc Core JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
  "chapter#transformations>9;VDoc Core transformations": {
    "data#extraction_rules_lookup": extractionRules,
    "data#extractee_api_lookup": extractee,
    "#0": [
`VDoc defines a single extraction transformation from a native
javascript source graph. To support this VDoc defines an `,
dfn("extractee API", "#extractee_api"), ` as native javascript
convenience functions and libraries which construct typical VDoc source
graph primitives. This API can be extended by extensions which make use
of native source graph extractors.

The extraction transformation is based around two basic mechanisms: `,
dfn("array composition", "#array_composition"), ` and `,
dfn("extraction rules", "#extraction_rules"), `.`,
    ],
    "chapter#extraction_rules>0;VDoc Core extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_lookup": ontologyHeaders.extractionRules,
    },
    "chapter#extractee_api>1;VDoc Core extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": ontologyHeaders.extractee,
    },
    "chapter#emission_output>2;VDoc Core emission output": {
      "#0": [],
    },
    "chapter#emission_rules>3;VDoc Core emission rules": {
      "#0": [
        `ReVDoc provides html emission rules for `,
        { "VDoc:words": Object.keys(emitters.html) },
      ],
    },
  }
};
