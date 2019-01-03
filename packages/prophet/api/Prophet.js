// @flow

import type ValaaURI from "~/raem/ValaaURI";

import { NarrateOptions, ReceiveEvents } from "~/prophet/api/types";
import Follower from "~/prophet/api/Follower";
import type PartitionConnection from "~/prophet/api/PartitionConnection";

import { LogEventGenerator } from "~/tools/Logger";
import { dumpObject } from "~/tools/wrapError";

  /**
   * Eagerly acquires and returns an existing full connection, otherwise
   * returns a promise of one. If any narration options are specified in the options, said
   * narration is also performed before the connection is considered fully connected.
   *
   * @param {ValaaURI} partitionURI
   * @param {NarrateOptions} [options={
   *   // If true and a connection (even a non-fully-connected) exists it is returned synchronously.
   *   allowPartialConnection: boolean = false,
   *   // If true does not initiate new connection and returns undefined instead of any promise.
   *   synchronous: boolean = false,
   *   // If false does not create a new connection process is one cannot be found.
   *   newConnection: boolean = true,
   *   // If true requests a creation of a new partition and asserts if one exists. If false,
   *   // asserts if no commands or events for the partition can be found.
   *   newPartition: boolean = false,
   *   // If true, throws an error if the retrieval for the latest content for any media fails.
   *   // Otherwise allows the connection to complete successfully. But because then not all latest
   *   // content might be locally available, Media.immediateContent calls for script files might
   *   // fail and Media.readContent operations might result in making unreliable network accesses.
   *   requireLatestMediaContents: boolean = true,
   * }]
   * @returns {*}
   *
   * @memberof Oracle
   */
export type ConnectOptions = {
  connect?: boolean,               // default: true. Connect to updates
  subscribe?: boolean,             // default: true. Subscribe for downstream push events.
  receiveTruths?: ReceiveEvents,   // The persistent connection callback for downstream push events.
  narrateOptions?: NarrateOptions, // default: {}. Narrate with default options. False to disable.
  newConnection?: boolean,         // if true, throw if a connection exists,
                                   // if false, throw if no connection exists,
  newPartition?: boolean,          // if true, throw if a partition exists (has persisted events)
                                   // if false, throw if no partition exists (no persisted events)
  synchronous?: boolean, // if true
  allowPartialConnection?: boolean,       // default: false. If true, return not fully narrated
                                          // connection synchronously
  requireLatestMediaContents?: boolean,   //
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

  /**
   * Returns a connection to partition identified by given partitionURI.
   *
   * The returned connection might be shared between other users and
   * implements internal reference counting; it is acquired once as
   * part of this call. The connection must be manually released
   * with removeReference or otherwise the connection resources will be
   * left open.
   *
   * The connection is considered acquired and the promise is resolved
   * after a lazy greedy "first narration" is complete. Lazy means that
   * only the single closest source which can provide events is
   * consulted. Greedy means that all events from that source are
   * retrieved.
   *
   * The design principle behind this is that no non-authoritative
   * event log cache shall have functionally incomplete event logs,
   * even if event log might be outdated in itself.
   *
   * More specifically in inspire context the first source resulting in
   * non-zero events is chosen:
   * 1. all events of the latest previously seen full narration of this
   *    partition in the Scribe
   * 2. all events in the most recent authorized snapshot known by the
   *    remote authority connection
   * 3. all events in the remote authorize event log itself
   *
   * Irrespective of where the first narration is sourced, an
   * authorized full narration is initiated against the remote
   * authority if available.
   *
   * @param {ValaaURI} partitionURI
   * @returns {PartitionConnection}
   *
   * @memberof Prophet
   */
  acquirePartitionConnection (partitionURI: ValaaURI,
      options: ConnectOptions = {}): ?PartitionConnection {
    try {
      let connection = this._connections[String(partitionURI)];
      if (connection) return connection;
      if (options.newConnection === false) {
        if (options.require === false) return undefined;
        throw new Error(
            "Can't create new partition connection with options.newConnection === false");
      }
      connection = this._createPartitionConnection(partitionURI, { ...options, connect: false });
      if (!connection) return undefined;
      connection.addReference();
      this._connections[String(partitionURI)] = connection;
      if (options.connect !== false) connection.connect(options); // Initiate connect but dont wait.
      return connection;
    } catch (error) {
      throw this.wrapErrorEvent(error,
          new Error(`acquirePartitionConnection(${String(partitionURI)})`),
          "\n\toptions:", ...dumpObject(options));
    }

      /*
      if (options.newPartition || options.synchronous) {
        if (options.synchronous) return connection;
        if (connection && connection.getFirstUnusedTruthEventId()) {
          throw new Error(`Partition already exists when trying to create a new partition '${
              String(partitionURI)}'`);
        }
      }

      if (!ret || (!ret.isActive() && (options.allowPartialConnection === false))) return undefined;
      // oracle.logEvent("acquirePC:", partitionURI, ...dumpObject(options),
      //    "\n\tret:", ...dumpObject(ret));
      return ret;
      */
  }

  _createPartitionConnection (partitionURI: ValaaURI, options: ConnectOptions) {
    const PartitionConnectionType = this.constructor.PartitionConnectionType;
    if (!PartitionConnectionType) {
      return this._upstream.acquirePartitionConnection(partitionURI, options);
    }
    return new PartitionConnectionType({
      partitionURI, prophet: this, verbosity: this.getVerbosity(),
      receiveTruths: options.receiveTruths, receiveCommands: options.receiveCommands,
      ...(options.createConnectionOptions || {}),
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
   * Returns a map of fully active partition connections keyed by their partition id.
   */
  getActiveConnections (): Map<string, PartitionConnection> {
    const ret = {};
    Object.entries(this._connections).forEach(([key, connection]) => {
      if (connection.isActive()) ret[key] = connection;
    });
    return ret;
  }
  getFullPartitionConnections () : Map<string, PartitionConnection> {
    this.warnEvent(
        "DEPRECATED: prefer getActiveConnections instead of getFullPartitionConnections");
    return this.getActiveConnections();
  }

  /**
   * Returns a map of still synchronizing partition connections keyed by their partition id.
   */
  getActivatingConnections () : Map<string, Promise<PartitionConnection> > {
    const ret = {};
    Object.entries(this._connections).forEach(([key, connection]) => {
      if (!connection.isActive()) ret[key] = connection.getActiveConnection();
    });
    return ret;
  }
  getPendingPartitionConnections () : Map<string, PartitionConnection> {
    this.warnEvent(
        "DEPRECATED: prefer getActivatingConnections instead of getPendingPartitionConnections");
    return this.getActiveConnections();
  }

  obtainPartitionAuthority (partitionURI: string | ValaaURI) {
    return this._upstream.obtainPartitionAuthority(partitionURI);
  }
}
