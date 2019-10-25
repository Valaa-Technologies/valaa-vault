// @flow

import path from "path";

export function _buildKuery (routeMapper, jsonSchema, outerKuery, innerKuery, isValOSFields) {
  const hardcoded = (innerKuery === undefined) && (jsonSchema.valos || {}).hardcodedResources;
  if (hardcoded) {
    outerKuery.push(["§'", Object.values(hardcoded).map(e => e)]);
    return outerKuery;
  }
  if (jsonSchema.type === "array") {
    if (!innerKuery) {
      throw new Error("json schema valos predicate missing with json schema type 'array'");
    }
    routeMapper.buildKuery(jsonSchema.items, innerKuery);
  } else if (jsonSchema.type === "object") {
    const objectKuery = {};
    Object.entries(jsonSchema.properties).forEach(([key, valueSchema]) => {
      let op;
      if (isValOSFields && ((valueSchema.valos || {}).predicate === undefined)) {
        if (key === "href") {
          op = ["§->", "target", false, "rawId",
            ["§+", _getResourceHRefPrefix(routeMapper, jsonSchema), ["§->", null]]
          ];
        } else if (key === "rel") op = "self";
        else op = ["§->", key];
      } else if (key === "$V") {
        routeMapper.buildKuery(valueSchema, (op = ["§->"]), true);
      } else {
        routeMapper.buildKuery(valueSchema, (op = ["§->"]));
        op = (op.length === 1) ? ["§..", key]
            : ((valueSchema.type === "array")
                || (valueSchema.valos || {}).predicate !== undefined) ? op
            : ["§->", ["§..", key], false, ...op.slice(1)];
      }
      objectKuery[key] = op;
    });
    (innerKuery || outerKuery).push(objectKuery);
  }
  return outerKuery;
}

export function _getResourceHRefPrefix (routeMapper, jsonSchema) {
  const routeName = ((jsonSchema.valos || {}).route || {}).name;
  if (typeof routeName !== "string") {
    throw new Error("href requested without json schema valos route.name");
  }
  return path.join("/", routeMapper.getRoutePrefix(), routeName, "/");
}

export function _resolveSchemaName (routeMapper, maybeSchemaName) {
  if (typeof maybeSchemaName !== "string") return maybeSchemaName;
  if (maybeSchemaName[(maybeSchemaName.length || 1) - 1] !== "#") {
    throw new Error(
        `String without '#' suffix is not a valid shared schema name: "${maybeSchemaName}"`);
  }
  const sharedSchema = routeMapper._fastify.getSchemas()[maybeSchemaName.slice(0, -1)];
  if (!sharedSchema) {
    throw new Error(`Can't resolve shared schema "${maybeSchemaName}"`);
  }
  return sharedSchema;
}