// @flow

import { ValaaURI } from "~/raem/ValaaURI";

import Sourcerer from "~/sourcerer/api/Sourcerer";
import { ConnectOptions } from "~/sourcerer/api/types";

import DecoderArray from "~/sourcerer/Oracle/DecoderArray";

import OracleConnection from "./OracleConnection";

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
 * @extends {Sourcerer}
 */
export default class Oracle extends Sourcerer {
  constructor ({ authorityNexus, ...rest }: Object) {
    super({ ...rest });
    this._authorityNexus = authorityNexus;
    this._decoderArray = new DecoderArray({
      name: `Decoders of ${this.getName()}`,
      logger: this.getLogger(),
    });
  }

  getDecoderArray () { return this._decoderArray; }

  obtainoAuthorityOfPartition (partitionURI: ValaaURI) {
    const ret = this._authorityNexus.obtainAuthorityOfPartition(partitionURI);
    if (!ret) {
      throw new Error(`Can't obtain authority for partition <${partitionURI}>`);
    }
    return ret;
  }

  _createConnection (partitionURI: ValaaURI, options: ConnectOptions) {
    const authoritySourcerer = this._authorityNexus.obtainAuthorityOfPartition(partitionURI);
    if (!authoritySourcerer) {
      throw new Error(`Can't obtain authority for partition <${partitionURI}>`);
    }
    return new OracleConnection({
      partitionURI, sourcerer: this, verbosity: this.getVerbosity(),
      receiveTruths: options.receiveTruths, authoritySourcerer,
    });
  }
}
