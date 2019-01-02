// @flow

import { AuthorityProphet } from "~/prophet";
import type { SchemeModule } from "~/prophet";

export default function createValaaLocalScheme (/* { logger } */): SchemeModule {
  return {
    scheme: "valaa-local",

    getAuthorityURIFromPartitionURI: () => `valaa-local:`,

    obtainAuthorityConfig: (/* partitionURI: ValaaURI, authorityPreConfig: Object */) => ({
      isLocallyPersisted: true,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
    }),

    createAuthorityProphet: (options: Object) => new AuthorityProphet(options),
  };
}
