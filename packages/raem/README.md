# @valos/raem provides ValOS Resources And Events Model `ValOS-RaEM` (/væləsˌɹɛem/)

This library provides the definitions and reference implementations for
the fundamental `ValOS Resources` and `ValOS Events` systems.

> A ValOS Resource (`resource`) represents a well-defined part of the
> world. It has a well-defined state at each particular moment in time.

> A ValOS Event (`event`) represents a dynamic change to a resource by
> describing the change from previous to subsequent resource states at
> a particular time.

The interplay of these distinct yet interwoven systems forms the
foundation of the Valaa Open System.

This library provides:
- schema definitions for `Resource` and the other core types.
- `Corpus` component which stores in-memory representations of the
  resources.
- `reducers` which a corpus uses to convert (`reduce`) events into
  changes of its resource representations.
- the kuery language `VALK` definition and the kuery engine `Valker`
  component for accessing and manipulating the resources.
- `ghost instancing` mechanism which unifies the object oriented
  instantiation and inheritance principles into a single but powerful
  mechanism for ValOS resources.
- `resource couplings` mechanism which allows referential integrity and
  the definition of different types of reference semantics like
  ownership, global references and local references.
- `urn:valos` specification which defines globally unique identifiers
  for ValOS resources.
- `ValOSURL` specification which allows for universal locating of
  resources.
- `valospace` definition as a distributed set of resources containing
  references to each other using the VRLs.
- `chronicles` mechanism which allows for unlimited scalability of the
  `valospace` into a singular globally distributed and unified object
  space.

