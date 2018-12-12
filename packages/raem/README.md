# @ValOS/raem provides ValOS Resources And Events Model `ValOS-RaEM` (/væləsˌɹɛem/)

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
- `ValaaSpace` definition as a distributed set of resources containing
  references to each other using the ValaaURIs.
- `partitions` mechanism which allows for unlimited scalability of the
  `ValaaSpace` into a singular globally distributed and unified object
  space.

[//]: # (TODO(iridian): ValaaSpace and partitions should in principle be inside @ValOS/prophet)
[//]: # (TODO(iridian): This refactoring effort would be valuable otherwise as well as it would clarify Valker API's and simplify its implementation)
[//]: # (TODO(iridian): However that's gonna be a damn of a refactoring process to fully abstract and excise them from @ValOS/raem)

- depends: `@ValOS/tools`, `immutable`
- exports: `Corpus`, `Command`, `VALK`, `Valker`, `RAEMContentAPI`
- ValaaSpace: `Resource`, `TransientFields`, `Bvob`, `Partition`
- concepts: `ghost instancing`, `partitions`, `couplings`


## 1. ValOS URLs, urn:valos and raw id's

ValOS URL is used to specify a parameterized location reference to a
ValOS Resource. It has two major parts separated by the URI fragment
separator `#`: *partition URI* part and a *local reference* part.

*Partition URI* identifies the target authority and partition of
the reference. It corresponds to scheme, hierarchical and query parts
of an URI; everything but the fragment. Its precise structure and
interpretation is specified by the scheme but typically the scheme and
hierarchical part identify an authority and query part identifies
a partition.

*Local reference* identifies a particular resource inside a partition
but also contains optional *coupling*, *ghost path*, *lens* (and other)
parts which further parameterize the reference itself. It corresponds
to the URI fragment part but has sub-structure which is specified in
this document.

```
                                            valos-url
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
```
Fig 1. Correlations between ValOS URL and urn:valos (top) and URI and URN (bottom)


#### 1.1. Curious pluralistic dualisms of *partition URI* and *local reference*

The division between partition URI and local reference has many curious
dualistic qualities: backend vs. frontend, hierarchical vs. flat,
routing vs. computation, extensible vs. fixed, absolute vs. contextual,
coarse vs. granular, self-contained vs. part-of-a-whole.

##### 1.1.1. Partition URI domain is backend, local reference domain is front-end

ValOS backends deal with the indivisible partitions and thus don't care
about the particularities of local references to individual resources.
This corresponds to how in web architecture URI fragments are not sent
to backend with resource requests. Conversely, ValOS frontends don't
care where a resource comes from once it has been loaded, but about its
identity, relationships and the parameters of those relationships. This
is reflected in how frontend code regularily drops the partition URI.

##### 1.1.2. Partition URI structure is specified by the scheme, local reference structure is specified by ValOS

By the nature of its distributed event sourcing architecture ValOS
focuses heavily on the frontend. The cross-compatibility between
components is driven by how new backends can integrate and talk with
existing front-end clients. This is facilitated by front-end plugin
systems which enables new valaa URI schemes to specify new routing
solutions and fundamentally new backend infrastructures, as long as
said infrastructures can route valaa event streams to clients. This
corresponds to how ValOS doesn't specify how a *partition URI*
identifies and locates partitions and authorities but leaves it to
the scheme specifications and their reference implementations of
frontend plugins.

##### 1.1.3. Partitions URI's identify self-contained wholes, resource references need their context

Web architecture specifies that all or none of the document is
retrieved. This corresponds to the behaviour of ValOS partitions which
are always retrieved as a whole. Partition URI's contain all and
nothing but the components which identify web resources, that is
everything but the fragment.

##### 1.1.4. Etc.

### 1.2. resource-id

Resource id is the NSS part of an urn:valos URI. It globally uniquely
identifies a *referenced resource*:

`resource-id        = primary-part [ "/" secondary-part ]`

The first, non-optional *primary* part globally uniquely identifies a
freely movable *primary* resource. If no secondary part exists this
resource is also the referenced resource. If the secondary part exists
it identifies a sub-resource strictly relative to the primary resource.
The referenced resource is then this sub-resource.

Two resource ids refer to the same resource iff their canonical string
representations are lexically equivalent. Notably:
1. both parts are case sensitive. If a part specification refers to a
   case insensitive external naming system it must specify a canonical
   representation.
   It is recommended that this representation is all-lowercase.
2. no redundant encoding. If a part contains encoding schemes then any
   characters or tokens which can expressed without encoding must not
   be encoded.

#### 1.2.1 primary-part - restricted naming, free ownership

The primary id part has a very restricted character set of `unreserved`
as specified in the [URI specification](https://tools.ietf.org/html/rfc3986).

`primary-part       = *( unreserved )`

The *primary* part must be globally unique.
Note: uuid v4 is recommended for now, but eventually primary id
generation should tied to the deterministic event id chain. This in
turn should be seeded by some ValOS authority.

Note: when using base64 encoded values as primary id, use
[ie. url-and-filename-ready base64url characters](https://tools.ietf.org/html/rfc4648#section-5).

Note: derivedId currently used by the codebase uses only the primary id
but breaks the above character set requirement, as it uses base64
encoding with `+` and `/` . For backwards compatibility they are
permitted, but [considered equal to the base64url](https://tools.ietf.org/html/rfc7515#appendix-C)
using `+` <-> `-`, `/` <-> `_` character mappings.

### 1.2.1 secondary-part - lenient naming, restricted ownership

The *secondary* id part is a qualified name which can be expanded into
an URI. This URI then defines how the referred resource is determined
from the primary resource.

`secondary-part    = prefix *( pchar / "/" )`
`prefix            = *( unreserved / pct-encoded / sub-delims / "@" ) ":"`

The expansion is done by replacing the prefix with a corresponding
value. Currently the only allowed prefixes and their semantics is
limited to the exclusive list of three entries:

1. prefix `@:` - instance-ghost ids
  `urn:valos:ba54/@:b7e4` reads as "inside the instanced resource
  `ba54` the ghost of the regular resource `b7e4`".
  The expansion of the prefix `@:` is `valos:urn:` itself.
  This means nested ghost paths are allowed, like so:
  `urn:valos:f00b/@:ba54/@:b7e4` reads as "inside the instance `f00b`
  the ghost of `urn:valos:ba54/@:b7e4`.
2. prefix `.:` - property ids
  `urn:valos:f00b/.:propName` - a directly owned Property resource with
  a constant name `propName` and prototype which is dynamically linked
  to the corresponding Property in the prototype of `urn:valos:f00b`,
  like so: `${prototype("urn:valos:f00b")}/.:propName`.
3. prefix `$:` - virtual resource ids
  permanently immaterial ghosts with nevertheless separate identities.
  When used as prototype with instance-ghosts allows separate
  instantiation of the same fundamental prototype in the same instance:
  `urn:valos:f00b/$:1/@:b74e`
  `urn:valos:f00b/$:2/@:b74e`
  `urn:valos:f00b/$:textsalt/@:b74e`

Resources identified by these parts are tightly bound to the resource
identified by the primary part (which must exist). They must be always
directly or indirectly owned by the primary resource.

### 1.3. ValaaReference

Javascript class which implements ValOS reference URI and associated
operations.
