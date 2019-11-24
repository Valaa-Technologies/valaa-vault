// @flow

import path from "path";

import { dumpObject } from "~/tools/wrapError";

export function _appendSchemaSteps (router, runtime, jsonSchema, targetVAKON, innerReflectionVAKON,
    expandProperties, isValOSFields) {
  let innerTargetVAKON = innerReflectionVAKON;
  if (jsonSchema.type === "array") {
    if (!innerTargetVAKON) {
      innerTargetVAKON = ["§map"];
      targetVAKON.push(innerTargetVAKON);
    }
    router.appendSchemaSteps(runtime, jsonSchema.items,
        { expandProperties, targetVAKON: innerTargetVAKON });
  } else if ((jsonSchema.type === "object") && expandProperties) {
    const objectKuery = {};
    Object.entries(jsonSchema.properties).forEach(([key, valueSchema]) => {
      let op;
      const reflectionVPath = (valueSchema.valospace || {}).reflection;
      if (isValOSFields && (reflectionVPath === undefined)) {
        if (key === "href") {
          if (!((jsonSchema.valospace || {}).gate || {}).name) {
            router.errorEvent(`Trying to generate a href to a resource without valospace.gate.name:`,
                "\n\troute:", runtime.name,
                "\n\tjsonSchema:", ...dumpObject(jsonSchema),
                "\n\tSKIPPING FIELD");
            return;
          }
          op = ["§->", "target", false, "rawId",
            ["§+", _getResourceHRefPrefix(router, jsonSchema), ["§->", null]]
          ];
        } else if (key === "rel") op = "self";
        else op = ["§->", key];
      } else if (key === "$V") {
        op = router.appendSchemaSteps(runtime, valueSchema,
            { expandProperties: true, isValOSFields: true });
      } else {
        op = router.appendSchemaSteps(runtime, valueSchema, { expandProperties: true });
        op = (op.length === 1) ? ["§..", key]
            : ((valueSchema.type === "array") || (reflectionVPath !== undefined))
                ? op
            : ["§->", ["§..", key], false, ...op.slice(1)];
      }
      objectKuery[key] = op;
    });
    (innerTargetVAKON || targetVAKON).push(objectKuery);
  }
  return targetVAKON;
}

export function _getResourceHRefPrefix (router, jsonSchema) {
  const routeName = ((jsonSchema.valospace || {}).gate || {}).name;
  if (typeof routeName !== "string") {
    throw new Error("href requested of a resource without a valospace.gate.name");
  }
  return path.join("/", router.getRoutePrefix(), routeName, "/");
}

export function _derefSchema (router, schemaOrSchemaName) {
  if (typeof maybeSchemaName !== "string") return schemaOrSchemaName;
  if (schemaOrSchemaName[(schemaOrSchemaName.length || 1) - 1] !== "#") {
    throw new Error(`Invalid shared schema name: "${schemaOrSchemaName}" is missing '#'-suffix`);
  }
  const sharedSchema = router._fastify.getSchemas()[schemaOrSchemaName.slice(0, -1)];
  if (!sharedSchema) {
    throw new Error(`Can't resolve shared schema "${schemaOrSchemaName}"`);
  }
  return sharedSchema;
}
