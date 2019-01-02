// @flow

import { AuthorityProphet } from "~/prophet";
import type { SchemeModule } from "~/prophet";

export default function createValaaTransientScheme (/* { logger } */): SchemeModule {
  return {
    scheme: "valaa-transient",

    getAuthorityURIFromPartitionURI: () => `valaa-transient:`,

    obtainAuthorityConfig: (/* partitionURI: ValaaURI, authorityPreConfig: Object */) => ({
      isLocallyPersisted: false,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
    }),

    createAuthorityProphet: (options: Object) => new AuthorityProphet(options),
  };
}
