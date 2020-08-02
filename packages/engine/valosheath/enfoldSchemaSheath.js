// @flow

import { GraphQLSchema } from "graphql/type";

import isResourceType from "~/raem/tools/graphql/isResourceType";
import getTypeInterfaces from "~/raem/tools/graphql/getTypeInterfaces";

import {
  ValoscriptNew, valoscriptInterfacePrototype, valoscriptTypePrototype, valoscriptResourcePrototype,
  qualifiedSymbol,
} from "~/script";

import {
  createHostPrototypeFieldDescriptor, createHostFunctionDescriptor, createHostSymbolDescriptor,
  TypeIntroTag, FieldsIntroTag, IsResourceTag,
  PrototypeFieldDescriptorsTag, TypeFieldDescriptorsTag, PropertyDescriptorsTag,
} from "~/engine/valosheath/hostDescriptors";

import { getValosheathNamespace } from "~/engine/valosheath/namespace";

import { dumpObject, wrapError } from "~/tools";

/* eslint-disable prefer-arrow-callback */

export const OwnerDefaultCouplingTag = qualifiedSymbol("Valosheath", "OwnerDefaultCoupling");

export default function enfoldSchemaSheath (scope: Object, valosheath: Object,
    primaryNamespace, hostDescriptors: Object, schema: GraphQLSchema, schemaTypeSheaths: Object) {
  Object.entries(schemaTypeSheaths).forEach(entry => {
    injectTypeSheath(scope, valosheath, primaryNamespace, hostDescriptors,
          schema, schemaTypeSheaths, ...entry);
  });
}

/**
 * Iterates over all ValOS host types and for each, iterates over all
 * the fields of that type found in the given schema and inserts the
 * necessary valoscript introspection objects: field descriptors, field
 * Symbols and type prototype field accessors.
 *
 * @export
 * @param {Object} valos
 * @param {GraphQLSchema} schema
 */
