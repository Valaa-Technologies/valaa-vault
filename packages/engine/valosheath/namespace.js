// @flow

import { HostRef, UnpackedHostValue } from "~/raem/VALK/hostReference";
import Transient from "~/raem/state/Transient";


// import debugId from "~/engine/debugId";
import { Valker } from "~/engine/VALEK";
import type Vrapper from "~/engine/Vrapper";

import { isSymbol } from "~/tools";

export const NamespaceInterfaceTag = Symbol("NamespaceInterface");
export const AccessorNameTag = Symbol("NamespaceAccessor");

export function getValosheathNamespace (valosheath, namespaceName) {
  return valosheath[`$${namespaceName}Namespace`];
}

export function addValosheathNamespace (valosheath, valosheathName: string, descriptor) {
  const valosheathKey = `$${valosheathName}Namespace`;
  if (valosheath[valosheathKey]) {
    throw new Error(`Valosheath namespace alias '${valosheathName}' already exists to <${
        valosheath[valosheathKey].namespaceURI}>`);
  }
  const proxyPrototypeFields = {
    tryTypeName () { return this[UnpackedHostValue].tryTypeName(); },
    getVALKMethod (methodName: string, valker: Valker, transient: Transient, scope: Object) {
      return this[UnpackedHostValue].getVALKMethod(methodName, valker, transient, scope, this);
    },
  };
  // V: "@valos"

  const namespaceInterface = proxyPrototypeFields[NamespaceInterfaceTag] = {
    valosheathName,
    valosheathKey,
    ...descriptor, // prefix, namespaceURI
    addSymbolField (fieldName: string, symbol: ?Symbol) {
      if (!isSymbol(symbol)) return;
      if (valosheath[fieldName] !== undefined) {
        throw new Error(
            `Can't create valosheath symbol alias valos.${fieldName} to <${String(symbol)
            }> as an existing symbol alias already exists to <${String(valosheath[fieldName])}>`);
      }
      valosheath[fieldName] = symbol; // Top-level symbol shortcut
      proxyPrototypeFields[fieldName] = symbol;
          /*
      Object.defineProperty(this, aliasName, {
        get () {
          console.warn(`host namespace prototype field '${aliasName
              }' access not implemented in non-VALK contexts`, this);
          return undefined;
          const hostField = this[symbol];
          if (hostField === undefined) {
            throw new Error(`${debugId(this, { brief: true })} does not implement host field '${
                name}`);
          }
          return (typeof hostField !== "function")
              ? hostField
              : hostField.bind(this);
        },
      });
          */
    },
    createProxyTo (vResource: Vrapper, accessor: string) {
      const ret = Object.create(proxyPrototypeFields);
      ret[HostRef] = vResource.getId();
      ret[UnpackedHostValue] = vResource;
      ret[AccessorNameTag] = accessor;
      return ret;
    },
  };
  return (valosheath[valosheathKey] = namespaceInterface);
}

export function tryNamespaceFieldSymbolOrPropertyName (container, fieldName) {
  const namespaceInterface = container[NamespaceInterfaceTag];
  if (!namespaceInterface) return fieldName;
  const symbol = container[fieldName];
  if (symbol) return symbol;
  throw new Error(`Namespace property ${container[AccessorNameTag]}.${fieldName
      } not defined by namespace <${namespaceInterface.namespaceURI}>`);
}