[//]: # (TODO(iridian): valospace and chronicles should in principle be inside @ValOS/sourcerer)
[//]: # (TODO(iridian): This refactoring effort would be valuable otherwise as well as it would clarify Valker API's and simplify its implementation)
[//]: # (TODO(iridian): However that's gonna be a damn of a refactoring process to fully abstract and excise them from @ValOS/raem)

- depends: `@ValOS/tools`, `immutable`
- exports: `Corpus`, `Command`, `VALK`, `Valker`, `RAEMContentAPI`
- valospace: `Resource`, `TransientFields`, `Bvob`, `Chronicle`
- concepts: `ghost instancing`, `chronicles`, `couplings`


## 1. ValOS URLs, urn:valos and raw id's

ValOS URL is used to specify a parameterized location reference to a
ValOS Resource. It has two major parts separated by the URI fragment
separator `#`: *chronicle URI* part and a *local reference* part.

*Chronicle URI* identifies the target authority and chronicle of
the reference. It corresponds to scheme, hierarchical and query parts
of an URI; everything but the fragment. Its precise structure and
interpretation is specified by the scheme but typically the scheme and
hierarchical part identify an authority and query part identifies
a chronicle.

*Local reference* identifies a particular resource inside a chronicle
but also contains optional *coupling*, *ghost path*, *lens* (and other)
parts which further parameterize the reference itself. It corresponds
to the URI fragment part but has sub-structure which is specified in
this document.

```
                                            valos-url
┌────────────────────────────────────────────────┴─────────────────────────────────────────────────┐
                  chronicle-uri                                      resource-ref
┌───────────────────────┴────────────────────────┐ ┌──────────────────────┴────────────────────────┐
                         resource-url                                         ref-params
┌──────────────────────────────┴────────────────────────────────┐  ┌───────────────┴───────────────┐
         authority-uri               chronicle-id   resource-id         coupling           lens
┌──────────────┴───────────────┐    ┌─────┴──────┐ ┌─────┴──────┐  ┌───────┴────────┐ ┌─────┴──────┐

valaa-test://example.com:123/dev?id=@$~raw.ab...@@#987b-72...8263?=coupling=relations&lens=ROOT_LENS

                                                   └─────┬──────┘  └──────────────┬────────────────┘
                                                        nss                urn-q-component
└───┬────┘   └──────┬──────┘ └┬┘ └───────┬───────┘ └──────────────────────┬────────────────────────┘
  scheme        authority    path      query                           fragment
             └────────┬────────┘
                  hier-part
```
Fig 1. Correlations between ValOS URL and urn:valos (top) and URI and URN (bottom)


#### 1.1. Curious pluralistic dualisms of *chronicle URI* and *local reference*

The division between chronicle URI and local reference has many curious
dualistic qualities: backend vs. frontend, hierarchical vs. flat,
routing vs. computation, extensible vs. fixed, absolute vs. contextual,
coarse vs. granular, self-contained vs. part-of-a-whole.

##### 1.1.1. Chronicle URI domain is backend, local reference domain is front-end

ValOS backends deal with the indivisible chronicles and thus don't care
about the particularities of local references to individual resources.
This corresponds to how in web architecture URI fragments are not sent
to backend with resource requests. Conversely, ValOS frontends don't
care where a resource comes from once it has been loaded, but about its
identity, relationships and the parameters of those relationships. This
is reflected in how frontend code regularily drops the chronicle URI.

##### 1.1.2. Chronicle URI structure is specified by the scheme, local reference structure is specified by ValOS

By the nature of its distributed event sourcing architecture ValOS
focuses heavily on the frontend. The cross-compatibility between
components is driven by how new backends can integrate and talk with
existing front-end clients. This is facilitated by front-end spindle
systems which enables new ValOS URI schemes to specify new routing
solutions and fundamentally new backend infrastructures, as long as
said infrastructures can route ValOS event streams to clients. This
corresponds to how ValOS doesn't specify how a *chronicle URI*
identifies and locates chronicles and authorities but leaves it to
the scheme specifications and their reference implementations of
frontend spindles.

##### 1.1.3. Chronicle URI's identify self-contained wholes, resource references need their context

Web architecture specifies that all or none of the document is
retrieved. This corresponds to the behaviour of ValOS chronicles which
are always retrieved as a whole. Chronicle URI's contain all and
nothing but the components which identify web resources, that is
everything but the fragment.

##### 1.1.4. Etc.

### 1.2. resource-id

resource-id is an NSS sub-part of an urn:valos:id URN scheme. It
globally uniquely identifies a *referenced resource*:

`resource-id        = [ secondary-part "!" ] primary-part`

The first, non-optional *primary-id* part globally uniquely identifies
an independent *primary resource*. If reference-path is not specified
the primary resource is also the referenced resource of the whole
resource-id. Otherwise the reference-path specifies a fixed semantic
path from the primary resource to a dependent *sub-resource* which then
is the referenced resource.

```
valos-resource-ref  = "urn:valos:id:" resource-ref
resource-ref        = resource-id
                      [ "?+" r-component ] [ "?=" q-component ]
```

resource-refs are a superset of resource-ids with additional
resolver/query parameterization and possible reference aliasing.

All resources are always associated with a single resource-id which is
inherently canonical. This resource-id must always be locally available
with any representation of the resource. resource-ref's which refer to
the same resource are semantically not resource-id's even though they
are syntactically indistinguishable.

Two resource ids refer to the same resource iff their canonical string
representations are lexically equivalent. Notably:
1. both primary-id and reference-path are case sensitive. If a part
   specification refers to a case insensitive external naming system it
   must specify a canonical representation.
   It is recommended that this representation is all-lowercase.
2. no redundant encoding. If a part contains encoding schemes then any
   characters or tokens which can expressed without encoding must not
   be encoded.
3. No resource-id reference aliasing. Some reference-step schemes are
   used outside resource-id's and resource-ref's as well. Some of these
   schemes are sufficiently powerful that a resource-ref which contains
   a reference-step using such a scheme can refer to a resource with
   a different canonical resource-id. In order to minimize issues from
   aliasing ambiguity a reference-step scheme must clearly define its
   different syntactic representations into one of three semantic
   categories: canonical syntax, aliasing syntax and sucky syntax.
   - A resource referenced using only canonical syntax must always
   contain the same primary id and reference-path parts in their
   resource id.
   - A resource referenced using one or more aliasing syntax path parts
   must never contain the aliasing path in its resource id.
   - A resource reference using sucky syntax path parts can but is not
   required to contain the sucky path as part of their canonical id.
   Syntax requiring sucky path semantics should be avoided as
   determining whether a resource-ref containing sucky parts is
   canonical or not could require complex checks.
   TODO(iridian, 2019-03): Come up with a better name for sucky paths.
                           Or maybe outright forbid it.

#### 1.2.1 primary-id - restricted naming, independent ownership

The primary-id has a very restricted character set of `unreserved`
(as per in the [URI specification](https://tools.ietf.org/html/rfc3986) ).

`primary-id         = *unreserved`

This *primary-id* must be globally unique.

Note: uuid v4 is allowed for now, but eventually primary id
generation should tied to the deterministic event id chain. This in
turn should be seeded by some ValOS authority.

Note: when using base64 encoded values as primary id, use
[ie. url-and-filename-ready base64url characters](https://tools.ietf.org/html/rfc4648#section-5).

Note: derivedId currently used by the codebase uses only the primary id
but breaks the above character set requirement, as it uses base64
encoding with `+` and `/` . For backwards compatibility they are
permitted, but [considered equal to the base64url](https://tools.ietf.org/html/rfc7515#appendix-C)
using `+` <-> `-`, `/` <-> `_` character mappings.

### 1.2.1 reference-step - lenient naming, dependent ownership

A *reference-step* is a potentially qualified name which can be
mapped into an URI. This URI defines the semantics on how a single or
set of *target resources* is resolved from an *originating resource*.

Within a resource-id the reference-step parts are applied left-to-right
with the primary-id denoting the originating resource of the leftmost
reference-step. Each reference-steps inside a resource-id must always
resolve into exactly one target resource which is then used as the
originating resource of the reference-step to its right and so on.
The target resource of the rightmost reference-step is the referenced
resource of the whole resource-id itself.

```
reference-step      = ( step-valos-prefix / step-owner-prefix ) ":" *( pchar )
                    / step-global-uri
step-valos-prefix   = 1( sub-delims / "-" / "." / "_" / "~" ) *( unreserved / sub-delims )
step-owner-prefix   = 1ALPHA *( unreserved / sub-delims )
step-global-uri-enc = *( unreserved / pct-encoded )
```

The semantics of a reference-step is defined based on whether it
contains a step-valos-prefix, step-owner-prefix or step-global-uri and
are specified for...
- step-valos-prefix by @valos/vault specification (ie. currently below).
- step-owner-prefix by the authority which owns the primary resource.
- step-global-uri-enc by the author of the uri (which is pct-encoded).

Note: step-owner-prefix and step-global-uri are provisional
placeholders and not further specified. Currently the reference-steps
with fully specified semantics is limited to this exclusive list:

1. prefix `=:` expands to `urn:valos:id:` - ghost ids
  `urn:valos:id:ba54@:b7e4` reads as:
  > ghost of `b7e4` inside resource `ba54`
  Nested ghost paths are allowed, like so:
  `urn:valos:id:f00b@~:ba54@~:b7e4` reads as:
  > ghost of `urn:valos:id:ba54@~:b7e4` inside resource `f00b`
2. prefix `$:` expands to `urn:valos:interface:`
2. prefix `.:` expands to `urn:valos:owned:Property:` - property ids
  `urn:valos:id:f00b@.:propName` - a directly owned Property resource
   with a constant name `propName` and prototype which is dynamically
   linked to the corresponding Property in the prototype of
   `urn:valos:id:f00b`, like so:
   `${prototype("urn:valos:id:f00b")}@.:propName`.
3. prefix `*:` expands to `urn:valos:owned:Relation:` - property ids
  `urn:valos:id:f00b@.:propName` - a directly owned Relation resource
   with a constant name `propName` and prototype which is dynamically
   linked to the corresponding Property in the prototype of
   `urn:valos:id:f00b`, like so:
   `${prototype("urn:valos:id:f00b")}@.:propName`.
4. prefix `&:` expands to `urn:valos:group:`- virtual groups
  permanently immaterial ghosts with nevertheless separate identities.
  When used as prototype with instance-ghosts allows separate
  instantiation of the same fundamental prototype in the same instance:
  `urn:valos:f00b!$:1!@:b74e`
  `urn:valos:f00b!$:2!@:b74e`
  `urn:valos:f00b!$:textsalt!@:b74e`

"!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="



Resources identified by these parts are tightly bound to the resource
identified by the primary id (which must exist). They must be always
directly or indirectly owned by the primary resource.

### 1.3. VRL

Javascript class which implements ValOS reference URI and associated
operations.
