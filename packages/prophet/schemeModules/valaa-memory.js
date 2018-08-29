// @flow

export default function createValaaMemoryScheme (/* { logger } */) {
  return {
    scheme: "valaa-memory",

    getAuthorityURIFromPartitionURI: () => `valaa-memory:`,

    createDefaultAuthorityConfig: (/* partitionURI: ValaaURI */) => ({}),

    createAuthorityProphet: () => null,
  };
}
