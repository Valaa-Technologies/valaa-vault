// @flow

import schemaTypeSheaths from "./schema";

import enfoldGatewaySheath from "./enfoldGatewaySheath";
import enfoldSchemaSheath, { OwnerDefaultCouplingTag } from "./enfoldSchemaSheath";

export { OwnerDefaultCouplingTag };

/*
 * Creates the ValOS introspection object.
 */
export default function extendValOS (scope: any, hostDescriptors: any, schema: any) {
  const valos = scope.valos || (scope.Valaa = scope.valos = {});
  enfoldGatewaySheath(valos);
  if (schema) {
    enfoldSchemaSheath(scope, valos, hostDescriptors, schema, schemaTypeSheaths);
  }
  return valos;
}
