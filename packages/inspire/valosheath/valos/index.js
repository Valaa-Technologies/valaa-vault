// @flow

import { addNamespaceFieldAlias } from "~/engine/valosheath/namespace";

import injectLensObjects from "./injectLensObjects";

export default function extendValOSWithInspire (scope: Object, hostDescriptors: any) {
  const valos = scope.valos || (scope.Valaa = scope.valos = {});
  valos.Lens = injectLensObjects(valos, scope, hostDescriptors);
  Object.getOwnPropertyNames(valos.Lens).forEach(lensName =>
      addNamespaceFieldAlias(valos, "valos", lensName, valos.Lens[lensName]));
}
