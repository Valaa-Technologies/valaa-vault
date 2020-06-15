// @flow

import type { Discourse } from "~/sourcerer/api/types";

import schemaTypeSheaths from "./schema";

import enfoldGatewaySheath from "./enfoldGatewaySheath";
import enfoldSchemaSheath, { OwnerDefaultCouplingTag } from "./enfoldSchemaSheath";

import { addValosheathNamespace } from "~/engine/valosheath/namespace";

export { OwnerDefaultCouplingTag };

/*
 * Creates the ValOS introspection object.
 */
export default function extendValOS (scope: any, hostDescriptors: any, rootDiscourse: Discourse) {
  const valosheath = scope.valos || (scope.Valaa = scope.valos = {});
  enfoldGatewaySheath(valosheath, rootDiscourse);
  if (rootDiscourse.schema) {
    const primaryNamespace = addValosheathNamespace(valosheath, "valos", {
      preferredPrefix: "valos",
      namespaceURI: "https://valospace.org/#",
    });
    enfoldSchemaSheath(scope, valosheath, primaryNamespace, hostDescriptors,
        rootDiscourse.getSchema(), schemaTypeSheaths);
  }
  return valosheath;
}
