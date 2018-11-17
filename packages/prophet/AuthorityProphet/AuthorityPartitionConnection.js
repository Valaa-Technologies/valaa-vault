// @flow

import type { EventBase } from "~/raem/events";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import thenChainEagerly from "~/tools/thenChainEagerly";
import { ChronicleRequest, ChronicleOptions, ChronicleEventResult, MediaInfo }
    from "~/prophet/api/types";

/**
 * The base authority partition connection implementation.
 * Provides all necessary services for local authorities use this directly.
 * Remote authorities extend this class
 *
 * @export
 * @class AuthorityPartitionConnection
 * @extends {PartitionConnection}
 */
export default class AuthorityPartitionConnection extends PartitionConnection {

  isLocallyPersisted () { return this._prophet.isLocallyPersisted(); }
  isPrimaryAuthority () { return this._prophet.isPrimaryAuthority(); }
  isRemoteAuthority () { return this._prophet.isRemoteAuthority(); }

  isConnected () {
    if (!this.isRemoteAuthority()) return true;
    return super.isConnected();
  }

  _connect (/* options: ConnectOptions, onError: Function */) {}

  async narrateEventLog (): Promise<any> { return {}; }

  chronicleEvents (events: EventBase[], options: ChronicleOptions): ChronicleRequest {
    if (this.isRemoteAuthority()) {
      throw new Error(`${this.constructor.name
          }.chronicleEvents not implemented by remote authority partition "${this.getName()}"`);
    }
    const resultBase = new AuthorityEventResult(null, {
      connection: this,
      isPrimary: this.isPrimaryAuthority(),
      receivedTruthsProcess: !this.isPrimaryAuthority() ? []
          : this.getReceiveTruths(options.receiveTruths)(events),
    });
    return {
      eventResults: events.map((event, index) => {
        const ret = Object.create(resultBase); ret.event = event; ret.index = index; return ret;
      }),
    };
  }

  // Coming from downstream: tries scribe first, otherwise forwards the request to authority.
  // In latter case forwards the result received from authority to Scribe for caching.
  requestMediaContents (mediaInfos: MediaInfo[]): any[] {
    return mediaInfos.map(mediaInfo => Promise.reject(new Error(
        `Authority connection '${this.getName()}' doesn't implement media content requests ('${
            mediaInfo.name}' requested)`)));
  }

  prepareBvob (content: any, mediaInfo?: Object):
      { contentId: string, persistProcess: ?Promise<any> } {
    if (!mediaInfo || !mediaInfo.bvobId) {
      throw new Error("mediaInfo.bvobId not defined in AuthorityProphetConnection");
    }
    let persistProcess = mediaInfo.bvobId;
    if (this.isRemoteAuthority()) {
      const error = new Error(`prepareBvob not implemented by remote authority partition`);
      error.retryable = false;
      persistProcess = Promise.reject(this.wrapErrorEvent(error, new Error("prepareBvob")));
    }
    return { contentId: mediaInfo.bvobId, persistProcess };
  }
}

export class AuthorityEventResult extends ChronicleEventResult {
  getLocalEvent () {
    return thenChainEagerly(this.receivedTruthsProcess,
        (receivedTruths) => receivedTruths[this.index]);
  }
  getTruthEvent () {
    if (this.isPrimary) return this.getLocalEvent();
    throw new Error(`Non-primary authority '${this.connection.getName()
        }' cannot deliver truths (by default)`);
  }
}
