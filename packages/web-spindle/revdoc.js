
const {
  extractee: { authors, em, ref, pkg },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": "Web API spindle",
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "webAPI",
  },

  "chapter#abstract>0": {
    "#0": [
`Web API spindle extends the gateway with a http(s) service endpoint
which maps valospace resources to a RESTful API using a reusable
declarative route mapping definition JSON-LD document.

Once a well-defined mapping definition for some use case is created and
documented by a technician then all valonauts are able to create
conforming resource structures fully inside the valospace. After that
a service provider can be commissioned to expose those resources via
some internet endpoint using the mapping definition.`,
    ],
  },

  "chapter#sotd>1": {
    "#0": [
`This document is the introduction document of the spindle `,
pkg("@valos/web-spindle"), ` and part of the domain `,
pkg("@valos/kernel"), `.

The current implementation is a working prototype. The core is
structurally sound but messy and there's little in the way of
specification. There's also some abstraction leakage; the JSON schema
is fixed at what the underlying fastify web server consumes.`,
    ],
  },
  "chapter#introduction>2;Web API routes map to valospace resources": {
    "#0": [
`As is traditional the web API spindle is configured via a set of route
patterns which are matched against incoming request IRIs.

The mapping definition is JSON-LD document (created by a technician)
which describes a set of routes and their mapping vplots to valospace
resources. These paths typically originate from a single, configurable
`, em("service index"), ` valospace resource.

A well-defined and documented mapping definition for some use case can
be reused. A valonaut can create a conforming valospace service index
and its surrounding resource structure and then request for a service
from a `, em("web API provider"), ` by providing only the mapping
definition, the service index and any necessary security credentials.

The route definition format is `, ref("JSON schema", "https://json-schema.org/"),
` which is as expected used to describe the route request and response
data types. These route specs can optionally exposed via an `,
ref("OpenAPI 3.0.0", "https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md"),
` (or newer) route). In addition to route format specification the
definition schema includes the `,
ref("declarative mapping definitions", "#section_mapping_definition"),
` from the route requests to valospace resources and eventually back to
responses.

The sub-library `, ref("schema-builder", "@valos/web-spindle/schema-builder"), `
contains the convenience functions that can be used to build the schema
description types and routes and also emit the plain data description
objects which the web API spindle can then consume.`
    ],
  },
  "chapter#section_service>3;The mapping service is a lens plus a focus": {
    "#0": [

    ],
    "chapter#section_routes>0;Routes map request IRIs to valospace operations": {
      "#0": [
`All routes share common as well as separate characteristics. The
handler of a request is located using the most specific route config
which matches the request IRI and its HTTP method. The route config
specifies the route *category* which when combined with the request
method uniquely specifies the actual route type and thus the
handler callback.

A route mapping is defined in terms of the service index resource,
a `, em("route path"), ` from it to a `, em("route root resource"), `
and zero to many `, em("runtime paths"), ` and their associated `,
em("runtime resources"), `

The mapping rule semantics for the shared service index resource and
for the individual route paths and route root resources are uniform.
These are all preloaded during service initialization.
Conversely the semantics of a runtime path and runtime resources
depends on the route type. As these paths and resources depend on
request parameters they are loaded dynamically during request
resolution.`,
      ]
    },
    "chapter#section_service_index>1;The service index is a view focus": {
      "#0": [
`The *service index resource* is statically configured and should be
the same for all routes starting from the same public endpoint. This
index resource is typically the root entity of the service master index
chronicle. The route paths (and some of their runtime paths) are then
typically defined as relations and references in the index chronicle.

The subject path is a path from the root resource to the subject
resource. The subject resource is the immediate _parent_ resource of
the route runtime parts. Its role is to act as the local index entry
point to the route runtime resources. The subject resource is preloaded
and mostly static. But because the subject path is a live kuery the
subject resource does change if the subject path resources and fields
themselves change.

The runtime paths and resources if any, are determined by the handler
which handles the particular request. They are based on the route
configuration and can depend on the request route, query and other
parameters. They use the route subject resource as their head.`
      ]
    }
  },
  "chapter#section_mapping_definition>2;The mapping definition is a view lens": {
    "#0": [
`This package is a major study on whether Web API <-> ValOS mappings
for a particular domain can be specified in a fully declarative
fashion.
Reaching this goal would have several desirable qualities:`,
    ],
    "numbered#declarative_desirable_qualities": [
[`ValOS resource model allows business logic to reside within the
  valospace execution model. If the Web API integration logic can
  be made to rely on this then the need for custom fabric code is
  removed. This means lighter fabric-valospace integration overheads
  and quicker development cycles.`],
[`Taken further, purely declarative mappings can allow Web API
endpoints be opened fully from inside valospace. A well-designed
Relation-based specification scheme can make route exposition a near
trivial matter of instructing a worker group to "open all routes that
are specified to start from this resource when used as the route root".`],
[`Purely declarative mappings provide a stronger foundation for
  introspection, debugging and validation of the mappings in general
  and particular requests in specific, at least on the fabric side.`],
[`The no-code aspect can allow for local inspire web-spindles.
  These spindles can collaboratively intercept remote Web API GET
  calls and then opportunistically serve them locally. This can be
  done if the remote endpoint is known to be a web-spindle and if
  all data is locally available. If implemented well this allows
  trivial web apps to rely on naive Web API interaction flows without
  having to care about minimizing the number of requests or
  roundtrips.`],
    ],
    "#1":
`The biggest design feature to reduce the need for multitude of
mappings is the subject paths. Using subject paths a particular common
mapping use case can specify an well-known ordered index chronicle
structure and the web-spindle compatible mapping route
specification for it sans route root resource.
Then the different use cases can specify their mappings solely in terms
of the endpoint prefix, the mapping root resource id and the identifier
of the above mapping route spec.`
  },
};
