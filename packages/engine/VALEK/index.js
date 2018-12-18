// @flow
import ValaaReference from "~/raem/ValaaReference";

import { transpileValaaScript, isNativeIdentifier, getNativeIdentifierValue } from "~/script";
import { dumpObject as _dumpObject, Kuery, ValaaScriptKuery, isValaaFunction, toVAKON }
    from "~/script/VALSK";

import Vrapper from "~/engine/Vrapper";

import { debugObjectType, inBrowser, wrapError } from "~/tools";

import EngineKuery, { pointer, literal } from "./EngineKuery";


const VALEK = new EngineKuery();
export default VALEK;

export {
  Kuery,
  EngineKuery,
  pointer,
  literal,
  ValaaScriptKuery,
};

export {
  Valker,
  kueryHash,
  run,
  VALKOptions,
  dumpScope,
  dumpKuery,
  isValaaFunction,
  toVAKON,
} from "~/script/VALSK";

export { default as builtinSteppers } from "./builtinSteppers";

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
export function expressionFromValue (value: any) {
  if (value === undefined) return null;
  if (typeof value === "object"
      && ((value instanceof Vrapper) || (value instanceof ValaaReference))) {
    return pointer(value);
  }
  return literal(value);
}

export function expressionFromOperation (operation: any) {
  if (typeof operation !== "function") return { typeName: "KueryExpression", vakon: operation };
  if (isValaaFunction(operation)) {
    return { typeName: "KueryExpression", vakon: extractFunctionVAKON(operation) };
  }
  return undefined;
}

/**
 * Template literal tag which transpiles the given string into a Valaa Kuery.
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
    return transpileValaaScript(source, VALEK, { sourceInfo, sourceType: "body" });
  } catch (error) {
    throw wrapError(error, `During VS literal tag, with:`,
        "\n\ttexts:", ...texts,
        "\n\tvariables:", ...variables,
        "\n\titeration:", i,
        "\n\tsource:", source);
  }
}

/**
 * Extracts a standalone VAKON from a ValaaScript function caller thunk.
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
    let vakon = caller[toVAKON];
    if (!vakon) {
      throw new Error(`Cannot extract function VAKON from non-valaascript function ${caller.name}`);
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
