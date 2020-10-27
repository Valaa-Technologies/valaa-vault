// @flow

import { NarrateOptions, ReceiveEvents } from "~/sourcerer/api/types";
import Follower from "~/sourcerer/api/Follower";
import type Connection from "~/sourcerer/api/Connection";

import { FabricEventTarget } from "~/tools/FabricEvent";
import { dumpObject } from "~/tools/wrapError";

  /**
   * Eagerly acquires and returns an existing full connection, otherwise
   * returns a promise of one. If any narration options are specified in the options, said
   * narration is also performed before the connection is considered fully connected.
   *
   * @param {ValaaURI} chronicleURI
   * @param {NarrateOptions} [options={
   *   // If true and a connection (even a non-fully-connected) exists it is returned synchronously.
   *   allowPartialConnection: boolean = false,
   *   // If false does not create a new connection process is one cannot be found.
   *   newConnection: boolean = true,
   *   // If true requests a creation of a new chronicle and asserts if one exists. If false,
   *   // asserts if no commands or events for the chronicle can be found.
   *   newChronicle: boolean = false,
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
export type SourceryOptions = {
  sourcer?: boolean,                      // default: true. Connect to updates
  subscribeEvents?: boolean,              // default: true. Subscribe for downstream push events.
  pushTruths?: ReceiveEvents,   // The persistent callback for downstream push events.
  narrateOptions?: NarrateOptions, // default: {}. Narrate with default options. False to disable.
  newConnection?: boolean,                // if true, throw if a connection exists,
                                          // if false, throw if no connection exists,
  newChronicle?: boolean,          // if true, throw if a chronicle exists (has persisted events)
                                   // if false, throw if no chronicle exists (no persisted events)
  allowPartialConnection?: boolean,       // default: false. If true, return not fully narrated
                                          // connection synchronously
  requireLatestMediaContents?: boolean,   //
};

/* eslint-disable no-unused-vars */

/**
 * Interface for sending commands to upstream.
 */
export default class Sourcerer extends FabricEventTarget {
  _upstream: Sourcerer;
  _followers: Follower;
  _connections: { [chronicleURI: string]: Connection };

  constructor (options: Object = {}) {
    super(options.parent, options.verbosity, options.name);
    this._followers = new Map();
    this._connections = {};
    this.setUpstream(options.upstream);
  }

  initiate (): Promise<Sourcerer> | Sourcerer {}

  addFollower (follower: Follower, options: ?Object): Follower {
    const discourse = this.createDiscourse(follower, options);
    this._followers.set(follower, discourse);
    return discourse;
  }

  setUpstream (upstream) {
    this._upstream = upstream;
    if (upstream) upstream.addFollower(this);
  }

  createDiscourse (follower: Follower) {
    return follower;
  }

  /**
   * Returns a connection to chronicle identified by given chronicleURI.
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
   *    chronicle in the Scribe
   * 2. all events in the most recent authorized snapshot known by the
   *    remote authority connection
   * 3. all events in the remote authorize event log itself
   *
   * Irrespective of where the first narration is sourcered, an
   * authorized full narration is initiated against the remote
   * authority if available.
   *
   * @param {ValaaURI} chronicleURI
   * @returns {Connection}
   *
   * @memberof Sourcerer
   */
  sourcerChronicle (chronicleURI: string, options: SourceryOptions = {}): ?Connection {
    try {
      let connection = this._connections[chronicleURI];
      if (connection) return connection;
      if (options.newConnection === false) {
        if (options.require === false) return undefined;
        throw new Error(
            "Can't create new chronicle connection with options.newConnection === false");
      }
      connection = this._createConnection(chronicleURI,
          Object.assign(Object.create(options), { sourcer: false }));
      if (!connection) return undefined;
      connection.addReference();
      this._connections[chronicleURI] = connection;
      if (options.sourcer !== false) connection.sourcer(options); // Don't wait for sourcery.
      return connection;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1,
          new Error(`sourcerChronicle(${chronicleURI})`),
          "\n\toptions:", ...dumpObject(options));
    }

      /*
      if (options.newChronicle && connection && connection.getFirstUnusedTruthEventId()) {
        throw new Error(`Chronicle already exists when trying to create a new chronicle '${
            chronicleURI}'`);
      }

      if (!ret || (!ret.isActive() && (options.allowPartialConnection === false))) return undefined;
      // oracle.logEvent("acquirePC:", chronicleURI, ...dumpObject(options),
      //    "\n\tret:", ...dumpObject(ret));
      return ret;
      */
  }

  acquireConnection (chronicleURI: string, options: SourceryOptions) {
    return this.sourcerChronicle(chronicleURI, options);
  }

  _createConnection (chronicleURI: string, options: SourceryOptions) {
    const ConnectionType = this.constructor.ConnectionType;
    if (!ConnectionType) {
      return this._upstream.sourcerChronicle(chronicleURI, options);
    }
    return new ConnectionType({
      chronicleURI, sourcerer: this, verbosity: this.getVerbosity(),
      pushTruths: options.pushTruths,
      pushCommands: options.pushCommands,
    });
  }

  /**
   * Returns the bvob buffer for given contentHash as an ArrayBuffer if
   * it is locally available, undefined otherwise.
   *
   * @param {string} contentHash
   * @returns
   *
   * @memberof Sourcerer
   */
  tryGetCachedBvobContent (contentHash: string): ArrayBuffer {
    return this._upstream.tryGetCachedBvobContent(contentHash);
  }

  /**
   * Returns a map of fully active chronicle connections keyed by their
   * chronicle id.
   */
  getActiveConnections (): Map<string, Connection> {
    const ret = {};
    Object.entries(this._connections).forEach(([key, connection]) => {
      if (connection.isActive()) ret[key] = connection;
    });
    return ret;
  }

  getActiveConnection (chronicleURI: string) {
    const connection = this._connections[chronicleURI];
    if (!connection) throw new Error(`No connection to chronicle <${chronicleURI}> found`);
    if (!connection.isActive()) throw new Error(`Chronicle <${chronicleURI}> found but not active`);
    return connection;
  }

  getFullConnections () : Map<string, Connection> {
    this.debugEvent("DEPRECATED: getFullConnections in favor of getActiveConnections");
    return this.getActiveConnections();
  }

  /**
   * Returns a map of still synchronizing chronicle connections keyed
   * by their chronicle id.
   */
  getActivatingConnections () : Map<string, Promise<Connection> > {
    const ret = {};
    Object.entries(this._connections).forEach(([key, connection]) => {
      if (!connection.isActive()) ret[key] = connection.asSourceredConnection();
    });
    return ret;
  }
  getPendingConnections () : Map<string, Connection> {
    this.debugEvent("DEPRECATED: getPendingConnections in favor of getActivatingConnections");
    return this.getActiveConnections();
  }

  obtainAuthorityOfChronicle (chronicleURI: string) {
    return this._upstream.obtainAuthorityOfChronicle(chronicleURI);
  }

  resolveReference (reference: string | Object) {
    return this._upstream.resolveReference(reference);
  }
}
