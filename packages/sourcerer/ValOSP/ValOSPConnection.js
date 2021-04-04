// @flow

import type { EventBase } from "~/raem";
import AuthorityConnection from "~/sourcerer/Authority/AuthorityConnection";
import type { NarrateOptions, ProclaimOptions, SourceryOptions, MediaInfo } from "~/sourcerer";

import { getEventIndex } from "~/sourcerer/tools/event-version-0.3";

import { dumpObject, thisChainEagerly, thisChainReturn } from "~/tools";

export const _proclaimFailureFlags = {
  unconnected: { isSchismatic: false, proceed: { when: "connected" } },

  // Information responses
  // Ignore the response
  section100: { isSchismatic: false },

  // Successful responses
  // Non-schismatic, persisted truth by default
  section200: { isSchismatic: false, isPersisted: true, isTruth: true },
  // chronicle request was successfully persisted but not confirmed as truth
  202: { isTruth: false },

  // Redirection messages
  // Not implemented.
  section300: {
    isSchismatic: true, isRevisable: false, isReformable: false, isRefabricateable: false,
  },

  // Client error responses
  section400: {
    isSchismatic: true, isRevisable: false, isReformable: false, isRefabricateable: false,
  },
  // bad request, gateway can't recover
  400: { proceed: { when: "narrated" } },
  // not authenticated
  401: { isSchismatic: false, proceed: { when: "authenticated" } },
  // not authorized, gateway can't recover
  403: {},
  // method not available, slim chance of recovery by hammering
  404: { isRevisable: true, proceed: { when: "staggered", times: 3, backoff: 10000 } },
  // method not allowed, gateway can't recover
  405: {},
  // log index conflict
  409: { isRevisable: true, proceed: { when: "narrated" } },
  // precondition not met
  412: { isReformable: true },

  // Server error responses
  // Limited retries
  section500: {
    isSchismatic: true, isRevisable: false,
    // proceed: { when: "staggered", times: 3, backoff: 1000 },
  }
};

export default class ValOSPConnection extends AuthorityConnection {
  _config: Object;
  _eventSubscription: ?{ unsubscribe: () => void };

  constructor (options: Object) {
    super(options);
    if (!this._pushTruthsDownstream) {
      this.warnEvent(0, "ValOSPConnection created without a pushTruths callback.");
      this._pushTruthsDownstream = (events: Object[]) => {
        this.warnEvent(0, "Events received to a no-op _pushTruthsDownstream",
            "\n\tevents:", ...dumpObject(events));
      };
    }
  }

  getValOSPChronicleURL () {
    return this._chronicleValOSPURL
        || (this._chronicleValOSPURL = `https${this._chronicleURI.slice(6)}`);
  }

  getActiveAuthority () {
    return this.getSourcerer().getAuthorityConfig();
  }

  isConnected () {
    return this._isConnected;
  }

  setConnected (value = true) {
    this._isConnected = value;
    if (!value) this._eventSubscription = null;
  }

  disconnect () {
    if (this._eventSubscription) this._eventSubscription.unsubscribe();
    this._isConnected = false;
    super.disconnect();
  }

  static sourceryOpsName = "valospSourcery";
  static valospSourcery = [
    ValOSPConnection.prototype._finalizeAuthorityConfig,
    ValOSPConnection.prototype._sourcerUpstream,
    AuthorityConnection.prototype._narrateEventLog,
    AuthorityConnection.prototype._finalizeSourcery,
  ];

  _finalizeAuthorityConfig (options: SourceryOptions) {
    return [options, this.getSourcerer().getAuthorityConfig()];
  }

  _sourcerUpstream (options: SourceryOptions = {}, authorityConfig) {
    if (!authorityConfig) {
      throw new Error(`Cannot sourcer from unavailable authority ${
          this.getSourcerer().getAuthorityURI()}`);
    }
    this._config = authorityConfig;
    if (options.narrateOptions !== false) {
      (options.narrateOptions || (options.narrateOptions = {})).isConnecting = true;
    }
    return super._sourcerUpstream(options);
  }

