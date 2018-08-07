// @flow

import { isSymbol } from "~/tools";

import { addNamespaceField } from "~/engine/ValaaSpace/namespace";

export default function createSymbolAliases (targetScope: Object, sourceScope: any) {
  Object.getOwnPropertyNames(sourceScope).forEach(name => {
    const symbol = sourceScope[name];
    if (isSymbol(symbol)) {
      if (typeof targetScope[name] === "undefined") {
        addNamespaceField(targetScope, "valos", name, symbol);
      } else {
        console.warn(`Cannot create a symbol alias Valaa.${name} to ${
            sourceScope.name}.${name}`, "with symbol value", String(symbol),
            `because targetScope.${name} already exists with value:`, targetScope[name]);
      }
    }
  });
}
