// @flow

export default function isInactiveTypeName (typeName: string) {
  return typeName.slice(0, 8) === "Inactive";
}
