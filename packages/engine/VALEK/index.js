// @flow

import { transpileValoscript } from "~/script";
import { dumpObject as _dumpObject, Kuery, ValoscriptKuery } from "~/script/VALSK";

import Vrapper from "~/engine/Vrapper";

import { inBrowser, wrapError } from "~/tools";

import EngineKuery, { VALEK, IsLiveTag } from "./EngineKuery";

export default VALEK;

export {
  Kuery,
  EngineKuery,
  IsLiveTag,
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
