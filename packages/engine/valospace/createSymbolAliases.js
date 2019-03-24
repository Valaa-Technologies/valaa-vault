// @flow

import { isSymbol } from "~/tools";

import { addNamespaceField } from "~/engine/valospace/namespace";

export default function createSymbolAliases (targetScope: Object, sourceScope: any) {
  Object.getOwnPropertyNames(sourceScope).forEach(name => {
    const symbol = sourceScope[name];
    if (isSymbol(symbol)) {
      if (targetScope[name] === undefined) {
        addNamespaceField(targetScope, "valos", name, symbol);
      } else {
        console.warn(`Cannot create a symbol alias valos.${name} to ${
            sourceScope.name}.${name}`, "with symbol value", String(symbol),
            `because targetScope.${name} already exists with value:`, targetScope[name]);
      }
    }
  });
}
