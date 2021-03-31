// @flow

import type { EventBase } from "~/raem/events";

import Connection from "~/sourcerer/api/Connection";
import {
  EventCallback, Proclamation, ProclaimOptions, ProclaimEventResult, MediaInfo, NarrateOptions,
} from "~/sourcerer/api/types";

import { FutureEventData, getEventIndex } from "~/sourcerer/tools/event-version-0.3";

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
  _downstreamQueueStartIndex = undefined;
  _downstreamEventQueue = [];

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

  _sourcerUpstream (options /* , authorityConfig */) {
    if (options.newChronicle) {
      this._downstreamQueueStartIndex = 0;
    }
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
    if (this.isRemoteAuthority() && !options.proclamationResults) {
      throw new Error(`Failed to chronicle events to ${this.getName()}: ${this.constructor.name
          }.proclaimEvents not overridden and options.proclamationResults not defined`);
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
    AuthorityConnection.prototype._preprocessProclamationResults,
    AuthorityConnection.prototype._receiveTruthsLocally,
    AuthorityConnection.prototype._finalizeLocallyReceivedTruths,
  ]

  _errorOnProclaimEvents (error, stepIndex, params) {
    throw this.wrapErrorEvent(error, 1, new Error("proclaimEvents()"),
        `\n\tstep #${stepIndex} params:`, ...dumpObject(params));
  }

  _preprocessProclamationResults (op) {
    if (!op.options.proclamationResults) return [op];
    return [
      op,
      mapEagerly(op.options.proclamationResults,
          remoteEvent => remoteEvent,
          (error, head, index, remoteResults, entries, callback, onRejected) => {
            if (op.firstRejectedIndex === undefined) op.firstRejectedIndex = index;
            remoteResults[index] = Promise.reject(error);
            return mapEagerly(entries, callback, onRejected, index + 1, remoteResults);
          }),
    ];
  }

  _receiveTruthsLocally (op, remoteResults) {
    op.resultBase.remoteResults = remoteResults;
    const truths = (op.firstRejectedIndex !== undefined)
        ? remoteResults.slice(0, op.firstRejectedIndex)
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

  // Downstream queue ops

  // return value: accepted or not (note: not accepted can be normal operation)
  receiveEventMessage (message: string) {
    this.logEvent(2, () => ["Received event message:", { message }]);
    let shouldRenarrate = this._placeEventsToDownstreamQueue(
        [].concat((typeof message !== "string" ? message : JSON.parse(message)) || []),
        "received push event");
    const downstreamFlushing = this._pushConsecutiveQueueEventsDownstream();
    if (downstreamFlushing) {
      if (this._downstreamEventQueue.length) shouldRenarrate = true;
      thenChainEagerly(downstreamFlushing, [], e =>
          this.outputErrorEvent(e, "Exception caught during push event downstream flush"));
    }
    if (shouldRenarrate) {
      this._renarrateMissingEvents();
    }
  }

  _placeEventsToDownstreamQueue (events: Object[]) {
    let shouldRenarrate;
    for (const event of events) {
      if (event == null) {
        shouldRenarrate = true;
        continue;
      }
      const eventIndex = getEventIndex(event);
      if (eventIndex === undefined) {
        this.warnEvent(1, `Ignoring an incoming event which is missing eventIndex:`,
            ...dumpObject(event));
        continue;
      }
      const pendingIndex = eventIndex - this._downstreamQueueStartIndex;
      const duplicateReason = !(pendingIndex >= 0) ? "already narrated"
          : (this._downstreamEventQueue[pendingIndex] !== undefined) ? "already pending in queue"
          : undefined;
      if (!duplicateReason) {
        this._downstreamEventQueue[pendingIndex] = event;
      } else {
        this.warnEvent(1, () => [
          `Ignoring an event with index ${eventIndex}: ${duplicateReason}.`,
          ...dumpObject(event),
        ]);
      }
    }
    return shouldRenarrate;
  }

  _pushConsecutiveQueueEventsDownstream (pushEvents: EventCallback = this._pushTruthsDownstream) {
    let count = 0;
    while (this._downstreamEventQueue[count]) ++count;
    if (!count) return false;
    const truths = this._downstreamEventQueue.splice(0, count);
    this._downstreamQueueStartIndex += count;
    return pushEvents(truths);
  }

  _renarrateMissingEvents () {
    if (!this._config.isRemoteAuthority || this._missingEventsRenarration) {
      return;
    }
    const narrateOptions = { eventIdBegin: this._downstreamQueueStartIndex };
    const firstNonMissingIndex = this._downstreamEventQueue.findIndex(v => (v != null));
    if (firstNonMissingIndex > 0) {
      narrateOptions.eventIdEnd = this._downstreamQueueStartIndex + firstNonMissingIndex;
    }
    const renarration = this._missingEventsRenarration = this
        .narrateEventLog(narrateOptions)
        .finally(() => {
          if (this._missingEventsRenarration === renarration) {
            this._missingEventsRenarration = undefined;
          }
        })
        .then(result => Object.keys(result).length
            && this._renarrateMissingEvents())
        .catch(error =>
            this.outputErrorEvent(error, "Exception caught during renarrateMissingQueueEvents"));
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
    const contextName = new Error(`prepareBvob(${contentHash || "<undefined>"})`);
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
      throw connection.wrapErrorEvent(error, 1, contextName,
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