  // Fetches recent events from upstream chronicle and delivers them to
  // the EventEnvelope unpacker, then ultimately as Events to the
  // callback funcion.
  // Returns count of events.
  // Callback can also be overriden, if you need to get the events
  // (EventEnvelopes) directly for some reason. In that case the events
  // will be delivered directly and any internal processing
  // of the envelopes skipped.
  narrateEventLog (options: NarrateOptions) {
    let { // eslint-disable-next-line
      receiveTruths, eventIdBegin, eventIdEnd, isConnecting, subscribeEvents, remote, identity,
      /* , noSnapshots */
    } = options || {};
    let chunkIndex = 0;
    return thisChainEagerly(this, [this._config || this.getSourcerer().getAuthorityConfig()], [
      config => {
        if (!config) {
          throw new Error(`Cannot narrate from unavailable authority <${
              this.getSourcerer().getAuthorityURI()}>`);
        }
        if (!config.isRemoteAuthority) {
          return thisChainReturn(super.narrateEventLog(options));
        }
        return !isConnecting && !this.isActive() && [this.sourcer({ narrateOptions: false })];
      },
      () => ((subscribeEvents === true) && [this._subscribeToEventMessages(true)])
          || ((subscribeEvents === false) && this.isConnected() && [this.disconnect()]),
      () => {
        if (eventIdBegin === undefined) eventIdBegin = 0;
        if (this._downstreamQueueStartIndex !== eventIdBegin) {
          this._downstreamQueueStartIndex = eventIdBegin;
          this._downstreamEventQueue = [];
        }
        // fetches the events
        const sections = {};
        if (remote === false) return thisChainReturn(sections);
        return [sections, this._createIdentities(identity)];
      },
      async function _fetchEventLogChunks (sections, identities) {
        let receivedEventsToIntegrate;
        while (eventIdBegin !== undefined || receivedEventsToIntegrate) {
          let remoteNarrateProcess;
          if (eventIdBegin !== undefined) {
            remoteNarrateProcess = this.getSourcerer().getEventsAPI()
                .narrateRemoteEventLog(this, eventIdBegin, eventIdEnd, identities);
          }

          if (receivedEventsToIntegrate) {
            const isSingleChunk = (!remoteNarrateProcess && !chunkIndex);
            this._placeEventsToDownstreamQueue(receivedEventsToIntegrate,
                isSingleChunk ? "single-chunk narrate" : "paginated narrate");
            receivedEventsToIntegrate = undefined;
            sections[isSingleChunk ? "remoteLog" : `remoteLogChunk${chunkIndex++}`] =
                this._pushConsecutiveQueueEventsDownstream(receiveTruths);
            if (!remoteNarrateProcess) break;
          }

          const remoteEvents = await remoteNarrateProcess;
          this.logEvent(2, () => ["\tGET success onwards from:", eventIdBegin]);
          if (!remoteEvents || !remoteEvents.length) {
            break;
          }
          receivedEventsToIntegrate = remoteEvents;
          if (remoteEvents[remoteEvents.length - 1] != null) {
            // No pagination, this was a single-chunk narrate.
            eventIdBegin = undefined;
          } else {
            // The result has been paginated, need to fetch more.
            remoteEvents.pop();
            const lastIndex = getEventIndex(remoteEvents[remoteEvents.length - 1]);
            let nextStartIndex = eventIdBegin + remoteEvents.length;
            if (lastIndex + 1 !== nextStartIndex) {
              this.warnEvent(1, () => [
                "Narrate pagination index mismatch: expected next index to be", nextStartIndex,
                "but latest event index received was", lastIndex,
                "\n\tNarrating from", lastIndex + 1,
              ]);
              nextStartIndex = lastIndex + 1;
            }
            if (nextStartIndex === eventIdBegin) {
              this.errorEvent("INTERNAL ERROR: pagination repeats event index:", eventIdBegin);
              throw new Error("Paginated event narration is repeating the same query.");
            }
            this.logEvent(3, () => [
              "Fetching more, last event was:", lastIndex,
            ]);
            // Prime fetch for next chunk
            eventIdBegin = nextStartIndex;
          }
        }
        return [sections];
      },
      async function _postProcessSections (sections) {
        for (const [key, value] of Object.entries(sections)) {
          sections[key] = await value;
          if (!(sections[key] || []).length) delete sections[key];
        }
        return sections;
      }
    ], function _onNarrateEventLogError (error) {
      this.warnEvent(2, () => [
        "\tGET FAILURE:", (error.response || {}).status || error.message,
      ]);
      throw this.wrapErrorEvent(error, 1, error.chainContextName("narrateEventLog()"),
          "\n\tchunkIndex:", chunkIndex,
          "\n\teventIdBegin:", eventIdBegin,
          "\n\terror response:", error.response);
    });
  }

