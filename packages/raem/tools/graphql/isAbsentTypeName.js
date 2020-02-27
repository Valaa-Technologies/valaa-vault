// @flow

export default function isAbsentTypeName (typeName: string) {
  return typeName.slice(0, 8) === "Inactive";
}
