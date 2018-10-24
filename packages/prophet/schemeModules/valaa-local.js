// @flow

import { AuthorityProphet } from "~/prophet";

export default function createValaaLocalScheme (/* { logger } */) {
  return {
    scheme: "valaa-local",

    getAuthorityURIFromPartitionURI: () => `valaa-local:`,

    createDefaultAuthorityConfig: (/* partitionURI: ValaaURI */) => ({
      isLocallyPersisted: true,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
    }),

    createAuthorityProphet: (options: Object) => new AuthorityProphet(options),
  };
}
