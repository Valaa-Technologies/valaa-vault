// $flow

/*
 * Note on semantics:
 * 'native' in ValaaScript context has the corresponding semantics to
 * javascript 'native'. It refers to objects which are self-contained
 * in the execution context and can't be directly used to manipulate
 * data outside it. Conversely 'host' refers to objects and operations
 * which can access and/or modify such host and external data. Two most
 * prominent ValaaScript host object categories are Valaa resource
 * proxies (used to manipulate ValaaSpace content) and engine execution
 * context objects (used to access environment like javascript global
 * scope, DOM, execution engine builtin operations, etc.)
 */

export function createHostPrototypeFieldDescriptor (field: Object) {
  return Object.freeze({
    writable: field.writable, enumerable: field.enumerable, configurable: field.configurable,
    valaa: true, host: true, field: true, description: field.description,
    namespace: field.namespace, persisted: field.persisted,
  });
}

export function createHostMaterializedFieldDescriptor (value: any, field: Object, removes?: any) {
  const ret = {
    value,
    writable: field.writable, enumerable: field.enumerable, configurable: field.configurable,
    valaa: true, host: true, field: true, description: field.description,
    persisted: field.persisted,
    ...(removes ? { removes } : {}),
  };
  if (removes) ret.removes = removes;
  return Object.freeze(ret);
}

export function createHostPropertyDescriptor (value: any, description: ?string) {
  return Object.freeze({
    value,
    writable: true, enumerable: true, configurable: true,
    valaa: true, host: true, property: true, description, persisted: true,
  });
}

export function createHostSymbolDescriptor (value: any, description: string) {
  return Object.freeze({
    value,
    writable: false, enumerable: true, configurable: false,
    valaa: true, host: true, symbol: true, description,
  });
}

export function createHostFunctionDescriptor (value: any) {
  return Object.freeze({
    value,
    writable: false, enumerable: true, configurable: false,
    valaa: true, host: true, function: true, description: value._valkDescription,
  });
}
