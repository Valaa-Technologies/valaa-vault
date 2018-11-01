// @flow

import ValaaURI from "~/raem/ValaaURI";

import Prophet, { ConnectOptions } from "~/prophet/api/Prophet";

import DecoderArray from "~/prophet/Oracle/DecoderArray";

import OraclePartitionConnection from "./OraclePartitionConnection";

/**
 * TODO(iridian): Outdated, clean up.
 *
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

  static PartitionConnectionType = OraclePartitionConnection;

  constructor ({ authorityNexus, ...rest }: Object) {
    super({ ...rest });
    this._authorityNexus = authorityNexus;
    this._decoderArray = new DecoderArray({
      name: `Decoders of ${this.getName()}`,
      logger: this.getLogger(),
    });
  }

  getDecoderArray () { return this._decoderArray; }

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
  acquirePartitionConnection (partitionURI: ValaaURI, options: ConnectOptions = {}):
      ?PartitionConnection {
    try {
      return _acquirePartitionConnection(this, partitionURI, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, `acquirePartitionConnection(${String(partitionURI)})`,
          "\n\toptions:", ...dumpObject(options));
    }
  }
}
