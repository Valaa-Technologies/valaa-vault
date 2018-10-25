// @flow

import type { UniversalEvent } from "~/raem/command";
import type ValaaURI from "~/raem/ValaaURI";
import { VRef } from "~/raem/ValaaReference";

import Follower from "~/prophet/api/Follower";
import type PartitionConnection from "~/prophet/api/PartitionConnection";

import { LogEventGenerator } from "~/tools/Logger";

export type EventData = {
  type: "CREATED" | "MODIFIED" | "FIELDS_SET" | "ADDED_TO" | "REMOVED_FROM" | "REPLACED_WITHIN"
      | "SPLICED" | "TRANSACTED" | "FROZEN"
}

export type RetrieveMediaBuffer = (mediaInfo: MediaInfo) => Promise<any>;
export type ReceiveEvents =
    ((events: EventData[], retrieveMediaBuffer?: RetrieveMediaBuffer) =>
        (Promise<UniversalEvent> | UniversalEvent)[]);

export type MediaInfo = {
  mediaId: VRef,
  bvobId?: string,
  name?: string,
  sourceURL?: string,
  mime?: string,
  type?: string,
  subtype?: string,
  asURL? : any,                // default false. Available options: true, false, "data", "public",
                               // "source".
  contentDisposition?: string,
  contentEncoding?: string,
  contentLanguage?: string,
  contentType?: string,
};

export type ConnectOptions = {
  connect?: boolean,               // default: true. Connect to updates
  subscribe?: boolean,             // default: true. Subscribe for downstream push events.
  receiveTruths?: ReceiveEvents,   // The persistent connection callback for downstream push events.
  narrateOptions?: NarrateOptions, // default: {}. Narrate with default options
  newConnection?: boolean,         // if true, throw if a connection exists,
                                   // if false, throw if no connection exists,
  newPartition?: boolean,          // if true, throw if a partition exists (has persisted events)
                                   // if false, throw if no partition exists (no persisted events)
  onlyTrySynchronousConnection?: boolean, // if true
  allowPartialConnection?: boolean,       // default: false. If true, return not fully narrated
                                          // connection synchronously
  requireLatestMediaContents?: boolean,   //
};

export type NarrateOptions = {
  remote?: boolean,                // If false never narrate to upstream, if true wait for upstream
                                   // narration result even if an optimistic narration can be
                                   // performed locally
  snapshots?: boolean,             // default: true, currently ignored. Start narration from most
                                   // recent snapshot within provided event range
  commands?: boolean,              // default: true. Narrate pending commands as well.
  rechronicleOptions?: boolean,    // default: {}. Chronicle pending commands on the side.
  receiveTruths?: ReceiveEvents,   // default: connection receiveTruths.
                                   //   Callback for downstream truth events.
  receiveCommands?: ReceiveEvents, // default: receiveTruths. Callback for re-narrated commands
  firstEventId?: number,
  lastEventId?: number,
};

export type ChronicleOptions = NarrateOptions & {
  isPreAuthorized?: boolean,         // If true the chronicled events are already authorized truths.
  retrieveMediaBuffer?: RetrieveMediaBuffer,
};

export type ChronicleEventResult = {
  event: UniversalEvent,
  getLocallyReceivedEvent: Function<Promise<UniversalEvent> >,
  getTruthEvent: Function<Promise<UniversalEvent> >,
};

/* eslint-disable no-unused-vars */

/**
 * Interface for sending commands to upstream.
 */
export default class Prophet extends LogEventGenerator {
  _upstream: Prophet;
  _followers: Follower;
  _connections: { [partitionURIString: string]: PartitionConnection };

  constructor ({ upstream, ...rest }: Object = {}) {
    super({ ...rest });
    this._followers = new Map();
    this._connections = {};
    this.setUpstream(upstream);
    this._upstream = upstream;
  }

  initiate (): Promise<Prophet> | Prophet {}

  addFollower (follower: Follower): Follower {
    const discourse = this._createDiscourse(follower);
    this._followers.set(follower, discourse);
    return discourse;
  }

  setUpstream (upstream) {
    this._upstream = upstream;
    if (upstream) upstream.addFollower(this);
  }

  _createDiscourse (follower: Follower) {
    return follower;
  }

  _confirmTruthToAllFollowers (truthEvent: Object, purgedCommands?: Array<Object>) {
    (this._followers || []).forEach(discourse => {
      try {
        discourse.receiveTruth(truthEvent, purgedCommands);
      } catch (error) {
        this.outputErrorEvent(this.wrapErrorEvent(error,
            "_confirmTruthToAllFollowers",
            "\n\ttruthEvent:", truthEvent,
            "\n\tpurgedCommands:", purgedCommands,
            "\n\ttarget discourse:", discourse,
        ));
      }
    });
  }

