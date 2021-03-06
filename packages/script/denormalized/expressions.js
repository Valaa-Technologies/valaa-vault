import { qualifiedSymbol } from "~/tools/namespace";

import VALSK, { Kuery, isValOSFunction, toVAKONTag } from "~/script/VALSK";

import { tryHostRef } from "~/raem/VALK/hostReference";

import { isNativeIdentifier, getNativeIdentifierValue } from "./nativeIdentifier";

export const rootScopeSelf = qualifiedSymbol("VALSK", "rootScopeSelf");

export function descriptorExpression (descriptor: Object, propertyName) {
  if (descriptor.value !== undefined) {
    return valueExpression(descriptor.value, propertyName);
  }
  if (!descriptor || descriptor.hasOwnProperty("value")) return null;
  if (!descriptor.get) {
    throw new Error(`Must specify either descriptor.value or descriptor.get${
      ""} when defining valospace property '${propertyName}'`);
  }
  const vakon = isValOSFunction(descriptor.get) ? extractFunctionVAKON(descriptor.get)
      : (descriptor.get instanceof Kuery) ? descriptor.get.toVAKON()
      : undefined;
  if (vakon === undefined) {
    throw new Error(`descriptor.get must be either VAKON kuery or a enliveable function${
      ""} when defining valospace property '${propertyName}'`);
  }
  return { typeName: "KueryExpression", vakon };
}

export function valueExpression (value: any) {
  if (value === undefined) return null;
  if (value instanceof Kuery) return { typeName: "KueryExpression", vakon: value.toVAKON() };
  const reference = tryHostRef(value);
  if (reference) return { typeName: "Identifier", reference };
  const ret = { typeName: "Literal", value };
  return ret;
}

/**
 * Extracts a standalone VAKON from a valoscript function caller thunk.
 * Any identifiers of the captured scope of the original function that
 * are referenced to from inside the function body are lifted and
 * embedded in the resulting VAKON.
 *
 * @export
 * @param {*} caller
 * @returns
 */
export function extractFunctionVAKON (caller: any) {
  if (caller._persistedVAKON === undefined) {
    const lifts = {};
    let vakon = caller[toVAKONTag];
    if (!vakon) {
      throw new Error(`Cannot extract function VAKON from non-valoscript function ${caller.name}`);
    }
    if (Array.isArray(vakon) && Array.isArray(vakon[0])
        && (vakon[0][0] === "§$") && (vakon[0][1] === "this")) {
      vakon = (vakon.length === 2) ? vakon[1] : vakon.slice(1);
    }
    _extractScopeAccesses(vakon, caller._capturedScope, lifts);
    caller._persistedVAKON = !Object.keys(lifts).length
        ? vakon
        : ["§->", VALSK.setScopeValues(lifts).toVAKON(), vakon];
  }
  return caller._persistedVAKON;
}

function _extractScopeAccesses (vakon: any, scope: Object, lifts: Object) {
  if ((typeof vakon !== "object") || (vakon === null)) return;
  if (!Array.isArray(vakon)) {
    for (const value of Object.values(vakon)) _extractScopeAccesses(value, scope, lifts);
    return;
  }
  if (vakon[0] === "§'") return;
  if ((vakon[0] === "§capture") || (vakon[0] === "§evalk")) {
    if (Array.isArray(vakon[1]) && (vakon[1][0] === "§'")) {
      _extractScopeAccesses(vakon[1][1], scope, lifts);
      return;
    }
  } else if ((vakon[0] === "§$$") || (vakon[0] === "§$")) {
    if (typeof vakon[1] !== "string") {
      throw new Error("While persisting function cannot access an identifier with non-string name");
    }
    if (vakon[2] !== undefined) {
      throw new Error("While persisting function cannot have custom scope specified");
    }
    if ((lifts[vakon[1]] === undefined) && (vakon[1] !== "this") && (vakon[1] !== "arguments")) {
      const scopeEntry = scope[vakon[1]];
      const rootScope = scope[rootScopeSelf];
      if (!rootScope || (scopeEntry !== rootScope[vakon[1]])) {
        // Only lift entries which don't belong to rootScope.
        lifts[vakon[1]] = VALSK.toTemplate(
            isNativeIdentifier(scopeEntry) ? getNativeIdentifierValue(scopeEntry) : scopeEntry);
      }
    }
    return;
  }
  for (const step of vakon) _extractScopeAccesses(step, scope, lifts);
}
