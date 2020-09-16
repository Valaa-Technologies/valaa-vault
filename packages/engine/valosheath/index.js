// @flow

import extendObject from "~/engine/valosheath/Object";
import extendValos, { OwnerDefaultCouplingTag } from "~/engine/valosheath/valos";
import {
  TypeIntroTag, FieldsIntroTag, IsResourceTag,
  PropertyDescriptorsTag, TypeFieldDescriptorsTag, PrototypeFieldDescriptorsTag,
} from "~/engine/valosheath/hostDescriptors";
import type { NameDefinition } from "~/engine/valosheath/namespace";
import {
  defineName, defineValosheathNamespace, integrateNamespace, getValosheathNamespace,
} from "~/engine/valosheath/namespace";
import type { Discourse } from "~/sourcerer/api/types";

import globalEcmaScriptBuiltinObjects from "./globalEcmaScriptBuiltinObjects";
import globalValoscriptBuiltinObjects from "./globalValoscriptBuiltinObjects";

export {
  OwnerDefaultCouplingTag, TypeIntroTag, FieldsIntroTag, IsResourceTag,
  PropertyDescriptorsTag, TypeFieldDescriptorsTag, PrototypeFieldDescriptorsTag,
  defineName, defineValosheathNamespace, integrateNamespace, getValosheathNamespace,
};
export type { NameDefinition };

export default function extendValosheath (globalScope: Object, hostDescriptors: Map<any, Object>,
    rootDiscourse: Discourse) {
  /**
   * Set the globals
   */
  Object.assign(globalScope, globalEcmaScriptBuiltinObjects);
  Object.assign(globalScope, globalValoscriptBuiltinObjects);

  extendValos(globalScope, hostDescriptors, rootDiscourse);
  extendObject(globalScope, hostDescriptors, globalScope.valos);
  return globalScope.valos;
}
