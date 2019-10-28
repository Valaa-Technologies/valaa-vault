// @flow

export function _buildToRelationsSource (
    mapper, schema, relationName, kuery = ["§->"]) {
  mapper.addSchemaStep(schema, kuery);
  kuery.push(...relationName.split("/").slice(0, -1).map(name => ["§..", name]));
  return kuery;
}
