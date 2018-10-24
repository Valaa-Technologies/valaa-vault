// @flow

import { AuthorityProphet } from "~/prophet";

export default function createValaaMemoryScheme (/* { logger } */) {
  return {
    scheme: "valaa-memory",

    getAuthorityURIFromPartitionURI: () => `valaa-memory:`,

    createDefaultAuthorityConfig: (/* partitionURI: ValaaURI */) => ({
      isLocallyPersisted: false,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
    }),

    createAuthorityProphet: (options: Object) => new AuthorityProphet(options),
  };
}
