// @flow

import { ValaaPrimitiveTag } from "~/script";
import { toVAKON } from "~/script/VALSK";

import { beaumpify, isSymbol } from "~/tools";

import injectSchemaFieldBindings from "./injectSchemaFieldBindings";
import injectSchemaTypeBindings from "./injectSchemaTypeBindings";

/*
 * Creates the Valaa introspection object.
**/
export default function extendValaa (scope: any, hostObjectDescriptors: any, schema: any) {
  const Valaa = Object.assign(scope.Valaa || (scope.Valaa = {}), {
    beautify: beaumpify,
    toVAKON,
    Primitive: ValaaPrimitiveTag,
    Lens: null,
  });
  injectSchemaTypeBindings(Valaa, scope);
  if (schema) {
    injectSchemaFieldBindings(Valaa, hostObjectDescriptors, schema);
    for (const key of Object.keys(Valaa.Partition)) {
      // Entity=>Partition multiple interface inheritance hardcode. Generalize when needed or get
      // rid of multiple interface inheritance for good.
      if (isSymbol(Valaa.Partition[key])) {
        const field = Valaa.Partition.hostObjectPrototype[Valaa.Partition[key]];
        if (field) Valaa.Entity.hostObjectPrototype[Valaa.Partition[key]] = field;
      }
    }
  }
  return Valaa;
}