  // Sends a given command within a command envelope to the API endpoint
  proclaimEvents (events: EventBase[], options: ProclaimOptions = {}) {
    return thisChainEagerly(this, this.asSourceredConnection(), [
      () => this._config || this.getSourcerer().getAuthorityConfig(),
      config => {
        if (!config) {
          throw new Error(`Cannot proclaim to unavailable authority ${
            this.getSourcerer().getAuthorityURI()}`);
        }
        if (config.rejectChronicleUpstream) {
          throw new Error(`Won't proclaim events due to authorityConfig.rejectChronicleUpstream: ${
            config.rejectChronicleUpstream}`);
        }
        if (config.isRemoteAuthority) {
          const startIndex = getEventIndex(events[0]);
          const identities = this._createIdentities(options.identity);

          const fixedResponse = this._config.blockChronicleUpstream
              ? { status: 100 }
              : this._config.fixedChronicleResponse;

          const remoteResults = fixedResponse
              ? Promise.reject(Object.assign(
                  new Error(`Blocked locally with fixed response: ${JSON.stringify(fixedResponse)}`),
                  { response: fixedResponse }))
              : Promise.resolve(this.getSourcerer().getEventsAPI()
                  .proclaimRemoteCommands(this, startIndex, events, identities));

          options.proclamationResults = remoteResults
              .catch(error => {
                const actualError = (error instanceof Error) ? error : new Error(error.response);
                if (!actualError.response) actualError.response = { status: 400 };
                this._embedErrorResolutionFlagsFromHTTPResponse(
                    actualError, actualError.response, _proclaimFailureFlags);
                this.warnEvent(1, () => [
                  `\n\tproclaim FAILURE at #${startIndex}:`, actualError,
                  "\n\tapplying resolution to all", events.length, "proclaimed events",
                ]);
                return events.map(Promise.reject(actualError));
              });
        } else if (config.isPrimaryAuthority) {
          // Add authority aspects.
        } else {
          throw new Error(`Can't proclaim events to a non-remote non-primary chronicle.`);
        }
        return super.proclaimEvents(events, options);
      },
    ], function errorOnProclaimEvents (error) {
      throw this.wrapErrorEvent(error, error.chainContextName("proclaimEvents"));
    });
  }

  _createIdentities (identity: Object) {
    const ret = [];
    ((identity && identity.list()) || []).forEach(identityChronicleURI => {
      const candidate = identity.get(identityChronicleURI);
      if (candidate.authority === this.getSourcerer()) {
        const identityConfig = { ...candidate };
        delete identityConfig.authority;
        ret.push([identityChronicleURI, identityConfig]);
      }
    });
    return ret;
  }

  _embedErrorResolutionFlagsFromHTTPResponse (error, response, resolutionFlagLookup) {
    let status = (response || {}).status;
    if (!status) return;
    if (typeof status === "string") status = parseInt(status, 10);
    if (typeof status !== "number" || isNaN(status)) status = "unconnected";
    const resolutionFlags = Object.assign({},
        ((typeof status === "number")
            && resolutionFlagLookup[`section${Math.floor(status / 100)}00`]) || {},
        resolutionFlagLookup[status] || {});
    Object.assign(error, resolutionFlags);
  }

  requestMediaContents (mediaInfos: MediaInfo[]): any {
    return this.getSourcerer()
        .getStorage()
        .downloadBvobsContents(this, mediaInfos);
  }

  prepareBvob (content: ArrayBuffer | () => Promise<ArrayBuffer>, mediaInfo?: MediaInfo):
      { contentHash: string, persistProcess: string | ?Promise<string> } {
    const mediaName = (mediaInfo || {}).name ? `media '${mediaInfo.name}'` : "unnamed media";
    const whileTrying = `while trying to prepare ${mediaName} bvob content for persist`;
    try {
      if (!mediaInfo) throw new Error(`mediaInfo missing ${whileTrying}`);
      if (!mediaInfo.contentHash) throw new Error(`mediaInfo.contentHash missing ${whileTrying}`);
      return {
        contentHash: mediaInfo.contentHash,
        persistProcess: this.getSourcerer()
            .getStorage()
            .uploadBvobContent(this, mediaInfo.contentHash || mediaInfo.bvobId, content, mediaName),
      };
    } catch (error) {
      throw this.wrapErrorEvent(error, `prepareBvob(${whileTrying})`,
          "\n\tcontent:", ...dumpObject(content),
          "\n\tmediaInfo:", mediaInfo,
      );
    }
  }

  // subscribe to topics, and set up the callbacks for receiving events
  _subscribeToEventMessages (require) {
    if (this._config.subscribeEvents === false) {
      return undefined;
    }
    if (require && !this._config.isRemoteAuthority) {
      throw new Error(`Can't subscribe for events on a non-remote chronicle connection.`);
    }
    return (async () => (this._eventSubscription = await this.getSourcerer().getEventsAPI()
        .subscribeToEventMessages(this)))();
  }
}
