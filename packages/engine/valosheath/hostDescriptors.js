// $flow

import { qualifiedSymbol } from "~/script";


/*
 * Note on semantics:
 * 'native' in valoscript context has the corresponding semantics to
 * javascript 'native'. It refers to objects which are self-contained
 * in the execution context and can't be directly used to manipulate
 * data outside it. Conversely 'host' refers to objects and operations
 * which can access and/or modify such host and external data. Two most
 * prominent valoscript host object categories are ValOS resource
 * proxies (used to manipulate ValoSpace content) and engine execution
 * context objects (used to access environment like javascript global
 * scope, DOM, execution engine builtin operations, etc.)
 */

export const PropertyDescriptorsTag = qualifiedSymbol("Valosheath", "PropertyDescriptors");
export const TypeFieldDescriptorsTag = qualifiedSymbol("Valosheath", "TypeFieldDescriptors");
export const PrototypeFieldDescriptorsTag =
    qualifiedSymbol("Valosheath", "PrototypeFieldDescriptors");

export function createHostPrototypeFieldDescriptor (field: Object) {
  return Object.freeze({
    ...field,
    // writable: field.writable, enumerable: field.enumerable, configurable: field.configurable,
    valos: true, host: true, field: true,
    // description: field.description, namespace: field.namespace, persisted: field.persisted,
  });
}

export function createHostMaterializedFieldDescriptor (value: any, field: Object, removes?: any) {
  const ret = {
    value,
    writable: field.writable, enumerable: field.enumerable, configurable: field.configurable,
    valos: true, host: true, field: true,
    description: field.description, persisted: field.persisted, ...(removes ? { removes } : {}),
  };
  if (removes) ret.removes = removes;
  return Object.freeze(ret);
}

export function createHostPropertyDescriptor (value: any, description: ?string) {
  return Object.freeze({
    value,
    writable: true, enumerable: true, configurable: true,
    valos: true, host: true, property: true, description, persisted: true,
  });
}

export function createHostSymbolDescriptor (value: any, description: string) {
  return Object.freeze({
    value,
    writable: false, enumerable: true, configurable: false,
    valos: true, host: true, symbol: true, description,
  });
}

export function createHostFunctionDescriptor (value: any) {
  return Object.freeze({
    value,
    writable: false, enumerable: true, configurable: false,
    valos: true, host: true, function: true, description: value._valkDescription,
  });
}
