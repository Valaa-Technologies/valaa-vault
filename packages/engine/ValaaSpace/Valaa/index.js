// @flow

import { ValaaPrimitiveTag } from "~/script";
import { toVAKON } from "~/script/VALSK";

import { beaumpify } from "~/tools";

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
  if (schema) injectSchemaFieldBindings(Valaa, hostObjectDescriptors, schema);
  return Valaa;
}
