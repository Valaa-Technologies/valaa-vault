
const {
  extractee: {
    abnf, blockquote, authors, ref, pkg, turtle,
  },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": "ValOS Resource Identifier",
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "vrid",
  },
  "chapter#abstract>0": [
`ValOS Resource Identifiers (*VRIDs*) uniquely identify valospace
resources created and manipulated by `,
ref("ValOS event logs", "@valos/sourcerer/valos-event-log"), `.
VRIDs are strings with restricted grammar so that they can be embedded
into various URI component and list formats without encoding.
`,
  ],
  "chapter#sotd>1": [
"This document is part of the library workspace ", pkg("@valos/raem"),
" but is `NOT SUPPORTED NOR IMPLEMENTED` by it yet in any manner.",
  ],
  "chapter#introduction>2;VRID is a stable identifier": [
`A VRID is the NSS part of an urn:valos URI. It is a string with two
nested levels of syntactic structure. The outer structure consists of
\`@\`-separated segments.

`, abnf(`
  vrid           = vgrid-segment *( "@" sub-segment )
`), `

The vgrid-segment uniquely identifies a *global resource*. The
optional sub-segments identify an unambiguous path from the
global resource to a *structural sub-resource* which also is the
*referenced resource* of the VRID. Otherwise if there are no
sub-segments the global resource is the referenced resource.

The inner structure consists of \`$\`-separated parts which specify
the semantics of each individual segment.

`, abnf(`
  vgrid-segment  = "$" vgrid-format-term "$" vgrid-body
  sub-segment    = sub-type-term "$" sub-context-term "$" sub-body
`), `

The identified resource (and thus the VRID itself) is always affiliated
with an event log in the context where the VRID appears.
The *term* parts refer the event log JSON-LD context term definitions,
both for syntactic purposes (e.g. as simple prefix expansions) as well
as semantically (JSON-LD constructs such as index maps have semantic
meaning for some VRID subsegments).

The two *body* parts carry the actual encodeURIComponent-encoded
segment data. The precise meaning depends on the segment type (e.g. URI
suffix, member access etc.).
`
  ],
  "chapter#section_equivalence>3": [`
Two VRIDs refer to the same resource iff their URN representations are `,
ref("urn-equivalent", "https://tools.ietf.org/html/rfc8141#section-3"),
`(i.e. if the two VRID's are equivalent after section 3.1. case
normalization for step 3. percent-encoding case normalization).

Maintaining this consistency between lexical equivalence and semantic
equivalence without having to dereference VRID's is useful but has
implications.

`, blockquote(`When resources are transferred between event logs the
semantics of their context terms and body-parts must remain equivalent.`), `

A *simple equivalence* is that two simple prefix term definitions
resolve to the same URI. An *extended equivalence* is when two extended
term definitions in the source and target event logs are equivalent
after normalization. These two equivalences are [will be] defined by
this document.

More complex equivalences are outside the scope of this document but
can be defined by specifications specifying segment types. These
equivalences might take details of the particular sub-type-term into
account and/or specify context definition additions which do not change
the equivalence semantics.
`,
  ],
  [`chapter#section_vgrid>4;${
      ""}*vgrid-segment* - restricted naming, free ownership, only concrete state`]: [`
The first segment identifies the global resource and is also called
ValOS /Global/ Resource Id or *VGRID*. If there are no sub-segments
then this global resource is also the referenced resource of the VRID.

`, abnf(`
  vgrid-segment     = "$" vgrid-format-term "$" vgrid-body
  vgrid-format-term = context-term
  vgrid-body        = 1*unreserved
  context-term      = ALPHA 0*30( ALPHA / DIGIT / "-" ) ( ALPHA / DIGIT )
`), `

The VGRID character set is very restricted, with only "$" in addition
to *unreserved*  as specified in the `, ref("URI specification", "https://tools.ietf.org/html/rfc3986"), `).
`, blockquote(`Note: when using base64 encoded values as vgrid-body, use `,
    ref("url-and-filename-ready base64url characters",
        "https://tools.ietf.org/html/rfc4648#section-5"), `.
`), `

Global resources can be transferred between event logs. To maintain
immutability across these transfers VGRID's must not contain partition
or other non-identifying locator information. Similar to URN's VRID's
always relies external structures and systems for carrying locator
information.

`, blockquote(`Note: uuid v4 (format term \`iu4\`) is recommended for
    now, but eventually VGRID generation will be tied to the
    deterministic event id chain (format term \`icc\`).
    This in turn should be seeded by some ValOS authority.
`),
],
  [`chapter#section_subsegments>5;${
      ""}*sub-segment* - lenient naming, fixed ownership, also inferred state`]: {
    "#0": [
`The sequence of sub-segments specifies a structured path from the
global resource to a *structured sub-resource*.

`, abnf(`
  sub-segment      = sub-type-term "$" sub-context-term "$" sub-body
  sub-type-term    = *( unreserved / "!" / "*" / "'" / "(" / ")" )
  sub-context-term = context-term
  sub-body         = *( unreserved / pct-encoded / "!" / "*" / "'" / "(" / ")" )
  context-term     = ALPHA 0*30( ALPHA / DIGIT / "-" ) ( ALPHA / DIGIT )
`), `

Note that while sub-type-term and sub-context-term grammar are still
relatively restricted, *sub-body* allows all characters in percent
encoded form (as per encodeURIComponent).

The sub-resources of a particular global resource can be nested and
thus form a tree. Individual sug-segments specify the edges in this
tree.

Each sub-segment specifies the relationship from its
*host resource* to its sub-resource in addition to other constraints of
the sub-resource. The global resource is the host resource for the
first sub-segment; the sub-resource of that segment is the host
resource of the second sub-segment and so on.

As the VRID identities of the sub-resources are structurally fixed to
this tree the coupling between host and sub-resource must be static.
The typical implementation for this is an ownership coupling.
`],
    "chapter#section_sub_type>0;*sub-type-term*": {
      "#0": [`
*sub-type-term* specifies the relationship category between the segment
host resource and sub-resource, a set of inferred triples as well as
other possible constraints.

The examples below all share the following example data:`,
    turtle(`
  <urn:valos:$iu4$f00b> a valos:Entity
      ; valos:prototype <urn:valos:$iu4$f00b-b507-0763>
`)],
      "chapter#section_structured_ghost>0;sub-type \"`!`\": ghost sub-resource": [`

Ghost sub-resources are products of ghost instantiation. All the ghosts
of the directly _and indirectly_ owned resources of the instance
prototype are flattened as _direct_ structural sub-resources of the
instance itself. The instance is called *ghost host* of all such ghosts.

e.g. \`<urn:valos:$iu4$f00b@!$iu4$ba54>\` reads as "inside the
instance resource \`f00b\` the ghost of the iu4 resource \`ba54\`"
and infers triples:`,
turtle(`
  <urn:valos:$iu4$f00b@!$iu4$ba54>
        valos:ghostHost <urn:valos:$iu4$f00b>
      ; valos:ghostPrototype <urn:valos:$iu4$ba54>
`), `
In case of deeper instantiation chains the outermost ghost segment
provides inferences recursively to all of its sub-resources; nested
ghost segments wont provide any further inferences.

e.g. \`<urn:valos:$iu4$f00b@!$iu4$ba54@!$iu4$b7e4>\` reads as "inside
the instance resource \`f00b\` the ghost of
\`<urn:valos:$iu4$ba54@!$iu4$b7e4>\`" and infers triples:`,
turtle(`
  <urn:valos:$iu4$f00b@!$iu4$ba54@!$iu4$b7e4>
        valos:ghostHost <urn:valos:$iu4$f00b>
      ; valos:ghostPrototype <urn:valos:$iu4$ba54@!$iu4$b7e4>
`)],
      "chapter#section_structured_subspace>1;sub-type \"`~`\": subspace selector": [`

Selects a variant resource value for a base resource within a
structurally identified subspace. The variant resource provides
inferred \`subspacePrototype\` fallbacks to an *inner* subspace and
eventually to the non-variant base resource as well as to the
homologous sub-resource of the host resource inheritancePrototype.
This means that no matter where a subspace variant is defined in
the prototype chain or in the nested sub-structure its value will be
found.

e.g. \`<urn:valos:$iu4$f00b@.$$myProp@~$lang$fi>\` is a lang fi
variant of f00b myProp and infers triples:`,
turtle(`
  <urn:valos:$iu4$f00b@.$$myProp@~$lang$fi> a valos:ScopeProperty
      ; valos:subspacePrototype <urn:valos:$iu4$f00b@.$$myProp>
                              , <urn:valos:$iu4$f00b-b507-0763@.$$myProp@~$lang$fi>
      ; valos:language "fi"
`), `
Subspace selectors can be used to access language variants,
statically identified ghost variants within an instance, statically
identified Relation's etc.

The sub-context-term can also specify triple inferences for *all*
sub-resources in the subspace (not just for the immediate
sub-resource of the selector segment).

e.g. \`<urn:valos:$iu4$f00b@!$iu4$b453@~$lang$fi@!$$iu4$b74e@.$$myProp>\`
infers triples:`,
turtle(`
  <urn:valos:$iu4$f00b@!$iu4$b453@~$lang$fi@!$$iu4$b74e@.$$myProp> a valos:ScopeProperty
      ; valos:ghostHost <urn:valos:$iu4$f00b>
      ; valos:ghostPrototype <urn:valos:$iu4$b453@~$lang$fi@!$$iu4$b74e@.$$myProp>
      ; valos:subspacePrototype <urn:valos:$iu4$f00b@!$iu4$b453@!$$iu4$b74e@~$lang$fi@.$$myProp>
      ; valos:language "fi"
`)],
      "chapter#section_structured_scope_property>2;sub-type \"`.`\": structured ScopeProperty": [`

e.g. \`<urn:valos:$iu4$f00b@.$$myProp>\` is a resource with fixed
name "myProp", dominant type ScopeProperty, iu4 resource f00b as the
owning scope and a structurally homologous prototype inside
f00b-b507-0763 and thus infers triples:`,
turtle(`
  <urn:valos:$iu4$f00b@.$$myProp> a valos:ScopeProperty
      ; valos:scope <urn:valos:$iu4$f00b>
      ; valos:inheritancePrototype <urn:valos:$iu4$f00b-b507-0763@.$$myProp>
      ; valos:name "myProp"
`)],
      "chapter#section_structured_relation>3;sub-type \"`*`\": structured Relation": [`

e.g. \`<urn:valos:$iu4$f00b@*$$PERMISSIONS@~$$1>\` is a resource with
fixed name "PERMISSIONS", dominant type Relation, iu4 f00b as the
source, a structurally homologous prototype inside f00b-b507-0763
and thus infers triples:`,
turtle(`
  <urn:valos:$iu4$f00b@*$$PERMISSIONS> a valos:Relation
      ; valos:source <urn:valos:$iu4$f00b>
      ; valos:inheritancePrototype <urn:valos:$iu4$f00b-b507-0763@*$$PERMISSIONS>
      ; valos:name "PERMISSIONS"
  <urn:valos:$iu4$f00b@*$$PERMISSIONS@~$$1> a valos:Relation
      ; valos:subspacePrototype <urn:valos:$iu4$f00b@*$$PERMISSIONS>
                              , <urn:valos:$iu4$f00b-b507-0763@*$$PERMISSIONS@~$$1>
`)],
      "chapter#section_structured_media>4;sub-type \"`'`\": structured Media": [`

e.g. \`<urn:valos:$iu4$f00b@'$$foo.vs>\` is a media with fixed
name "foo.vs", dominant type Media, iu4 resource f00b as the
owning directory and a structurally homologous prototype inside
f00b-b507-0763 and thus infers triples:`,
turtle(`
  <urn:valos:$iu4$f00b@'$$foo.vs> a valos:Media
      ; valos:directory <urn:valos:$iu4$f00b>
      ; valos:inheritancePrototype <urn:valos:$iu4$f00b-b507-0763@'$$foo.vs>
      ; valos:name "foo.vs"
`)],
      "chapter#section_structured_entity>5;sub-type \"`+`\": structured Entity": [`

e.g. \`<urn:valos:$iu4$f00b@+$$scripts>\` is an entity with fixed
name "scripts", dominant type Entity, iu4 resource f00b as the
owning directory and a structurally homologous prototype inside
f00b-b507-0763 and thus infers triples:`,
turtle(`
  <urn:valos:$iu4$f00b@+$$scripts> a valos:Entity
      ; valos:directory <urn:valos:$iu4$f00b>
      ; valos:inheritancePrototype <urn:valos:$iu4$f00b-b507-0763@+$$scripts>
      ; valos:name "scripts"
`)],
      "chapter#section_structured_object_value>6;sub-type \"`-`\" - structured rdf:object value": [`

Extends the preceding sub-segment with a fixed rdf:object triple.
The actual rdf:object sub-property depends on the dominant type of
the sub-segment: \`valos:value\` for ScopeProperty, \`valos:target\`
for Relation, \`valos:content\` for Media, etc.

e.g. \`<urn:valos:$iu4$f00b@*$$PERMISSIONS@-$ihi$8766>\` is PERMISSIONS
relation with fixed ihi target 8766 and thus infers triples:`,
turtle(`
  <urn:valos:$iu4$f00b@*$$PERMISSIONS@-$ihi$8766> a valos:Relation
      ; valos:source <urn:valos:$iu4$f00b>
      ; valos:prototype <urn:valos:$iu4$f00b-b507-0763@*$$PERMISSIONS@-$ihi$8766>
      ; valos:name "PERMISSIONS"
      ; valos:target <urn:valos:$iu4$8766-src>
`)],
    },
    "chapter#section_context_term>1;*context-term* is a lookup term to event log context": [`
*context-term* specifies a lookup term to the event log JSON-LD context.
This binds the relationship to a well-defined namespace or rule
(idiomatic example: namespace prefixes expand to a base URI).
`],
    "chapter#section_sub_body>2;*sub-body* specifies rule content": [`
Rule content is interpreted depending on the combination of
*sub-type-term* and *context-term* (idiomatic example: generic property
name if no context-term namespace is provided, otherwise a compact IRI
local part for an IRI property).

Currently the only allowed sub-types and their semantics is limited to
the exclusive list of three entries:
`],
  },
  "chapter#section_substructure>5;": [],
  "chapter#section_grammar>9": [],
};

