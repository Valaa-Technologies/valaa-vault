// @flow

import { HostRef, UnpackedHostValue } from "~/raem/VALK/hostReference";
import Transient from "~/raem/state/Transient";
import { qualifiedSymbol, deprecateSymbolInFavorOf } from "~/raem/tools/namespaceSymbols";

// import debugId from "~/engine/debugId";
import { Valker } from "~/engine/VALEK";
import type Vrapper from "~/engine/Vrapper";

import { isSymbol } from "~/tools";

export type NameDefinition = {
  tags: string[],
  description: string,
  type: string,
  value: any,
  defaultValue: any,
};

export type Namespace = {
  preferredPrefix: string,
  namespaceURI: string,
  description: string,
  nameSymbols: { [name: string | Symbol]: Symbol | string },
  nameDefinitions: { [name: string]: NameDefinition },
};

export function defineName (name: string, namespace: Namespace,
    createNameParameters: Object, commonNameParameters: Object = {}) {
  namespace.nameDefinitions[name] = () => ({
    ...createNameParameters(),
    ...commonNameParameters,
  });
  const symbol = namespace.nameSymbols[name] = qualifiedSymbol(namespace.preferredPrefix, name);
  namespace.nameSymbols[symbol] = name; // Symbol -> name reverse lookup
  return namespace.nameSymbols[name];
}

export function integrateNamespace (
    namespace: Namespace, rootScope: Object, hostDescriptors: Object) {
  const {
    preferredPrefix, namespaceURI, description,
    nameSymbols, nameDefinitions, deprecatedNames,
  } = namespace;
  const names = {};
  rootScope[`$${preferredPrefix}`] = nameSymbols;
  hostDescriptors.set(nameSymbols, {
    writable: false, enumerable: true, configurable: false,
    valos: true, namespace: true, description, preferredPrefix, namespaceURI,
    names,
  });
  for (const [nameSuffix, createDefinition] of Object.entries(nameDefinitions)) {
    const { value, defaultValue, ...rest } = createDefinition();
    const entryDescriptor = names[nameSuffix] = Object.freeze({
      writable: false, enumerable: true, configurable: false,
      valos: true, symbol: true,
      uri: `${namespaceURI}${nameSuffix}`,
      value, defaultValue,
      ...rest,
    });
    if (defaultValue || value) {
      rootScope[nameSymbols[nameSuffix]] = Object.freeze(defaultValue || value);
    }
    hostDescriptors.set(nameSymbols[nameSuffix], entryDescriptor);
  }
  for (const [deprecatedName, inFavorOfName] of Object.entries(deprecatedNames || {})) {
    const favoredSymbol = qualifiedSymbol(preferredPrefix, inFavorOfName);
    deprecateSymbolInFavorOf(preferredPrefix, deprecatedName, favoredSymbol);
  }
  return nameSymbols;
}

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
      ret[HostRef] = vResource.getVRef();
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
