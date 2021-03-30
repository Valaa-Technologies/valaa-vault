// @flow

import Sourcerer from "~/sourcerer/api/Sourcerer";
import { SourceryOptions } from "~/sourcerer/api/types";

import DecoderArray from "~/sourcerer/Oracle/DecoderArray";

import OracleConnection from "./OracleConnection";

/**
 * TODO(iridian): Outdated, clean up.
 *
 * Oracle is the central hub for routing content and metadata streams
 * between the downstream users, upstream authorities and local caches.
 *
 * 1. Provides downstream multi-chronicle event synchronization and
 *   deduplication by gating individual chronicle event downstreams
 *   until all chronicles reach the same point.
 *
 * 2. Provides media bvob pre-caching by gating downstream events until
 *   all required bvob content has been retrieved and stored in scribe.
 *
 * 3. Provides upstream media command gating by making sure all
 *   associated bvob content is stored in corresponding authority
 *   storage before letting the commands go further upstream.
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
    this._decoderArray = new DecoderArray({ name: `Decoders of ${this.getName()}`, parent: this });
  }

  getDecoderArray () { return this._decoderArray; }

  createChronicleURI (authorityURI: string, chronicleId: string) {
    return this._authorityNexus.createChronicleURI(authorityURI, chronicleId);
  }

  splitChronicleURI (chronicleURI: string): [string, string] {
    return this._authorityNexus.splitChronicleURI(chronicleURI);
  }

  obtainAuthorityOfChronicle (chronicleURI: string) {
    const ret = this._authorityNexus.obtainAuthorityOfChronicle(chronicleURI);
    if (!ret) {
      throw new Error(`Couldn't obtain authority for chronicle <${chronicleURI}>`);
    }
    return ret;
  }

  _createConnection (chronicleURI: string, sourceryOptions: SourceryOptions) {
    const authoritySourcerer = this.obtainAuthorityOfChronicle(chronicleURI);
    return new OracleConnection({
      chronicleURI, sourcerer: this, verbosity: this.getVerbosity(),
      sourceryOptions, authoritySourcerer,
    });
  }
}
