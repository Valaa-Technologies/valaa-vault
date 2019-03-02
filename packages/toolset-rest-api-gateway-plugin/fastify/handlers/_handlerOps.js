// @flow

export function _addToRelationsSourceSteps (server, resourceSchema, relationName, target) {
  server.addSchemaStep(resourceSchema, target);
  target.push(...relationName.split("/").slice(0, -1).map(name => ["§..", name]));
}
