// @flow

import type Command from "~/raem/command";
import ValaaURI, { getPartitionRawIdFrom } from "~/raem/ValaaURI";

import Prophet, { ClaimResult, NarrateOptions } from "~/prophet/api/Prophet";

import { dumpObject } from "~/tools";

import OraclePartitionConnection from "./OraclePartitionConnection";
import { _acquirePartitionConnection } from "./_connectionOps";
import { _claim } from "./_upstreamOps";

/**
 * Oracle is the central hub for routing content and metadata streams between the downstream users,
 * upstream authorities and local caches.
 *
 * 1. Provides downstream multi-partition event synchronization and deduplication by gating
 * individual partition event downstreams until all partitions reach the same point.
 *
 * 2. Provides media bvob pre-caching by gating downstream events until all required bvob content
 * has been retrieved and stored in scribe.
 *
 * 3. Provides upstream media command gating by making sure all associated bvob content is stored in
 * corresponding authority storage before letting the commands go further upstream.
 *
 * 4. Provides offline mode handling through scribe.
 *
 * @export
 * @class Oracle
 * @extends {Prophet}
 */
export default class Oracle extends Prophet {

  _partitionConnections: {
    [partitionRawId: string]: {
      // Set both if the connection process is on-going or fully connected.
      connection: OraclePartitionConnection,
      // Only set if connection process is on-going, null if fully connected.
      pendingConnection: ?Promise<OraclePartitionConnection>,
    }
  };

  constructor ({ scribe, authorityNexus, ...rest }: Object) {
    super({ ...rest, upstream: scribe });
    this._authorityNexus = authorityNexus;
    this._partitionConnections = {};
  }

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
   *   onlyTrySynchronousConnection: boolean = false,
   *   // If true does not create a new connection process is one cannot be found.
   *   dontCreateNewConnection: boolean = false,
   *   // If true requests a creation of a new partition and asserts if one exists. If false,
   *   // asserts if no commands or events for the partition can be found.
   *   createNewPartition: boolean = false,
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
  acquirePartitionConnection (partitionURI: ValaaURI, options: NarrateOptions = {}): any {
    let partitionRawId;
    try {
      partitionRawId = getPartitionRawIdFrom(partitionURI);
      return _acquirePartitionConnection(this, partitionURI, partitionRawId, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, `acquirePartitionConnection(${String(partitionURI)})`,
          "\n\toptions:", ...dumpObject(options),
          "\n\tpartitionRawId:", partitionRawId,
          "\n\texisting connection:", ...dumpObject(
              partitionRawId && this._partitionConnections[partitionRawId]));
    }
  }

  getFullPartitionConnections (): Object {
    const ret = {};
    Object.entries(this._partitionConnections)
        .forEach(([key, { connection, pendingConnection }]) => {
          if (!pendingConnection) ret[key] = connection;
        });
    return ret;
  }

  getPendingPartitionConnections (): Object {
    const ret = {};
    Object.entries(this._partitionConnections).forEach(
        ([key, { pendingConnection }]) => {
          if (pendingConnection) ret[key] = pendingConnection;
        }
    );
    return ret;
  }

  _claimOperationQueue = [];

  // Coming from downstream
  claim (command: Command, options: Object): ClaimResult { return _claim(this, command, options); }
}
