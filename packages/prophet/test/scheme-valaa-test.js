// @flow

import { EventBase } from "~/raem/events";

import { AuthorityProphet, AuthorityPartitionConnection, EVENT_VERSION } from "~/prophet";
import { ChronicleRequest, ChronicleOptions, ChronicleEventResult, MediaInfo, NarrateOptions }
    from "~/prophet/api/types";

import { dumpObject } from "~/tools";

export default function createValaaTestScheme ({ config, authorityURI } = {}) {
  return {
    scheme: "valaa-test",

    getAuthorityURIFromPartitionURI: () => authorityURI || `valaa-test:`,

    obtainAuthorityConfig: () => ({
      eventVersion: EVENT_VERSION,
      isLocallyPersisted: true,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
      ...config,
    }),

    createAuthorityProphet: (options: Object) => new TestProphet(options),
  };
}

export class TestPartitionConnection extends AuthorityPartitionConnection {
  _narrations = {};
  _preparations = {};
  _chroniclings = [];

  // Test writer API

  addNarrateResults ({ eventIdBegin }, events) {
    const narration = this._narrations[eventIdBegin] || (this._narrations[eventIdBegin] = {});
    if (narration.resultEvents) {
      throw this.wrapErrorEvent(new Error(`narration result events already exist for ${
        eventIdBegin}`), new Error("addNarrateResults"));
    }
    narration.resultEvents = events;
    this._tryFulfillNarration(narration);
  }

  getNarration (eventIdBegin) {
    const ret = this._narrations[eventIdBegin];
    if (!ret) {
      throw new Error(`Cannot find an existing narration request beginning from "${eventIdBegin}"`);
    }
    return ret;
  }

  addPrepareBvobResult ({ contentHash }) {
    const preparation = this._preparations[contentHash] || (this._preparations[contentHash] = {});
    if (preparation.contentHash) {
      throw this.wrapErrorEvent(new Error(`bvob preparation result already exists for ${
        contentHash}`), new Error("addPrepareBvobResult"));
    }
    preparation.contentHash = contentHash;
    this._tryFulfillPreparation(preparation);
  }

  getPreparation (contentHash) {
    const ret = this._preparations[contentHash];
    if (!ret) throw new Error(`Cannot find an existing prepareBvob request for "${contentHash}"`);
    return ret;
  }

  // PartitionConnection implementation

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

  chronicleEvents (events: EventBase[], options: ChronicleOptions): ChronicleRequest {
    if (!this.isRemoteAuthority()) return super.chronicleEvents(events, options);
    this._mostRecentChronicleOptions = options;
    const resultBase = new TestEventResult(null, { isPrimary: this.isPrimaryAuthority() });
    const eventResults = events.map((event, index) => {
      const ret = Object.create(resultBase); ret.event = event; ret.index = index; return ret;
    });
    this._chroniclings.push(...eventResults);
    return { eventResults };
  }

  prepareBvob (content: any, mediaInfo: MediaInfo): Object | Promise<Object> {
    if (!this.isRemoteAuthority()) return super.prepareBvob(content, mediaInfo);
    const contentHash = mediaInfo && (mediaInfo.contentHash || mediaInfo.bvobId);
    if (!contentHash) throw new Error("mediaInfo.contentHash not defined");
    const preparation = this._preparations[contentHash] || (this._preparations[contentHash] = {});
    preparation.content = content;
    preparation.mediaInfo = mediaInfo;
    return {
      contentHash,
      persistProcess: this._tryFulfillPreparation(preparation) || new Promise((resolve, reject) => {
        preparation.resolve = resolve;
        preparation.reject = reject;
      }),
    };
  }

  // Detail

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

  _tryFulfillPreparation (preparation: Object) {
    if (!preparation.mediaInfo || !preparation.contentHash) return undefined;
    try {
      if (preparation.resolve) preparation.resolve(preparation.contentHash);
      return preparation.contentHash;
    } catch (error) {
      const wrapped = this.wrapErrorEvent(error, new Error("_tryFulfillPreparation()"),
          "\n\tnarration:", ...dumpObject(preparation));
      if (!preparation.reject) throw wrapped;
      preparation.reject(wrapped);
    }
    return undefined;
  }
}

class TestEventResult extends ChronicleEventResult {
  getLocalEvent () { return undefined; }
  getTruthEvent () {
    if (!this.isPrimary) {
      return Promise.reject(new Error("Non-primary authority cannot chronicle events"));
    }
    return this.truthEventProcess
        || (this.truthEventProcess = new Promise((resolve, reject) => {
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
