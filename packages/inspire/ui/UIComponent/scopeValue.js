// @flow

import Vrapper from "~/engine/Vrapper";
import { createNativeIdentifier, isNativeIdentifier, getNativeIdentifierValue }
    from "~/script";

export function getScopeValue (scope: Object, name: string | Symbol) {
  if (typeof scope === "undefined") return undefined;
  const value = scope[name];
  return isNativeIdentifier(value) ? getNativeIdentifierValue(value) : value;
}

export function setScopeValue (scope: Object, name: string | Symbol, value: any) {
  scope[name] = (value instanceof Vrapper) && (value.tryTypeName() === "Property")
      ? createNativeIdentifier(value)
      : value;
}

export function clearScopeValue (scope: Object, name: string | Symbol) {
  if (!scope.hasOwnProperty(name)) return false;
  delete scope[name];
  return true;
}
