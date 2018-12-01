// @flow
import { OrderedMap } from "immutable";

import { VRef, IdData, RawId, vRef } from "~/raem/ValaaReference";
import type GhostPath from "~/raem/state/GhostPath";

import invariantify from "~/tools/invariantify";
import wrapError from "~/tools/wrapError";

const Transient = OrderedMap;
// A Transient is an immutable-js denormalized representation of a Valaa object.
export default Transient;

export function createTransient (options: {
  id?: IdData, typeName?: string, owner?: IdData, prototype?: IdData, RefType: Function
} = {}) {
  let ret = Transient();
  if (typeof options.id !== "undefined") {
    ret = ret.set("id", typeof options.id === "string"
        ? vRef(options.id, undefined, undefined, undefined, options.RefType)
        : options.id);
  }
  if (typeof options.typeName !== "undefined") ret = ret.set("typeName", options.typeName);
  if (typeof options.owner !== "undefined") ret = ret.set("owner", options.owner);
  if (typeof options.prototype !== "undefined") ret = ret.set("prototype", options.prototype);
  return ret;
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

export function getTransientTypeName (value: Transient): string {
  try {
    const typeName = tryTransientTypeName(value);
    if (typeof typeName !== "string") {
      invariantify(typeName, "transient must have either 'typeName' or immaterial prototype");
    }
    return typeName;
  } catch (error) {
    throw wrapError(error, `During getTransientTypeName, with:`,
        "\n\tvalue:", value);
  }
}

export function tryTransientTypeName (value: Transient): ?string {
  try {
    const typeName = value.get("typeName");
    if (typeName) return typeName;
    const id = value.get("id");
    if (!id) return undefined;
    if (id.isInactive()) return "InactiveResource";
    const immaterialPrototype = value[PrototypeOfImmaterialTag];
    if (!immaterialPrototype) return undefined;
    return tryTransientTypeName(immaterialPrototype);
  } catch (error) {
    throw wrapError(error, `During tryTransientTypeName, with:`,
        "\n\tvalue:", value);
  }
}
