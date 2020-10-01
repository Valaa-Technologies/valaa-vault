// @flow

import { qualifiedSymbol } from "~/tools/namespace";

import { getValosheathNamespace, integrateNamespace } from "~/engine/valosheath";

const LensNamespace = require("~/inspire/Lens");
const OnNamespace = require("~/inspire/On");

export default function extendValOSWithInspire (rootScope: Object, hostDescriptors: any) {
  const valosheath = rootScope.valos || (rootScope.Valaa = rootScope.valos = {});

  integrateNamespace(LensNamespace, valosheath, rootScope, hostDescriptors);
  integrateNamespace(OnNamespace, valosheath, rootScope, hostDescriptors);

  const primaryNamespace = getValosheathNamespace(valosheath, "valos");
  Object.getOwnPropertyNames(valosheath.Lens).forEach(lensName => {
    primaryNamespace.addSymbolField(lensName, valosheath.Lens[lensName]);
  });
  for (const deprecatedName of Object.keys(LensNamespace.deprecatedNames)) {
    Object.defineProperty(valosheath, deprecatedName, {
      configurable: false, enumerable: false,
      get () { return qualifiedSymbol("Lens", deprecatedName); },
    });
  }
}
