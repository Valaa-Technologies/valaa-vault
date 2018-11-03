// @flow

import { EventBase } from "~/raem/command";

import { AuthorityProphet, AuthorityPartitionConnection } from "~/prophet";
import { ChronicleRequest, ChronicleOptions, ChronicleEventResult } from "~/prophet/api/types";

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

    createAuthorityProphet: (options: Object) => new MockProphet(options),
  };
}

class MockPartitionConnection extends AuthorityPartitionConnection {
  _upstreamQueue = [];
  chronicleEvents (events: EventBase[], options: ChronicleOptions): ChronicleRequest {
    if (!this.isRemoteAuthority()) return super.chronicleEvents(events, options);
    this._upstreamQueue.push(...events);
    this._mostRecentChronicleOptions = options;
    return {
      eventResults: events.map((event) => (new ChronicleEventResult(event, {
        getLocalEvent: () => undefined,
        getTruthEvent: () => undefined,
      }))),
    };
  }
}

export class MockProphet extends AuthorityProphet {

  static PartitionConnectionType = MockPartitionConnection;

  addFollower (/* falseProphet */) {
    const connectors = {};
    return connectors;
  }
}