  _reclaimToAllFollowers (command: Object) {
    (this._followers || []).forEach(discourse => {
      try {
        discourse.repeatClaim(command);
      } catch (error) {
        this.outputErrorEvent(this.wrapErrorEvent(error,
            "_reclaimToAllFollowers",
            "\n\trepeated command:", command,
            "\n\ttarget discourse:", discourse,
        ));
      }
    });
    return command;
  }

  /**
   * Returns a connection to partition identified by given partitionURI.
   *
   * The returned connection might be shared between other users and implements internal reference
   * counting; it is acquired once as part of this call. The connection must be manually released
   * with removeReference or otherwise the connection resources will be left open.
   *
   * The connection is considered acquired and the promise is resolved after a lazy greedy
   * "first narration" is complete. Lazy means that only the single closest source which
   * can provide events is consulted. Greedy means that all events from that source are retrieved.
   *
   * The design principle behind this is that no non-authoritative event log cache shalle have
   * functionally incomplete event logs, even if event log might be outdated in itself.
   *
   * More specifically in inspire context the first source resulting in non-zero events is chosen:
   * 1. all events of the optional explicit initialNarrateOptions.eventLog option and
   *    the latest previously seen full narration of this partition in the Scribe (deduplicated)
   * 2. all events in the most recent authorized snapshot known by the remote authority connection
   * 3. all events in the remote authorize event log itself
   *
   * Irrespective of where the first narration is sourced, an authorized full narration is
   * initiated against the remote authority if available.
   *
   * @param {ValaaURI} partitionURI
   * @returns {PartitionConnection}
   *
   * @memberof Prophet
   */
  acquirePartitionConnection (partitionURI: ValaaURI,
      options: ConnectOptions = {}): ?PartitionConnection {
    let connection = this._connections[String(partitionURI)];
    if (connection) return connection;
    if (options.newConnection === false) {
      if (options.require === false) return undefined;
      throw new Error("Can't create new partition connection with options.newConnection === false");
    }
    connection = this._createPartitionConnection(partitionURI, options);
    if (!connection) return undefined;
    connection.addReference();
    this._connections[String(partitionURI)] = connection;
    connection.connect(options); // Initiates the connection but doesn't wait for it to complete.
    return connection;
  }

  _createPartitionConnection (partitionURI: ValaaURI, options: ConnectOptions) {
    const PartitionConnectionType = this.constructor.PartitionConnectionType;
    if (!PartitionConnectionType) {
      return this._upstream.acquirePartitionConnection(partitionURI, options);
    }
    return new PartitionConnectionType({
      partitionURI, prophet: this, debugLevel: this.getDebugLevel(),
      receiveTruths: options.receiveTruths, ...(options.createConnectionOptions || {}),
    });
  }

  /**
   * Returns the bvob buffer for given bvobId as an ArrayBuffer if it is locally available,
   * undefined otherwise.
   *
   * @param {string} bvobId
   * @returns
   *
   * @memberof Prophet
   */
  tryGetCachedBvobContent (bvobId: string): ArrayBuffer {
    return this._upstream.tryGetCachedBvobContent(bvobId);
  }

  /**
   * Returns a map of fully synced partition connections keyed by their partition id.
   */
  getSyncedConnections (): Map<string, PartitionConnection> {
    const ret = {};
    Object.entries(this._connections).forEach(([key, connection]) => {
      if (connection.isSynced()) ret[key] = connection;
    });
    return ret;
  }
  getFullPartitionConnections () : Map<string, PartitionConnection> {
    this.warnEvent(
        "DEPRECATED: prefer getSyncedConnections instead of getFullPartitionConnections");
    return this.getSyncedConnections();
  }

  /**
   * Returns a map of still synchronizing partition connections keyed by their partition id.
   */
  getConnectionsPendingSync () : Map<string, Promise<PartitionConnection> > {
    const ret = {};
    Object.entries(this._connections).forEach(([key, connection]) => {
      if (!connection.isSynced()) ret[key] = connection.getSyncedConnection();
    });
    return ret;
  }
  getPendingPartitionConnections () : Map<string, PartitionConnection> {
    this.warnEvent(
        "DEPRECATED: prefer getConnectionsPendingSync instead of getPendingPartitionConnections");
    return this.getSyncedConnections();
  }
}
