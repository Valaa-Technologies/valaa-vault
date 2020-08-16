// @flow

import VALEK from "~/engine/VALEK";
import { extractFunctionVAKON, ValoscriptNew, ValoscriptInstantiate } from "~/script";

import { newResource, instantiateResource } from "~/engine/valosheath/resourceLifetimeOps";

export default {
  isGlobal: true,
  symbols: {},
  typeFields: {
    [ValoscriptNew]: newResource,
    [ValoscriptInstantiate]: instantiateResource,
    getListenersOf (entity, name, ...additionalConditions) {
      return this.getFieldOf(entity,
          VALEK.listeners(name,
              ...additionalConditions.map(condition =>
                  VALEK.fromVAKON(extractFunctionVAKON(condition)))));
    },
  },
  prototypeFields: {},
};
