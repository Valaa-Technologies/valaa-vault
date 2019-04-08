// @flow

import { ValoscriptNew } from "~/script";

import { newResource } from "~/engine/valosheath/valos/_resourceLifetimeOps";
import { OwnerDefaultCouplingTag } from "~/engine/valosheath/valos/enfoldSchemaSheath";

export default {
  isGlobal: true,
  symbols: {},
  typeFields: {
    [OwnerDefaultCouplingTag]: "properties",
    [ValoscriptNew]: newResource,
  },
  prototypeFields: {},
};
