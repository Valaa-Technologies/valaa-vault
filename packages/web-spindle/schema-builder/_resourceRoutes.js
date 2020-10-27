import { disjoinVPlotOutline } from "~/plot";
import { wrapError, dumpify, dumpObject } from "~/tools";

import { ObjectSchema, schemaRefOf, trySchemaNameOf } from "./types";

import {
  _prepareRoute, _finalizeRoute, _routeName,
  _genericGETResourceQueryStringSchema, _resourceSequenceQueryStringSchema,
} from "./_routesCommon";

export function _setupResourceRoute (route, userConfig, globalRules, resourceType) {
  if (!resourceType || (typeof resourceType !== "object")) {
    throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
  }
  _prepareRoute(route, userConfig);
  _setupRouteResourceConfig(route, resourceType);
  return _finalizeRoute(route, userConfig, globalRules);
}

export function _setupRouteResourceConfig (route, resourceType) {
  const name = trySchemaNameOf(resourceType) || "<resource>";
  const valospace = resourceType[ObjectSchema].valospace || {};
  if (!valospace.gate) {
    throw new Error(`Can't find valospace gate for resource '${name}' in ${_routeName(route)}`);
  }
  if (!route.name) route.name = valospace.gate.name;
  route.config.resource = {
    name,
    schema: schemaRefOf(resourceType),
    gate: {
      ...valospace.gate,
      projection: disjoinVPlotOutline(valospace.gate.projection, "@@"),
    },
  };
}

export function listingGETRoute (url, userConfig, globalRules, resourceType) {
  const route = { url, category: "listing", method: "GET" };
  try {
    if (!_setupResourceRoute(route, userConfig, globalRules, resourceType)) return undefined;
    Object.assign(route.schema, {
      description: `List all listable ${route.config.resource.name} resources`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(resourceType),
        ..._resourceSequenceQueryStringSchema(resourceType),
        ...(route.schema.querystring || {}),
      },
      response: {
        200: {
          type: "array",
          items: route.config.resource.schema,
        },
        403: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`listingGETRoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tResourceType:", ...dumpObject(resourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourcePOSTRoute (url, userConfig, globalRules, resourceType) {
  const route = { url, category: "resource", method: "POST" };
  try {
    if (!_setupResourceRoute(route, userConfig, globalRules, resourceType)) return undefined;
    Object.assign(route.schema, {
      description: `Create a new ${route.config.resource.name} resource`,
      body: route.config.resource.schema,
      response: {
        200: route.config.resource.schema,
        403: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourcePOSTRoute(${_routeName(route)})`),
        "\n\tresource:", dumpify(route.config.resource),
        "\n\tType:", ...dumpObject(resourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourceGETRoute (url, userConfig, globalRules, resourceType) {
  const route = { url, category: "resource", method: "GET" };
  try {
    if (!_setupResourceRoute(route, userConfig, globalRules, resourceType)) return undefined;
    Object.assign(route.schema, {
      description: `Get the contents of a ${route.config.resource.name} route resource`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(resourceType),
        ...(route.schema.querystring || {}),
      },
      response: {
        200: route.config.resource.schema,
        403: { type: "string" },
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourceGETRoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tResourceType:", ...dumpObject(resourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourcePATCHRoute (url, userConfig, globalRules, resourceType) {
  const route = { url, category: "resource", method: "PATCH" };
  try {
    if (!_setupResourceRoute(route, userConfig, globalRules, resourceType)) return undefined;
    Object.assign(route.schema, {
      description: `Update parts of a ${route.config.resource.name} route resource`,
      body: route.config.resource.schema,
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourcePATCHRoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tResourceType:", ...dumpObject(resourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourceDELETERoute (url, userConfig, globalRules, resourceType) {
  const route = { url, category: "resource", method: "DELETE" };
  try {
    if (!_setupResourceRoute(route, userConfig, globalRules, resourceType)) return undefined;
    Object.assign(route.schema, {
      description: `Destroy a ${route.config.resource.name} route resource`,
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourceDELETERoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tResourceType:", ...dumpObject(resourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}
