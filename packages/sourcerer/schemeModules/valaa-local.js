// @flow

import { Authority, EVENT_VERSION } from "~/sourcerer";
import type { SchemeModule } from "~/sourcerer";

export default function createValaaLocalScheme (/* { logger } */): SchemeModule {
  return {
    scheme: "valaa-local",

    getAuthorityURIFromChronicleURI: () => `valaa-local:`,

    obtainAuthorityConfig: (/* chronicleURI: string, authorityPreConfig: Object */) => ({
      eventVersion: EVENT_VERSION,
      isLocallyPersisted: true,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
    }),

    createAuthority: (options: Object) => new Authority(options),
  };
}
