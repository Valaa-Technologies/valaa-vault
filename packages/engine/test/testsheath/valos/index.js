// @flow

import type { Discourse } from "~/sourcerer/api/types";

import enfoldSchemaSheath from "~/engine/valosheath/enfoldSchemaSheath";
import { getValosheathNamespace } from "~/engine/valosheath/namespace";

import schemaTypeSheaths from "./schema";

/*
 * Creates the ValOS introspection object.
 */
export default function extendValOSTest (
    scope: any, hostDescriptors: any, rootDiscourse: Discourse) {
  const valosheath = scope.valos;
  if (rootDiscourse.schema) {
    const primaryNamespace = getValosheathNamespace(valosheath, "valos");
    enfoldSchemaSheath(scope, valosheath, primaryNamespace, hostDescriptors,
        rootDiscourse.schema, schemaTypeSheaths);
  }
  return valosheath;
}
