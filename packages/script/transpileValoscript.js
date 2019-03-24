// @flow

import { module as es2017module, body as es2017body } from "~/script/acorn/es2017";
import ValoscriptTranspiler from "~/script/acorn/ValoscriptTranspiler";
import VALSK from "~/script/VALSK";

import { Kuery } from "~/raem/VALK";

const moduleTranspilerLookup = new Map();
const bodyTranspilerLookup = new Map();

export default function transpileValoscript (expressionText: string, options: Object = {}): Kuery {
  const isModule = options.sourceType === "module";
  const lookup = (isModule ? moduleTranspilerLookup : bodyTranspilerLookup);
  const VALK = options.customVALK || VALSK;
  let transpiler = lookup.get(VALK);
  if (!transpiler) {
    transpiler = new ValoscriptTranspiler(
        isModule ? es2017module : es2017body,
        { locations: true, allowReturnOutsideFunction: !isModule, VALK, }
    );
    lookup.set(VALK, transpiler);
  }
  return transpiler.transpileKueryFromText(expressionText, options);
}

export function transpileValoscriptModule (bodyText: string, options: Object = {}) {
  return transpileValoscript(bodyText, { ...options, sourceType: "module" });
}

export function transpileValoscriptBody (bodyText: string, options: Object = {}) {
  return transpileValoscript(bodyText, { ...options, sourceType: "body" });
}
