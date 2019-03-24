// @flow

import createSymbolAliases from "~/engine/valospace/createSymbolAliases";

import injectLensObjects from "./injectLensObjects";

export default function extendValOSWithInspire (scope: Object, hostObjectDescriptors: any) {
  const valos = scope.valos || (scope.Valaa = scope.valos = {});
  valos.Lens = injectLensObjects(valos, scope, hostObjectDescriptors);
  createSymbolAliases(valos, valos.Lens);
}
