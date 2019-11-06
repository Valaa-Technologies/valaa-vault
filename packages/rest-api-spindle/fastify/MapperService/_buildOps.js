// @flow

import path from "path";

export function _buildSchemaKuery (routeMapper, jsonSchema, outerKuery, innerKuery, isValOSFields) {
  const hardcoded = (innerKuery === undefined)
      && (jsonSchema.valospace || {}).hardcodedResources;
  if (hardcoded) {
    outerKuery.push(["§'", Object.values(hardcoded).map(e => e)]);
    return outerKuery;
  }
  if (jsonSchema.type === "array") {
    if (!innerTargetVAKON) {
      throw new Error("json schema valospace vpath missing with json schema type 'array'");
    }
    routeMapper.buildSchemaKuery(jsonSchema.items, innerKuery);
  } else if (jsonSchema.type === "object") {
    const objectKuery = {};
    Object.entries(jsonSchema.properties).forEach(([key, valueSchema]) => {
      let op;
      if (isValOSFields && ((valueSchema.valospace || {}).projection === undefined)) {
        if (key === "href") {
          op = ["§->", "target", false, "rawId",
            ["§+", _getResourceHRefPrefix(routeMapper, jsonSchema), ["§->", null]]
          ];
        } else if (key === "rel") op = "self";
        else op = ["§->", key];
      } else if (key === "$V") {
        op = routeMapper.buildSchemaKuery(valueSchema, undefined, true);
      } else {
        op = routeMapper.buildSchemaKuery(valueSchema);
        op = (op.length === 1) ? ["§..", key]
            : ((valueSchema.type === "array")
                || (valueSchema.valospace || {}).projection !== undefined) ? op
            : ["§->", ["§..", key], false, ...op.slice(1)];
      }
      objectKuery[key] = op;
    });
    (innerTargetVAKON || targetVAKON).push(objectKuery);
  }
  return targetVAKON;
}

export function _getResourceHRefPrefix (routeMapper, jsonSchema) {
  const routeName = ((jsonSchema.valospace || {}).gate || {}).name;
  if (typeof routeName !== "string") {
    throw new Error("href requested of a resource without a valospace.gate.name");
  }
  return path.join("/", routeMapper.getRoutePrefix(), routeName, "/");
}

export function _derefSchema (routeMapper, schemaOrSchemaName) {
  if (typeof maybeSchemaName !== "string") return schemaOrSchemaName;
  if (schemaOrSchemaName[(schemaOrSchemaName.length || 1) - 1] !== "#") {
    throw new Error(`Invalid shared schema name: "${schemaOrSchemaName}" is missing '#'-suffix`);
  }
  const sharedSchema = routeMapper._fastify.getSchemas()[schemaOrSchemaName.slice(0, -1)];
  if (!sharedSchema) {
    throw new Error(`Can't resolve shared schema "${schemaOrSchemaName}"`);
  }
  return sharedSchema;
}
