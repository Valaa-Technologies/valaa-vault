# @valos/web-spindle

Web API spindle extends the gateway with a http server which exposes
valospace resources via a RESTful API.

This package is also a major study on whether ValOS <-> Web API
mappings for a particular domain can be specified in a fully
declarative fashion. There are several points to be made here:
1. ValOS object model allows delegation of the web API calls into
   valospace business logic functions. This improves fabric-valospace
   integration and reduces the need for custom fabric code and is
   the reason declarative approach can even be considered.
2. The declarative mappings allow for faster adaptations to the wild
   west that is valospace. It also provides better foundation for
   introspecting and validating the mappings at any point in time.
   At least as it has no custom code it shouldn't make the complexity
   problems worse, in principle.
3. The no-code aspect allows an opportunistic instance of the
   web-spindle to be attached to a local inspire gateway
   for it to serve REST calls locally. Then a parallel non-valospace
   web application which has a valos REST perspire backend can request
   the local inspire REST endpoint to fetch its API mappings to serve
   some (or all) REST requests locally. This arrangement is possible
   even non-intrusively as long as the web application allows a service
   worker to intercept the appropriate remote REST calls and forward
   them locally.

The description language is [JSON schema](https://json-schema.org/)
which is extended with ValOS mapping descriptors.
`schema-builder/` contains the convenience functions that can be used
to build the schema description types and routes and emit the
description objects.

The current system is a working prototype. the core is structurally
sound but there's no specification and leaks abstractions somewhat;
most notably the JSON schema is fixed at what the underlying fastify
web server consumes.
