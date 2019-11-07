// @flow

import path from "path";

export function _appendSchemaSteps (routeMapper, runtime, jsonSchema, targetVAKON, innerTargetVAKON,
    expandProperties, isValOSFields) {
  if (jsonSchema.type === "array") {
    if (!innerTargetVAKON) {
      throw new Error("json schema valospace vpath missing with json schema type 'array'");
    }
    routeMapper.appendSchemaSteps(runtime, jsonSchema.items,
        { expandProperties, targetVAKON: innerTargetVAKON });
  } else if ((jsonSchema.type === "object") && expandProperties) {
    const objectKuery = {};
    Object.entries(jsonSchema.properties).forEach(([key, valueSchema]) => {
      let op;
      if (isValOSFields && ((valueSchema.valospace || {}).reflection === undefined)) {
        if (key === "href") {
          op = ["§->", "target", false, "rawId",
            ["§+", _getResourceHRefPrefix(routeMapper, jsonSchema), ["§->", null]]
          ];
        } else if (key === "rel") op = "self";
        else op = ["§->", key];
      } else if (key === "$V") {
        op = routeMapper.appendSchemaSteps(runtime, valueSchema,
            { expandProperties: true, isValOSFields: true });
      } else {
        op = routeMapper.appendSchemaSteps(runtime, valueSchema, { expandProperties: true });
        op = (op.length === 1) ? ["§..", key]
            : ((valueSchema.type === "array")
                || (valueSchema.valospace || {}).reflection !== undefined) ? op
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
