// @flow

import { wrapError, dumpObject } from "~/tools";

import { _prepareRoute, _finalizeRoute, _routeName } from "./_routesCommon";

export function _setupBridgeRoute (route, userConfig, globalRules) {
  _prepareRoute(route, userConfig);
  return _finalizeRoute(route, userConfig, globalRules);
}

function _bridgeRoute (method, url, userConfig, globalRules) {
  const route = { url, category: "bridge", method };
  try {
    if (!_setupBridgeRoute(route, userConfig, globalRules)) return undefined;
    Object.assign(route.schema, {
      description: route.schema.description
          || `Generic ${method}-method bridge into valospace`,
      response: { ...(route.schema.response || {}) },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`bridge${method}Route(${_routeName(route)})`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function bridgeCONNECTRoute (url, userConfig, globalRules) {
  return _bridgeRoute("CONNECT", url, userConfig, globalRules);
}

export function bridgeDELETERoute (url, userConfig, globalRules) {
  return _bridgeRoute("DELETE", url, userConfig, globalRules);
}

export function bridgeGETRoute (url, userConfig, globalRules) {
  return _bridgeRoute("GET", url, userConfig, globalRules);
}

export function bridgeHEADRoute (url, userConfig, globalRules) {
  return _bridgeRoute("HEAD", url, userConfig, globalRules);
}

export function bridgeOPTIONSRoute (url, userConfig, globalRules) {
  return _bridgeRoute("OPTIONS", url, userConfig, globalRules);
}

export function bridgePATCHRoute (url, userConfig, globalRules) {
  return _bridgeRoute("PATCH", url, userConfig, globalRules);
}

export function bridgePUTRoute (url, userConfig, globalRules) {
  return _bridgeRoute("PUT", url, userConfig, globalRules);
}

export function bridgePOSTRoute (url, userConfig, globalRules) {
  return _bridgeRoute("POST", url, userConfig, globalRules);
}

export function bridgeTRACERoute (url, userConfig, globalRules) {
  return _bridgeRoute("TRACE", url, userConfig, globalRules);
}
