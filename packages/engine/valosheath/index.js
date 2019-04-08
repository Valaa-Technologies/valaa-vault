// @flow

import { GraphQLSchema } from "graphql/type";

import extendObject from "~/engine/valosheath/Object";
import extendValos, { OwnerDefaultCouplingTag } from "~/engine/valosheath/valos";
import { PropertyDescriptorsTag, TypeFieldDescriptorsTag, PrototypeFieldDescriptorsTag }
    from "~/engine/valosheath/hostDescriptors";

import globalEcmaScriptBuiltinObjects from "./globalEcmaScriptBuiltinObjects";
import globalValoscriptBuiltinObjects from "./globalValoscriptBuiltinObjects";

export {
  OwnerDefaultCouplingTag, PropertyDescriptorsTag, TypeFieldDescriptorsTag,
  PrototypeFieldDescriptorsTag,
};

export default function extendValosheath (globalScope: Object, hostDescriptors: Map<any, Object>,
    schema?: GraphQLSchema) {
  /**
   * Set the globals
   */
  Object.assign(globalScope, globalEcmaScriptBuiltinObjects);
  Object.assign(globalScope, globalValoscriptBuiltinObjects);

  extendValos(globalScope, hostDescriptors, schema);
  extendObject(globalScope, hostDescriptors, globalScope.valos);
  return globalScope.valos;
}
