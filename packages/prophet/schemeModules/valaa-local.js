// @flow

export default function createValaaLocalScheme (/* { logger } */) {
  return {
    scheme: "valaa-local",

    getAuthorityURIFromPartitionURI: () => `valaa-local:`,

    createDefaultAuthorityConfig: (/* partitionURI: ValaaURI */) => ({}),

    createAuthorityProphet: () => null,
  };
}
