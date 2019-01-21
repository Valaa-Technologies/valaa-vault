// @flow

import type { EventBase } from "~/raem/events";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import { ChronicleRequest, ChronicleOptions, ChronicleEventResult, MediaInfo, NarrateOptions }
    from "~/prophet/api/types";

import thenChainEagerly from "~/tools/thenChainEagerly";
import { debugObjectType, dumpObject } from "~/tools/wrapError";

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
  getEventVersion () { return this._prophet.getEventVersion(); }

  isConnected () {
    if (!this.isRemoteAuthority()) return true;
    return super.isConnected();
  }

  _doConnect (/* options: ConnectOptions */) {}

  narrateEventLog (options: ?NarrateOptions = {}): Object | Promise<Object> {
    if (this.isRemoteAuthority()) {
      throw new Error(`Failed to narrate events from ${this.getName()}: ${this.constructor.name
          }.narrateEventLog is not implemented`);
    }
    return !options ? undefined : {};
  }

  chronicleEvents (events: EventBase[], options: ChronicleOptions): ChronicleRequest {
    if (this.isRemoteAuthority() && !options.remoteChronicleEventsProcess) {
      throw new Error(`Failed to chronicle events to ${this.getName()}: ${this.constructor.name
          }.chronicleEvents not overridden and options.remoteChronicleEventsProcess not defined`);
    }
    const receiveTruths = this.getReceiveTruths(options.receivedTruths);
    const resultBase = new AuthorityEventResult(null, {
      connection: this,
      isPrimary: this.isPrimaryAuthority(),
      remoteChronicleEventsProcess: options.remoteChronicleEventsProcess,
      receiveTruthsProcess:
          options.remoteChronicleEventsProcess
              ? thenChainEagerly(options.remoteChronicleEventsProcess, [
                individualRemoteEventProcesses => Promise.all(individualRemoteEventProcesses),
                remoteEvents => receiveTruths(remoteEvents),
              ])
          : this.isPrimaryAuthority()
              ? receiveTruths(events)
          : [],
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
      { contentHash: string, persistProcess: ?Promise<any> } {
    const connection = this;
    const wrap = new Error(`prepareBvob(${(mediaInfo && mediaInfo.bvobId) || "<undefined>"})`);
    try {
      if (!mediaInfo || !mediaInfo.bvobId) {
        throw new Error("mediaInfo.bvobId not defined");
      }
      let persistProcess = mediaInfo.bvobId;
      if (this.isRemoteAuthority()) {
        const error = new Error(`prepareBvob not implemented by remote authority partition`);
        error.retryable = false;
        persistProcess = Promise
            .reject(this.wrapErrorEvent(error, new Error("prepareBvob")))
            .catch(errorOnAuthorityPartitionConnectionPrepareBvob);
      }
      return { contentHash: mediaInfo.bvobId, persistProcess };
    } catch (error) { return errorOnAuthorityPartitionConnectionPrepareBvob(error); }
    function errorOnAuthorityPartitionConnectionPrepareBvob (error) {
      throw connection.wrapErrorEvent(error, wrap,
          "\n\tcontent:", debugObjectType(content),
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tconnection:", ...dumpObject(connection));
    }
  }
}

export class AuthorityEventResult extends ChronicleEventResult {
  getLocalEvent () {
    return thenChainEagerly(this.receiveTruthsProcess,
        receivedTruths => receivedTruths[this.index],
        this.onError);
  }
  getTruthEvent () {
    if (!this.isPrimary) {
      throw new Error(`Non-primary authority '${this.connection.getName()
          }' cannot deliver truths (by default)`);
    }
    if (!this.remoteChronicleEventsProcess) return this.getLocalEvent(); // implies: not remote
    return thenChainEagerly(this.remoteChronicleEventsProcess,
        chronicledEvents => chronicledEvents[this.index],
        this.onError);
  }
}
