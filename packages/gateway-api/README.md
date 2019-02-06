# @valos/gateway-api forwards gateway API calls to separate Valaa.gateway

gateway-api is a minimal ValOS gateway API call forwarding library. It
requires that the ValOS gateway be separately loaded into the current
execution context. Before that only a limited subset of the API is
available. This subset allows applications and libraries to add gateway
configurations, set up the client identity and register plugins without
having to wait for the gateway itself to load.

@valos/gateway-api communicates with the gateway via the reserved
global variable `Valaa`.
