// @flow

export function _addToRelationsSourceSteps (mapper, resourceSchema, relationName, target) {
  mapper.addSchemaStep(resourceSchema, target);
  target.push(...relationName.split("/").slice(0, -1).map(name => ["§..", name]));
}
