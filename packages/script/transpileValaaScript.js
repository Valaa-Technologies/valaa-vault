// @flow

import { module as es2017module, body as es2017body } from "~/script/acorn/es2017";
import ValaaScriptTranspiler from "~/script/acorn/ValaaScriptTranspiler";
import VALSK from "~/script/VALSK";

import { Kuery } from "~/raem/VALK";

const moduleTranspilerLookup = new Map();
const bodyTranspilerLookup = new Map();

export default function transpileValaaScript (expressionText: string, options: Object = {}): Kuery {
  const isModule = options.sourceType === "module";
  const lookup = (isModule ? moduleTranspilerLookup : bodyTranspilerLookup);
  const VALK = options.customVALK || VALSK;
  let transpiler = lookup.get(VALK);
  if (!transpiler) {
    transpiler = new ValaaScriptTranspiler(
        isModule ? es2017module : es2017body,
        { locations: true, allowReturnOutsideFunction: !isModule, VALK, }
    );
    lookup.set(VALK, transpiler);
  }
  return transpiler.transpileKueryFromText(expressionText, options);
}

export function transpileValaaScriptModule (bodyText: string, options: Object = {}) {
  return transpileValaaScript(bodyText, { ...options, sourceType: "module" });
}

export function transpileValaaScriptBody (bodyText: string, options: Object = {}) {
  return transpileValaaScript(bodyText, { ...options, sourceType: "body" });
}
