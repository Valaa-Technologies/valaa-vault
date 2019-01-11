// @flow

import { EventBase } from "~/raem/events";

import { AuthorityProphet, AuthorityPartitionConnection, EVENT_VERSION } from "~/prophet";
import { ChronicleRequest, ChronicleOptions, ChronicleEventResult, NarrateOptions }
    from "~/prophet/api/types";

import { dumpObject } from "~/tools";

export default function createValaaTestScheme ({ config, authorityURI } = {}) {
  return {
    scheme: "valaa-test",

    getAuthorityURIFromPartitionURI: () => authorityURI || `valaa-test:`,

    obtainAuthorityConfig: () => ({
      eventVersion: EVENT_VERSION,
      isLocallyPersisted: false,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
      ...config,
    }),

    createAuthorityProphet: (options: Object) => new TestProphet(options),
  };
}

export class TestPartitionConnection extends AuthorityPartitionConnection {
  _narrations = {};
  _testUpstreamEntries = [];

  addNarrateResults ({ eventIdBegin }, events) {
    const narration = this._narrations[eventIdBegin] || (this._narrations[eventIdBegin] = {});
    if (narration.resultEvents) {
      throw this.wrapErrorEvent(new Error(`narration result events already exist for ${
          eventIdBegin}`), new Error("addNarrateResults"));
    }
    narration.resultEvents = events;
    this._tryFulfillNarration(narration);
  }

  narrateEventLog (options: ?NarrateOptions = {}): Promise<any> {
    if (!this.isRemoteAuthority()) return super.narrateEventLog(options);
    const narration = this._narrations[options.eventIdBegin || 0]
        || (this._narrations[options.eventIdBegin || 0] = {});
    narration.options = options;
    return this._tryFulfillNarration(narration) || new Promise((resolve, reject) => {
      narration.resolve = resolve;
      narration.reject = reject;
    });
  }

  _tryFulfillNarration (narration: Object) {
    if (!narration.options || !narration.resultEvents) return undefined;
    const ret = {};
    try {
      ret.testAuthorityTruths = !narration.resultEvents.length ? []
          : narration.options.receiveTruths(narration.resultEvents);
      if (narration.resolve) narration.resolve(ret);
      return ret;
    } catch (error) {
      const wrapped = this.wrapErrorEvent(error, new Error("tryFulfillNarration()"),
          "\n\tnarration:", ...dumpObject(narration));
      if (!narration.reject) throw wrapped;
      narration.reject(wrapped);
    }
    return undefined;
  }

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
