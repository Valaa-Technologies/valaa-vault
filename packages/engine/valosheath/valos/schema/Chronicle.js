// @flow

import { naiveURI } from "~/raem/ValaaURI";
import { denoteValOSCallable } from "~/raem/VALK";

export default {
  symbols: {},
  typeFields: {
    createPartitionURI: denoteValOSCallable(
`Creates a URI from given *base* and *partitionId* strings`,
    // TODO(iridian): Replace naiveURI.createPartitionURI with appropriate authority scheme-specific
    // implementation dispatcher.
    )(naiveURI.createPartitionURI),
    createChronicleURI: denoteValOSCallable(
`Creates a URI from given *base* and *chronicleId* strings (coercing non-vpath id's)`
    // TODO(iridian): Replace naiveURI.createChronicleURI with appropriate authority scheme-specific
    // implementation dispatcher.
    )(naiveURI.createChronicleURI),
    tryPartitionConnection: denoteValOSCallable([
`Returns an existing, fully active connection to the chronicle with
given *chronicleURI*, undefined otherwise`,
    ], [
      "DEPRECATED", `V:Chronicle.tryConnection`
    ])(function tryPartitionConnection (chronicleURI) {
      const ret = this.__callerValker__
          .sourcerChronicle(chronicleURI, { require: false, newConnection: false });
      return (ret && ret.isActive()) ? ret : undefined;
    }),
    tryConnection: denoteValOSCallable(
`Returns an existing, fully active connection to the chronicle with
given *chronicleURI*, undefined otherwise`,
    )(function tryConnection (chronicleURI) {
      const ret = this.__callerValker__
          .sourcerChronicle(chronicleURI, { require: false, newConnection: false });
      return (ret && ret.isActive()) ? ret : undefined;
    }),
    acquirePartitionConnection: denoteValOSCallable([
`Returns a promise to a full connection to the chronicle with given
*chronicleURI* and *options*.`,
`If no full connection exists, waits on a possibly existing on-going
connection process. If none exists creates a new connection process.`,
    ], [
      "DEPRECATED", "V:Chronicle.acquireConnection",
    ])(function acquireConnection (chronicleURI, options = {}) {
      return Promise.resolve(this.__callerValker__
          .sourcerChronicle(chronicleURI, options)
          .asSourceredConnection());
    }),
    acquireConnection: denoteValOSCallable([
`Returns a promise to a full connection to the chronicle with given
*chronicleURI* and *options*.`,
`If no full connection exists, waits on a possibly existing on-going
connection process. If none exists creates a new connection process.`,
    ])(function acquireConnection (chronicleURI, options = {}) {
      return Promise.resolve(this.__callerValker__
          .sourcerChronicle(chronicleURI, options)
          .asSourceredConnection());
    }),
    sourcerChronicle: denoteValOSCallable([
      `Returns a promise to a sourcered chronicle with given
      *chronicleURI* and *options*.`,
      `If no full connection exists, waits on a possibly existing on-going
      connection process. If none exists creates a new connection process.`,
          ])(function sourcerChronicle (chronicleURI, options = {}) {
            return Promise.resolve(this.__callerValker__
                .sourcerChronicle(chronicleURI, options)
                .asSourceredConnection());
          }),
    },
  prototypeFields: {},
};
