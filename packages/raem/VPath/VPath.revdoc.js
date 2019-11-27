
const {
  extractee: {
    abnf, blockquote, example, authors, em, ref, pkg, turtle,
  },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": "ValOS Path",
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "VPath",
  },
  "chapter#abstract>0": {
    "#0": [
`ValOS Paths ('VPaths') are strings which are used to identify
valospace resources as well as paths between them.

The vpath strings have a recursive structure allowing for the
expression of arbitrary relationships but also a grammar that is
sufficiently restrictive for embedding into URI's and similar contexts.

VPaths contain 'context terms' which refer to definitions provided by
the surrounding context, usually as references to some external
ontology. This allows VPath semantics to be extended in domain
specific but reusable manner.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/raem"), `
but is only partially implemented by it.`,
    ],
  },
  "chapter#introduction>2": {
    "#0": [`
A subset of vpaths called 'vrids' contain a fixed starting point and
identify valospace resources.

The primary example of a vpath context is the JSON-LD @context of a `,
ref("ValOS event chronicle", "@valos/sourcerer/valos-event-log"), `
which provides the semantics for all vpaths that appear inside the
chronicle.
    `],
  },
  "chapter#section_structure>3;VPath structure": {
    "#0": [
`VPath structure has two primary building blocks: vsteps and vparams.`
    ],
    "bulleted#>0": [
[`A vpath itself is an ordered sequence of "@"-separated vsteps, each
  of which logically depends on the preceding one.`],
[`A vstep can have a 'verb type' and a sequence of "$" or ":"
  -separated vparams, all logically independent of each other.`],
[`A vparam can have a 'context term' and a value; this vparam value can
  be a primitive or a fully nested vpath.`],
    ],
    "example#main_vpath_rules>1;Main VPath rules": abnf(
`  vpath         = "@" vgrid-tail / vsteps-tail
  vgrid-tail    = "$" vgrid "@" [ vsteps-tail ]
  vsteps-tail   = verb "@" [ vsteps-tail ]
  verb          = verb-type vparams
  vparams       = [ vparam vparams ]
  vparam        = [ "$" context-term ] ":" vparam-value
  vparam-value  = "$" / 1*( unencoded / pct-encoded ) / vpath`
    ),
    "#1":
`VPaths serve two superficially distinct purposes as paths and as
identifiers. If the first vstep of a vpath begins with a context term
(ie. doesn't have a verb type) then the whole vpath is valospace
resource identifier (a *vrid*) and the first vstep is a valospace
global resource identifier (a *vgrid*).`,
    "chapter#section_vrid_structure>2;VPath with a vgrid is a resource identifier: a VRId": {
      "#0": `
A vpath with a first vstep lacking a verb type and no other vsteps
identifies a global resource.

Many valospace resources, so called *structural sub-resources* are
identified by a fixed path from the global resource defined by the same
verbs that define non-VRId VPaths. Thus while paths and identifiers are
superficially different it is useful to represent them both using the
same VPath verb structure.

Both verb and vgrid params can also have context term references to
an external lookup of URI prefixes and semantic definitions.`
    },
    "chapter#section_representations>3;VPath representations": {
      "#0": [`
The canonical VPath is a string, but there are other format specific
representations.
      `],
      "chapter#section_segmented_vpaths>0;Segmented VPath representation": {
        "#0": [`
Segmented VPath is a recursive partitioning of a VPath as a JSON object
where each structural segment is expressed as an array. The first entry
of each such segment is a string which denotes the segment type and the
remaining entries contain the segment payload:
`],
        "bulleted#segment_types>1": [
[`"@" identifies a vpath segment with remaining entries as step
  segments`],
[`"$" identifies a vparam segment with its second entry being a valid
  context term string and an optional third entry containing the vparam
  value`],
[`":" identifies a vparam segment without a context-term and with an
  optional second entry containing the vparam value`],
[`otherwise the segment type denotes the verb type of a verb segment
  and remaining entries containing the parameter segments`],
        ],
        "#1": [`
JSON numbers and strings can only appear as param values of "$" or
":"-segments. JSON objects cannot appear.
A vpath which is used as a contextless param of a verb must appear
directly without intermediate ":"-segments (unlike in the string VPath
construct).
Conversely a verb used as a contextless param must still be wrapped
inside a "@"-segment.`
        ],
      },
      "chapter#section_shortcut_vpaths>0;Shortcut VPath representation": {
        "#0": [`
Shortcut VPath format is a compact object representation of a VPath as
'human readable' JSON which can then be distributed to the canonical
representation. In fact any JSON construct is a valid shortcut VPath,
and as long as all initial array entries equal to "@", "$" and ":"  are
escaped as [":", "@"], [":", "$"] and [":", ":"] the shortcut egment
will resolve back into the original JSON construct.
`],
      },
      "chapter#section_cemented_vpaths>1;Cemented VPaths": {
        "#0": [`
VPaths contain context references but do not _contain_ knowledge about
the context. This is to ensure that a VPath can be moved from a context
to a compabible one without modification.

Cementing a VPath with a context inside an environment produces a
construct where the vpath itself and specifically its context terms are
converted to their environment-specific representations. This
representation can be anything from interpretable JSON to fully
compiled executable code.

Cementing also performs the security critical function of validating
the context terms and their parameters against their context inside
that particular environment (e.g. a typical validation failure being
the lack of implementation for a specific context term by the
environment).`
        ],
      },
    },
  },
  "chapter#section_semantics>4;VPath semantics": {
    "#0": [
`The full semantics of a particular VPath string in some environment
comes from several different sources:`
    ],
    "numbered#semantic_sources>0": [
[`VPath specification (ie. this document) fully specifies the VPath
  structure and grammar and defines several verb types`],
[`VPath extension specifications can define additional conforming verb type semantics`],
[`VPath environment can define context terms directly`],
[`VPath environment can delegate context term definitions to external
  ontologies`],
    ],
    "chapter#section_equivalence>1;VPath equivalence follows URN equivalence": {
      "#0": [`
Two VPaths identify the same path (and in case they're VRIds, refer to
the same resource) iff their URN representations are `,
ref("urn-equivalent", "https://tools.ietf.org/html/rfc8141#section-3"),
` and 1. they either share the same environment or 2. their
corresponding context terms expand to URIs which are pair-wise
URI-equivalent.

For the general case the actual semantics of a VPath and specifically
of its context-term's depends on the context it is used. Vrids have a
fixed context which is established by the vgrid. `,
ref("This has implications on VRId equivalence",
      "@valos/raem/VPath#section_vrid_equivalence"), `.`,
      ],
    },
    [`chapter#section_context_term>2;${
      ""} 'context-term' is a lookup to definitions provided by the context`]: {
      "#0": [`
A vpath can be contextual via the vparam context-term's. These are
case-sensitive strings with very restricted grammar. The context where
the vpath is used defines the exact meaning of these terms.
The meaning for two identical context-terms is recommended to be
uniform across domains where possible.
A vpath is invalid in contexts which don't have definitions for the
context-terms of all of its steps. This gives different contexts
a fine-grained mechanism for defining the vocabularies that are
available.

Idiomatic example of such context is the event log and its JSON-LD
context structure which is to define both URI namespace prefixes as
well as available semantics.`
      ],
    },
    "chapter#section_vparam_value>3;'vparam-value' carries content": {
      "#0": [`
*vparams* is a sequence of vparam's, optionally prefixed with
"$" and a context-term. The idiomatic vparam-value is a string.
If present a context-term may denote a URI prefix in which case the
vparam-value forms the suffix of the full expanded URI reference.
However contexts are free to provide specific semantics for specific
context-terms, such as interpreting them as the value type of the
vparam-value etc.

"$" for a vparam-value denotes empty string.

*vparam-value* both allows for fully
unencoded nesting of vpath's as well as allows encoding of all unicode
characters in percent encoded form (as per encodeURIComponent)`,
      ],
    },
    [`chapter#section_verb>4;${
        ""}*verb* - a vstep from a source resource to target resource(s)`]: {
      "#0": `
A verb is a one-to-maybe-many relationship between resources. A verb
can be as simple as a trivial predicate of a triple or it can represent
something as complex as a fully parameterized computational function
call.`,
    "example#main_verb_rules>0;Main verb rules": abnf(
`  vsteps-tail   = verb "@" [ vsteps-tail ]
  verb          = verb-type vparams
  verb-type     = 1*unencoded

  vparams       = [ vparam vparams ]
  vparam        = [ "$" context-term ] ":" vparam-value
  context-term  = ALPHA *unreserved-nt
  vparam-value  = "$" / 1*( unencoded / pct-encoded ) / vpath
`),
      "#1": `
A verb is made up of verb type and a sequence of vparams. The grammar
of verb-type is restricted but less than for context-term.  The verb
type semantics is always fixed. Because of this the first vparam may be
semantically special and act as a contextual name of the verb.
`,
      "chapter#section_verb_type>1;*verb-type*": {
        "#0": [`
*verb-type* specifies the relationship category between the segment
host resource and sub-resource, a set of inferred triples as well as
other possible constraints.`
        ],
        "chapter#section_verb_property>1;verb type \"`.`\": property or ScopeProperty selector": {
          "#0": `
Verb for selecting the resource (typically a ScopeProperty) with the
given name and which has the head as its scope.`,
          "example#example_verb_property>0;Property selector example": [
`Triple pattern \`?s <urn:valos:.:myProp> ?o\` matches like:
`, turtle(`
  ?o    valos:scope ?s
      ; valos:name "myProp"
`), `Mnemonic: '.' is traditional property accessor (ie. ScopeProperty).`,
          ],
        },
        "chapter#section_verb_sequence>2;verb type \"`*`\": sequence or Relation selector": {
          "#0": `
Verb for selecting all resources (typically Relations) with the given
name and which have the head as their source.`,
          "example#example_verb_sequence>0;Sequence selector example": [
`Triple pattern \`?s <urn:valos:*:PERMISSIONS> ?o\` matches like:
`, turtle(`
  ?o    valos:source ?s
      ; valos:name "PERMISSIONS"
`), `
Mnemonic: '*' for many things as per regex/glob syntax (Relations are
the only things that can have multiple instances with the same name).`,
          ],
        },
        "chapter#section_verb_container>3;verb type \"`-`\": container or Entity selector": {
          "#0": `
Verb for selecting the resource (typically an Entity) with the given
name and which has the head as their container.`,
          "example#example_verb_container>0;Container selector example": [
`Triple pattern \`?s <urn:valos:-:Scripts> ?o\` matches like:
`, turtle(`
  ?o    valos:parent ?s
      ; valos:name "Scripts"
`), `
Mnemonic: "-" links a container to its parent.`,
          ],
        },
        "chapter#section_verb_content>3;verb type \"`'`\": content or Media selector": {
          "#0": `
Verb for selecting the Media with the given name which has the
head as their folder.`,
          "example#example_verb_content>0;Content selector example": [
`Triple pattern \`?s <urn:valos:':foo.vs> ?o\` matches like:
`, turtle(`
  ?o    valos:folder ?s
      ; valos:name "foo.vs"
`), `
Mnemonic: "'" for quoted content suggests text data.`,
          ],
        },
        "chapter#section_verb_object>4;verb type \"`-`\": object or target selector": {
          "#0": `
Verb that is a synonym for predicate 'rdf:object'.`,
          "example#example_verb_object>0;Property selector example": [
`Triple pattern \`?s <urn:valos:-> ?o\` matches like:
`, turtle(`
  ?s    rdf:object ?o
`), `
Mnemonic: follow line '-' to target.`,
          ],
        },
        "chapter#section_verb_ghost>5;verb type \"`_`\": subspace selector": {
          "#0": `
Verb for selecting named subspaces and ghosts.`,
          "example#example_verb_language_subspace>0;Language subspace selector example": [
`Triple pattern \`?s <urn:valos:.:myProp@_$lang:fi> ?o\` matches like:
`, turtle(`
  ?_sp  valos:scope ?s
      ; valos:name "myProp"
  . ?o  valos:subspacePrototype* ?_sp
      ; valos:language "fi"
`), `
Mnemonic: '_' is underscore is subscript is subspace.`],
          "#1": [
`If the verb name context term is an identifier term then the subspace
denotes the ghost subspace of the identified resource inside the
current resource.`
          ],
          "example#example_verb_ghost_subspace>1;Ghost subspace selector example": [
`Triple pattern \`?s <urn:valos:_$~u4:ba54> ?o\` matches like:
`, turtle(`
  ?o    valos:ghostHost ?s
      ; valos:ghostPrototype <urn:valos:$~u4:ba54>
`), `
Mnemonic: The '_$~' is a 'subspace of ghoStS'.`,
          ],
        },
        "chapter#section_verb_computation>6;verb type \"`!`\": computation evaluators": {
          "#0": [`
VPaths are data. In general whenever a representation of a VPath
appears in some `, em("evaluation context"), ` the representation
evaluates into itself. The only exception are the verbs with \`!\` as
the leading character of their type: these represent the class of
computation evaluators.

VPath spec tries to specify as little as possible. As such it doesn't
specify an execution model itself but delegates this to context term
ontologies. VPath only provides a way to specify evaluation dependency
chains and the mapping between VPath data structures and evaluator
inputs and outputs.

Following principles apply:`,
          ],
          "numbered#1": [
[`The different evaluator verb types only specify the means to access
  and process the VPath data structure itself. These
  \`evaluator types\` are defined by the VPath specification(s).`],
[`All computation (f.ex. flow control and method call) semantics are
  specified by the first vpath param of the evaluator verb, ie. the
  \`computation id\`. This specification shall be provided by the
  ontology that defines the context-term of the computation id param.`],
[`If the computation id doesn't have a context-term of if the
  specification denotes the computation id to be a \`trivial name\`
  then the computation is a \`context scope lookup path\`.`],
[`When a computation evaluator is evaluated all of its vparams are
  evaluated first in an order defined by the evaluation context and
  their results stores as evaluation arguments.`],
[`The evaluation context is then searched for an implementation for the
  evaluator type / computation id combination. If none is found the
  context does not implement the computation and the whole evaluation
  chain is rejected.`],
[`The evaluation implementation is resolved with the evaluation
  arguments and its result is the result of the computation
  evaluator.`],
          ],
          "example#example_verb_computation>1;Computation selector example": [
`Triple pattern \`?s <urn:valos:!$valk:add$number:10:@!:myVal@> ?o\`
matches like:
`, turtle(`
  ?_:0  valos:scope ?s
      ; valos:name "myVal"
      ; valos:value ?myVal
  . FILTER (?o === 10 + ?myVal)
`),
          ],
          "example#1": `
Editorial Note: this section should be greatly improved.
The purpose of computation verbs lies more on representing various
conversions (as part of dynamic operations such as rest API route
mapping) and less on clever SPARQL trickery. The illustration here uses
(questionable) SPARQL primarily for consistency.`,
        },
      },
    },
    "chapter#section_semantic_considerations>3;Semantic design choices and guidelines": {
      "#0": [
`As VPath structure is expressive there are often multiple ways to
express a particular design need. Following juxtapositions and
guidelines apply:`,
      ],
      "bulleted#>0": [
[`"vsteps vs. vparams" or "How should I express a sequence?":
  If the entries of a sequence depend on each other (e.g. in a query or
  in an execution list) they are vsteps, if not (e.g. data entries)
  they are vparams of a vstep.`],
[`"verb type vs. context term" or "How should I express a concept?":
  If the concept is interaction logic, domain specific, visible to the
  end-users or it doesn't require infrastructure code changes it is
  probably a context term with URI expansion to some ontology.
  If the concept concerns VPath structure or its interpretation and is
  generic enough to warrant a specification and corresponding
  infrastructure implementation work it is possibly a verb type with
  new extension spec or new release of an existing spec.`],
[`"!-computational vs. declarational" or "Who writes the code?":
  Computational vsteps (those with verb type beginning with "!") allow
  for turing-complete computation to be embedded inside vpaths. An
  environment that chooses to support these verbs and context terms
  has the upside of rapid and arbitrarily expressive configurability
  without further code changes. The downside is that security and
  complexity analysis becomes intractable even more rapidly.
  Declarational vsteps (all other verb types) require explicit
  interpretation but should be preferred when meaningful semantics can
  be specified.`],
      ],
    }
  },
  [`chapter#section_vrid>5;${
      ""}VRId is a stable identifier of a global resource or a structural sub-resource`]: {
    "#0": `
A VRId is a vpath which has vgrid as its first production
(via vgrid-tail).`,
    "example#main_vrid_rules>0;Main vrid rules": abnf(
`  vpath         = "@" vgrid-tail / vsteps-tail
  vgrid-tail    = "$" vgrid "@" [ vsteps-tail ]
  vgrid         = format-term ":" vparam-value vparams
`),
    "#1": [`
The VRId can be directly used as the NSS part of an 'urn:valos:'
prefixed URI.

Each valospace resource is identified by a VRId.

If a resource VRId has only vgrid part but no verbs the resource is
called a global resource.

If a resource VRId has verbs then the verbs describe a structural path
from the global resource of its initial vgrid part to the resource
itself. The resource is called a *structural sub-resource* of that
global resource.

Each resource is affiliated with an event log of its global resource.

All direct VRId context-terms are references to this event log `,
ref("JSON-LD context", "https://w3c.github.io/json-ld-syntax/#the-context"),
`.`,
    ],
    [`chapter#section_vgrid>0;${
        ""}vgrid identifies global resources - primary keys, free ownership, concrete state`]: {
      "#0": `
The vgrid uniquely identifies a *global resource*. If a VRId contains
a vgrid and no verbs this global resource is also the
*referenced resource* of the VRId itself.`,
      "example#main_vgrid_rules>0;Main vgrid rules": abnf(
`  vgrid-tail    = "$" vgrid "@" [ vsteps-tail ]
  vgrid         = format-term ":" vparam-value vparams
  format-term   = "~" context-term

  vparams       = [ vparam vparams ]
  vparam        = [ "$" context-term ] ":" vparam-value
  context-term  = ALPHA *unreserved-nt
  vparam-value  = "$" / 1*( unencoded / pct-encoded ) / vpath
`),
      "#1": [`
The format-term defines the global resource identifier schema as well
as often some (or all) characteristics of the resource.

Some vgrid types restrict the vparam-value further, with only "$" in
addition to *unreserved*  as specified in the `,
ref("URI specification", "https://tools.ietf.org/html/rfc3986"), `).
`,
      ],
      "example#2": [`
Note: when using base64 encoded values as vgrid vparam-value, use the
url-and-filename-ready`, ref("base64url characters",
"https://tools.ietf.org/html/rfc4648#section-5"), `.`,
      ],
    },
    [`chapter#section_vrid_event_log>1;VRId is affiliated with an event log`]: {
      "#0": [`
The resource identified by a VRId is always affiliated with an event
log of its global resource. Because the VRId doesn't contain the
locator information of this event log it must be discoverable from the
context where the VRId is used.

All context-terms of the VGRId and VRId vparams are references to the
event log `, ref("JSON-LD context", "https://w3c.github.io/json-ld-syntax/#the-context"),
` (Note: this applies only to immediate but not to nested vparams).

Global resources can be transferred between event logs. To maintain
immutability across these transfers VGRId's must not contain partition
or other non-identifying locator information. Similar to URN's VRId's
always relies external structures and systems for carrying locator
information.
`],
      "example#1":
`Note: uuid v4 (format term \`~u4\`) is recommended for
now, but eventually VGRId generation will be tied to the
deterministic event id chain (format term \`~cc\`).
This in turn should be seeded by some ValOS authority.`,
    },
    "chapter#section_vrid_equivalence>2": {
      "#0": [`
Two VRIds refer to the same resource iff their URN representations are `,
ref("urn-equivalent", "https://tools.ietf.org/html/rfc8141#section-3"),
`(i.e. if the two VRIds are equivalent after section 3.1. case
normalization for step 3. percent-encoding case normalization).

Maintaining the consistency between this lexical equivalence and the
semantic equivalence of a resource which has been transferred between
event logs without having to dereference VRIds is useful but has
implications.
`, blockquote(
  `Rule: When resources are transferred between event logs
  the semantics of their context terms and body-parts must remain
  equivalent.`,
), `

A *simple equivalence* is that two simple prefix term definitions
resolve to the same URI. An *extended equivalence* is when two extended
term definitions in the source and target event logs are equivalent
after normalization. These two equivalences are [will be] defined by
this document.

More complex equivalences are outside the scope of this document but
can be defined by specifications specifying segment types. These
equivalences might take details of the particular verb-type into
account and/or specify context definition additions which do not change
the equivalence semantics.`,
      ],
    },
    [`chapter#section_structural_sub_resources>3;VRId verbs identify structural sub-resources${
        ""} - fixed ownership, inferred state, 'secondary keys'`]: {
      "#0": [
`In VRId context the vsteps-tail that follows the VGRId specifies
a structural path from the global resource to a
*structural sub-resource* of the global resource. The triple
constraints of each verb in that path are _inferred as triples_ for the
particular resource that that verb affects.

`, blockquote(`Principle: a structural sub-resource using a particular
vsteps-tail in its identifying VRId will always infer the triples that
are required to satisfy the same vsteps-tail in a query context which
starts from the same global resource.`), `

This fixed triple inference is the meat and bones of the structural
sub-resources: they allow for protected, constrained semantics to be
expressed in the valospace resources. This allows both simplified
semantics (eg. properties _cannot_ be renamed so the complex
functionality doesn't need to be supported on fabric level), more
principled mechanism for partition crypto behaviours (permission
relations are structural sub-resources which simplifies security
analysis but retains valospace convenience) and also a mechanism for
expressing non-trivial resources such as hypertwin resources.

The sub-resources can be nested and form a tree with the global
resource as the root. Typical verb sub-segments specify the edges in
this tree (some verbs only specify the current node resource further
without specifying a new edge). The global resource is the host
resource for the first verb; the sub-resource of that segment is the
host resource of the second verb and so on.

As the VRId identities of the sub-resources are structurally fixed to
this tree the coupling between host and sub-resource must be static.
The typical implementation for this is an ownership coupling.`,
      ],
    },
    "chapter#section_vgrid_types>4;List of VGRId formats:": {
      "#0": `
VGRId context-term specifies the particular identifier format and
possible semantics of the identified global resource. ValOS kernel
reserves all context-terms matching '"i" 2( ALPHA / DIGIT )' for
itself with currently defined formats exhaustively listed here.
      `,
      [`chapter#section_vgrid_uuid_v4>0;${
          ""}VGRId format "\`~u4\`": Uuid v4 of a native, insecure resource`]: {
        "#0": `
An identifier for native valospace resource with an event log.
This is insecure as there are no guarantees against resource id
collisions by malicious event logs. These identifiers can thus only be
used in trusted, protected environments.`,
      },
      [`chapter#section_vgrid_content_hash>1;${
          ""}VGRId format "\`~bv\`": The content hash of Binary ValOS object`]: {
        "#0": `
An identifier of an immutable octet-stream, with the content hash in
the vparam-value.`
      },
      [`chapter#section_vgrid_platonic_resource>2;${
          ""}VGRId format "\`~pw\`": The id of an immutable Platonic resource With inferences`]: {
        "#0": `
An identifier of an immutable, procedurally generated resource with its
content inferred from the vpath embedded in the vparam-value.
While of limited use in itself this is useful when used as the
prototype of structural ghost sub-resources which are quite mutable.`,
      },
      [`chapter#section_vgrid_crypto_chained>3;${
          ""}VGRId format "\`~cc\`": The id of Crypto-event-log-Chained secure resource`]: {
        "#0": `
An identifier of a native, secure valospace resource with an event log.
This id is deterministically derived from the most recent hash-chain
event log entry of the particular event which created it, the
cryptographic secret of the creating identity and a salt, thus ensuring
collision resistance and a mechanism for creator to prove their claim
to the resource.`,
      },
      [`chapter#section_vgrid_ghost>4;${
          ""}VGRId format "\`~gh\`": The derived Hash id of a native, insecure Ghost resource`]: {
        "#0": `
This is a legacy format for native ghost resources, with id created
from the hash of the 'ghost path' of the resource.`,
      },
    },
    "chapter#section_vrid_verb_types>4;List of VRId-specific verb type semantics:": {
      "#0": `
VRId *verb-type* specifies the relationship category between the
segment host resource and sub-resource, a set of inferred triples as
well as other possible constraints.`,
      "example#example_shared_vrid_verb_data>0;Shared example data": [
`The examples below all share the following triples:`,
        turtle(`
  <urn:valos:$~u4:f00b> a valos:Entity
      ; valos:prototype <urn:valos:$~u4:f00b-b507-0763>
`),
      ],
      "chapter#section_structural_ghost>0;verb type \"`_`\": structural subspace sub-resource": {
        "#0": `
Ghost sub-resources are products of ghost instantiation. All the ghosts
of the directly _and indirectly_ owned resources of the instance
prototype are flattened as _direct_ structural sub-resources of the
instance itself. The instance is called *ghost host* of all such ghosts.`,
        "example#example_structural_ghost>0;Structural ghost triple inference": [
`\`<urn:valos:$~u4:f00b@_$~u4:ba54>\` reads as "inside the
instance resource \`f00b\` the ghost of the $~u4 resource \`ba54\`"
and infers triples:
`, turtle(`
  <urn:valos:$~u4:f00b@_$~u4:ba54>
        valos:ghostHost <urn:valos:$~u4:f00b>
      ; valos:ghostPrototype <urn:valos:$~u4:ba54>
`),
        ],
        "#1": `
In case of deeper instantiation chains the outermost ghost segment
provides inferences recursively to all of its sub-resources; nested
ghost segments wont provide any further inferences.`,
        "example#example_structural_ghost_recursive>1;Recursive ghost triple inference": [
`\`<urn:valos:$~u4:f00b@_$~u4:ba54@_$~u4:b7e4>\` reads as "inside
the instance resource \`f00b\` the ghost of
\`<urn:valos:$~u4:ba54@_$~u4:b7e4>\`" and infers triples:
`, turtle(`
  <urn:valos:$~u4:f00b@_$~u4:ba54@_$~u4:b7e4>
        valos:ghostHost <urn:valos:$~u4:f00b>
      ; valos:ghostPrototype <urn:valos:$~u4:ba54@_$~u4:b7e4>
`)
        ],
      },
      "chapter#section_structural_subspace>1;verb type \"`_`\": structural subspace override": {
        "#0": `
Selects a variant resource value for a base resource within a
structurally identified subspace. The variant resource provides
inferred \`subspacePrototype\` fallbacks to an *inner* subspace and
eventually to the non-variant base resource as well as to the
homologous sub-resource of the host resource inheritancePrototype.

This means that no matter where a subspace variant is defined in
the prototype chain or in the nested sub-structure its value will be
found.`,
        "example#example_structural_subspace>0;Structural subspace triple inference": [
`\`<urn:valos:$~u4:f00b@.:myProp@_$lang:fi>\` is a lang fi variant of
f00b myProp and infers triples:
`, turtle(`
  <urn:valos:$~u4:f00b@.:myProp@_$lang:fi> a valos:ScopeProperty
      ; valos:subspacePrototype <urn:valos:$~u4:f00b@.:myProp>
                              , <urn:valos:$~u4:f00b-b507-0763@.:myProp@_$lang:fi>
      ; valos:language "fi"
`)
        ],
        "#1": `
Subspace selectors can be used to access language variants,
statically identified ghost variants within an instance, statically
identified Relation's etc.

The verb segment-term can also specify triple inferences for *all*
sub-resources in the subspace (not just for the immediate
sub-resource of the selector segment).`,
        "example#example_structural_subspace_recursive>1;Structural subspace recursive inference": [
`\`<urn:valos:$~u4:f00b@_$~u4:b453@_$lang:fi@_$~u4:b74e@.:myProp>\`
infers triples:
`, turtle(`
  <urn:valos:$~u4:f00b@_$~u4:b453@_$lang:fi@_$~u4:b74e@.:myProp> a valos:ScopeProperty
      ; valos:ghostHost <urn:valos:$~u4:f00b>
      ; valos:ghostPrototype <urn:valos:$~u4:b453@_$lang:fi@_$~u4:b74e@.:myProp>
      ; valos:subspacePrototype <urn:valos:$~u4:f00b@_$~u4:b453@_$~u4:b74e@_$lang:fi@.:myProp>
      ; valos:language "fi"
`),
        ],
      },
      "chapter#section_structural_scope_property>2;verb type \"`.`\": structural ScopeProperty": {
        "#0": `
Structural properties infer a type, fixed owner and name.`,
        "example#example_structural_scope_property>0;Structural scope property triple inference": [
`\`<urn:valos:$~u4:f00b@.:myProp>\` is a resource with fixed name
"myProp", dominant type ScopeProperty, $~u4 resource f00b as the owning
scope and a structurally homologous prototype inside
f00b-b507-0763 and thus infers triples:
`, turtle(`
  <urn:valos:$~u4:f00b@.:myProp> a valos:ScopeProperty
      ; valos:scope <urn:valos:$~u4:f00b>
      ; valos:inheritancePrototype <urn:valos:$~u4:f00b-b507-0763@.:myProp>
      ; valos:name "myProp"
`),
        ],
        "#1": [
`The verbs \`.O.\`, \`.O*\`, and \`.O'\` denote the properties
\`valos:value\`, \`valos:target\`, and \`valos:content'\` respectively.
These are the primary `, em("rdf:object sub-properties"), ` of
ScopeProperty, Entity and Media, respectively (the letter 'o' in the
verbs stands for rdf:object). When given as a parameter to a primary
resource they modify it with a fixed rdf:object triple.
In addition \`.S*\` and \`.O*\` denote \`valos:source\` \`valos:target\`
which are the rdf:subject and rdf:object properties of a Relation.`,
        ],
        "example#example_structural_object>1;Structural rdf:object triple inference": [
`\`<urn:valos:$~u4:f00b@*:PERMISSIONS:@.*$~ih:8766>\` is a PERMISSIONS
relation with fixed ~ih target 8766 and infers triples:
`, turtle(`
  <urn:valos:$~u4:f00b@*:PERMISSIONS:@.*$~ih:8766> a valos:Relation
      ; valos:connectedSource <urn:valos:$~u4:f00b>
      ; valos:prototype <urn:valos:$~u4:f00b-b507-0763@*:PERMISSIONS:@.*$~ih:8766>
      ; valos:name "PERMISSIONS"
      ; valos:target <urn:valos:$~u4:8766-src>
`),
`Mnemonic: these verbs are read right-to-left, eg. \`.O*\` -> 'Relation
rdf:object property is valos:target'`
        ],
      },
      "chapter#section_structural_relation>3;verb type \"`*`\": structural Relation": {
        "#0": `
Structural relations infer a type, fixed owner (connector), name and
possibly source and target.`,
        "example#example_structural_relation>0;Structural relation triple inference": [
`\`<urn:valos:$~u4:f00b@*:PERMISSIONS@_:1>\` is a resource with
fixed name "PERMISSIONS", dominant type Relation, ~u4 f00b as the
source, a structurally homologous prototype inside f00b-b507-0763
and thus infers triples:
`, turtle(`
  <urn:valos:$~u4:f00b@*:PERMISSIONS> a valos:Relation
      ; valos:connectedSource <urn:valos:$~u4:f00b>
      ; valos:inheritancePrototype <urn:valos:$~u4:f00b-b507-0763@*:PERMISSIONS>
      ; valos:name "PERMISSIONS"
  <urn:valos:$~u4:f00b@*:PERMISSIONS@_:1> a valos:Relation
      ; valos:subspacePrototype <urn:valos:$~u4:f00b@*:PERMISSIONS>
                              , <urn:valos:$~u4:f00b-b507-0763@*:PERMISSIONS@_:1>
`),
        ],
      },
      "chapter#section_structural_entity>4;verb type \"`-`\": structural Entity": {
        "#0": `
Structural entities infer a type, fixed owner (parent) and name.`,
        "example#example_structural_entity>0;Structural Entity triple inference": [
`\`<urn:valos:$~u4:f00b@-:Scripts>\` has a fixed name "scripts",
dominant type Entity, $~u4 resource f00b as the owning container and
a structurally homologous prototype inside f00b-b507-0763 and thus
infers triples:
`, turtle(`
  <urn:valos:$~u4:f00b@-:Scripts> a valos:Entity
      ; valos:parent <urn:valos:$~u4:f00b>
      ; valos:inheritancePrototype <urn:valos:$~u4:f00b-b507-0763@-:scripts>
      ; valos:name "scripts"
`),
        ],
      },
      "chapter#section_structural_media>5;verb type \"`'`\": structural Media": {
        "#0": `
Structural medias infer a type, fixed owner (folder) and name.`,
        "example#example_structural_media>0;Structural Media triple inference": [
`\`<urn:valos:$~u4:f00b@':foo.vs>\` has a fixed name "foo.vs", dominant
type Media, $~u4 resource f00b as the owning folder and a structurally
homologous prototype inside f00b-b507-0763 and thus infers triples:
`, turtle(`
  <urn:valos:$~u4:f00b@':foo.vs> a valos:Media
      ; valos:folder <urn:valos:$~u4:f00b>
      ; valos:inheritancePrototype <urn:valos:$~u4:f00b-b507-0763@':foo.vs>
      ; valos:name "foo.vs"
`),
        ],
      },
    },
  },
  "chapter#section_grammar>8;Collected VPath ABNF grammar": {
    "#0": [
`The VPath grammar is an LL(1) grammar. It is recursive as vparam-value
productions can contain nested vpaths without additional encoding.

The list of definitive rules:
`, abnf(
`  vpath         = "@" vgrid-tail / vsteps-tail

  vgrid-tail    = "$" vgrid "@" [ vsteps-tail ]
  vgrid         = format-term ":" vparam-value vparams
  format-term   = "~" context-term

  vsteps-tail   = verb "@" [ vsteps-tail ]
  verb          = verb-type vparams
  verb-type     = 1*unencoded

  vparams       = [ vparam vparams ]
  vparam        = [ "$" context-term ] ":" vparam-value
  context-term  = ALPHA *unreserved-nt
  vparam-value  = "$" / 1*( unencoded / pct-encoded ) / vpath

  unencoded     = unreserved / "!" / "*" / "'" / "(" / ")"
  unreserved    = unreserved-nt / "~"
  unreserved-nt = ALPHA / DIGIT / "-" / "_" / "."
  pct-encoded   = "%" HEXDIG HEXDIG`,
), `

In addition there are pseudo-rules which are not used by an LL(1)
parser but which have well-defined meaning and can thus be referred to
from other documents.

The list of informative pseudo-rules:
`, abnf(
`  vrid            = "@" "$" vgrid "@" [ vsteps-tail ]
  verbs           = "@" vsteps-tail
  context-term-ns = ALPHA 0*30unreserved-nt ( ALPHA / DIGIT )
`), `

There are couple notes not explicitly expressed by the the grammar
itself. These notes primarily relate to LL(1)-parseability:`
    ],
    "bulleted#1": [
[`Pseudo-rule 'vrid': this class contains all 'vpath' productions with
  'vgrid' as their first expansion.`],
[`Pseudo-rule 'context-term-ns': this class contains all 'context-term'
  expansions which match this more restrictive specification (max 32
  chars, special chars only in the middle). All 'context-term's which
  are plain namespace prefixes should be restricted to this rule as
  this is the prefix grammar of some relevant prefix context.
  `, example(
    `Editorial Note: which context was this again? Neither
    SPARQL, Turtle nor JSON-LD have this limitation.`
  )],
[`The nesting hierarchy can be manually quickly established by first
  splitting a valid vpath string by the delimiter regex /(@$:)/
  (retaining these delimiters in the result). Then a tree structure is
  formed by traversing the array from left to right and dividing it to
  different nesting depths. The nesting depth is increased for the
  initial "@" and for each "@" that is preceded by a ":" (corresponds
  to the 'vpath' production prefix of some 'short-param' production)
  and reducing the nesting depth for each "@" that is succeeded by a
  "$", ":", "@" or EOF (corresponds to the terminator of the last
  'vgrid' or 'verb' production of some 'vpath' production). All
  remaining "@" correspond to non-final 'vgrid' or 'verb' production
  terminators of some 'vpath' rule production and thus don't change the
  nesting depth.`],
    ],
  },
  "chapter#section_encoding_considerations>9;VPath design considerations and case studies": {
    "#0": `
This section contains considerations on the choice of character set and
on where and how VPaths need or don't need to be encoded. There's a
historical emphasis on the decision of which characters to use as
delimiters (ie. "@", ":" and "$").`,
/*
urn-reserved-gen-delims = "?" | "#"
 - can never appear unescaped, can't be used as delimiters
urn-allowed-gen-delims = "/" | ":" | "@"
 - could be considered as structural delimiters
encoded-subdelims = "$" | "+" | ";" | "," | "=" | "&"
 - could be considered as structural delimiters
unencoded-subdelims = "!" | "*" | "'" | "(" | ")"
 - payload characters, can appear in sub-parts, can't be used as delimiters
unreserved = ALPHA | DIGIT | "-" | "." | "_" | "~"
 - payload characters, can appear in sub-parts, can't be used as delimiters
escape = "%"

gen-delims = reserved-gen-delims | urn-gen-delims | "[" | "]"
sub-delims = unencoded-subdelims | encoded-subdelims

encodeURIComponent doesn't encode: unreserved | unencoded-subdelims
URN-8141; allowed: unreserved | unencoded-subdelims | encoded-subdelims | allowed-gen-delims
URN-8141; reserved: escape | reserved-gen-delims
*/
    "chapter#section_robust_composition>0;VPath composition and decomposition should be robust": {
      "#0": ``,
      "chapter#section_no_contextual_delimiters>0;No contextual delimiters": {
        "#0": `
If a character is a delimiter in some context within a VPath then this
character must always encoded when not used as a delimiter.`,
      },
      [`chapter#section_consistent_encoding>1;${
        ""}All value segments are encoded and decoded using encodeURIComponent`]: {
          "#0": `
Characters not encoded are ruled out from structural delimiters.
This leaves "?" | "#" and "/" | ":" | "@" and "$" | "+" | ";" | "," | "=" | "&"`,
      },
    },
    "chapter#section_unencoded_contexts>1;Contexts where VPath doesn't need encoding": {
      "#0": [`
In general VPaths don't require encoding in contexts where the VPath
delimiters "@" / ":" / "$" and the encodeURIComponent result character
set ALPHA / DIGIT / "-" / "_" / "." / "~" / "!" / "*" / "'" / "(" / ")"
can be used.
`, blockquote(
  `Editorial Note: "(" and ")" can in principle be
  substantially inconvenient in many contexts. But as they're grouped
  with "!" / "*" / "'" which have their uses in verb-type's all
  five are for now retained as allowed characters.`,
),
      ],
      "chapter#section_unencoded_in_rfc_3986_segment_nz>0;As RFC 3986 URI segment-nz component": {
        "#0": `
VPaths can be used as-is in URI path parts (except as segment-nz-nc, see below).
This rules out "?", "#", "/" from structural delimiters`,
      },
      "chapter#section_unencoded_in_sequences>1;As a typical sequence entry": {
        "#0": `
Rules out "," | ";" from structural delimiters`,
      },
      [`chapter#section_unencoded_in_rfc_3986_query>2;${
        ""}As part of RFC 3986 URI query component when consumer is known not to decode`]: {
          "#0": [`
VPath can and is intended to be used as-is in the query part (even as
the right-hand side value of "=") `, em(`as long as the URI
consumer or possible middlewares don't perform x-www-form-urlencoded
(or other) decoding of the key-value pairs`), `before VPath expansion.

Rules out "=" , "&" from structural characters.
`, blockquote(
  `Note: This is completely regular. If the consumer is
  known to explicitly decode query values and because VPaths can
  contain "%" characters they must be appropriately symmetrically
  encoded. This can result in double encoding. However as the intent is
  that VPath expansion should be considered to be part of `,
  ref("the URI parsing and separation itself", "https://tools.ietf.org/html/rfc3986#section-2.4"),
  ` any  separate encoding and decoding should not be needed.`
),
        ],
      },
/*
 - because either there is full x-www-form-urlencoded roundtrip or
   there is none this should _not_ rule out "+" as a delimiter in
   principle. The practice is another story as legacy issues abound.
 - thus rules out "+"
 */
      "chapter#section_unencoded_in_rfc_3986_fragment>2;As RFC 3986 URI fragment component": {
        "#0": `
Doesn't rule out any delimiter options not yet ruled out.`,
      },
      "chapter#section_unencoded_in_rfc_8141_nss>2;As RFC 8141 URN NSS components": {
        "#0": `
Doesn't rule out any delimiter options not yet ruled out.
Specifically this does not rule out ":" as that is allowed in NSS sub-parts.`,
      },
      "chapter#section_unencoded_in_rfc_8141_rq_f>2;As RFC 8141 URN rq-, and f-component": {
        "#0": `
Covered by URI query and fragment sections.`,
      },
    },
    [`chapter#section_encoded_contexts>2;${
        ""}VPath must be used escaped/quoted/encoded in following contexts`]: {
      "#0": ``,
      "chapter#section_quoted_string>0;In HTTP/1.1 headers always as a quoted-string": {
        "#0": `
URI's in general need to be quoted here and VPath is URI-like.
This retains "@" as an allowed delimiter.`,
      },
      "chapter#section_x_www_form_urlencoded;In form fields as x-www-form-urlencoded": {
        "#0": [`
Encoded and serialized as per `, ref("https://url.spec.whatwg.org/#urlencoded-serializing")
        ],
      },
      [`chapter#section_in_rfc_3986_segment_nz_nc;${
        ""}In URI relative-part with no scheme must be prefixed with "./"`]: {
          "#0": `
This retains ":" as an allowed delimiter which segment-nz-nc would
otherwise prevent.`,
      },
    },
    "chapter#section_tilde_problem>3;The tilde problem with URN RFC 2141 is solved by RFC 8141": {
      "#0": `
RFC 2141 reserves "~" but encodeURIComponent doesn't encode it. To
maintain direct drop-in 2141 compatibility would require disallowing
"~" from the character set. This in turn would complicate specific
javascript domain implementations as they would have to encode "~"
separately without being able to solely rely on encodeURIComponent.

As this concern is not likely to be a problem in practice anyway we
choose to refer to RFC 8141 for URN's which removes "~" from the set of
reserved character. This solves this (relatively theoretical) issue.`,
    },
  },
};
