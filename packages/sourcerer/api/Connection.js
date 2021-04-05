// @flow

import type { EventBase } from "~/raem/events";

import Sourcerer from "~/sourcerer/api/Sourcerer";
import { SourceryOptions, MediaInfo, NarrateOptions, ProclaimOptions, Proclamation,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/sourcerer/api/types";
import Follower from "~/sourcerer/api/Follower";

import {
  dumpObject, invariantifyArray, invariantifyObject, invariantifyString,
  isPromise, thenChainEagerly, thisChainRedirect, thisChainReturn,
} from "~/tools";

/**
 * Interface for sending commands to upstream and registering for downstream truth updates
 */
export default class Connection extends Follower {
  _chronicleURI: string;

  _refCount: number;
  _upstreamConnection: Connection;
  _activeConnection: Connection | Promise<Connection>;

  constructor (options: {
    sourcerer: Sourcerer, verbosity?: number, name: ?any, chronicleURI: string,
    sourcerOptions: SourceryOptions,
  }) {
    super(options.sourcerer, options.verbosity, name);
    invariantifyObject(options.sourcerer, "Connection.constructor.sourcerer",
        { instanceof: Sourcerer });
    if (typeof chronicleURI !== "string") {
      invariantifyString(options.chronicleURI, "Connection.constructor.chronicleURI",
          { allowEmpty: true });
    }
    this._chronicleURI = options.chronicleURI;
    this._refCount = 0;
    this._pushTruthsDownstream = options.sourceryOptions.pushTruths;
    this._pushCommandsDownstream = options.sourceryOptions.pushCommands;
    this.setRawName(this._chronicleURI);
  }

  getName (): string {
    return (this._upstreamConnection && this._upstreamConnection.getName())
        || super.getName() || super.getRawName();
  }
  getSourcerer (): Sourcerer { return this._parent; }
  getActiveAuthority () {
    return this._upstreamConnection && this._upstreamConnection.getActiveAuthority();
  }

  getAuthorityURI (): string { return this._parent.splitChronicleURI(this._chronicleURI)[0]; }
  getChronicleURI (): string { return this._chronicleURI; }
  getChronicleId (): string { return this._parent.splitChronicleURI(this._chronicleURI)[1]; }

  getStatus (): Object {
    return {
      local: !!this.isLocallyRecorded(),
      primary: !!this.isPrimaryAuthority(),
      remote: !!this.isRemoteAuthority(),
    };
  }

  isLocallyRecorded () { return this._upstreamConnection.isLocallyRecorded(); }
  isPrimaryAuthority () { return this._upstreamConnection.isPrimaryAuthority(); }
  isRemoteAuthority () { return this._upstreamConnection.isRemoteAuthority(); }
  getEventVersion () { return this._upstreamConnection.getEventVersion(); }

  getReceiveTruths (pushTruths?: ReceiveEvents = this._pushTruthsDownstream): ReceiveEvents {
    return (truths, retrieveMediaBuffer, unused, rejectedEvent, parentPlog) => {
      try {
        invariantifyArray(truths, "receiveTruths.truths", { min: (rejectedEvent ? 0 : 1) });
        return this.receiveTruths(
            truths, retrieveMediaBuffer, pushTruths, rejectedEvent, parentPlog);
      } catch (error) {
        throw this.wrapErrorEvent(error, 1,
            new Error(`receiveTruths(${this._dumpEventIds(truths)})`),
            "\n\ttruths:", ...dumpObject(truths));
      }
    };
  }
  getReceiveCommands (pushCommands?: ReceiveEvents = this._pushCommandsDownstream):
      ReceiveEvents {
    return (commands, retrieveMediaBuffer) => {
      try {
        invariantifyArray(commands, "receiveTruths.commands", { min: 1 });
        return this.receiveCommands(commands, retrieveMediaBuffer, pushCommands);
      } catch (error) {
        throw this.wrapErrorEvent(error, 1,
            new Error(`receiveCommands(${this._dumpEventIds(commands)})`),
            "\n\tcommands:", ...dumpObject(commands));
      }
    };
  }

  _dumpEventIds (events) {
    return `[${
      [].concat(events || []).map(event => (!event ? "<no event>"
          : !event.aspects ? "<no aspects>"
          : `#${(event.aspects.log || {}).index}:${(event.aspects.command || {}).id}`)).join(",")
    }]`;
  }

  static _disconnectedPushEventsDownstream = () => undefined;

  isConnected () {
    if (this._upstreamConnection) return this._upstreamConnection.isConnected();
    return this._pushTruthsDownstream !== Connection._disconnectedPushEventsDownstream;
  }

  /**
   * disconnect - Disconnects from chronicle, stops receiving further requests
   *
   * @returns {type}                   description
   */
  disconnect () {
    this._refCount = null;
    this._pushTruthsDownstream = Connection._disconnectedPushEventsDownstream;
    this._pushCommandsDownstream = Connection._disconnectedPushEventsDownstream;
    delete this._parent._connections[this.getChronicleURI()];
    if (this._upstreamConnection) this._upstreamConnection.disconnect();
  }

  /**
   * Asynchronous operation which activates the connection to the
   * upstream loads its metadatas, initiates the authority connection
   * and narrates any requested events before finalizing.
   *
   * The initial narration looks for the requested events in following order:
   * 1. scribe in-memory and IndexedDB caches
   * 2. authority connection.narrateEventLog (only if options.eventIdEnd is given)
   *
   * If eventIdEnd is not specified, all the locally cached events
   * (both truths and queued commands starting from the optional
   * eventIdBegin) are narrated.
   *
   *
   * @param {SourceryOptions} options
   *
   * @memberof OracleConnection
   */
  sourcer (options: SourceryOptions) {
    if (this._activeConnection !== undefined) return this._activeConnection;
    const Type = this.constructor;
    const chainOptions = Object.create(options);
    chainOptions.plog = (options.plog || {}).v1
        || this.opLog(1, options, "sourcery",
            `Sourcering ${Type.name} ${Type.sourceryOpsName}`, { options, connection: this });
    return (this._activeConnection = this.opChain(
        Type.sourceryOpsName, chainOptions,
        "_errorOnSourcery", chainOptions.plog, 2));
  }

  static sourceryOpsName = "localSourcery";
  static localSourcery = [
    Connection.prototype._sourcerUpstream,
    Connection.prototype._narrateEventLog,
    Connection.prototype._finalizeSourcery,
  ];

  _errorOnSourcery (error, stepIndex, params, functions) {
    this._activeConnection = null;
    if (error.disconnected && (params[0].narrateOptions !== false)) {
      return null;
    }
    throw this.wrapErrorEvent(error, 1,
        error.chainContextName(`sourcer.${(functions[stepIndex] || "").name}()`),
        `\n\tstep #${stepIndex} params:`, ...dumpObject(params));
  }

  _sourcerUpstream (options: SourceryOptions, subOptions = {}) {
    let { sourceredUpstream } = subOptions;
    const narrateOptions = options.narrateOptions;
    if (sourceredUpstream === undefined) {
      if (!this.getSourcerer()._upstream) {
        throw new Error("Cannot call default _sourcerUpstream with no sourcerer upstream");
      }
      // narrate later, but subscribe the persistent downstream push callbacks here
      const upstreamOptions = Object.create(options);
      upstreamOptions.narrateOptions = false;
      upstreamOptions.pushTruths = this.getReceiveTruths(options.pushTruths);
      upstreamOptions.pushCommands = this.getReceiveCommands(options.pushCommands);
      this.setUpstreamConnection(this.getSourcerer()._upstream
          .sourcerChronicle(this.getChronicleURI(), upstreamOptions));
      sourceredUpstream = this._upstreamConnection.asSourceredConnection();
    }
    const params = [options, sourceredUpstream];
    return narrateOptions !== false ? params : thisChainRedirect("_finalizeSourcery", params);
  }

  _narrateEventLog (options: SourceryOptions) {
    if (options.narrateOptions === false) {
      throw new Error(
          "INTERNAL ERROR: options.narrateOptions is false: _narrateEventLog must be skipped");
    }
    const narrateOptions = options.narrateOptions || {};
    narrateOptions.plog = options.plog;
    if (options.newChronicle && (narrateOptions.remote === undefined)) {
      narrateOptions.remote = false;
    }
    return [options, this.narrateEventLog(narrateOptions)];
  }

  _finalizeSourcery (options, narrateResults) {
    if (options.narrateOptions !== false) {
      if (!narrateResults) {
        this.outputErrorEvent(new Error(
            "INTERNAL ERROR: options.narrateOptions not false but no narrateResults found"));
      }
      const eventIdEnd = Object.values(narrateResults || {}).reduce(
          (sum, log) => sum + (Array.isArray(log) ? log.length : 0),
          options.eventIdBegin || 0);
      if (!eventIdEnd && (options.newChronicle === false)) {
        throw new Error(`No events found when connecting to an existing chronicle <${
            this.getChronicleURI()}>`);
      } else if (eventIdEnd && (options.newChronicle === true)) {
        throw new Error(`Existing events found when trying to create a new chronicle <${
            this.getChronicleURI()}>`);
      }
      if ((options.requireLatestMediaContents !== false)
          && (narrateResults.mediaRetrievalStatus
              || { latestFailures: [] }).latestFailures.length) {
        // FIXME(iridian): This error temporarily demoted to log error
        this.outputErrorEvent(
            new Error(`Failed to sourcer chronicle: encountered ${
              narrateResults.mediaRetrievalStatus.latestFailures.length
                } latest media content retrieval failures (and ${
                ""}options.requireLatestMediaContents does not equal false).`),
            "Exception logged when connecting to chronicle");
      }
      (options.plog || {}).chain && options.plog.chain.opEvent(this, "narrated",
          "Narrated:", narrateResults);
    }
    options.plog && !Object.getPrototypeOf(options).plog && options.plog.opEvent(this, "done",
        "Sourcery done:", { options, narrateResults });
    return thisChainReturn(this._activeConnection = this);
  }

  addReference () { ++this._refCount; }

  removeReference () { if ((this._refCount !== null) && --this._refCount) this.disconnect(); }

  getUpstreamConnection () {
    return this._upstreamConnection;
  }

  setUpstreamConnection (connection: Connection) {
    if (isPromise(connection)) throw new Error("setUpstreamConnection must not be a promise");
    this._upstreamConnection = connection;
  }

  /**
   * Returns true if this connection has successfully completed an
   * optimistic narration and is trying to receive events from its
   * upstream.
   *
   * @returns
   * @memberof Connection
   */
  isActive () {
    if (this._activeConnection !== undefined) return (this._activeConnection === this);
    if (this._upstreamConnection) return this._upstreamConnection.isActive();
    return false;
  }

  asSourceredConnection (requireSynchronous: ?boolean):
      null | Promise<Connection> | Connection {
    try {
      if (requireSynchronous && (this._activeConnection !== this)) {
        throw new Error(`Active connection required but not synchronously available for ${
            this.getName()}`);
      }
      if (this._activeConnection) return this._activeConnection;
      throw new Error(
          `Cannot get an active connection promise from connection which is not being activated`);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`asSourceredConnection(${
          requireSynchronous ? "sync" : "async"})`));
    }
  }

  /**
   * Request replay of the event log using provided narration options
   * from the chronicle upstream.
   *
   * @param {NarrateOptions} [options={}]
   * @returns {Promise<Object>}
   * @memberof Connection
   */
  narrateEventLog (options: ?NarrateOptions = {}): Promise<Object> {
    if (!options) return undefined;
    options.receiveTruths = this.getReceiveTruths(options.receiveTruths);
    options.receiveCommands = this.getReceiveCommands(options.receiveTruths);
    return this._upstreamConnection.narrateEventLog(options);
  }

  /**
   * Record events into the upstream.
   * Takes ownership of the *events* (ie. can mutate them).
   *
   * @param {EventBase[]} [events={}]
   * @param {ProclaimOptions} [options={}]
   * @returns {Promise<Object>}
   * @memberof Connection
   */
  proclaimEvents (events: EventBase[], options: ProclaimOptions = {}): Proclamation {
    if (!options) return undefined;
    options.receiveTruths = this.getReceiveTruths(options.receiveTruths);
    options.receiveCommands = this.getReceiveCommands(options.receiveTruths);
    return this._upstreamConnection.proclaimEvents(events, options);
  }

  getFirstUnusedTruthEventId () {
    return this._upstreamConnection.getFirstUnusedTruthEventId();
  }
  getFirstUnusedCommandEventId () {
    return this._upstreamConnection.getFirstUnusedCommandEventId();
  }

  receiveTruths (truths: EventBase[], retrieveMediaBuffer: RetrieveMediaBuffer,
      receiveTruths: ?ReceiveEvents, type: string = "receiveTruths",
  ): Promise<(Promise<EventBase> | EventBase)[]> {
    try {
      if (!receiveTruths) {
        throw new Error(`INTERNAL ERROR: receiveTruths not implemented by ${this.constructor.name
            } and no explicit options.receiveTruths was defined (for narrate/chronicle).`);
      }
      return receiveTruths(truths, retrieveMediaBuffer);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1,
          new Error(`${type}(${this._dumpEventIds(truths)})`),
          "\n\ttruths:", ...dumpObject(truths),
          "\n\tretrieveMediaBuffer:", ...dumpObject(retrieveMediaBuffer));
    }
  }

  receiveCommands (commands: EventBase[], retrieveMediaBuffer: RetrieveMediaBuffer,
      receiveCommands?: ReceiveEvents,
  ): Promise<(Promise<EventBase> | EventBase)[]> {
    return this.receiveTruths(commands, retrieveMediaBuffer, receiveCommands, "receiveCommands");
  }

  /**
   * Returns the media content if it is immediately synchronously
   * available or a Promise if the content is asynchronously available.
   * Throws directly if the content is not available at all or
   * indirectly through the Promise in situations like timeouts.
   *
   * This function is convenience forward to alias for
   * requestMediaContents([mediaInfo])[0].
   *
   * @param {VRL} mediaVRL
   * @param {MediaInfo} mediaInfo
   * @returns
   *
   * @memberof Engine
   */
  decodeMediaContent (mediaInfo: MediaInfo): any {
    if (!mediaInfo.contentType) {
      const error = new Error("decodeMediaContent: mediaInfo.contentType is missing");
      throw this.wrapErrorEvent(error, 1,
          `decodeMediaContent('${mediaInfo.name || "<unnamed>"}')`,
              "\n\tmediaInfo:", ...dumpObject(mediaInfo));
    }
    return thenChainEagerly(
        this.requestMediaContents([mediaInfo]),
        results => results[0],
        (error) => {
          throw this.wrapErrorEvent(error, 1, `decodeMediaContent(${mediaInfo.name} as ${
                mediaInfo.contentType})`,
            "\n\tmediaInfo:", ...dumpObject(mediaInfo));
        },
    );
  }

  /**
   * Returns a URL for given mediaVRL pair which can be used in html context for retrieving media
   * content.
   *
   * Convenience for requestMediaContents([{ ...mediaInfo, asURL: true }])[0].
   *
   * @param {VRL} mediaVRL
   * @param {MediaInfo} mediaInfo
   * @returns
   *
   * @memberof Engine
   */
  getMediaURL (mediaInfo: MediaInfo): any {
    if (!mediaInfo.asURL) mediaInfo.asURL = true;
    return thenChainEagerly(
        this.requestMediaContents([mediaInfo]),
        results => results[0],
        (error) => {
          throw this.wrapErrorEvent(error, 1, `getMediaURL(${mediaInfo.name})`,
              "\n\tmediaInfo:", ...dumpObject(mediaInfo));
        },
    );
  }

  requestMediaContents (mediaInfos: MediaInfo[]): Promise<(Promise | any)[]> | (Promise | any)[] {
    return this._upstreamConnection.requestMediaContents(mediaInfos);
  }

  /**
   * Prepares the bvob content to be available for this chronicle,
   * returning its contentHash and a promise to the record process.
   *
   * This availability is impermanent. If the contentHash is not
   * referred to by the event log the content will eventually be
   * garbage collected.
   * The particular Sourcerer chain of this connection will define the
   * specific details of garbage collection (see Scribe for its local
   * content caching semantics).
   *
   * The idiomatic way to make content permanently available is to add
   * a Media.content reference to a Bvob with Bvob.id equal to
   * the contentHash.
   *
   * mediaInfo is an optional hint containing the expected MediaInfo
   * of a Media where this content is to be used. The upstream is
   * allowed to reject the prepareBvob request based on this hint, most
   * notably if mediaInfo.contentHash differs from the contentHash.
   *
   * @param {*} content
   * @param {MediaInfo} [mediaInfo]
   * @returns {{ contentHash: string, persistProcess: ?Promise<any> }}
   * @memberof Connection
   */
  prepareBvob (content: any, mediaInfo?: MediaInfo):
      { contentHash: string, persistProcess: ?Promise<any> } {
    return this._upstreamConnection.prepareBvob(content, mediaInfo);
  }
}
