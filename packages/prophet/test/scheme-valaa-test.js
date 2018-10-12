// @flow

import { AuthorityProphet } from "~/prophet";

export default function createValaaTestScheme (/* { logger } */) {
  return {
    scheme: "valaa-test",

    getAuthorityURIFromPartitionURI: () => `valaa-test:`,

    createDefaultAuthorityConfig: () => ({
      isLocallyPersisted: false,
      isRemoteAuthority: false,
    }),

    createAuthorityProphet: (options: Object) => new AuthorityProphet(options),
  };
}
