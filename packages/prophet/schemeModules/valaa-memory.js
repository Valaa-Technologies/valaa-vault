// @flow

import { AuthorityProphet } from "~/prophet";

export default function createValaaMemoryScheme (/* { logger } */) {
  return {
    scheme: "valaa-memory",

    getAuthorityURIFromPartitionURI: () => `valaa-memory:`,

    createDefaultAuthorityConfig: (/* partitionURI: ValaaURI */) => ({
      isLocallyPersisted: false,
      isRemoteAuthority: false,
    }),

    createAuthorityProphet: (options: Object) => new AuthorityProphet(options),
  };
}