export function injectTypeSheath (scope: Object, valosheath: Object, primaryNamespace,
    hostDescriptors: Map<any, Object>, schema: GraphQLSchema, schemaTypeSheaths,
    typeName, typeSheath) {
  let valospaceType, typeIntro, fieldsIntro;
  try {
    if (!typeSheath) throw new Error(`TypeSheath missing for type name '${typeName}'`);
    if (valosheath[typeName]) return valosheath[typeName];
    typeIntro = schema.getType(typeSheath.schemaTypeName || typeName);
    if (!typeIntro) {
      throw new Error(`No schema type introspection found for type sheath '${
          typeSheath.schemaTypeName || typeName}'`);
    }
    fieldsIntro = typeIntro.getFields();
    valospaceType = _createValospaceType();
    _addOwnSheathSymbolsAndFields();

    valospaceType.interfaces = _prepareSchemaInterfaces();

    Object.entries(fieldsIntro)
        .forEach(_addOwnSchemaFieldSymbolAndDescriptor);

    // Fill properties inherited from interfaces
    [...valospaceType.interfaces].reverse()
        .forEach(_fillPropertiesAndDescriptorsFrom);

    // Fill own properties
    _fillPropertiesAndDescriptorsFrom(valospaceType);

    valosheath[typeName] = valospaceType;
    if (typeSheath.isGlobal) scope[typeName] = valospaceType;
    return valospaceType;
  } catch (error) {
    throw wrapError(error, new Error(`injectTypeSheath(${typeName})`),
        "\n\tschema:", ...dumpObject(schema),
        "\n\tsheathTypes:", ...dumpObject(schemaTypeSheaths),
        "\n\ttypeSheath:", ...dumpObject(typeSheath),
    );
  }

  function _createValospaceType () {
    let ret;
    if (typeSheath.typeFields[ValoscriptNew]) {
      ret = Object.create(valoscriptTypePrototype);
    } else {
      ret = Object.create(valoscriptInterfacePrototype);
    }
    ret.name = typeName;
    ret.prototype = Object.create(valoscriptResourcePrototype);
    ret[TypeIntroTag] = typeIntro;
    ret[FieldsIntroTag] = fieldsIntro;
    ret[IsResourceTag] = (typeName !== "Blob") && isResourceType(typeIntro);
    ret[TypeFieldDescriptorsTag] = {};
    ret[PrototypeFieldDescriptorsTag] = {};
    Object.defineProperty(ret, PropertyDescriptorsTag,
        { configurable: false, enumerable: false, writable: false, value: {} });
    Object.defineProperty(ret.prototype, PropertyDescriptorsTag,
        { configurable: false, enumerable: false, writable: false, value: {} });
    return ret;
  }

  function _addOwnSheathSymbolsAndFields () {
    for (const [symbolName, symbol] of Object.entries(typeSheath.symbols || {})) {
      valospaceType[symbolName] = symbol;
      valospaceType[TypeFieldDescriptorsTag][symbolName] = createHostSymbolDescriptor(symbol,
          `a Symbol for accessing host field '${valospaceType.name}.${symbolName
            }' via property lookup from a ValOS Resource instance,${
            ""} given the instance implements the host type '${valospaceType.name}'`);
      primaryNamespace.addSymbolField(symbolName, symbol);
    }
    for (const [key, prefix] of Object.entries(typeSheath.namespaceAccessors || {})) {
      const accessor = `$${key}`;
      valospaceType[PrototypeFieldDescriptorsTag][accessor] = Object.freeze({
        isHostField: true, enumerable: false, configurable: false,
        accessor, namespace: getValosheathNamespace(valosheath, prefix),
      });
    }
    for (const field of Object.keys(typeSheath.typeFields || {})
        .concat(Object.getOwnPropertySymbols(typeSheath.typeFields || {}))) {
      const typeField = typeSheath.typeFields[field];
      valospaceType[field] = typeField;
      if (typeof typeField === "function") {
        valospaceType[TypeFieldDescriptorsTag][field] = createHostFunctionDescriptor(typeField);
      }
    }
    for (const prototypeField of Object.keys(typeSheath.prototypeFields || {})
        .concat(Object.getOwnPropertySymbols(typeSheath.prototypeFields || {}))) {
      const prototypeFieldValue = typeSheath.prototypeFields[prototypeField];
      valospaceType.prototype[prototypeField] = prototypeFieldValue;
      if (typeof prototypeFieldValue === "function") {
        valospaceType[PrototypeFieldDescriptorsTag][prototypeField] =
            createHostFunctionDescriptor(prototypeFieldValue);
      }
    }
  }

  function _prepareSchemaInterfaces () {
    return getTypeInterfaces(typeIntro).map(intro => {
      const interfaceSheath = schemaTypeSheaths[intro.name];
      return interfaceSheath && injectTypeSheath(scope, valosheath, primaryNamespace,
          hostDescriptors, schema, schemaTypeSheaths, intro.name, interfaceSheath);
    }).filter(notNull => notNull);
  }

  function _addOwnSchemaFieldSymbolAndDescriptor ([fieldName: string, fieldIntro: Object]) {
    const fieldSymbol = qualifiedSymbol(primaryNamespace.preferredPrefix, fieldName);
    if (valospaceType[PrototypeFieldDescriptorsTag][fieldSymbol]) return;

    if (fieldName === "id") {
      if (typeName !== "TransientFields") return;
    } else if ((fieldName !== "name") && (fieldName !== "prototype")) {
      valospaceType[fieldName] = fieldSymbol;
    }
    // console.log("field:", fieldName, String(fieldSymbol), typeName);
    for (const interfaceType of valospaceType.interfaces) {
      const interfaceProtoDescs = interfaceType[PrototypeFieldDescriptorsTag];
      // console.log("interface:", interfaceType.name, (interfaceProtoDescs || {})[fieldSymbol]);
      if (((interfaceProtoDescs || {})[fieldSymbol] || {}).isHostField) {
        return;
      }
    }
    primaryNamespace.addSymbolField(fieldName, fieldSymbol);

    const fieldDescriptorBase: any = { ...fieldIntro };
    fieldDescriptorBase.isHostField = true;
    // host fields are only discoverable via the field Symbols in the host type object.
    fieldDescriptorBase.enumerable = false;
    fieldDescriptorBase.configurable = false;
    let resolvedAlias: any = fieldIntro;
    if (!resolvedAlias.filterTypeName) {
      while (resolvedAlias.alias) resolvedAlias = fieldsIntro[resolvedAlias.alias];
      if (resolvedAlias.isWritable) {
        fieldDescriptorBase.writableFieldName = resolvedAlias.fieldName;
      }
    }
    fieldDescriptorBase.persisted = resolvedAlias.isPersisted;
    fieldDescriptorBase.sequence = resolvedAlias.isSequence;
    fieldDescriptorBase.writable = resolvedAlias.isWritable;
    fieldDescriptorBase.kuery = resolvedAlias.fieldName;

    valospaceType[PrototypeFieldDescriptorsTag][fieldSymbol] =
        createHostPrototypeFieldDescriptor(fieldDescriptorBase);
  }

  function _fillPropertiesAndDescriptorsFrom (sourceType) {
    for (const field of Object.keys(sourceType[TypeFieldDescriptorsTag])
        .concat(Object.getOwnPropertySymbols(sourceType[TypeFieldDescriptorsTag]))) {
      valospaceType[field] = sourceType[field];
      valospaceType[PropertyDescriptorsTag][field] = sourceType[TypeFieldDescriptorsTag][field];
    }
    if (valospaceType.prototype) {
      for (const prototypeField of Object.keys(sourceType[PrototypeFieldDescriptorsTag])
          .concat(Object.getOwnPropertySymbols(sourceType[PrototypeFieldDescriptorsTag]))) {
        valospaceType.prototype[prototypeField] = sourceType.prototype[prototypeField];
        valospaceType.prototype[PropertyDescriptorsTag][prototypeField] =
            sourceType[PrototypeFieldDescriptorsTag][prototypeField];
      }
    }
  }
}
