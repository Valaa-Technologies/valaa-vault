// @flow

import { ValoscriptNew, ValoscriptInstantiate } from "~/script";

import { newResource, instantiateResource } from "~/engine/valosheath/resourceLifetimeOps";

export default {
  isGlobal: true,
  symbols: {},
  typeFields: {
    [ValoscriptNew]: newResource,
    [ValoscriptInstantiate]: instantiateResource,
  },
  prototypeFields: {},
};
