// @flow

import type { Discourse } from "~/sourcerer/api/types";

import enfoldGatewaySheath from "~/engine/valosheath/enfoldGatewaySheath";
import enfoldSchemaSheath, { injectTypeSheath, OwnerDefaultCouplingTag }
    from "~/engine/valosheath/enfoldSchemaSheath";
import { addValosheathNamespace, integrateNamespace } from "~/engine/valosheath/namespace";

import schemaTypeSheaths from "./schema";

const SourcererOnNamespace = require("~/inspire/On");

export { OwnerDefaultCouplingTag };

/*
 * Creates the ValOS introspection object.
 */
export default function extendValOS (scope: any, hostDescriptors: any, rootDiscourse: Discourse) {
  const valosheath = scope.valos || (scope.Valaa = scope.valos = {});

  integrateNamespace(SourcererOnNamespace, valosheath, scope, hostDescriptors);

  enfoldGatewaySheath(valosheath, hostDescriptors, rootDiscourse);

  if (rootDiscourse.schema) {
    const primaryNamespace = addValosheathNamespace(valosheath, "valos", {
      preferredPrefix: "V",
      baseIRI: "https://valospace.org/0#",
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
