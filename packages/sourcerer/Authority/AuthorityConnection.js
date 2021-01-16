// @flow

import type { EventBase } from "~/raem/events";

import Connection from "~/sourcerer/api/Connection";
import { Proclamation, ProclaimOptions, ProclaimEventResult, MediaInfo, NarrateOptions }
    from "~/sourcerer/api/types";

import { thenChainEagerly, mapEagerly } from "~/tools/thenChainEagerly";
import { debugObjectType, dumpObject } from "~/tools/wrapError";

/**
 * The base authority chronicle connection implementation.
 * Provides all necessary services for local authorities use this directly.
 * Remote authorities extend this class
 *
 * @export
 * @class AuthorityConnection
 * @extends {Connection}
 */
export default class AuthorityConnection extends Connection {
  isLocallyRecorded () { return this.getSourcerer().isLocallyRecorded(); }
  isPrimaryAuthority () { return this.getSourcerer().isPrimaryAuthority(); }
  isRemoteAuthority () { return this.getSourcerer().isRemoteAuthority(); }
  getEventVersion () { return this.getSourcerer().getEventVersion(); }

  isConnected () {
    if (!this.isRemoteAuthority()) return true;
    return super.isConnected();
  }

  getName () {
    return this.getRawName();
  }

  static sourceryOpsName = "authoritySourcery";
  static authoritySourcery = [
    AuthorityConnection.prototype._sourcerUpstream,
    Connection.prototype._narrateEventLog,
    Connection.prototype._finalizeSourcery,
  ]

  _sourcerUpstream (options) {
    return super._sourcerUpstream(options, { sourceredUpstream: null });
  }

  narrateEventLog (options: ?NarrateOptions = {}): Object | Promise<Object> {
    if (this.isRemoteAuthority()) {
      throw new Error(`Failed to narrate events from ${this.getName()}: ${this.constructor.name
          }.narrateEventLog is not implemented`);
    }
    return !options ? undefined : {};
  }

  proclaimEvents (events: EventBase[], options: ProclaimOptions): Proclamation {
    if (this.isRemoteAuthority() && !options.remoteEventsProcess) {
      throw new Error(`Failed to chronicle events to ${this.getName()}: ${this.constructor.name
          }.proclaimEvents not overridden and options.remoteEventsProcess not defined`);
    }
    const op = { events, options, resultBase: new AuthorityEventResult(this, options.verbosity) };
    op.resultBase.remoteResults = null;
    op.resultBase.isPrimary = this.isPrimaryAuthority();
    op.resultBase.authorityProclaimProcess = this.opChain(
        "authorityProclaim", op,
        "_errorOnProclaimEvents", this.opLog(2, options.plog, "proclaim"));
    op.resultBase.truthsProcess = thenChainEagerly(
        op.resultBase.authorityProclaimProcess,
        receivedTruths => (op.resultBase.truthsProcess =
            (this.isPrimaryAuthority() && (receivedTruths || events)) || []));
    return {
      eventResults: events.map((event, index) => {
        const ret = Object.create(op.resultBase);
        ret.event = event; ret.index = index;
        return ret;
      }),
    };
  }

  static authorityProclaim = [
    AuthorityConnection.prototype._processRemoteEvents,
    AuthorityConnection.prototype._receiveTruthsLocally,
    AuthorityConnection.prototype._finalizeLocallyReceivedTruths,
  ]

  _errorOnProclaimEvents (error, stepIndex, params) {
    throw this.wrapErrorEvent(error, 1, new Error("proclaimEvents()"),
        `\n\tstep #${stepIndex} params:`, ...dumpObject(params));
  }

  _processRemoteEvents (op) {
    if (!op.options.remoteEventsProcess) return [op];
    return [
        op,
        mapEagerly(op.options.remoteEventsProcess,
            remoteEvent => remoteEvent,
            (error, head, index, remoteEvents, entries, callback, onRejected) => {
              if (op.rejectedIndex === undefined) op.rejectedIndex = index;
              remoteEvents[index] = Promise.reject(error);
              return mapEagerly(entries, callback, onRejected, index + 1, remoteEvents);
            }),
    ];
  }

  _receiveTruthsLocally (op, remoteResults) {
    op.resultBase.remoteResults = remoteResults;
    const truths = (op.rejectedIndex !== undefined)
        ? remoteResults.slice(0, op.rejectedIndex)
        : remoteResults || op.events;
    if (!truths || !truths.length) return [op];
    return [
      op,
      op.resultBase.getChronicler().getReceiveTruths(op.options.receivedTruths)(truths),
    ];
  }

  _finalizeLocallyReceivedTruths (op, receivedTruths) {
    return (op.resultBase.authorityProclaimProcess = receivedTruths);
  }

  // Coming from downstream: tries scribe first, otherwise forwards the request to authority.
  // In latter case forwards the result received from authority to Scribe for caching.
  requestMediaContents (mediaInfos: MediaInfo[]): any[] {
    return mediaInfos.map(mediaInfo => Promise.reject(new Error(
        `Authority connection '${this.getName()}' doesn't implement content requests (for Media '${
            mediaInfo.name}') and content not found in local cache`)));
  }

  prepareBvob (content: any, mediaInfo?: Object):
      Promise<Object> | { contentHash: string, persistProcess: ?Promise<any> } {
    const connection = this;
    const contentHash = mediaInfo && mediaInfo.contentHash;
    const wrap = new Error(`prepareBvob(${contentHash || "<undefined>"})`);
    try {
      if (!contentHash) throw new Error("mediaInfo.contentHash not defined");
      let persistProcess = contentHash;
      if (this.isRemoteAuthority()) {
        const error = new Error(`prepareBvob not implemented by remote authority chronicle`);
        error.isRetryable = false;
        persistProcess = Promise
            .reject(this.wrapErrorEvent(error, 1, new Error("prepareBvob")))
            .catch(errorOnAuthorityConnectionPrepareBvob);
      }
      return { contentHash, persistProcess };
    } catch (error) { return errorOnAuthorityConnectionPrepareBvob(error); }
    function errorOnAuthorityConnectionPrepareBvob (error) {
      throw connection.wrapErrorEvent(error, 1, wrap,
          "\n\tcontent:", debugObjectType(content),
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tconnection:", ...dumpObject(connection));
    }
  }
}

export class AuthorityEventResult extends ProclaimEventResult {
  getComposedEvent () {
    return thenChainEagerly(this.authorityProclaimProcess,
        receivedEvents => receivedEvents[this.index],
        this.onGetEventError);
  }
  getTruthEvent () {
    if (!this.isPrimary) {
      throw new Error(`Non-primary authority '${this.getChronicler().getName()
          }' cannot deliver truths (by default)`);
    }
    if (!this.truthsProcess) return this.getComposedEvent(); // implies: not remote
    return thenChainEagerly(this.truthsProcess,
        truthEvents => (this.remoteResults || truthEvents)[this.index],
        this.onGetEventError);
  }
}
