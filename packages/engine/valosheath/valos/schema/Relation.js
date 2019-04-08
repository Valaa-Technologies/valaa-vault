// @flow

import { denoteDeprecatedValOSBuiltin } from "~/raem/VALK";

import { ValoscriptNew, ValoscriptInstantiate } from "~/script";

import { newResource, instantiateResource } from "~/engine/valosheath/valos/_resourceLifetimeOps";
import { OwnerDefaultCouplingTag } from "~/engine/valosheath/valos/enfoldSchemaSheath";

export default {
  isGlobal: true,
  symbols: {},
  typeFields: {
    [OwnerDefaultCouplingTag]: "relations",
    [ValoscriptNew]: newResource,
    [ValoscriptInstantiate]: instantiateResource,
    getSourceOf: denoteDeprecatedValOSBuiltin("[Relation.source]")(
        function getSourceOf (relation) { return relation.get("source"); }), // eslint-disable-line
    setSourceOf: denoteDeprecatedValOSBuiltin("[Relation.source] = newSource")(
        function setSourceOf (relation, newSource) { relation.setField("source", newSource); }),  // eslint-disable-line
    getTargetOf: denoteDeprecatedValOSBuiltin("[Relation.target]")(
        function getTargetOf (relation) { return relation.get("target"); }),  // eslint-disable-line
    setTargetOf: denoteDeprecatedValOSBuiltin("[Relation.target] = newSource")(
        function setTargetOf (relation, newTarget) { relation.setField("target", newTarget); }), // eslint-disable-line
  },
  prototypeFields: {},
};
