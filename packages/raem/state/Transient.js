// @flow
import { OrderedMap } from "immutable";

import ValaaReference, { VRef, RawId, vRef } from "~/raem/ValaaReference";
import type GhostPath from "~/raem/state/GhostPath";

import invariantify, { invariantifyObject } from "~/tools/invariantify";
import wrapError, { dumpObject } from "~/tools/wrapError";

const Transient = OrderedMap;
// A Transient is an immutable-js denormalized representation of a Valaa object.
export default Transient;

export function createTransient (
    initialValues: { id?: VRef, typeName?: string, owner?: VRef, prototype?: VRef } = {}) {
  let ret = Transient();
  if (initialValues.id) ret = _validateAndSet(ret, "id", initialValues.id);
  if (initialValues.typeName) ret = ret.set("typeName", initialValues.typeName);
  if (initialValues.owner) ret = _validateAndSet(ret, "owner", initialValues.owner);
  if (initialValues.prototype) ret = _validateAndSet(ret, "prototype", initialValues.prototype);
  return ret;
}

function _validateAndSet (transient: Transient, fieldName: string, value: VRef) {
  if (!(value instanceof ValaaReference)) {
    invariantifyObject(value, `createTransient.${fieldName}`, { instanceof: ValaaReference });
  }
  return transient.set(fieldName, value);
}

export const PrototypeOfImmaterialTag = Symbol("PrototypeOfImmaterial");

export function createImmaterialTransient (rawId: RawId, ghostPath: GhostPath,
    mostInheritedMaterializedPrototype: Object) {
  const ret = Transient([["id", vRef(rawId, null, ghostPath)]]);
  ret[PrototypeOfImmaterialTag] = mostInheritedMaterializedPrototype;
  return ret;
}

export function createInactiveTransient (id: VRef) {
  return Transient([["id", id]]);
}

export function isInactiveTransient (value: Transient) {
  return value.get("id").isInactive();
}

export function getTransientTypeName (value: Transient, schema?: Object): string {
  try {
    const typeName = tryTransientTypeName(value, schema);
    if (typeof typeName !== "string") {
      invariantify(typeName, "transient must have either 'typeName' or immaterial prototype");
    }
    return typeName;
  } catch (error) {
    throw wrapError(error, `During getTransientTypeName, with:`,
        "\n\tvalue:", ...dumpObject(value),
        "\n\tschema:", ...dumpObject(schema));
  }
}

export function tryTransientTypeName (value: Transient, schema?: Object): ?string {
  try {
    const typeName = value.get("typeName");
    if (typeName) return typeName;
    const id = value.get("id");
    if (!id) return undefined;
    if (id.isInactive()) return !schema ? "InactiveResource" : schema.inactiveType.name;
    const immaterialPrototype = value[PrototypeOfImmaterialTag];
    if (!immaterialPrototype) return undefined;
    return tryTransientTypeName(immaterialPrototype, schema);
  } catch (error) {
    throw wrapError(error, `During tryTransientTypeName, with:`,
        "\n\tvalue:", ...dumpObject(value),
        "\n\tschema:", ...dumpObject(schema));
  }
}
