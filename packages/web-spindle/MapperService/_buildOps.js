// @flow

export function _appendSchemaSteps (
    router, runtime, jsonSchema, targetTrack, expandProperties, isValOSFields) {
  if (jsonSchema.type === "array") {
    router.appendSchemaSteps(runtime, jsonSchema.items, { expandProperties, targetTrack });
  } else if ((jsonSchema.type === "object") && expandProperties) {
    const objectKuery = {};
    Object.entries(jsonSchema.properties).forEach(([key, valueSchema]) => {
      let op;
      const reflectionVPlot = (valueSchema.valospace || {}).reflection;
      if (key === "$V") {
        op = router.appendSchemaSteps(
            runtime, valueSchema, { expandProperties: true, isValOSFields: true });
      } else if (isValOSFields && (reflectionVPlot === undefined)) {
        if (key === "href") {
          const targetType = ((jsonSchema.properties.target || {}).valospace || {}).resourceType;
          const targetSchema = targetType && router.derefSchema(`${targetType}#`);
          const targetHRef = router.createGetRelSelfHRef(runtime, null, targetSchema);
          if (!targetHRef) return;
          op = [
            "§->", "target", false,
            (head, scope, valker) => targetHRef(valker.unpack(head), scope),
          ];
        } else if (key === "rel") {
          op = "self";
        } else {
          op = router.appendSchemaSteps(runtime, valueSchema,
              { expandProperties: true, targetTrack: ["§->", key, false] });
        }
      } else {
        op = router.appendSchemaSteps(runtime, valueSchema, { expandProperties: true });
        op = (op.length === 1) ? ["§..", key]
            : ((valueSchema.type === "array") || (reflectionVPlot !== undefined))
                ? op
            : ["§->", ["§..", key], false, ...op.slice(1)];
      }
      objectKuery[key] = op;
    });
    targetTrack.push(objectKuery);
  }
}

export function _derefSchema (router, schemaOrSchemaName) {
  let sharedName;
  if (typeof schemaOrSchemaName !== "string") {
    if (!(schemaOrSchemaName || "").$ref) return schemaOrSchemaName;
    sharedName = schemaOrSchemaName.$ref.match(/#(.*\/)?([^/]+)$/)[2];
  } else if (schemaOrSchemaName[(schemaOrSchemaName.length || 1) - 1] === "#") {
    sharedName = schemaOrSchemaName.slice(0, -1);
  } else {
    throw new Error(
        `Invalid shared schema name: "${schemaOrSchemaName}" is missing '#'-suffix`);
  }
  const sharedSchema = router._fastify.getSchemas()[sharedName];
  if (!sharedSchema) {
    throw new Error(`Can't resolve shared schema "${sharedName}"`);
  }
  return sharedSchema;
}
