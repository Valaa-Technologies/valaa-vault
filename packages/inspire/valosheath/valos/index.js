// @flow

import { getValosheathNamespace } from "~/engine/valosheath/namespace";

import injectLensObjects from "./injectLensObjects";

export default function extendValOSWithInspire (scope: Object, hostDescriptors: any) {
  const valosheath = scope.valos || (scope.Valaa = scope.valos = {});
  valosheath.Lens = injectLensObjects(valosheath, scope, hostDescriptors);
  const primaryNamespace = getValosheathNamespace(valosheath, "valos");
  Object.getOwnPropertyNames(valosheath.Lens).forEach(lensName =>
      primaryNamespace.addSymbolField(lensName, valosheath.Lens[lensName]));
}
