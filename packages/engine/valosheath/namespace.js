// @flow

import { HostRef, UnpackedHostValue } from "~/raem/VALK/hostReference";
import Transient from "~/raem/state/Transient";


// import debugId from "~/engine/debugId";
import { Valker } from "~/engine/VALEK";
import type Vrapper from "~/engine/Vrapper";

import { isSymbol } from "~/tools";

export function addNamespaceField (target: Object, namespaceName: string, fieldName: string,
    fieldSymbol: Symbol) {
  target[fieldName] = fieldSymbol; // Top-level symbol shortcut
  const namespaceKey = `$${namespaceName}Namespace`;
  const namespace = (target[namespaceKey]
      || (target[namespaceKey] = createHostNamespace(namespaceName)));
  namespace._addProxyPrototypeFieldShortcut(fieldName, fieldSymbol);
}

export function addNamespaceFieldAlias (target: Object,
    namespaceName: string, name: string, symbol: ?Symbol) {
  if (!isSymbol(symbol)) return;
  if (target[name] === undefined) {
    addNamespaceField(target, namespaceName, name, symbol);
  } else {
    throw new Error(`Cannot create a symbol alias from valos.${name} for ${String(symbol)
      } because targetScope.${name} already exists with value: ${String(target[name])}`);
  }
}

export const NamespaceInterfaceTag = Symbol("NamespaceInterfaceTag");

export function createHostNamespace (name: string) {
  const namespace = {
    name,
    _createProxy (vrapper: Vrapper) {
      const ret = Object.create(this._namespaceFields);
      ret[HostRef] = vrapper.getId();
      ret[UnpackedHostValue] = vrapper;
      return ret;
    },

    _addProxyPrototypeFieldShortcut (fieldName: string, fieldSymbol: Symbol) {
      this._namespaceFields[fieldName] = fieldSymbol;
      Object.defineProperty(this, fieldName, { get () {
        console.warn(`host namespace prototype field '${fieldName
            }' access not implemented in non-VALK contexts`, this);
        return undefined;
        /*
        const hostField = this[symbol];
        if (hostField === undefined) {
          throw new Error(`${debugId(this, { brief: true })} does not implement host field '${
              name}`);
        }
        return (typeof hostField !== "function")
            ? hostField
            : hostField.bind(this);
        */
      } });
    },
  };
  namespace._namespaceFields = {
    [NamespaceInterfaceTag]: namespace,
    tryTypeName () { return this[UnpackedHostValue].tryTypeName(); },
    getVALKMethod (methodName: string, valker: Valker, transient: Transient, scope: Object) {
      return this[UnpackedHostValue].getVALKMethod(methodName, valker, transient, scope, this);
    },
  };
  return namespace;
}
