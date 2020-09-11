// @flow

import { HostRef, UnpackedHostValue } from "~/raem/VALK/hostReference";
import Transient from "~/raem/state/Transient";
import {
  qualifiedNamesOf, qualifiedSymbol, deprecateSymbolInFavorOf,
} from "~/raem/tools/namespaceSymbols";

// import debugId from "~/engine/debugId";
import { Valker } from "~/engine/VALEK";
import type Vrapper from "~/engine/Vrapper";

import { dumpify, isSymbol } from "~/tools";

export type NameDefinition = {
  tags: string[],
  description: string,
  type: string,
  value: any,
  defaultValue: any,
};

export type Namespace = {
  preferredPrefix: string,
  baseIRI: string,
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
    preferredPrefix, baseIRI, description,
    nameSymbols, nameDefinitions, deprecatedNames,
  } = namespace;
  const names = {};
  rootScope[`$${preferredPrefix}`] = nameSymbols;
  hostDescriptors.set(nameSymbols, {
    writable: false, enumerable: true, configurable: false,
    valos: true, namespace: true, description, preferredPrefix, baseIRI,
    names,
  });
  for (const [nameSuffix, createDefinition] of Object.entries(nameDefinitions)) {
    const { value, defaultValue, ...rest } = createDefinition();
    const entryDescriptor = names[nameSuffix] = Object.freeze({
      writable: false, enumerable: true, configurable: false,
      valos: true, symbol: true,
      uri: `${baseIRI}${nameSuffix}`,
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

export function buildOntologyNamespace (
    namespace: Namespace, processTags, initialDefinitions: Object) {
      initialDefinitions.ontology = { "@type": "owl:Ontology",
    "rdfs:label": namespace.preferredPrefix,
    "rdf:about": namespace.baseIRI,
    "rdfs:comment": namespace.description,
  };

  for (const [name, createParameters] of Object.entries(namespace.nameDefinitions)) {
    const { tags, type, description, value, defaultValue } = createParameters();
    const termDefinition = { "@type": "VEngine:Property", tags };
    if (value !== undefined) termDefinition.value = _valueText(value);
    if (defaultValue !== undefined) termDefinition.defaultValue = _valueText(defaultValue);
    function _addLabel (label, indexLabel) {
      (termDefinition["rdfs:label"] || (termDefinition["rdfs:label"] = []))
          .push(label);
      if (indexLabel) {
        (termDefinition["VRevdoc:indexLabel"] || (termDefinition["VRevdoc:indexLabel"] = []))
            .push(indexLabel);
      }
    }
    const domain = [];
    if (tags) {
      termDefinition.tags = tags;
      if (processTags) {
        for (const [label, indexLabel] of (processTags(name, tags, domain) || [])) {
          _addLabel(label, indexLabel);
        }
      }
    }
    termDefinition["rdfs:domain"] = !domain.length ? "rdfs:Resource"
        : (domain.length === 1) ? domain[0]
        : domain;
    const range = [];
    if (type) {
      if (type.includes("number")) range.push("xsd:integer");
      if (type.includes("boolean")) range.push("xsd:boolean");
      if (type.includes("string")) range.push("xsd:string");
    }
    termDefinition["rdfs:range"] = !range.length ? "rdfs:Resource"
        : (range.length === 1) ? range[0]
        : range;
    if (description) {
      if (!Array.isArray(description)) {
        termDefinition["rdfs:comment"] = description;
      } else {
        termDefinition["rdfs:comment"] = description[0];
        termDefinition["VRevdoc:introduction"] = description.slice(1);
      }
    }
    initialDefinitions[name] = termDefinition;
  }

  return initialDefinitions;

  function _valueText (value) {
    if ((value == null) || (typeof value !== "object")) {
      const qualifiedNames = qualifiedNamesOf(value);
      if (qualifiedNames) return qualifiedNames[2];
      return dumpify(value);
    }
    if (Array.isArray(value)) return `[${value.map(_valueText).join(", ")}]`;
    if (value.delegate) return _valueText(value.delegate);
    return `<${(value.constructor || "").name || "Object"}>`;
  }
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
        valosheath[valosheathKey].baseIRI}>`);
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
    ...descriptor, // preferredPrefix, baseIRI
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
      } not defined by namespace <${namespaceInterface.baseIRI}>`);
}
