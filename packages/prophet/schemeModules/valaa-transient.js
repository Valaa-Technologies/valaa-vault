// @flow

import { Authority, EVENT_VERSION } from "~/prophet";
import type { SchemeModule } from "~/prophet";

export default function createValaaTransientScheme (/* { logger } */): SchemeModule {
  return {
    scheme: "valaa-transient",

    getAuthorityURIFromPartitionURI: () => `valaa-transient:`,

    obtainAuthorityConfig: (/* partitionURI: ValaaURI, authorityPreConfig: Object */) => ({
      eventVersion: EVENT_VERSION,
      isLocallyPersisted: false,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
    }),

    createAuthority: (options: Object) => new Authority(options),
  };
}
