// @flow

import { transpileValoscript, isNativeIdentifier, getNativeIdentifierValue } from "~/script";
import { dumpObject as _dumpObject, Kuery, ValoscriptKuery, isValOSFunction, toVAKONTag }
    from "~/script/VALSK";

import Vrapper from "~/engine/Vrapper";

import { tryHostRef } from "~/raem/VALK/hostReference";

import { debugObjectType, inBrowser, wrapError } from "~/tools";
import trivialClone from "~/tools/trivialClone";

import EngineKuery, { IsLiveTag, pointer, literal } from "./EngineKuery";


const VALEK = new EngineKuery();
export default VALEK;

export {
  Kuery,
  EngineKuery,
  IsLiveTag,
  pointer,
  literal,
  ValoscriptKuery,
};

export {
  Valker,
  run,
  dumpScope,
  dumpKuery,
  isValOSFunction,
  toVAKONTag,
} from "~/script/VALSK";

export { default as engineSteppers } from "./engineSteppers";

export function dumpObject (value: mixed) {
  if (!inBrowser() && (value instanceof Vrapper)) return [value.debugId()];
  return _dumpObject(value);
}

export const rootScopeSelf = Symbol("rootScope.self");

export function kueryExpression (kuery: Kuery | any) {
  return {
    typeName: "KueryExpression",
    vakon: (kuery instanceof Kuery) ? kuery.toVAKON() : kuery,
  };
}

// TODO(iridian): Having an Expression to be the type of the the property value
// seems like a worse choice by the day. Biggest issue of all is that for Data pointers
// there is no referential integrity yet. We can't avoid the setField, but we could
// avoid toExpressionKuery and the typeof/Resource-condition below
export function expressionFromProperty (value: any, property: any, descriptor: ?Object) {
  if (value === undefined) {
    if (!descriptor || descriptor.hasOwnProperty("value")) return null;
    if (!descriptor.get) {
      throw new Error(`Must specify either descriptor.value or descriptor.get${
        ""} when defining valospace property '${String(property)}'`);
    }
    const vakon = isValOSFunction(descriptor.get) ? extractFunctionVAKON(descriptor.get)
        : (descriptor.get instanceof Kuery) ? descriptor.get.toVAKON()
        : undefined;
    if (vakon === undefined) {
      throw new Error(`descriptor.get must be either VAKON kuery or a liveable function${
        ""} when defining valospace property '${String(property)}'`);
    }
    return { typeName: "KueryExpression", vakon };
  }
  if (value instanceof Kuery) {
    return { typeName: "KueryExpression", vakon: value.toVAKON() };
  }
  const ref = tryHostRef(value);
  if (ref) {
    return { typeName: "Identifier", reference: ref.toJSON() };
  }
  const ret = {
    typeName: "Literal",
    value: trivialClone(value, (clonee, key, object, cloneeDescriptor, recurseClone) => {
      if (typeof clonee === "function") {
        if (!isValOSFunction(clonee)) {
          throw new Error(`While universalizing into valospace resource property '${
              String(property)}' encountered a non-valospace function at sub-property ${key}': ${
                clonee.name}`);
        }
        return ["§capture", ["§'", extractFunctionVAKON(clonee)], undefined, "literal"];
      }
      /*
      if (cloneeDescriptor && (typeof cloneeDescriptor.get === "function")) {
        if (!isValOSFunction(cloneeDescriptor.get)) {
          throw new Error(`While universalizing into valospace resource property '${
              String(property)}' encountered a non-valospace getter for sub-property ${key}': ${
                cloneeDescriptor.get.name}`);
        }
        cloneeDescriptor.enumerable = true;
        cloneeDescriptor.configurable = true;
        // This doesn't work because the kuery property vakon gets
        // evaluated when the property is read. Instead the construct
        // should introduce a getter to the object that is currently
        // being constructed. But there's no support for that yet.
        return extractFunctionVAKON(cloneeDescriptor.get);
      }
      */
      if ((clonee == null) || (typeof clonee !== "object")) return clonee;
      if (Array.isArray(clonee)) {
        const ret_ = clonee.map(recurseClone);
        if ((typeof ret_[0] === "string") && ret_[0][0] === "§") ret_[0] = ["§'", ret_[0]];
        return ret_;
      }
      if (Object.getPrototypeOf(clonee) === Object.prototype) return undefined;
      if (clonee instanceof Kuery) return clonee.toVAKON();
      const cloneeRef = tryHostRef(clonee);
      if (cloneeRef) return ["§vrl", cloneeRef.toJSON()];
      throw new Error(`Cannot universalize non-trivial value ${debugObjectType(value)}`);
    }),
  };
  return ret;
}

/**
 * Template literal tag which transpiles the given string into a ValOS Kuery.
 *
 * @export
 * @param {string[]} scripts
 * @param {...any[]} variables
 * @returns {Kuery}
 */
export function VS (texts: string[], ...variables: any[]): Kuery {
  let source = "";
  let i = 0;
  try {
    for (; i !== texts.length; ++i) {
      source += texts[i];
      if (i < variables.length) {
        source += String(variables[i]);
      }
    }
    const sourceInfo = {
      phase: "VS-string transpilation",
      source,
      mediaName: undefined,
      sourceMap: new Map(),
    };
    return transpileValoscript(source, VALEK, { sourceInfo, sourceType: "body" });
  } catch (error) {
    throw wrapError(error, `During VS literal tag, with:`,
        "\n\ttexts:", ...texts,
        "\n\tvariables:", ...variables,
        "\n\titeration:", i,
        "\n\tsource:", source);
  }
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
        : ["§->", VALEK.setScopeValues(lifts).toVAKON(), vakon];
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
        lifts[vakon[1]] = VALEK.toTemplate(
            isNativeIdentifier(scopeEntry) ? getNativeIdentifierValue(scopeEntry) : scopeEntry);
      }
    }
    return;
  }
  for (const step of vakon) _extractScopeAccesses(step, scope, lifts);
}
