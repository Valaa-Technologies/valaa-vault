// @flow

import { ValoscriptNew } from "~/script";

import { newResource } from "~/engine/valosheath/resourceLifetimeOps";
import { OwnerDefaultCouplingTag } from "~/engine/valosheath/enfoldSchemaSheath";

export default {
  isGlobal: true,
  symbols: {},
  typeFields: {
    [OwnerDefaultCouplingTag]: "properties",
    [ValoscriptNew]: newResource,
  },
  prototypeFields: {},
};
