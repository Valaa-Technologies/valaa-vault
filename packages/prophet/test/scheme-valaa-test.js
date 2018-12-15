// @flow

import { EventBase } from "~/raem/events";

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

    createAuthorityProphet: (options: Object) => new TestProphet(options),
  };
}

export class TestPartitionConnection extends AuthorityPartitionConnection {
  _testUpstreamEntries = [];

  chronicleEvents (events: EventBase[], options: ChronicleOptions): ChronicleRequest {
    if (!this.isRemoteAuthority()) return super.chronicleEvents(events, options);
    this._mostRecentChronicleOptions = options;
    const resultBase = new TestEventResult(null, { isPrimary: this.isPrimaryAuthority() });
    const eventResults = events.map((event, index) => {
      const ret = Object.create(resultBase); ret.event = event; ret.index = index; return ret;
    });
    this._testUpstreamEntries.push(...eventResults);
    return { eventResults };
  }
}

class TestEventResult extends ChronicleEventResult {
  getLocalEvent () { return undefined; }
  getTruthEvent () {
    if (!this.isPrimary) return Promise.reject(new Error("Not primary"));
    return (this.truthEventProcess = new Promise((resolve, reject) => {
      this.resolveTruthEvent = resolve;
      this.rejectTruthEvent = reject;
    }));
  }
}

export class TestProphet extends AuthorityProphet {

  static PartitionConnectionType = TestPartitionConnection;

  addFollower (/* falseProphet */) {
    const connectors = {};
    return connectors;
  }
}
