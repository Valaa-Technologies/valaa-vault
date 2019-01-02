// @flow

import { AuthorityProphet, EVENT_VERSION } from "~/prophet";
import type { SchemeModule } from "~/prophet";

export default function createValaaMemoryScheme (/* { logger } */): SchemeModule {
  return {
    scheme: "valaa-memory",

    getAuthorityURIFromPartitionURI: () => `valaa-memory:`,

    obtainAuthorityConfig: (/* partitionURI: ValaaURI, authorityPreConfig: Object */) => ({
      eventVersion: EVENT_VERSION,
      isLocallyPersisted: false,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
    }),

    createAuthorityProphet: (options: Object) => new AuthorityProphet(options),
  };
}
