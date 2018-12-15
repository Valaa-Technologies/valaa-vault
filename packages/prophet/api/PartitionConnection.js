// @flow

import ValaaURI, { getPartitionRawIdFrom } from "~/raem/ValaaURI";
import type { EventBase } from "~/raem/events";

import Prophet from "~/prophet/api/Prophet";
import { ConnectOptions, MediaInfo, NarrateOptions, ChronicleOptions, ChronicleRequest,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/prophet/api/types";
import Follower from "~/prophet/api/Follower";

import Logger from "~/tools/Logger";
import { dumpObject, invariantifyArray, invariantifyObject, thenChainEagerly } from "~/tools";

/**
 * Interface for sending commands to upstream and registering for downstream truth updates
 */
export default class PartitionConnection extends Follower {
  _prophet: Prophet;
  _partitionURI: ValaaURI;

  _refCount: number;
  _upstreamConnection: PartitionConnection;
  _syncedConnection: PartitionConnection | Promise<PartitionConnection>;

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

  getReceiveTruths (downstreamReceiveTruths?: ReceiveEvents = this._downstreamReceiveTruths):
      ReceiveEvents {
    return (truths, retrieveMediaBuffer) => {
      try {
        invariantifyArray(truths, "receiveTruths.truths", { min: 1 });
        return this.receiveTruths(truths, retrieveMediaBuffer, downstreamReceiveTruths);
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
    const onError = errorOnConnect.bind(this, new Error("connect"));
    try {
      this.warnEvent(1, () => [
        "\n\tBegun connecting with options", ...dumpObject(options), ...dumpObject(this)
      ]);
      return this._syncedConnection || (this._syncedConnection = thenChainEagerly(
          this._connect(options, onError),
          (connectResults) => {
            this.warnEvent(1, () => [
              "\n\tDone connecting with results:", connectResults,
              "\n\tstatus:", this.getStatus(),
            ]);
            return (this._syncedConnection = this);
          },
          onError,
      ));
    } catch (error) { return onError(error); }
    function errorOnConnect (wrapper, error) {
      throw this.wrapErrorEvent(error, wrapper, "\n\toptions:", ...dumpObject(options));
    }
  }

  _connect (options: ConnectOptions, onError: Function) {
    if (!this._prophet._upstream) throw new Error("Cannot connect: upstream missing");
    options.receiveTruths = this.getReceiveTruths(options.receiveTruths);
    options.receiveCommands = this.getReceiveCommands(options.receiveCommands);
    return thenChainEagerly(
        this._prophet._upstream.acquirePartitionConnection(this.getPartitionURI(), options),
        upstreamConnection => {
          this.setUpstreamConnection(upstreamConnection);
          return upstreamConnection.getSyncedConnection();
        },
        onError);
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
    this._upstreamConnection = connection;
  }

  /**
   * Returns true if this connection has successfully completed an optimistic narration.
   *
   * @returns
   * @memberof PartitionConnection
   */
  isSynced () {
    if (this._syncedConnection !== undefined) return (this._syncedConnection === this);
    if (this._upstreamConnection) return this._upstreamConnection.isSynced();
    return false;
  }

  getSyncedConnection (require: ?boolean):
      null | Promise<PartitionConnection> | PartitionConnection {
    if (require && (this._syncedConnection !== this)) {
      throw new Error(`Couldn't synchronously sync ${this.constructor.name} to ${this.getName()}`);
    }
    if (this._syncedConnection !== undefined) return this._syncedConnection;
    // Wait for upstream to sync, then denote this connection synced, then resolve as 'this'.
    return (this._syncedConnection = thenChainEagerly(
        this._upstreamConnection && this._upstreamConnection.getSyncedConnection(), [
          () => (this._syncedConnection = this),
        ]
    ));
  }

  /**
   * Request replay of the event log using provided narration options
   * from the partition upstream.
   *
   * @param {NarrateOptions} [options={}]
   * @returns {Promise<Object>}
   * @memberof PartitionConnection
   */
  narrateEventLog (options: NarrateOptions = {}): Promise<Object> {
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
   * TODO(iridian): Specify the semantics for this function. An ArrayBuffer can be retrieved using
   * mime application/octet-stream and decodeMediaContent. What should this return? Maybe
   * always sync or always aync? Or just delete this whole function?
   *
   * @param {VRef} mediaId
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
   * Returns the media content if it is immediately synchronously available or a Promise if the
   * content is asynchronously available. Throws directly if the content is not available at all or
   * indirectly through the Promise in situations like timeouts.
   *
   * This function is convenience forward to alias for
   * requestMediaContents([mediaInfo])[0].
   *
   * @param {VRef} mediaId
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
   * Returns a URL for given mediaId pair which can be used in html context for retrieving media
   * content.
   *
   * Convenience for requestMediaContents([{ ...mediaInfo, asURL: true }])[0].
   *
   * @param {VRef} mediaId
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
   * returning its contentId and a promise to the persist process.
   *
   * This availability is impermanent. If the contentId is not referred
   * to by the event log the content will eventually be garbage
   * collected.
   * The Prophet chain will define the specific details of garbage
   * collection (see Scribe for its local content caching semantics).
   *
   * The idiomatic way to make content permanently available is to add
   * a Media.content reference to a Bvob with Bvob.id equal to
   * the contentId.
   *
   * mediaInfo is an optional hint containing the expected MediaInfo
   * of a Media where this content is to be used. The upstream is
   * allowed to reject the prepareBvob request based on this hint, most
   * notably if mediaInfo.bvobId differs from the contentId.
   *
   * @param {*} content
   * @param {MediaInfo} [mediaInfo]
   * @returns {{ contentId: string, persistProcess: ?Promise<any> }}
   * @memberof PartitionConnection
   */
  prepareBvob (content: any, mediaInfo?: MediaInfo):
      { contentId: string, persistProcess: ?Promise<any> } {
    return this._upstreamConnection.prepareBvob(content, mediaInfo);
  }
}
