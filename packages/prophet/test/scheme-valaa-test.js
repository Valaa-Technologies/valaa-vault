// @flow

import { AuthorityProphet } from "~/prophet";

export default function createValaaTestScheme ({ config, authorityURI } = {}) {
  return {
    scheme: "valaa-test",

    getAuthorityURIFromPartitionURI: () => authorityURI || `valaa-test:`,

    createDefaultAuthorityConfig: () => ({
      isLocallyPersisted: false,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
      ...config,
    }),

    createAuthorityProphet: (options: Object) => new AuthorityProphet(options),
  };
}
