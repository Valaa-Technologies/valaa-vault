// @flow

import { Authority, EVENT_VERSION } from "~/sourcerer";
import type { SchemeModule } from "~/sourcerer";

export default function createValaaMemoryScheme (/* { parent } */): SchemeModule {
  return {
    scheme: "valaa-memory",

    getAuthorityURIFromChronicleURI: () => `valaa-memory:`,

    obtainAuthorityConfig: (/* chronicleURI: string, authorityPreConfig: Object */) => ({
      eventVersion: EVENT_VERSION,
      isLocallyRecorded: false,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
    }),

    createAuthority: (options: Object) => new Authority(options),
  };
}
