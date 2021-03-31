// @flow

import { EventBase } from "~/raem/events";
import { naiveURI } from "~/raem";

import { Authority, AuthorityConnection, SOURCERER_EVENT_VERSION } from "~/sourcerer";
import { Proclamation, ProclaimOptions, ProclaimEventResult, MediaInfo, NarrateOptions }
    from "~/sourcerer/api/types";

import { dumpObject } from "~/tools";

export default function createValaaTestScheme ({ config, /* parent */ } = {}) {
  return {
    scheme: "valaa-test",

    createChronicleURI: naiveURI.createChronicleURI,
    splitChronicleURI: naiveURI.splitChronicleURI,

    obtainAuthorityConfig: () => ({
      eventVersion: SOURCERER_EVENT_VERSION,
      isLocallyRecorded: true,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
      ...config,
    }),

    createAuthority: (options: Object) => new TestSourcerer(options),
  };
}

export class TestConnection extends AuthorityConnection {
  _pendingNarrations = {};
  _preparations = {};
  _proclamations = [];

  // Test writer API

  addNarrateResults ({ eventIdBegin }, events) {
    const narration = this._pendingNarrations[eventIdBegin]
        || (this._pendingNarrations[eventIdBegin] = {});
    if (narration.resultEvents) {
      const error = new Error(`narration result events already exist for ${eventIdBegin}`);
      throw this.wrapErrorEvent(error, 1,
          new Error("addNarrateResults"));
    }
    narration.resultEvents = events;
    this._tryFulfillNarration(narration);
  }

  getNarration (eventIdBegin) {
    const ret = this._pendingNarrations[eventIdBegin];
    if (!ret) {
      throw new Error(`Cannot find an existing narration request beginning from "${eventIdBegin}"`);
    }
    return ret;
  }

  addPrepareBvobResult ({ contentHash }) {
    const preparation = this._preparations[contentHash] || (this._preparations[contentHash] = {});
    if (preparation.contentHash) {
      const error = new Error(`bvob preparation result already exists for ${contentHash}`);
      throw this.wrapErrorEvent(error, 1,
          new Error("addPrepareBvobResult"));
    }
    preparation.contentHash = contentHash;
    this._tryFulfillPreparation(preparation);
  }

  getPreparation (contentHash) {
    const ret = this._preparations[contentHash];
    if (!ret) throw new Error(`Cannot find an existing prepareBvob request for "${contentHash}"`);
    return ret;
  }

  // Connection implementation

  narrateEventLog (options: ?NarrateOptions = {}): Promise<any> {
    if (!this.isRemoteAuthority()) return super.narrateEventLog(options);
    if (!options.receiveTruths) throw new Error("Missing narrateEventLog:options.receiveTruths");
    const narration = this._pendingNarrations[options.eventIdBegin || 0]
        || (this._pendingNarrations[options.eventIdBegin || 0] = {});
    narration.options = options;
    return this._tryFulfillNarration(narration) || new Promise((resolve, reject) => {
      narration.resolve = resolve;
      narration.reject = reject;
    });
  }

  proclaimEvents (events: EventBase[], options: ProclaimOptions): Proclamation {
    if (!this.isRemoteAuthority()) return super.proclaimEvents(events, options);
    this._mostRecentChronicleOptions = options;
    const resultBase = new TestEventResult(this, options.verbosity);
    resultBase._events = events;
    resultBase.isPrimary = this.isPrimaryAuthority();
    const eventResults = events.map((event, index) => {
      const ret = Object.create(resultBase); ret.event = event; ret.index = index; return ret;
    });
    this._proclamations.push(...eventResults);
    return { eventResults };
  }

  prepareBvob (content: any, mediaInfo: MediaInfo): Object | Promise<Object> {
    if (!this.isRemoteAuthority()) return super.prepareBvob(content, mediaInfo);
    const contentHash = mediaInfo && mediaInfo.contentHash;
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
      const wrapped = this.wrapErrorEvent(error, 1, "tryFulfillNarration()",
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
      const wrapped = this.wrapErrorEvent(error, 1, "_tryFulfillPreparation()",
          "\n\tnarration:", ...dumpObject(preparation));
      if (!preparation.reject) throw wrapped;
      preparation.reject(wrapped);
    }
    return undefined;
  }
}

class TestEventResult extends ProclaimEventResult {
  getComposedEvent () { return undefined; }
  getRecordedEvent () { return undefined; }
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

export class TestSourcerer extends Authority {
  static ConnectionType = TestConnection;

  addFollower (/* falseProphet */) {
    const connectors = {};
    return connectors;
  }

  createChronicleURI (authorityURI: string, chronicleId: string): string {
    return naiveURI.createChronicleURI(authorityURI, chronicleId);
  }

  splitChronicleURI (chronicleURI: string): [string, string] {
    return naiveURI.splitChronicleURI(chronicleURI);
  }

  obtainAuthorityOfChronicle (chronicleURI) {
    return chronicleURI.startsWith(this.getAuthorityURI()) && this;
  }
}
