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
    createChronicleURI: denoteValOSBuiltinWithSignature(
        `Creates a URI from given *base* and *chronicleId* strings (coercing non-vpath id's)`
    // TODO(iridian): Replace naiveURI.createChronicleURI with appropriate authority scheme-specific
    // implementation dispatcher.
    )(naiveURI.createChronicleURI),
    tryPartitionConnection: denoteValOSBuiltinWithSignature(
        `DEPRECATED: prefer tryConnection.
        Returns an existing, fully active connection to the chronicle with given${
          ""} *chronicleURI*, undefined otherwise`
    )(function tryConnection (chronicleURI) {
      const ret = this.__callerValker__
          .acquireConnection(chronicleURI, { require: false, newConnection: false });
      return (ret && ret.isActive()) ? ret : undefined;
    }),
    tryConnection: denoteValOSBuiltinWithSignature(
        `Returns an existing, fully active connection to the chronicle with given${
          ""} *chronicleURI*, undefined otherwise`
    )(function tryConnection (chronicleURI) {
      const ret = this.__callerValker__
          .acquireConnection(chronicleURI, { require: false, newConnection: false });
      return (ret && ret.isActive()) ? ret : undefined;
    }),
    acquirePartitionConnection: denoteValOSBuiltinWithSignature(
        `DEPRECATED: prefer acquireConnection.
        Returns a promise to a full connection to the chronicle with given *chronicleURI* and${
            ""} *options*. If no full connection exists, waits on a possibly existing on-going ${
            ""} connection process. If none exists creates a new connection process.`
    )(function acquireConnection (chronicleURI, options = {}) {
      return Promise.resolve(this.__callerValker__
          .acquireConnection(chronicleURI, options)
          .asActiveConnection());
    }),
    acquireConnection: denoteValOSBuiltinWithSignature(
        `Returns a promise to a full connection to the chronicle with given *chronicleURI* and${
            ""} *options*. If no full connection exists, waits on a possibly existing on-going ${
            ""} connection process. If none exists creates a new connection process.`
    )(function acquireConnection (chronicleURI, options = {}) {
      return Promise.resolve(this.__callerValker__
          .acquireConnection(chronicleURI, options)
          .asActiveConnection());
    }),
  },
  prototypeFields: {},
};
