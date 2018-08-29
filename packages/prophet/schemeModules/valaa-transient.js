// @flow

export default function createValaaTransientScheme (/* { logger } */) {
  return {
    scheme: "valaa-transient",

    getAuthorityURIFromPartitionURI: () => `valaa-transient:`,

    createDefaultAuthorityConfig: (/* partitionURI: ValaaURI */) => ({}),

    createAuthorityProphet: () => null,
  };
}
