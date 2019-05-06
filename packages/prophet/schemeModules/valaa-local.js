// @flow

import { Authority, EVENT_VERSION } from "~/prophet";
import type { SchemeModule } from "~/prophet";

export default function createValaaLocalScheme (/* { logger } */): SchemeModule {
  return {
    scheme: "valaa-local",

    getAuthorityURIFromPartitionURI: () => `valaa-local:`,

    obtainAuthorityConfig: (/* partitionURI: ValaaURI, authorityPreConfig: Object */) => ({
      eventVersion: EVENT_VERSION,
      isLocallyPersisted: true,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
    }),

    createAuthority: (options: Object) => new Authority(options),
  };
}
