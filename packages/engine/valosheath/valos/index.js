// @flow

import type { Discourse } from "~/sourcerer/api/types";

import enfoldGatewaySheath from "~/engine/valosheath/enfoldGatewaySheath";
import enfoldSchemaSheath, { injectTypeSheath, OwnerDefaultCouplingTag }
    from "~/engine/valosheath/enfoldSchemaSheath";
import { addValosheathNamespace } from "~/engine/valosheath/namespace";

import schemaTypeSheaths from "./schema";

export { OwnerDefaultCouplingTag };

/*
 * Creates the ValOS introspection object.
 */
export default function extendValOS (scope: any, hostDescriptors: any, rootDiscourse: Discourse) {
  const valosheath = scope.valos || (scope.Valaa = scope.valos = {});
  enfoldGatewaySheath(valosheath, hostDescriptors, rootDiscourse);
  if (rootDiscourse.schema) {
    const primaryNamespace = addValosheathNamespace(valosheath, "valos", {
      preferredPrefix: "V",
      namespaceURI: "https://valospace.org/#",
    });
    injectTypeSheath(scope, valosheath, primaryNamespace, hostDescriptors,
        rootDiscourse.schema, schemaTypeSheaths,
        "TransientFields", schemaTypeSheaths.TransientFields);
    injectTypeSheath(scope, valosheath, primaryNamespace, hostDescriptors,
        rootDiscourse.schema, schemaTypeSheaths,
        "Discoverable", schemaTypeSheaths.Discoverable);
    // primaryNamespace.addSymbolField("name", valosheath.Discoverable.nameAlias);
    // primaryNamespace.addSymbolField("prototype", valosheath.Discoverable.prototypeAlias);

    enfoldSchemaSheath(scope, valosheath, primaryNamespace, hostDescriptors,
        rootDiscourse.getSchema(), schemaTypeSheaths);

    // Future deprecations
    // TODO(iridian, 2019-04): Deprecate and remove
    valosheath.Blob = valosheath.Bvob;
    valosheath.ResourceStub = valosheath.TransientFields;
    valosheath.Partition = valosheath.Chronicle;
    // valosheath.Chronicle = valosheath.Partition;
  }
  return valosheath;
}
