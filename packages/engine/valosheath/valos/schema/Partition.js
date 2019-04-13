// @flow

import { naiveURI } from "~/raem/ValaaURI";
import { denoteValOSBuiltinWithSignature } from "~/raem/VALK";

export default {
  symbols: {},
  typeFields: {
    createPartitionURI: denoteValOSBuiltinWithSignature(
        `Creates a URI from given *base* and *partitionId* strings`
    // TODO(iridian): Replace naiveURI.createPartitionURI with appropriate authority scheme-specific
    // implementation dispatcher.
    )(naiveURI.createPartitionURI),
    tryPartitionConnection: denoteValOSBuiltinWithSignature(
        `Returns an existing, fully active connection to the partition with given${
          ""} *partitionURI*, undefined otherwise`
    )(function tryPartitionConnection (partitionURI) {
      const ret = this.__callerValker__
          .acquirePartitionConnection(partitionURI, { require: false, newConnection: false });
      return (ret && ret.isActive()) ? ret : undefined;
    }),
    acquirePartitionConnection: denoteValOSBuiltinWithSignature(
        `Returns a promise to a full connection to the partition with given *partitionURI* and${
            ""} *options*. If no full connection exists, waits on a possibly existing on-going ${
            ""} connection process. If none exists creates a new connection process.`
    )(function acquirePartitionConnection (partitionURI, options = {}) {
      return Promise.resolve(this.__callerValker__
          .acquirePartitionConnection(partitionURI, options)
          .getActiveConnection());
    }),
  },
  prototypeFields: {},
};
