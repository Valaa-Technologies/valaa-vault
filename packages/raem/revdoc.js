
const {
  headers,
  extractee: {
    c, ref,
    authors, quote, pkg,
    filterKeysWithAnyOf, filterKeysWithNoneOf,
  },
} = require("@valos/revdoc");

const { prefix, prefixIRI, prefixes, vocabulary } = require("./ontology");

const { name, version, description } = require("./package");

module.exports = {
  "dc:title": description,
  "vdoc:tags": ["PRIMARY", "INTRODUCTORY", "ONTOLOGY", "LIBRARY"],
  "revdoc:package": name,
  "revdoc:prefix": prefix,
  "revdoc:prefixIRI": prefixIRI,
  "revdoc:version": version,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "raem",
  },
  "chapter#abstract>0": [
    `This library provides the definitions and reference implementation
    for the fundamental `, c(`ValOS Resources`), " and ", c(`ValOS Events`),
    ` systems.`,
  ],
  "chapter#sotd>1": [
    "This document is part of the library workspace ", pkg("@valos/raem"),
    " (of domain ", pkg("@valos/kernel"), ") which is ",
    "ValOS Resources And Events Model (ValOS-RAEM) API, Schema",
  ],
  "chapter#introduction>2": [
    `This library provides the definitions and reference implementations
    for the fundamental `, c(`ValOS Resources`), " and ", c(`ValOS Events`),
    ` systems.`,
    null,
    quote([
      `A ValOS Resource `, c(`resource`), ` represents a well-defined part of
      the world. It has a well-defined state at each particular moment in time.`,
    ]),
    null,
    quote([
      `A ValOS Event `, c(`event`), ` represents a dynamic change to a
      resource by describing the change from previous to subsequent resource
      states at a particular time.`,
    ]),
    null,
    `The interplay of these distinct yet interwoven systems forms the
    foundation of the Valaa Open System.`,
  ],
  [`chapter#readme>3;${
      ""}@valos/raem provides ValOS Resources And Events Model \`ValOS-RaEM\` (/væləsˌɹɛem/)`]: {
    "#0":
      `This library provides:`,
    "bulleted#1": [
      ["schema definitions for ", c("Resource"), " and the other core types."],
      [c("Corpus"), " component which stores in-memory representations of the resources."],
      [c("reducers"), " which a corpus uses to convert (", c("reduce"),
        ") events into changes of its resource representations."],
      ["the kuery language ", c("VALK"), " definition and the kuery engine ",
        c("Valker"), "component for accessing and manipulating the resources."],
      [c("ghost instancing"), ` mechanism which unifies the object
        oriented instantiation and inheritance principles into a single
        but powerful mechanism for ValOS resources.`],
      [c("resource couplings"), ` mechanism which allows referential
        integrity and the definition of different types of reference
        semantics like ownership, global references and local references.`],
      // TODO(iridian, 2019-07): Valospace and partitions should in principle
      // be inside @valos/sourcerer. This refactoring effort would be
      // valuable otherwise as well as it would clarify Valker API's and
      // simplify its implementation considerably.
      // However that's gonna be a damn of a refactoring process to fully
      // abstract and excise them from @valos/raem.
      [c("urn:valos"), ` specification which defines globally unique
        identifiers for ValOS resources.`],
      [c("ValOSURL"), ` specification which allows for universal locating of resources.`],
      [c("valospace"), ` definition as a distributed set of resources
        containing references to each other using the VRLs.`],
      [c("partitions"), ` mechanism which allows for unlimited scalability of
      the `, c("valospace"), ` into a singular globally distributed and
      unified object space.`],
    ],
    "bulleted#2": [
      ["depends:", pkg(`@valos/tools`), c(`immutable`)],
      ["exports:", c(`Corpus`), c(`Command`), c(`VALK`), c(`Valker`), c(`RAEMContentAPI`)],
      ["valosheath:", c(`Resource`), c(`TransientFields`), c(`Bvob`), c(`Partition`)],
      ["concepts:", c(`ghost instancing`), c(`partitions`), c(`couplings`)],
    ],
    "chapter#section_url_urn_id>2;ValOS URLs, urn:valos and raw id's": {
      "#0": [
        `ValOS URL is used to specify a parameterized location reference to a
        ValOS Resource. It has two major parts separated by the URI fragment
        separator \`#\`: *partition URI* part and a *local reference* part.`,
        null,
        `*Partition URI* identifies the target authority and partition of
        the reference. It corresponds to scheme, hierarchical and query parts
        of an URI; everything but the fragment. Its precise structure and
        interpretation is specified by the scheme but typically the scheme and
        hierarchical part identify an authority and query part identifies
        a partition.`,
        null,
        `*Local reference* identifies a particular resource inside a partition
        but also contains optional *coupling*, *ghost path*, *lens* (and other)
        parts which further parameterize the reference itself. It corresponds
        to the URI fragment part but has sub-structure which is specified in
        this document.`
      ],
      [`c#valos_iri_structure>0;${
        ""}Correlations between ValOS URL and urn:valos (top) and URI and URN (bottom)`]:
`                                            valos-url
┌────────────────────────────────────────────────┴─────────────────────────────────────────────────┐
                  partition-url                                      resource-ref
┌───────────────────────┴────────────────────────┐ ┌──────────────────────┴────────────────────────┐
                         resource-url                                         ref-params
┌──────────────────────────────┴────────────────────────────────┐  ┌───────────────┴───────────────┐
         authority-uri               partition-id   resource-id         coupling           lens
┌──────────────┴───────────────┐    ┌─────┴──────┐ ┌─────┴──────┐  ┌───────┴────────┐ ┌─────┴──────┐

valaa-test://example.com:123/dev?id=abcd-123...234#987b-72...8263?=coupling=relations&lens=ROOT_LENS

                                                   └─────┬──────┘  └──────────────┬────────────────┘
                                                        nss                  q-component
└───┬────┘   └──────┬──────┘ └┬┘ └───────┬───────┘ └──────────────────────┬────────────────────────┘
  scheme        authority    path      query                           fragment
             └────────┬────────┘
                  hier-part
`,
      "chapter#section_dualisms>1;Curious dualisms of *partition URI* and *local reference*": {
        "#0":
          `The division between partition URI and local reference has many curious
          dualistic qualities: backend vs. frontend, hierarchical vs. flat,
          routing vs. computation, extensible vs. fixed, absolute vs. contextual,
          coarse vs. granular, self-contained vs. part-of-a-whole.`,
        "chapter#1;Partition URI domain is backend, local reference domain is front-end":
          `ValOS backends deal with the indivisible partitions and thus don't care
          about the particularities of local references to individual resources.
          This corresponds to how in web architecture URI fragments are not sent
          to backend with resource requests. Conversely, ValOS frontends don't
          care where a resource comes from once it has been loaded, but about its
          identity, relationships and the parameters of those relationships. This
          is reflected in how frontend code regularily drops the partition URI.`,
        "chapter#2;Partition URI structure is specified by the scheme, local reference structure is specified by ValOS":
          `By the nature of its distributed event sourcing architecture ValOS
          focuses heavily on the frontend. The cross-compatibility between
          components is driven by how new backends can integrate and talk with
          existing front-end clients. This is facilitated by front-end plugin
          systems which enables new ValOS URI schemes to specify new routing
          solutions and fundamentally new backend infrastructures, as long as
          said infrastructures can route ValOS event streams to clients. This
          corresponds to how ValOS doesn't specify how a *partition URI*
          identifies and locates partitions and authorities but leaves it to
          the scheme specifications and their reference implementations of
          frontend plugins.`,
        "chapter#3;Partitions URI's identify self-contained wholes, resource references need their context":
          `Web architecture specifies that all or none of the document is
          retrieved. This corresponds to the behaviour of ValOS partitions which
          are always retrieved as a whole. Partition URI's contain all and
          nothing but the components which identify web resources, that is
          everything but the fragment.`,
        "chapter#4;Etc.": [],
      },
      "chapter#resource_id>2;resource-id": {
        "#0": [
          `Resource id is the NSS part of an urn:valos URI. It globally uniquely
          identifies a *referenced resource*:`,
          null,
          c(`resource-id        = primary-part [ "/" secondary-part ]`),
          null,
          `The first, non-optional *primary* part globally uniquely identifies a
          freely movable *primary* resource. If no secondary part exists this
          resource is also the referenced resource. If the secondary part exists
          it identifies a structural sub-resource which is deterministic to
          the primary resource.
          The referenced resource is then this sub-resource.`,
          null,
          `Two resource ids refer to the same resource iff their canonical string
          representations are lexically equivalent. Notably:`,
        ],
        "numbered#1": [
          [`both parts are case sensitive. If a part specification refers to a
            case insensitive external naming system it must specify a canonical
            representation.
            It is recommended that this representation be all-lowercase.`],
          [`no redundant encoding. If a part contains encoding schemes then any
            characters or tokens which can expressed without encoding must not
            be encoded.`],
        ],
        "chapter#primary_part>1;primary-part - restricted naming, free ownership": [
          `The primary id part has a very restricted character set of `, c(`unreserved`),
          `as specified in the `, ref("URI specification", "https://tools.ietf.org/html/rfc3986"),
          `.`,
          null,
          c(`primary-part       = *( unreserved )`),
          null,
          `The *primary* part must be globally unique.
          Note: uuid v4 is recommended for now, but eventually primary id
          generation should tied to the deterministic event id chain. This in
          turn should be seeded by some ValOS authority.`,
          null,
          `Note: when using base64 encoded values as primary id, use `,
          ref("url-and-filename-ready base64url characters",
              "https://tools.ietf.org/html/rfc4648#section-5"),
          ".",
          null,
          `Note: derivedId currently used by the codebase uses only the primary
          id but breaks the above character set requirement, as it uses base64
          encoding with `, c(`+`), " and ", c(`/`), `. For backwards
          compatibility they are permitted, but `,
          ref("considered equal to the base64url",
              "https://tools.ietf.org/html/rfc7515#appendix-C"),
          "using ", c(`+`), " <-> ", c(`-`), " and ", c(`/`), " <-> ", c(`_`),
          " character mappings.",
        ],
        "chapter#secondary_part>2;secondary-part - lenient naming, restricted ownership": [
          `The *secondary* id part is a qualified name which can be expanded into
          an URI. This URI then defines how the referred resource is determined
          from the primary resource.`,
          null,
          c(`\n
            secondary-part    = prefix *( pchar / "/" )
            prefix            = *( unreserved / pct-encoded / sub-delims / "@" ) ":"`),
          `The expansion is done by replacing the prefix with a corresponding
          value. Currently the only allowed prefixes and their semantics is
          limited to the exclusive list of three entries:`,
          null,
          { "numbered#": [
            [`prefix \`@:\` - instance-ghost ids
              \`urn:valos:ba54/@:b7e4\` reads as "inside the instanced resource
              \`ba54\` the ghost of the regular resource \`b7e4\`".
              The expansion of the prefix \`@:\` is \`valos:urn:\` itself.
              This means nested ghost paths are allowed, like so:
              \`urn:valos:f00b/@:ba54/@:b7e4\` reads as "inside the instance
              \`f00b\` the ghost of \`urn:valos:ba54/@:b7e4\`.`],
            [`prefix \`.:\` - property ids
              \`urn:valos:f00b/.:propName\` - a directly owned Property resource
              with a constant name \`propName\` and prototype which is dynamically
              linked to the corresponding Property in the prototype of
              \`urn:valos:f00b\`, like so: \`\${prototype("urn:valos:f00b")}/.:propName\`.`],
            [`prefix \`$:\` - virtual resource ids
              permanently immaterial ghosts with nevertheless separate identities.
              When used as prototype with instance-ghosts allows separate
              instantiation of the same fundamental prototype in the same instance:
              \`urn:valos:f00b/$:1/@:b74e\`
              \`urn:valos:f00b/$:2/@:b74e\`
              \`urn:valos:f00b/$:textsalt/@:b74e\``]
          ] },
          null,
          `Resources identified by these parts are tightly bound to the resource
          identified by the primary part (which must exist). They must be always
          directly or indirectly owned by the primary resource.`,
        ],
      },
      "chapter#vrl>3;VRL": [
        `Javascript class which implements ValOS reference URI and associated
        operations.`,
      ]
    },
  },
  [`chapter#ontology>8;<em>${prefix}:</em> library ${name} ontology`]: {
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "#section_ontology_abstract>0": [
      `${name} ontology specifies the Valospace core types and
      properties directly to the @valos/kernel namespace. `,
    ],
    [`chapter#section_prefixes>1;${name} IRI prefixes`]: {
      "#0": [],
      "table#>0;prefixes": headers.prefixes,
    },
    [`chapter#section_classes>2;<em>${prefix}:* a valos:Class</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.classes,
        "vdoc:entries": filterKeysWithAnyOf("rdf:type", "valos:Class", vocabulary),
      },
    },
    [`chapter#section_properties>3;<em>${prefix}:* a valos:Property</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.properties,
        "vdoc:entries": filterKeysWithAnyOf("rdf:type", "valos:Property", vocabulary),
      },
    },
    [`chapter#section_types>4;<em>${prefix}:* a valos:Type</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.types,
        "vdoc:entries": filterKeysWithAnyOf("rdf:type", "valos:Type", vocabulary),
      },
    },
    [`chapter#section_fields>5;<em>${prefix}:* a valos:Field</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.fields,
        "vdoc:entries": filterKeysWithAnyOf("rdf:type", [
          "valos:Field", "valos:PrimaryField", "valos:TransientField", "valos:InferredField",
          "valos:GeneratedField", "valos:AliasField",
        ], vocabulary),
      },
    },
    [`chapter#section_vocabulary_other>8;<em>${prefix}:*</em> other vocabulary:`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.vocabularyOther,
        "vdoc:entries": filterKeysWithNoneOf("rdf:type", [
          "valos:Class", "valos:Type", "valos:Property", "valos:Field",
          "valos:PrimaryField", "valos:TransientField", "valos:InferredField",
          "valos:GeneratedField", "valos:AliasField",
        ], vocabulary),
      },
    },
  },
};
