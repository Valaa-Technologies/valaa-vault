// @flow

import { wrapError, dumpObject } from "~/tools";

import { _prepareRoute, _finalizeRoute, _routeName } from "./_routesCommon";

export function _setupBridgeRoute (route, userConfig, globalRules) {
  _prepareRoute(route, userConfig);
  return _finalizeRoute(route, userConfig, globalRules);
}

export function bridgeDELETERoute (url, userConfig, globalRules) {
  const route = { url, category: "bridge", method: "DELETE" };
  try {
    if (!_setupBridgeRoute(route, userConfig, globalRules)) return undefined;
    Object.assign(route.schema, {
      description: route.schema.description
          || `Generic DELETE-method bridge into valospace`,
      response: { ...(route.schema.response || {}) },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`bridgeGETRoute(${_routeName(route)})`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function bridgeGETRoute (url, userConfig, globalRules) {
  const route = { url, category: "bridge", method: "GET" };
  try {
    if (!_setupBridgeRoute(route, userConfig, globalRules)) return undefined;
    Object.assign(route.schema, {
      description: route.schema.description
          || `Generic GET-method bridge into valospace`,
      response: { ...(route.schema.response || {}) },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`bridgeGETRoute(${_routeName(route)})`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function bridgePATCHRoute (url, userConfig, globalRules) {
  const route = { url, category: "bridge", method: "PATCH" };
  try {
    if (!_setupBridgeRoute(route, userConfig, globalRules)) return undefined;
    Object.assign(route.schema, {
      description: route.schema.description
          || `Generic PATCH-method bridge into valospace`,
      response: { ...(route.schema.response || {}) },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`bridgeGETRoute(${_routeName(route)})`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function bridgePOSTRoute (url, userConfig, globalRules) {
  const route = { url, category: "bridge", method: "POST" };
  try {
    if (!_setupBridgeRoute(route, userConfig, globalRules)) return undefined;
    Object.assign(route.schema, {
      description: route.schema.description
          || `Generic POST-method bridge into valospace`,
      response: { ...(route.schema.response || {}) },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`bridgeGETRoute(${_routeName(route)})`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function bridgePUTRoute (url, userConfig, globalRules) {
  const route = { url, category: "bridge", method: "PUT" };
  try {
    if (!_setupBridgeRoute(route, userConfig, globalRules)) return undefined;
    Object.assign(route.schema, {
      description: route.schema.description
          || `Generic PUT-method bridge into valospace`,
      response: { ...(route.schema.response || {}) },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`bridgeGETRoute(${_routeName(route)})`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}
