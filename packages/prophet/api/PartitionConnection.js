// @flow

import ValaaURI, { getPartitionRawIdFrom } from "~/raem/ValaaURI";
import type { EventBase } from "~/raem/events";

import Prophet from "~/prophet/api/Prophet";
import { ConnectOptions, MediaInfo, NarrateOptions, ChronicleOptions, ChronicleRequest,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/prophet/api/types";
import Follower from "~/prophet/api/Follower";

import Logger from "~/tools/Logger";
import {
  dumpObject, invariantifyArray, invariantifyObject, isPromise, thenChainEagerly,
} from "~/tools";

/**
 * Interface for sending commands to upstream and registering for downstream truth updates
 */
export default class PartitionConnection extends Follower {
  _prophet: Prophet;
  _partitionURI: ValaaURI;

  _refCount: number;
  _upstreamConnection: PartitionConnection;
  _activeConnection: PartitionConnection | Promise<PartitionConnection>;

  constructor ({
    name, prophet, partitionURI, receiveTruths, receiveCommands, logger, verbosity
  }: {
    name: any, prophet: Prophet, partitionURI: ValaaURI,
    receiveTruths?: ReceiveEvents, receiveCommands?: ReceiveEvents,
    logger?: Logger, verbosity?: number,
  }) {
    super({ name: name || null, logger: logger || prophet.getLogger(), verbosity });
    invariantifyObject(prophet, "PartitionConnection.constructor.prophet",
        { instanceof: Prophet });
    invariantifyObject(partitionURI, "PartitionConnection.constructor.partitionURI",
        { instanceof: ValaaURI, allowEmpty: true });

    this._prophet = prophet;
    this._partitionURI = partitionURI;
    this._refCount = 0;
    this._downstreamReceiveTruths = receiveTruths;
    this._downstreamReceiveCommands = receiveCommands;
  }

  getName (): string {
    return super.getName()
        || (this._upstreamConnection && this._upstreamConnection.getName())
        || this.getPartitionURI().toString();
  }
  getProphet (): Prophet { return this._prophet; }

  getPartitionURI (): ValaaURI { return this._partitionURI; }
  getPartitionRawId (): string { return getPartitionRawIdFrom(this._partitionURI); }

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
        throw this.wrapErrorEvent(error, new Error("receiveTruths()"),
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
        throw this.wrapErrorEvent(error, new Error(`receiveCommands()`),
            "\n\tcommands:", ...dumpObject(commands));
      }
    };
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
   * @memberof OraclePartitionConnection
   */
  connect (options: ConnectOptions) {
    const connection = this;
    const wrap = new Error("connect()");
    if (this._activeConnection) return this._activeConnection;
    this.warnEvent(1, () => [
      "\n\tBegun connecting with options", ...dumpObject(options), ...dumpObject(this)
    ]);
    return (this._activeConnection = thenChainEagerly(Object.create(options), [
      (doConnectOptions) => this._doConnect(doConnectOptions),
      (connectResults) => {
        if (options.narrateOptions !== false) {
          const actionCount = Object.values(connectResults).reduce(
              (s, log) => s + (Array.isArray(log) ? log.length : 0),
              options.eventIdBegin || 0);
          if (!actionCount && (options.newPartition === false)) {
            throw new Error(`No events found when connecting to an existing partition '${
              this.getPartitionURI().toString()}'`);
          } else if (actionCount && (options.newPartition === true)) {
            throw new Error(`Existing events found when trying to create a new partition '${
              this.getPartitionURI().toString()}'`);
          }
          if ((options.requireLatestMediaContents !== false)
              && (connectResults.mediaRetrievalStatus
                  || { latestFailures: [] }).latestFailures.length) {
            // FIXME(iridian): This error temporarily demoted to log error
            this.outputErrorEvent(new Error(`Failed to connect to partition: encountered ${
              connectResults.mediaRetrievalStatus.latestFailures.length
                } latest media content retrieval failures (and ${
                ""}options.requireLatestMediaContents does not equal false).`));
          }
        }
        this.warnEvent(1, () => [
          "\n\tDone connecting with results:", ...dumpObject(connectResults),
          "\n\tstatus:", ...dumpObject(this.getStatus()),
        ]);
        return (this._activeConnection = this);
      },
    ], function errorOnConnect (error, stepIndex, stepHead) {
      throw connection.wrapErrorEvent(error, wrap,
          "\n\toptions:", ...dumpObject(options),
          `\n\tstep #${stepIndex} head:`, ...dumpObject(stepHead));
    }));
  }

  _doConnect (options: ConnectOptions) {
    if (!this._prophet._upstream) {
      throw new Error("Cannot connect using default _doConnect with no upstream");
    }
    options.receiveTruths = this.getReceiveTruths(options.receiveTruths);
    options.receiveCommands = this.getReceiveCommands(options.receiveCommands);
    const postponedNarrateOptions = options.narrateOptions;
    options.narrateOptions = false;
    this.setUpstreamConnection(this._prophet._upstream.acquirePartitionConnection(
        this.getPartitionURI(), options));
    return thenChainEagerly(
        this._upstreamConnection.getActiveConnection(),
        () => ((postponedNarrateOptions !== false)
            && this.narrateEventLog(postponedNarrateOptions)));
  }

  /**
   * disconnect - Disconnects from partition, stops receiving further requests
   *
   * @param  {type} partitions = null description
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

  setUpstreamConnection (connection: PartitionConnection) {
    if (isPromise(connection)) throw new Error("setUpstreamConnection must not be a promise");
    this._upstreamConnection = connection;
  }

  /**
   * Returns true if this connection has successfully completed an
   * optimistic narration and is trying to receive events from its
   * upstream.
   *
   * @returns
   * @memberof PartitionConnection
   */
  isActive () {
    if (this._activeConnection !== undefined) return (this._activeConnection === this);
    if (this._upstreamConnection) return this._upstreamConnection.isActive();
    return false;
  }

  getActiveConnection (requireSynchronous: ?boolean):
      null | Promise<PartitionConnection> | PartitionConnection {
    try {
      if (requireSynchronous && (this._activeConnection !== this)) {
        throw new Error(`Active connection required but not synchronously available for ${
            this.getName()}`);
      }
      if (this._activeConnection) return this._activeConnection;
      throw new Error(
          `Cannot get an active connection promise from connection which is not being activated`);
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error(`getActiveConnection(${
          requireSynchronous ? "sync" : "async"})`));
    }
  }

  /**
   * Request replay of the event log using provided narration options
   * from the partition upstream.
   *
   * @param {NarrateOptions} [options={}]
   * @returns {Promise<Object>}
   * @memberof PartitionConnection
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
   * @memberof PartitionConnection
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
      throw this.wrapErrorEvent(error, new Error(type),
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
   * TODO(iridian): Specify the semantics for this function.
   * An ArrayBuffer can be retrieved using mime
   * application/octet-stream and decodeMediaContent. What should this
   * return? Maybe always sync or always aync? Or just delete this
   * whole function?
   *
   * @param {VRef} mediaRef
   * @param {MediaInfo} mediaInfo
   * @returns
   *
   * @memberof ValaaEngine
   */
  readMediaContent (mediaInfo: MediaInfo): any {
    delete mediaInfo.mime;
    delete mediaInfo.type;
    delete mediaInfo.subtype;
    return thenChainEagerly(
        this.requestMediaContents([mediaInfo]),
        results => results[0],
        (error) => {
          throw this.wrapErrorEvent(error, `readMediaContent(${mediaInfo.name})`,
              "\n\tmediaInfo:", ...dumpObject(mediaInfo));
        },
    );
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
   * @param {VRef} mediaRef
   * @param {MediaInfo} mediaInfo
   * @returns
   *
   * @memberof ValaaEngine
   */
  decodeMediaContent (mediaInfo: MediaInfo): any {
    if (!mediaInfo.type) {
      throw this.wrapErrorEvent(new Error("decodeMediaContent: mediaInfo.type is missing"),
          `decodeMediaContent('${mediaInfo.name || "<unnamed>"}')`,
              "\n\tmediaInfo:", ...dumpObject(mediaInfo));
    }
    return thenChainEagerly(
        this.requestMediaContents([mediaInfo]),
        results => results[0],
        (error) => {
          throw this.wrapErrorEvent(error, `decodeMediaContent(${mediaInfo.name} as ${
                mediaInfo.mime})`,
            "\n\tmediaInfo:", ...dumpObject(mediaInfo));
        },
    );
  }

  /**
   * Returns a URL for given mediaRef pair which can be used in html context for retrieving media
   * content.
   *
   * Convenience for requestMediaContents([{ ...mediaInfo, asURL: true }])[0].
   *
   * @param {VRef} mediaRef
   * @param {MediaInfo} mediaInfo
   * @returns
   *
   * @memberof ValaaEngine
   */
  getMediaURL (mediaInfo: MediaInfo): any {
    if (!mediaInfo.asURL) mediaInfo.asURL = true;
    return thenChainEagerly(
        this.requestMediaContents([mediaInfo]),
        results => results[0],
        (error) => {
          throw this.wrapErrorEvent(error, `getMediaURL(${mediaInfo.name})`,
              "\n\tmediaInfo:", ...dumpObject(mediaInfo));
        },
    );
  }

  requestMediaContents (mediaInfos: MediaInfo[]): Promise<(Promise | any)[]> | (Promise | any)[] {
    return this._upstreamConnection.requestMediaContents(mediaInfos);
  }

  /**
   * Prepares the bvob content to be available for this partition,
   * returning its contentHash and a promise to the persist process.
   *
   * This availability is impermanent. If the contentHash is not
   * referred to by the event log the content will eventually be
   * garbage collected.
   * The particular Prophet chain of this connection will define the
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
   * notably if mediaInfo.bvobId differs from the contentHash.
   *
   * @param {*} content
   * @param {MediaInfo} [mediaInfo]
   * @returns {{ contentHash: string, persistProcess: ?Promise<any> }}
   * @memberof PartitionConnection
   */
  prepareBvob (content: any, mediaInfo?: MediaInfo):
      { contentHash: string, persistProcess: ?Promise<any> } {
    return this._upstreamConnection.prepareBvob(content, mediaInfo);
  }
}
