// @flow

import type { Discourse } from "~/sourcerer/api/types";

import schemaTypeSheaths from "./schema";

import enfoldGatewaySheath from "./enfoldGatewaySheath";
import enfoldSchemaSheath, { OwnerDefaultCouplingTag } from "./enfoldSchemaSheath";

export { OwnerDefaultCouplingTag };

/*
 * Creates the ValOS introspection object.
 */
export default function extendValOS (scope: any, hostDescriptors: any, rootDiscourse: Discourse) {
  const valos = scope.valos || (scope.Valaa = scope.valos = {});
  enfoldGatewaySheath(valos, rootDiscourse);
  if (rootDiscourse.schema) {
    enfoldSchemaSheath(scope, valos, hostDescriptors, rootDiscourse.getSchema(), schemaTypeSheaths);
  }
  return valos;
}
