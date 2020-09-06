// @flow

// import { denoteDeprecatedValOSCallable } from "~/raem/VALK";

import { ValoscriptNew, ValoscriptInstantiate } from "~/script";

import { newResource, instantiateResource } from "~/engine/valosheath/resourceLifetimeOps";
import { OwnerDefaultCouplingTag } from "~/engine/valosheath/enfoldSchemaSheath";

export default {
  isGlobal: true,
  symbols: {},
  typeFields: {
    [OwnerDefaultCouplingTag]: "relations",
    [ValoscriptNew]: newResource,
    [ValoscriptInstantiate]: instantiateResource,
    /*
    getSourceOf: denoteDeprecatedValOSCallable("", ["DEPRECATED", "V:source"])(
        function getSourceOf (relation) { return relation.step("source"); }), // eslint-disable-line
    setSourceOf: denoteDeprecatedValOSCallable("", ["DEPRECATED", "V:source = value"])(
        function setSourceOf (relation, newSource) { relation.setField("source", newSource); }),
    getTargetOf: denoteDeprecatedValOSCallable("", ["DEPRECATED", "V:target"])(
        function getTargetOf (relation) { return relation.step("target"); }),
    setTargetOf: denoteDeprecatedValOSCallable("", ["DEPRECATED", "V:target = value"])(
        function setTargetOf (relation, newTarget) { relation.setField("target", newTarget); }),
    */
  },
  prototypeFields: {},
};
