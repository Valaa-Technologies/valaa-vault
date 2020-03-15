// @flow

import { naiveURI } from "~/raem/ValaaURI";
import type { EventBase } from "~/raem/events";

import Sourcerer from "~/sourcerer/api/Sourcerer";
import { ConnectOptions, MediaInfo, NarrateOptions, ChronicleOptions, ChronicleRequest,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/sourcerer/api/types";
import Follower from "~/sourcerer/api/Follower";

import {
  dumpObject, FabricEventLogger, invariantifyArray, invariantifyObject, invariantifyString,
  isPromise, thenChainEagerly,
} from "~/tools";

/**
 * Interface for sending commands to upstream and registering for downstream truth updates
 */
export default class Connection extends Follower {
  _sourcerer: Sourcerer;
  _chronicleURI: string;

  _refCount: number;
  _upstreamConnection: Connection;
  _activeConnection: Connection | Promise<Connection>;

  constructor ({
    name, sourcerer, chronicleURI, receiveTruths, receiveCommands, logger, verbosity,
  }: {
    name: any, sourcerer: Sourcerer, chronicleURI: string,
    receiveTruths?: ReceiveEvents, receiveCommands?: ReceiveEvents,
    logger?: FabricEventLogger, verbosity?: number,
  }) {
    super(name || null, verbosity, logger || sourcerer.getLogger());
    invariantifyObject(sourcerer, "Connection.constructor.sourcerer",
        { instanceof: Sourcerer });
    if (typeof chronicleURI !== "string") {
      invariantifyString(chronicleURI, "Connection.constructor.chronicleURI",
          { allowEmpty: true });
    }
    this._sourcerer = sourcerer;
    this._chronicleURI = chronicleURI;
    this._refCount = 0;
    this._downstreamReceiveTruths = receiveTruths;
    this._downstreamReceiveCommands = receiveCommands;
    this.setRawName(this._chronicleURI);
  }

  getName (): string {
    return (this._upstreamConnection && this._upstreamConnection.getName())
        || super.getName() || super.getRawName();
  }
  getSourcerer (): Sourcerer { return this._sourcerer; }

  getAuthorityURI (): string { return naiveURI.getAuthorityURI(this._chronicleURI); }
  getChronicleURI (): string { return this._chronicleURI; }
  getChronicleId (): string { return naiveURI.getChronicleId(this._chronicleURI); }

  getStatus (): Object {
    return {
      local: !!this.isLocallyPersisted(),
      primary: !!this.isPrimaryAuthority(),
      remote: !!this.isRemoteAuthority(),
    };
  }

  isLocallyPersisted () { return this._upstreamConnection.isLocallyPersisted(); }
  isPrimaryAuthority () { return this._upstreamConnection.isPrimaryAuthority(); }
  isRemoteAuthority () { return this._upstreamConnection.isRemoteAuthority(); }
  getEventVersion () { return this._upstreamConnection.getEventVersion(); }

  getReceiveTruths (downstreamReceiveTruths?: ReceiveEvents = this._downstreamReceiveTruths):
      ReceiveEvents {
    return (truths, retrieveMediaBuffer, unused, rejectedEvent) => {
      try {
        invariantifyArray(truths, "receiveTruths.truths", { min: (rejectedEvent ? 0 : 1) });
        return this.receiveTruths(truths, retrieveMediaBuffer, downstreamReceiveTruths,
            rejectedEvent);
      } catch (error) {
        throw this.wrapErrorEvent(error, 1,
            new Error(`receiveTruths(${this._dumpEventIds(truths)})`),
            "\n\ttruths:", ...dumpObject(truths));
      }
    };
  }
  getReceiveCommands (downstreamReceiveCommands?: ReceiveEvents = this._downstreamReceiveCommands):
      ReceiveEvents {
    return (commands, retrieveMediaBuffer) => {
      try {
        invariantifyArray(commands, "receiveTruths.commands", { min: 1 });
        return this.receiveCommands(commands, retrieveMediaBuffer, downstreamReceiveCommands);
      } catch (error) {
        throw this.wrapErrorEvent(error, 1,
            new Error(`receiveCommands(${this._dumpEventIds(commands)})`),
            "\n\tcommands:", ...dumpObject(commands));
      }
    };
  }

  _dumpEventIds (events) {
    return `[${
      [].concat(events || []).map(event =>
              `#${(event.aspects.log || {}).index}:${(event.aspects.command || {}).id}`
          ).join(",")
    }]`;
  }

  isConnected () {
    if (this._upstreamConnection) return this._upstreamConnection.isConnected();
    throw new Error("isConnected not implemented");
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
   * @param {ConnectOptions} options
   *
   * @memberof OracleConnection
   */
  connect (options: ConnectOptions) {
    const connection = this;
    const wrap = new Error("connect()");
    if (this._activeConnection) return this._activeConnection;
    this.warnEvent(1, () => [
      "\n\tBegun connecting with options", ...dumpObject(options), ...dumpObject(this)
    ]);
    return (this._activeConnection = thenChainEagerly(null,
        this.addChainClockers(1, "connection.connect.ops", [
      function _doConnect () { return connection._doConnect(Object.create(options)); },
      function _postProcess (connectResults) {
        if (options.narrateOptions !== false) {
          const actionCount = Object.values(connectResults).reduce(
              (s, log) => s + (Array.isArray(log) ? log.length : 0),
              options.eventIdBegin || 0);
          if (!actionCount && (options.newChronicle === false)) {
            throw new Error(`No events found when connecting to an existing chronicle '${
              connection.getChronicleURI()}'`);
          } else if (actionCount && (options.newChronicle === true)) {
            throw new Error(`Existing events found when trying to create a new chronicle '${
              connection.getChronicleURI()}'`);
          }
          if ((options.requireLatestMediaContents !== false)
              && (connectResults.mediaRetrievalStatus
                  || { latestFailures: [] }).latestFailures.length) {
            // FIXME(iridian): This error temporarily demoted to log error
            connection.outputErrorEvent(new Error(`Failed to connect to chronicle: encountered ${
              connectResults.mediaRetrievalStatus.latestFailures.length
                } latest media content retrieval failures (and ${
                ""}options.requireLatestMediaContents does not equal false).`));
          }
        }
        connection.warnEvent(1, () => [
          "\n\tDone connecting with results:", ...dumpObject(connectResults),
          "\n\tstatus:", ...dumpObject(connection.getStatus()),
        ]);
        return (connection._activeConnection = connection);
      },
    ]), function errorOnConnect (error, stepIndex, stepHead) {
      throw connection.wrapErrorEvent(error, 1, wrap,
          "\n\toptions:", ...dumpObject(options),
          `\n\tstep #${stepIndex} head:`, ...dumpObject(stepHead));
    }));
  }

  _doConnect (options: ConnectOptions) {
    if (!this._sourcerer._upstream) {
      throw new Error("Cannot connect using default _doConnect with no upstream");
    }
    options.receiveTruths = this.getReceiveTruths(options.receiveTruths);
    options.receiveCommands = this.getReceiveCommands(options.receiveCommands);
    const postponedNarrateOptions = options.narrateOptions;
    options.narrateOptions = false;
    this.setUpstreamConnection(this._sourcerer._upstream
        .acquireConnection(this.getChronicleURI(), options));
    const connection = this;
    return thenChainEagerly(null, this.addChainClockers(1, "connection.doConnect.ops", [
      function _waitActiveUpstream () {
        return connection._upstreamConnection.asActiveConnection();
      },
      function _narrateEventLog () {
        return (postponedNarrateOptions !== false)
            && connection.narrateEventLog(postponedNarrateOptions);
      },
    ]));
  }

  /**
   * disconnect - Disconnects from chronicle, stops receiving further requests
   *
   * @returns {type}                   description
   */
  disconnect () {
    this._refCount = null;
  } // eslint-disable-line

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

  asActiveConnection (requireSynchronous: ?boolean):
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
      throw this.wrapErrorEvent(error, 1, new Error(`asActiveConnection(${
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
   *
   * @param {ChronicleOptions} [options={}]
   * @returns {Promise<Object>}
   * @memberof Connection
   */
  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}): ChronicleRequest {
    if (!options) return undefined;
    options.receiveTruths = this.getReceiveTruths(options.receiveTruths);
    options.receiveCommands = this.getReceiveCommands(options.receiveTruths);
    return this._upstreamConnection.chronicleEvents(events, options);
  }

  getFirstUnusedTruthEventId () {
    return this._upstreamConnection.getFirstUnusedTruthEventId();
  }
  getFirstUnusedCommandEventId () {
    return this._upstreamConnection.getFirstUnusedCommandEventId();
  }

  receiveTruths (truths: EventBase[], retrieveMediaBuffer: RetrieveMediaBuffer,
      downstreamReceiveTruths: ?ReceiveEvents, type: string = "receiveTruths",
  ): Promise<(Promise<EventBase> | EventBase)[]> {
    try {
      if (!downstreamReceiveTruths) {
        throw new Error(`INTERNAL ERROR: receiveTruths not implemented by ${this.constructor.name
            } and no explicit options.receiveTruths was defined (for narrate/chronicle).`);
      }
      return downstreamReceiveTruths(truths, retrieveMediaBuffer);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1,
          new Error(`${type}(${this._dumpEventIds(truths)})`),
          "\n\ttruths:", ...dumpObject(truths),
          "\n\tretrieveMediaBuffer:", ...dumpObject(retrieveMediaBuffer));
    }
  }

  receiveCommands (commands: EventBase[], retrieveMediaBuffer: RetrieveMediaBuffer,
      downstreamReceiveCommands?: ReceiveEvents,
  ): Promise<(Promise<EventBase> | EventBase)[]> {
    return this.receiveTruths(commands, retrieveMediaBuffer, downstreamReceiveCommands,
        "receiveCommands");
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
   * returning its contentHash and a promise to the persist process.
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
