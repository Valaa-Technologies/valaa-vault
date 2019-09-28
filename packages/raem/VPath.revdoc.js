
const {
  extractee: {
    abnf, blockquote, authors, em, ref, pkg, turtle,
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
  "chapter#abstract>0": [`

ValOS Paths ('VPaths') identify paths between valospace resources.
Vrids (a subset of VPaths) identify valospace resources.

These VRIds are also affiliated with `,
ref("ValOS event logs", "@valos/sourcerer/valos-event-log"),
` which define their internal path semantics further.

VPaths are strings with restricted grammar so that they can be embedded
into various URI component and list formats without additional encoding.`,
  ],
  "chapter#sotd>1": [

"This document is part of the library workspace ", pkg("@valos/raem"),
" but is `NOT SUPPORTED NOR IMPLEMENTED` by it yet in any manner.",
  ],
  "chapter#introduction>2;VPath with a vgrid is a resource identifier: a VRId": [`

VPaths serve two notably different purposes, both as paths and as
resource identifiers. A VPath which has a global valospace resource
identifier (or 'vgrid') as its first segment is a valospace resource
identifier (or *VRId*).

`, abnf(
`  vpath         = "@" vgrid-path / verb-path
  vgrid-path    = vgrid "@" [ verb-path ]
  verb-path     = verb "@" [ verb-path ]
  verb          = verb-type params
`), `

Many valospace resources, so called *structural sub-resources* are
identified by a fixed path from the global resource defined by the same
verbs that define non-VRId VPaths. Thus while paths and identifiers are
superficially different it is useful to represent them both using the
same VPath verb structure.

Both verb and vgrid params can also have context term references to
an external lookup of URI prefixes and semantic definitions.`
  ],
  "chapter#section_equivalence>3;VPath equivalence follows URN equivalence": [`

Two VPaths identify the same path and in case they're VRIds, refer to
the same resource iff their URN representations are `,
ref("urn-equivalent", "https://tools.ietf.org/html/rfc8141#section-3"),
`. In other words two VPath are equivalent if and only if they are
lexically equivalent after case normalization of any percent-encoded
characters.

For the general case the actual semantics of a VPath and specifically
of its context-term's depends on the context it is used. Vrids have a
fixed context which is established by the vgrid. This has some
implications:`, ref("read more about the VRId equivalence",
    "@valos/raem/VPath#section_vrid_equivalence"), `.`,
  ],
  [`chapter#section_verb>4;${
      ""}*verb* - a step from a source resource to target resource(s)`]: {
    "#0": [
`A verb is a one-to-maybe-many relationship between resources. A verb
can be as simple as a trivial predicate of atriple or it can represent
something as complex as a fully parameterized computation or a function
call.

A verb is made up of type and a parameter list, with each parameter
carrying an optional context-term in addition to their value.
`, abnf(
`  verb-path     = verb "@" [ verb-path ]
  verb          = verb-type params
  verb-type     = 1*unencoded

  params        = context-tail / value-tail
  context-tail  = "$" [ context-term ] [ ":" param-value [ params ] / context-tail ]
  value-tail    = ":" param-value [ params ]

  context-term  = ALPHA *unreserved-nt
  param-value   = vpath / 1*( unencoded / pct-encoded )
`), `

Note that while the grammar of verb-type and context-term are
still relatively restricted, *param-value* both allows for fully
unencoded nesting of vpath's as well as allows encoding of all unicode
characters in percent encoded form (as per encodeURIComponent).`
    ],
    "chapter#section_verb_type>0;*verb-type*": {
      "#0": [`
*verb-type* specifies the relationship category between the segment
host resource and sub-resource, a set of inferred triples as well as
other possible constraints.`
      ],
      "chapter#section_verb_property>1;verb type \"`.`\": property or ScopeProperty selector": [`

Verb for selecting the resource (typically a ScopeProperty) with the
given name and which has the head as its scope.

e.g. triple pattern \`?s <urn:valos:.:myProp> ?o\` matches like:
`, turtle(`
  ?o    valos:scope ?s
      ; valos:name "myProp"
`), `
Mnemonic: '.' to access a property (ie. ScopeProperty).`,
      ],
      "chapter#section_verb_sequence>2;verb type \"`*`\": sequence or Relation selector": [`

Verb for selecting all resources (typically Relations) with the given
name and which have the head as their source.

e.g. triple pattern \`?s <urn:valos:*:PERMISSIONS> ?o\` matches like:
`, turtle(`
  ?o    valos:source ?s
      ; valos:name "PERMISSIONS"
`), `
Mnemonic: '*' to access many things (only Relations are many with the same name).`,
      ],
      "chapter#section_verb_content>3;verb type \"`'`\": content or Media selector": [`

Verb for selecting the Media with the given name which has the
head as their folder.

e.g. triple pattern \`?s <urn:valos:':foo.vs> ?o\` matches like:
`, turtle(`
  ?o    valos:folder ?s
      ; valos:name "foo.vs"
`), `
Mnemonic: "'" for quoted content (Media has content).`,
      ],
      "chapter#section_verb_container>4;verb type \"`+`\": container or Entity selector": [`

Verb for selecting the resource (typically an Entity) with the given
name and which has the head as their container.

e.g. triple pattern \`?s <urn:valos:+:Scripts> ?o\` matches like:
`, turtle(`
  ?o    valos:parent ?s
      ; valos:name "Scripts"
`), `
Mnemonic: click symbol '+' to expand container (Entity contains things).`,
      ],
      "chapter#section_verb_object>4;verb type \"`-`\": object or target selector": [`

Verb that is a synonym for predicate 'rdf:object'.

e.g. triple pattern \`?s <urn:valos:-> ?o\` matches like:
`, turtle(`
  ?s    rdf:object ?o
`), `
Mnemonic: follow line '-' to target.`,
      ],
      "chapter#section_verb_ghost>5;verb type \"`~`\": ghost selector": [`

Verb for selecting a ghost of the given resource from within the path
head as host.

e.g. triple pattern \`?s <urn:valos:~$iu4:ba54> ?o\` matches like:
`, turtle(`
  ?o    valos:ghostHost ?s
      ; valos:ghostPrototype <urn:valos:$iu4:ba54>
`),
      ],
      "chapter#section_verb_subspace>6;verb type \"`_`\": subspace selector": [`

Verb for selecting a subspace variant.

e.g. triple pattern \`?s <urn:valos:@.:myProp@_$lang:fi@> ?o\` matches
like:
`, turtle(`
  ?_sp  valos:scope ?s
      ; valos:name "myProp"
  . ?o  valos:subspacePrototype* ?_sp
      ; valos:language "fi"
`),
      ],
      "chapter#section_verb_computation>6;verb type \"`!`\": computation selector": [`

Verb representing the result of a computation.

e.g. triple pattern \`?s <urn:valos:@!$valk:plus$number:10:@!:myVal@@> ?o\`
matches like:
`, turtle(`
  ?_:0  valos:scope ?s
      ; valos:name "myVal"
      ; valos:value ?myVal
  . FILTER (?o === 10 + ?myVal)
`), blockquote(`Editorial Note: this section should be greatly improved.
The purpose of computation verbs lies more on representing various
conversions (as part of dynamic operations such as rest API route
mapping) and less on clever SPARQL trickery. The illustration here uses
(questionable) SPARQL primarily for consistency.`),
      ],
    },
    [`chapter#section_verb_context_term>1;${
        ""} 'context-term' is a lookup to definitions provided by the context`]: {
      "#0": [`
A verb (and vgrid via its format-term) can be contextual via the
context-term's of its params. The context where the verb is used
defines the exact meaning of these terms. The meaning for context-terms
is recommended to be uniform across domains where possible. A verb is
invalid in contexts which don't have a definition for its context-term.
This gives different contexts a fine-grained mechanism for defining the
vocabularies that are available.

Idiomatic example of such context is the event log and its JSON-LD
context structure which is to define both URI namespace prefixes as
well as available semantics.`
      ],
    },
    "chapter#section_param_value>2;'param-value' specifies vgrid and verb payload": {
      "#0": [`
*params* is a sequence of param-value's, optionally prefixed with
"$" and a context-term. The idiomatic param-value is a string. If
present a context-term usually denotes a URI prefix in which case the
param-value is a URI reference. However contexts are free to provide
specific semantics for specific context-terms, such as interpreting
them as the value type of the param-value etc.`,
      ],
    },
  },
  [`chapter#section_vrid>5;${
      ""}VRId is a stable identifier of a global resource or a structural sub-resource`]: {
    "#0": [
`A VRId is a vpath which has vgrid as its first production (via
vgrid-path).
`, abnf(
`  vpath         = "@" vgrid-path / verb-path
  vgrid-path    = vgrid "@" [ verb-path ]
  vgrid         = "$" format-term ":" param-value [ params ]
`), `

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
        ""}vgrid identifies global resources - primary keys, free ownership, concrete state`]: [`

The vgrid uniquely identifies a *global resource*. If a VRId contains
a vgrid and no verbs this global resource is also the
*referenced resource* of the VRId itself.

`, abnf(
`  vgrid         = "$" format-term ":" param-value [ params ]
  format-term   = context-term

  params        = context-tail / value-tail
  context-tail  = "$" [ context-term ] [ ":" param-value [ params ] / context-tail ]
  value-tail    = ":" param-value [ params ]

  context-term  = ALPHA *unreserved-nt
  param-value   = vpath / 1*( unencoded / pct-encoded )
`), `

The format-term defines the global resource identifier schema as well
as often some (or all) characteristics of the resource.

Some vgrid types restrict the param-value further, with only "$" in
addition to *unreserved*  as specified in the `,
ref("URI specification", "https://tools.ietf.org/html/rfc3986"), `).
`, blockquote(
  `Note: when using base64 encoded values as vgrid
  param-value, use the url-and-filename-ready`,
  ref("base64url characters", "https://tools.ietf.org/html/rfc4648#section-5"), `.`,
),
    ],
    [`chapter#section_vrid_event_log>1;VRId is affiliated with an event log`]: [`

The resource identified by a VRId is always affiliated with an event
log of its global resource. Because the VRId doesn't contain the
locator information of this event log it must be discoverable from the
context where the VRId is used.

All context-terms of the VGRId and VRId verb params are references to
the event log `, ref("JSON-LD context", "https://w3c.github.io/json-ld-syntax/#the-context"),
` (this applies only to immediate but not to nested VPath params).

Global resources can be transferred between event logs. To maintain
immutability across these transfers VGRId's must not contain partition
or other non-identifying locator information. Similar to URN's VRId's
always relies external structures and systems for carrying locator
information.
`, blockquote(
  `Note: uuid v4 (format term \`iu4\`) is recommended for
  now, but eventually VGRId generation will be tied to the
  deterministic event id chain (format term \`icc\`).
  This in turn should be seeded by some ValOS authority.
`)],
    "chapter#section_vrid_equivalence>2": [`

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
    [`chapter#section_structural_sub_resources>3;VRId verbs identify structural sub-resources${
        ""} - fixed ownership, inferred state, 'secondary keys'`]: {
      "#0": [
`In VRId context the verb-path that follows the VGRId specifies
a structural path from the global resource to a
*structural sub-resource* of the global resource. The triple
constraints of each verb in that path are _inferred as triples_ for the
particular resource that that verb affects.

`, blockquote(`Principle: a structured sub-resource using a particular
verb-path in its identifying VRId will always infer the triples that
are required to satisfy the same verb-path in a query context which
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
      "#0": [`
VGRId context-term specifies the particular identifier format and
possible semantics of the identified global resource. ValOS kernel
reserves all context-terms matching '"i" 2( ALPHA / DIGIT )' for
itself with currently defined formats exhaustively listed here.
      `],
      [`chapter#section_vgrid_iu4>0;${
          ""}VGRId format "\`iu4\`": Uuid v4 of a native, insecure resource`]: [`
An identifier for native valospace resource with an event log.
This is insecure as there are no guarantees against resource id
collisions by malicious event logs. These identifiers can thus only be
used in trusted, protected environments.
      `],
      [`chapter#section_vgrid_ibv>1;${
          ""}VGRId format "\`ibv\`": The content hash of Binary ValOS object`]: [`
An identifier of an immutable octet-stream, with the content hash in
the param-value.
      `],
      [`chapter#section_vgrid_ipw>2;${
          ""}VGRId format "\`ipw\`": The id of an immutable Platonic resource With inferences`]: [`
An identifier of an immutable, procedurally generated resource with its
content inferred from the vpath embedded in the param-value.
While of limited use in itself this is useful when used as the
prototype of structural ghost sub-resources which are quite mutable.
      `],
      [`chapter#section_vgrid_ice>3;${
          ""}VGRId format "\`ice\`": The id of Crypto-Event-log-coupled secure resource`]: [`
An identifier of a native, secure valospace resource with an event log.
This id is deterministically derived from the most recent hash-chain
event log entry of the particular event which created it, the
cryptographic secret of the creating identity and a salt, thus ensuring
collision resistance and a mechanism for creator to prove their claim
to the resource.
      `],
      [`chapter#section_vgrid_igh>4;${
          ""}VGRId format "\`igh\`": The derived Hash id of a native, insecure Ghost resource`]: [`
This is a legacy format for native ghost resources, with id created
from the hash of the 'ghost path' of the resource.
      `],
    },
    "chapter#section_vrid_verb_types>4;List of VRId-specific verb type semantics:": {
      "#0": [`
VRId *verb-type* specifies the relationship category between the
segment host resource and sub-resource, a set of inferred triples as
well as other possible constraints.

The examples below all share the following example data:`,
    turtle(`
  <urn:valos:$iu4:f00b> a valos:Entity
      ; valos:prototype <urn:valos:$iu4:f00b-b507-0763>
`),
      ],
      "chapter#section_structured_ghost>0;verb type \"`~`\": ghost sub-resource": [`

Ghost sub-resources are products of ghost instantiation. All the ghosts
of the directly _and indirectly_ owned resources of the instance
prototype are flattened as _direct_ structural sub-resources of the
instance itself. The instance is called *ghost host* of all such ghosts.

e.g. \`<urn:valos:@$iu4:f00b@~$iu4:ba54@>\` reads as "inside the
instance resource \`f00b\` the ghost of the $iu4 resource \`ba54\`"
and infers triples:
`, turtle(`
  <urn:valos:@$iu4:f00b@~$iu4:ba54@>
        valos:ghostHost <urn:valos:$iu4:f00b>
      ; valos:ghostPrototype <urn:valos:$iu4:ba54>
`), `
In case of deeper instantiation chains the outermost ghost segment
provides inferences recursively to all of its sub-resources; nested
ghost segments wont provide any further inferences.

e.g. \`<urn:valos:@$iu4:f00b@~$iu4:ba54@~$iu4:b7e4@>\` reads as "inside
the instance resource \`f00b\` the ghost of
\`<urn:valos:@$iu4:ba54@~$iu4:b7e4@>\`" and infers triples:
`, turtle(`
  <urn:valos:@$iu4:f00b@~$iu4:ba54@~$iu4:b7e4@>
        valos:ghostHost <urn:valos:$iu4:f00b>
      ; valos:ghostPrototype <urn:valos:@$iu4:ba54@~$iu4:b7e4@>
`)
      ],
      "chapter#section_structured_subspace>1;verb type \"`_`\": subspace override": [`

Selects a variant resource value for a base resource within a
structurally identified subspace. The variant resource provides
inferred \`subspacePrototype\` fallbacks to an *inner* subspace and
eventually to the non-variant base resource as well as to the
homologous sub-resource of the host resource inheritancePrototype.
This means that no matter where a subspace variant is defined in
the prototype chain or in the nested sub-structure its value will be
found.

e.g. \`<urn:valos:@$iu4:f00b@.:myProp@_$lang:fi@>\` is a lang fi
variant of f00b myProp and infers triples:
`, turtle(`
  <urn:valos:@$iu4:f00b@.:myProp@_$lang:fi@> a valos:ScopeProperty
      ; valos:subspacePrototype <urn:valos:@$iu4:f00b@.:myProp@>
                              , <urn:valos:@$iu4:f00b-b507-0763@.:myProp@_$lang:fi@>
      ; valos:language "fi"
`), `

Subspace selectors can be used to access language variants,
statically identified ghost variants within an instance, statically
identified Relation's etc.

The verb segment-term can also specify triple inferences for *all*
sub-resources in the subspace (not just for the immediate
sub-resource of the selector segment).

e.g. \`<urn:valos:@$iu4:f00b@~$iu4:b453@_$lang:fi@~$iu4:b74e@.:myProp@>\`
infers triples:
`, turtle(`
  <urn:valos:@$iu4:f00b@~$iu4:b453@_$lang:fi@~$iu4:b74e@.:myProp@> a valos:ScopeProperty
      ; valos:ghostHost <urn:valos:$iu4:f00b>
      ; valos:ghostPrototype <urn:valos:@$iu4:b453@_$lang:fi@~$iu4:b74e@.:myProp@>
      ; valos:subspacePrototype <urn:valos:@$iu4:f00b@~$iu4:b453@~$iu4:b74e@_$lang:fi@.:myProp@>
      ; valos:language "fi"
`),
      ],
      "chapter#section_structured_scope_property>2;verb type \"`.`\": structural ScopeProperty": [`

e.g. \`<urn:valos:@$iu4:f00b@.:myProp@>\` is a resource with fixed
name "myProp", dominant type ScopeProperty, $iu4 resource f00b as the
owning scope and a structurally homologous prototype inside
f00b-b507-0763 and thus infers triples:
`, turtle(`
  <urn:valos:@$iu4:f00b@.:myProp@> a valos:ScopeProperty
      ; valos:scope <urn:valos:$iu4:f00b>
      ; valos:inheritancePrototype <urn:valos:@$iu4:f00b-b507-0763@.:myProp@>
      ; valos:name "myProp"
`),
      ],
      "chapter#section_structured_relation>3;verb type \"`*`\": structural Relation": [`

e.g. \`<urn:valos:@$iu4:f00b@*:PERMISSIONS@_:1@>\` is a resource with
fixed name "PERMISSIONS", dominant type Relation, iu4 f00b as the
source, a structurally homologous prototype inside f00b-b507-0763
and thus infers triples:
`, turtle(`
  <urn:valos:@$iu4:f00b@*:PERMISSIONS@> a valos:Relation
      ; valos:source <urn:valos:$iu4:f00b>
      ; valos:inheritancePrototype <urn:valos:@$iu4:f00b-b507-0763@*:PERMISSIONS@>
      ; valos:name "PERMISSIONS"
  <urn:valos:@$iu4:f00b@*:PERMISSIONS@_:1@> a valos:Relation
      ; valos:subspacePrototype <urn:valos:@$iu4:f00b@*:PERMISSIONS@>
                              , <urn:valos:@$iu4:f00b-b507-0763@*:PERMISSIONS@_:1@>
`),
      ],
      "chapter#section_structured_media>4;verb type \"`'`\": structural Media": [`

e.g. \`<urn:valos:@$iu4:f00b@':foo.vs@>\` is a media with fixed
name "foo.vs", dominant type Media, $iu4 resource f00b as the
owning folder and a structurally homologous prototype inside
f00b-b507-0763 and thus infers triples:
`, turtle(`
  <urn:valos:@$iu4:f00b@':foo.vs@> a valos:Media
      ; valos:folder <urn:valos:$iu4:f00b>
      ; valos:inheritancePrototype <urn:valos:@$iu4:f00b-b507-0763@':foo.vs@>
      ; valos:name "foo.vs"
`),
      ],
      "chapter#section_structured_entity>5;verb type \"`+`\": structural Entity": [`

e.g. \`<urn:valos:@$iu4:f00b@+:scripts@>\` is an entity with fixed
name "scripts", dominant type Entity, $iu4 resource f00b as the
owning container and a structurally homologous prototype inside
f00b-b507-0763 and thus infers triples:
`, turtle(`
  <urn:valos:@$iu4:f00b@+:scripts@> a valos:Entity
      ; valos:parent <urn:valos:$iu4:f00b>
      ; valos:inheritancePrototype <urn:valos:@$iu4:f00b-b507-0763@+:scripts@>
      ; valos:name "scripts"
`),
      ],
      "chapter#section_structured_object_value>6;verb type  \"`-`\" - fixed rdf:object value": [`

Extends the preceding verb-param with a fixed rdf:object triple.
The actual rdf:object sub-property depends on the dominant type of
the verb-param: \`valos:value\` for ScopeProperty, \`valos:target\`
for Relation, \`valos:content\` for Media, etc.

e.g. \`<urn:valos:@$iu4:f00b@*:PERMISSIONS:@-$ihi:8766@@>\` is a
PERMISSIONS relation with fixed ihi target 8766 and infers triples:
`, turtle(`
  <urn:valos:@$iu4:f00b@*:PERMISSIONS:@-$ihi:8766@@> a valos:Relation
      ; valos:containerSource <urn:valos:$iu4:f00b>
      ; valos:prototype <urn:valos:@$iu4:f00b-b507-0763@*:PERMISSIONS:@-$ihi:8766@@>
      ; valos:name "PERMISSIONS"
      ; valos:target <urn:valos:$iu4:8766-src>
`),
      ],
    },
  },
  "chapter#section_grammar>8;Collected VPath ABNF grammar": {
    "#0": [
`The VPath grammar is an LL(1) grammar. It is recursive as param-value
productions can contain nested vpaths without additional encoding.
`, abnf(
`  vpath         = "@" vgrid-path / verb-path

  vgrid-path    = vgrid "@" [ verb-path ]
  vgrid         = "$" format-term ":" param-value [ params ]
  format-term   = context-term

  verb-path     = verb "@" [ verb-path ]
  verb          = verb-type params
  verb-type     = 1*unencoded

  params        = context-tail / value-tail
  context-tail  = "$" [ context-term ] [ ":" param-value [ params ] / context-tail ]
  value-tail    = ":" param-value [ params ]

  context-term  = ALPHA *unreserved-nt
  param-value   = vpath / 1*( unencoded / pct-encoded )

  unencoded     = unreserved / "!" / "*" / "'" / "(" / ")"
  unreserved    = unreserved-nt / "~"
  unreserved-nt = ALPHA / DIGIT / "-" / "_" / "."
  pct-encoded   = "%" HEXDIG HEXDIG`,
), `

There are couple notes not explicitly expressed by the the grammar
itself. These notes primarily relate to LL(1)-parseability:`
    ],
    "bulleted#1": [
[`There are no explicit rule 'vrid' for a VPath with 'vgrid' as the first
  expansion as that would prohibit LL(1) parsing.`],
[`A note that 'params' rule is right recursive. This is to ensure that
  the string "$foo:bar" will be properly LL(1)-parsed as a singular
  'context-tail' with 'param-value', instead of a 'context-tail'
  (without 'param-value') that is followed by 'value-tail'.
  To represent a 'context-tail' (without 'param-value') that is
  followed by a 'value-tail' an empty context must be added:
  "$foo$:bar". To represent an empty param an empty "$" can be
  inserted: "$$foo:bar" and as a consequence if the following param of
  an empty param has no context it must also prepended with "$" like
  so: "$$:bar".`],
[`'context-term's which are plain namespace prefixes should be
  restricted to rule 'ALPHA 0*30unreserved-nt ( ALPHA / DIGIT )' as
  this is the prefix grammar of some relevant prefix context.
  `, blockquote(
    `Editorial Note: which context was this again? Neither
    SPARQL, Turtle nor JSON-LD have this limitation).`
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

      "chapter#section_no_contextual_delimiters>0;No contextual delimiters": `

If a character is a delimiter in some context within a VPath then this
character must always encoded when not used as a delimiter.`,
      [`chapter#section_consistent_encoding>1;${
        ""}All value segments are encoded and decoded using encodeURIComponent`]: `

Characters not encoded are ruled out from structural delimiters.
This leaves "?" | "#" and "/" | ":" | "@" and "$" | "+" | ";" | "," | "=" | "&"`,
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

      "chapter#section_unencoded_in_rfc_3986_segment_nz>0;As RFC 3986 URI segment-nz component": `

VPaths can be used as-is in URI path parts (except as segment-nz-nc, see below).
This rules out "?", "#", "/" from structural delimiters`,
      "chapter#section_unencoded_in_sequences>1;As a typical sequence entry": `

Rules out "," | ";" from structural delimiters`,
      [`chapter#section_unencoded_in_rfc_3986_query>2;${
        ""}As part of RFC 3986 URI query component when consumer is known not to decode`]: [`

VPath can and is intended to be used as-is in the query part (even as
the right-hand side value of "=") `, em(`as long as the URI
consumer or possible middlewares don't perform x-www-form-urlencoded
(or other) decoding of the key-value pairs`), `before VPath expansion.

Rules out "=" , "&" from structural characters.
`, blockquote(
  `Note: This is completely regular. If the consumer is
  known to explicitly decode query values and because VPaths can
  contain "%" characters they must be appropriately symmetrically
  encoded. This can result in double encoding. However as the intent is that VPath
  expansion should be considered to be part of `,
  ref("the URI parsing and separation itself", "https://tools.ietf.org/html/rfc3986#section-2.4"),
  ` any  separate encoding and decoding should not be needed.`
),
      ],
/*
 - because either there is full x-www-form-urlencoded roundtrip or
   there is none this should _not_ rule out "+" as a delimiter in
   principle. The practice is another story as legacy issues abound.
 - thus rules out "+"
 */
      "chapter#section_unencoded_in_rfc_3986_fragment>2;As RFC 3986 URI fragment component": `

Doesn't rule out any delimiter options not yet ruled out.`,
      "chapter#section_unencoded_in_rfc_8141_nss>2;As RFC 8141 URN NSS components": `

Doesn't rule out any delimiter options not yet ruled out.
Specifically this does not rule out ":" as that is allowed in NSS sub-parts.`,
      "chapter#section_unencoded_in_rfc_8141_rq_f>2;As RFC 8141 URN rq-, and f-component": `

Covered by URI query and fragment sections.`,
    },
    [`chapter#section_encoded_contexts>2;${
        ""}VPath must be used escaped/quoted/encoded in following contexts`]: {

      "chapter#section_quoted_string>0;In HTTP/1.1 headers always as a quoted-string": `

URI's in general need to be quoted here and VPath is URI-like.
This retains "@" as an allowed delimiter.`,
      "chapter#section_x_www_form_urlencoded;In form fields as x-www-form-urlencoded": [`

Encoded and serialized as per `, ref("https://url.spec.whatwg.org/#urlencoded-serializing")
      ],
      [`chapter#section_in_rfc_3986_segment_nz_nc;${
        ""}In URI relative-part with no scheme must be prefixed with "./"`]: `

This retains ":" as an allowed delimiter which segment-nz-nc would
otherwise prevent.`,
    },
    "chapter#section_tilde_problem>3;The tilde problem with URN RFC 2141 is solved by RFC 8141": `

RFC 2141 reserves "~" but encodeURIComponent doesn't encode it. To
maintain direct drop-in 2141 compatibility would require disallowing
"~" from the character set. This in turn would complicate specific
javascript domain implementations as they would have to encode "~"
separately without being able to solely rely on encodeURIComponent.

As this concern is not likely to be a problem in practice anyway we
choose to refer to RFC 8141 for URN's which removes "~" from the set of
reserved character. This solves this (relatively theoretical) issue.`,
  },
};
