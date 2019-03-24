// @flow

import { ValOSPrimitiveTag } from "~/script";
import { toVAKON } from "~/script/VALSK";

import { beaumpify, isSymbol } from "~/tools";

import injectSchemaFieldBindings from "./injectSchemaFieldBindings";
import injectSchemaTypeBindings from "./injectSchemaTypeBindings";

/*
 * Creates the ValOS introspection object.
 */
export default function extendValOS (scope: any, hostObjectDescriptors: any, schema: any) {
  const valos = Object.assign(scope.valos || (scope.Valaa = scope.valos = {}), {
    beautify: beaumpify,
    toVAKON,
    Primitive: ValOSPrimitiveTag,
    Lens: null,
  });
  injectSchemaTypeBindings(valos, scope);
  if (schema) {
    injectSchemaFieldBindings(valos, hostObjectDescriptors, schema);
    for (const key of Object.keys(valos.Partition)) {
      // Entity=>Partition multiple interface inheritance hardcode. Generalize when needed or get
      // rid of multiple interface inheritance for good.
      if (isSymbol(valos.Partition[key])) {
        const field = valos.Partition.hostObjectPrototype[valos.Partition[key]];
        if (field) valos.Entity.hostObjectPrototype[valos.Partition[key]] = field;
      }
    }
  }
  return valos;
}