/*

urn-reserved-gen-delims = "?" | "#"
 - can never appear unescaped
urn-allowed-gen-delims = "/" | ":" | "@"
 - could be used
encoded-subdelims = "$" | "+" | ";" | "," | "=" | "&"
 - could be used
unencoded-subdelims = "!" | "*" | "'" | "(" | ")"
 - payload characters, can appear in sub-parts, can't be used in structure,
unreserved = ALPHA | DIGIT | "-" | "." | "_" | "~"
 - payload characters, can appear in sub-parts
escape = "%"

gen-delims = reserved-gen-delims | urn-gen-delims | "[" | "]"
sub-delims = unencoded-subdelims | encoded-subdelims


encodeURIComponent, not encoded: unreserved | unencoded-subdelims
URN-8141; allowed: unreserved | unencoded-subdelims | encoded-subdelims | allowed-gen-delims
URN-8141; reserved: escape | reserved-gen-delims

resource-id: ALPHA / DIGIT / "-" / "_"
subspace: "$"
structured-singular: "."
structured-group: "*"

Character set design principles:
1. resource-id composition and decomposition should be robust
1.1. A character either belongs to value segment or a structural segment
1.2. All value segments are encoded and decoded using encodeURIComponent
 - characters not encoded are ruled out from structural characters
2. resource-id must not need separate encoding when used as the value of:
2.1. RFC 3986 URI segment-nz-nc component
 - rules out "#", "?", "/", ":" from structural characters
2.2. RFC 3986 URI query component
 - this is interpreted to also cover keys and values and typical lists, thus:
 - rules out "&", "=" from structural characters
2.3. RFC 3986 URI fragment component
2.4. RFC 8141 URN NSS components
 - this is interpreted to cover typical NSS sub-parts, thus:
 - rules out "@"
2.5. RFC 8141 URN rq-component, f-component
 - covered by 2.2. and 2.3.
3. resource-id should be usable as typical sequence elements
 - rules out ",", ";"

This leaves "@", "$", and "+" as structural separators.
Browsers do evil things with "+", so that is ruled out.

Rationale for URN RFC 8141 over 2141: The Tilde Problem

RFC 8141 allows "~" which 2141 reserves but which
encodeURIComponent doesn't encode. To  maintain direct
drop-in 2141 compatibility would require disallowing "~"
from the character set. This in turn would complicate specific domain
implementations as they would have to encode "~" separately
without being able to rely on encodeURIComponent.

*/
