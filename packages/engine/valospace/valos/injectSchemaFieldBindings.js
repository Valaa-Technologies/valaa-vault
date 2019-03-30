import { GraphQLObjectType, GraphQLSchema } from "graphql/type";

import getTypeInterfaces from "~/raem/tools/graphql/getTypeInterfaces";

import createSymbolAliases from "~/engine/valospace/createSymbolAliases";
import { addNamespaceField } from "~/engine/valospace/namespace";
import { createHostFunctionDescriptor, createHostSymbolDescriptor }
    from "~/engine/valospace/hostPropertyDescriptors";

import { ValoscriptType } from "~/script";

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
export default function injectSchemaFieldBindings (valos: Object,
    hostObjectDescriptors: Map<any, Object>, schema: GraphQLSchema) {
  const alreadyProcessed = new Set();
  Object.values(valos).forEach(processType);
  addNamespaceField(valos, "valos", "name", valos.Discoverable.nameAlias);
  addNamespaceField(valos, "valos", "prototype", valos.Discoverable.prototypeAlias);
  function processType (hostTypeDescriptor: any) {
    if ((hostTypeDescriptor == null) || !ValoscriptType.isPrototypeOf(hostTypeDescriptor)
        || alreadyProcessed.has(hostTypeDescriptor)) {
      return;
    }
    const typeIntro = schema.getType(hostTypeDescriptor.name);
    if (!typeIntro) {
      throw new Error(`No type introspection found for '${hostTypeDescriptor.name}' in schema`);
    }
    const interfaces = getTypeInterfaces(typeIntro);
    alreadyProcessed.add(hostTypeDescriptor);
    hostTypeDescriptor.interfaces = interfaces.map(interface_ => valos[interface_.name]);
    hostTypeDescriptor.interfaces.forEach(processType);
    // processType(Object.getPrototypeOf(hostTypeDescriptor));

    const typePropertyDescriptors = createTypePropertyDescriptors(hostTypeDescriptor);
    hostObjectDescriptors.set(hostTypeDescriptor, typePropertyDescriptors);
    for (const [fieldName, fieldIntro] of Object.entries(typeIntro.getFields())) {
      addHostFieldSymbolAndDescriptor(hostTypeDescriptor, typeIntro, typePropertyDescriptors,
          fieldName, fieldIntro);
    }
    createSymbolAliases(valos, hostTypeDescriptor);
  }
}

function createTypePropertyDescriptors (hostTypeDescriptor: any) {
  const ret = {};
  for (const [propertyName, builtinProperty] of Object.entries(hostTypeDescriptor)) {
    if (typeof builtinProperty === "function") {
      ret[propertyName] = createHostFunctionDescriptor(builtinProperty);
    }
  }
  return ret;
}

function addHostFieldSymbolAndDescriptor (hostTypeDescriptor: any, typeIntro: GraphQLObjectType,
    typePropertyDescriptors: any, fieldName: string, fieldIntro: Object) {
  if ((fieldName === "name") || hostTypeDescriptor[fieldName]) return;
  for (const interface_ of hostTypeDescriptor.interfaces) {
    if (interface_[fieldName]) return;
  }
  hostTypeDescriptor[fieldName] = Symbol(`${hostTypeDescriptor.name}.${fieldName}`);
  const fieldDescriptorBase: any = Object.create(fieldIntro);
  fieldDescriptorBase.isHostField = true;
  // host fields are only discoverable via the field Symbols in the host type object.
  fieldDescriptorBase.enumerable = false;
  fieldDescriptorBase.configurable = false;
  let resolvedAlias: any = fieldIntro;
  while (resolvedAlias.alias) resolvedAlias = typeIntro.getFields()[resolvedAlias.alias];
  fieldDescriptorBase.kuery = resolvedAlias.fieldName;
  fieldDescriptorBase.persisted = resolvedAlias.isPersisted;
  fieldDescriptorBase.sequence = resolvedAlias.isSequence;
  if (resolvedAlias.isWritable) {
    fieldDescriptorBase.writable = true;
    fieldDescriptorBase.writableFieldName = resolvedAlias.fieldName;
  } else {
    fieldDescriptorBase.writable = false;
  }
  hostTypeDescriptor.hostObjectPrototype[hostTypeDescriptor[fieldName]] = fieldDescriptorBase;
  typePropertyDescriptors[fieldName] = createHostSymbolDescriptor(hostTypeDescriptor[fieldName],
      `a Symbol for accessing host field '${hostTypeDescriptor.name}.${fieldName
        }' via property lookup from a ValOS Resource instance,${
        ""} given the instance implements the host type '${hostTypeDescriptor.name}'`);

  // console.log("injected field symbol", fieldName, "to type", hostTypeDescriptor.name,
  //    ":", hostTypeDescriptor[fieldName]);
}
