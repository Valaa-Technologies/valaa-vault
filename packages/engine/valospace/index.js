// @flow

import { GraphQLSchema } from "graphql/type";

import extendObject from "~/engine/valospace/Object";
import extendValos from "~/engine/valospace/valos";

import globalEcmaScriptBuiltinObjects from "./globalEcmaScriptBuiltinObjects";
import globalValoscriptBuiltinObjects from "./globalValoscriptBuiltinObjects";

export default function extendValospace (globalScope: Object,
    hostObjectDescriptors: Map<any, Object>, schema?: GraphQLSchema) {
  /**
   * Set the globals
   */
  Object.assign(globalScope, globalEcmaScriptBuiltinObjects);
  Object.assign(globalScope, globalValoscriptBuiltinObjects);

  extendValos(globalScope, hostObjectDescriptors, schema);
  extendObject(globalScope, hostObjectDescriptors, globalScope.valos);
  return globalScope.valos;
}
