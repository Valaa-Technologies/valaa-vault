// @flow

import type { EventBase } from "~/raem/events";
import type { VRef } from "~/raem/ValaaReference";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import {
  MediaInfo, NarrateOptions, ChronicleOptions, ChronicleRequest, ConnectOptions,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/prophet/api/types";
import { tryAspect } from "~/prophet/tools/EventAspects";
import { deserializeVRef } from "~/prophet/FalseProphet";

import { DelayedQueue, dumpObject, thenChainEagerly } from "~/tools";

import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";

import {
  MediaEntry, _prepareBvob, _determineEventMediaPreOps, _requestMediaContents
} from "./_contentOps";
import {
  _initializeConnectionIndexedDB, _updateMediaEntries, _readMediaEntries, _destroyMediaInfo,
  _writeTruths, _readTruths, _writeCommands, _readCommands, _deleteCommands,
} from "./_databaseOps";
import {
  _narrateEventLog, _chronicleEvents, _receiveEvents, _triggerEventQueueWrites
} from "./_eventOps";

export default class ScribePartitionConnection extends PartitionConnection {
  // Info structures

  // If not eventLogInfo eventIdBegin is not 0, it means the oldest
  // stored event is a snapshot with that id.
  _truthLogInfo: { eventIdBegin: number, eventIdEnd: number };
  _commandQueueInfo: { eventIdBegin: number, eventIdEnd: number, commandIds: string[] };

  // Contains the media infos for most recent actions seen per media.
  // This lookup is updated whenever the media retrievers are created for the action, which is
  // before any medias are downloaded and before media info is persisted.
  // See Scribe._persistedMediaLookup for contrast.
  _pendingMediaLookup: { [mediaRawId: string]: MediaEntry };

  // Contains partition specific bvob state data.
  _pendingBvobLookup: { [bvobId: string]: {
    localPersistProcess: Promise<Object>,
    upstreamPrepareBvobProcess: Promise<Object>,
  } } = {};

  _db: IndexedDBWrapper;

  constructor (options: Object) {
    super(options);
    this._truthLogInfo = {
      eventIdBegin: 0, eventIdEnd: 0, writeQueue: new DelayedQueue(),
    };
    this._commandQueueInfo = {
      eventIdBegin: 0, eventIdEnd: 0, writeQueue: new DelayedQueue(), commandIds: [],
    };
  }

  getStatus () {
    return {
      indexedDB: { truthLog: this._truthLogInfo, commandQueue: this._commandQueueInfo },
      ...super.getStatus(),
    };
  }

  _doConnect (options: ConnectOptions) {
    if (this._prophet._upstream) {
      this.setUpstreamConnection(this._prophet._upstream.acquirePartitionConnection(
          this.getPartitionURI(), {
            // Set the permanent receiver without options.receiveTruths,
            // initiate connection but disable initial narration; perform
            // the initial optimistic narrateEventLog later below using
            // options.receiveTruths.
            ...options,
            receiveTruths: this.getReceiveTruths(), narrateOptions: false, subscribeEvents: false,
          }));
    }
    // ScribePartitionConnection can be active even if the upstream
    // connection isn't, as long as there are any events in the local
    // cache and thus optimistic narration is possible.
    return thenChainEagerly(null, [
      ...(!this.isLocallyPersisted ? [] : [
        () => _initializeConnectionIndexedDB(this),
        () => this._readMediaEntries(),
        (mediaEntries) => {
          this._pendingMediaLookup = mediaEntries;
          for (const [mediaRawId, entry] of Object.entries(this._pendingMediaLookup)) {
            this._prophet._persistedMediaLookup[mediaRawId] = entry;
          }
        },
      ]),
      () => ((options.narrateOptions !== false) && this.narrateEventLog({
        subscribeEvents: options.subscribeEvents, ...options.narrateOptions,
      })),
    ]);
  }

  disconnect () {
    const adjusts = {};
    for (const entry of Object.values(this._pendingMediaLookup)) {
      if (entry.isInMemory) adjusts[entry.contentHash] = -1;
      delete this._prophet._persistedMediaLookup[entry.mediaId];
    }
    this._prophet._adjustInMemoryBvobBufferRefCounts(adjusts);
    this._pendingMediaLookup = {};
    super.disconnect();
  }

  getFirstTruthEventId () { return this._truthLogInfo.eventIdBegin; }
  getFirstUnusedTruthEventId () { return this._truthLogInfo.eventIdEnd; }

  getFirstCommandEventId () { return this._commandQueueInfo.eventIdBegin; }
  getFirstUnusedCommandEventId () { return this._commandQueueInfo.eventIdEnd; }

  narrateEventLog (options: ?NarrateOptions = {}):
      Promise<{ scribeTruthLog: any, scribeCommandQueue: any }> {
    if (!options) return undefined;
    if (!this.isLocallyPersisted()) return super.narrateEventLog(options);
    const connection = this;
    const wrap = new Error("narrateEventLog()");
    const ret = {};
    return _narrateEventLog(this, options, ret)
        .catch(function errorOnScribeNarrateEventLog (error) {
          throw connection.wrapErrorEvent(error, wrap,
              "\n\toptions:", ...dumpObject(options),
              "\n\tcurrent ret:", ...dumpObject(ret));
        });
  }

  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}): ChronicleRequest {
    if (!this.isLocallyPersisted()) return super.chronicleEvents(events, options);
    const connection = this;
    const wrap = new Error("chronicleEvents()");
    try {
      return _chronicleEvents(this, events, options, errorOnScribeChronicleEvents);
    } catch (error) { return errorOnScribeChronicleEvents(error); }
    function errorOnScribeChronicleEvents (error) {
      throw connection.wrapErrorEvent(error, wrap,
          "\n\teventLog:", ...dumpObject(events),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  receiveTruths (truths: EventBase[], retrieveMediaBuffer?: RetrieveMediaBuffer,
      downstreamReceiveTruths: ReceiveEvents,
      type: ("receiveTruths" | "receiveCommands") = "receiveTruths",
  ) {
    if (!truths.length) return truths;
    const connection = this;
    const wrap = new Error(`${type}([${tryAspect(truths[0], "log").index}, ${
        tryAspect(truths[truths.length - 1], "log").index}])`);
    try {
      return _receiveEvents(this, truths, retrieveMediaBuffer, downstreamReceiveTruths,
          type, errorOnReceiveTruths);
    } catch (error) { throw errorOnReceiveTruths(error); }
    function errorOnReceiveTruths (error) {
      throw connection.wrapErrorEvent(error, wrap,
          "\n\ttruths:", ...dumpObject(truths), truths,
          "\n\tthis:", ...dumpObject(this));
    }
  }

  receiveCommands (commands: EventBase[], retrieveMediaBuffer?: RetrieveMediaBuffer,
      downstreamReceiveCommands: ReceiveEvents) {
    return this.receiveTruths(commands, retrieveMediaBuffer, downstreamReceiveCommands,
        "receiveCommands");
  }

  // Returns a promise to a write operation after which all entries
  // currently in the command queue write queue have been written, or
  // undefined if there are no pending command writes.
  _triggerCommandQueueWrites () {
    if (!this._commandQueueInfo.writeQueue.length) return undefined;
    if (this._commandQueueInfo.writeProcess) {
      return this._commandQueueInfo.writeProcess.then(() => this._commandQueueInfo.writeProcess);
    }
    return _triggerEventQueueWrites(this, this._commandQueueInfo, this._writeCommands.bind(this),
        undefined, (error) => {
          // Check for cross-tab writes
          throw error;
        });
  }

  // Returns a promise to a write operation after which all entries
  // currently in the truth log write queue have been written, or
  // undefined if there are no pending truth writes.
  _triggerTruthLogWrites (lastTruthCommandId?: any) {
    this._clampCommandQueueByTruthEvendIdEnd(lastTruthCommandId);
    if (!this._truthLogInfo.writeQueue.length) return undefined;
    if (this._truthLogInfo.writeProcess) {
      return this._truthLogInfo.writeProcess.then(() => this._truthLogInfo.writeProcess);
    }
    return _triggerEventQueueWrites(this, this._truthLogInfo, this._writeTruths.bind(this));
  }

  _clampCommandQueueByTruthEvendIdEnd (lastTruthCommandId?: any) {
    const deleteBegin = this._commandQueueInfo.eventIdBegin;
    if (!(deleteBegin < this._truthLogInfo.eventIdEnd)) return undefined;
    const commandIds = this._commandQueueInfo.commandIds;
    const lastDeletedCommandId = commandIds[this._truthLogInfo.eventIdEnd - deleteBegin - 1];
    // If the command id of the last truth doesn't match the command id
    // of the corresponding command then purge all commands.
    this._commandQueueInfo.eventIdBegin = (lastDeletedCommandId !== lastTruthCommandId)
        && lastTruthCommandId && lastDeletedCommandId
            ? this._commandQueueInfo.eventIdEnd
            : Math.min(this._commandQueueInfo.eventIdEnd, this._truthLogInfo.eventIdEnd);
    const deletedIds = commandIds.splice(0,
        this._commandQueueInfo.eventIdBegin - deleteBegin);
    if (this._commandQueueInfo.eventIdBegin === this._commandQueueInfo.eventIdEnd) {
      this._commandQueueInfo.eventIdBegin = this._commandQueueInfo.eventIdEnd =
          this._truthLogInfo.eventIdEnd;
    }
    return !deletedIds.length ? undefined : thenChainEagerly(
        _deleteCommands(this, deleteBegin, deleteBegin + deletedIds.length, deletedIds),
        commands => commands,
        error => {
          if (typeof error.conflictingCommandEventId !== "number") throw error;
          this._reloadCommandQueue(error.conflictingCommandEventId);
        });
  }

  _deleteQueuedCommandsOnwardsFrom (fromLogIndex: number, withCommandId: string) {
    const commandOffset = fromLogIndex - this._commandQueueInfo.eventIdBegin;
    const commandIds = this._commandQueueInfo.commandIds;
    if (!((commandOffset >= 0) && (commandOffset < commandIds.length))) return undefined;
    if (withCommandId !== commandIds[commandOffset]) return undefined;
    const deletedIds = commandIds.splice(commandOffset);
    this._commandQueueInfo.eventIdEnd -= deletedIds.length;
    return !deletedIds.length ? undefined : thenChainEagerly(
        _deleteCommands(this, fromLogIndex, fromLogIndex + deletedIds.length, deletedIds),
        commands => commands,
        error => {
          if (typeof error.conflictingCommandEventId !== "number") throw error;
          this._reloadCommandQueue(error.conflictingCommandEventId);
        });
  }

  _reloadCommandQueue (/* conflictingCommandEventId: number */) {}

  _determineEventMediaPreOps (mediaEvent: Object, rootEvent: Object) {
    const mediaRef = deserializeVRef(mediaEvent.id);
    let pendingEntry = this._pendingMediaLookup[mediaRef.rawId()];
    try {
      return _determineEventMediaPreOps(this, mediaEvent, rootEvent, mediaRef, pendingEntry);
    } catch (error) {
      if (!pendingEntry) pendingEntry = this._pendingMediaLookup[mediaRef.rawId()];
      throw this.wrapErrorEvent(error, `_initiateMediaRetrievals(${
              ((pendingEntry || {}).mediaInfo || {}).name || ""}/${mediaRef.rawId()})`,
          "\n\tmediaRef:", mediaRef,
          "\n\tmediaEvent:", ...dumpObject(mediaEvent),
          "\n\tpendingEntry:", ...dumpObject(pendingEntry),
          "\n\troot event:", ...dumpObject(rootEvent),
          "\n\tthis:", ...dumpObject(this),
      );
    }
  }

  requestMediaContents (mediaInfos: MediaInfo[]): any[] {
    const connection = this;
    const wrap = new Error(`requestMediaContents(${this.getName()}`);
    try {
      return _requestMediaContents(this, mediaInfos, errorOnRequestMediaContents);
    } catch (error) { return errorOnRequestMediaContents(error); }
    function errorOnRequestMediaContents (error: Object, mediaInfo: MediaInfo = error.mediaInfo) {
      throw connection.wrapErrorEvent(error, wrap,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tmediaInfos:", ...dumpObject(mediaInfos),
          "\n\tconnection:", ...dumpObject(connection),
      );
    }
  }

  prepareBvob (content: any, mediaInfo?: MediaInfo):
      { buffer: ArrayBuffer, contentHash: string, persistProcess: ?Promise<any> } {
    const connection = this;
    const wrap = new Error(`prepareBvob(${
        mediaInfo && mediaInfo.name ? `of Media "${mediaInfo.name}"` : typeof content})`);
    try {
      return _prepareBvob(this, content, mediaInfo, errorOnPrepareBvob);
    } catch (error) { return errorOnPrepareBvob(error); }
    function errorOnPrepareBvob (error) {
      throw connection.wrapErrorEvent(error, wrap,
          "\n\tcontent:", ...dumpObject({ content }),
          "\n\tmediaInfo:", ...dumpObject(mediaInfo));
    }
  }

  _getMediaEntry (mediaRef: VRef, require_ = true) {
    let currentStep;
    try {
      // Fetch from lookups - traverse media prototype chain.
      do {
        const mediaRawId = currentStep ? currentStep.headRawId() : mediaRef.rawId();
        const ret = this._pendingMediaLookup[mediaRawId]
            || this._prophet._persistedMediaLookup[mediaRawId];
        if (ret) return ret;
        currentStep = currentStep ? currentStep.previousGhostStep() : mediaRef.previousGhostStep();
      } while (currentStep);
      if (require_) throw new Error(`Media entry for ${mediaRef.toString()} not found`);
      return undefined;
    } catch (error) {
      throw this.wrapErrorEvent(error, `_getMediaEntry(..., require = ${require_})`,
          "\n\tmediaId:", ...dumpObject(mediaRef));
    }
  }

  async _updateMediaEntries (updates: MediaEntry[]) {
    try {
      return await _updateMediaEntries(this, updates);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_updateMediaEntries(${updates.length} updates)`,
          "\n\tupdates:", ...dumpObject(updates));
    }
  }

  async _readMediaEntries () {
    const ret = {};
    try {
      await _readMediaEntries(this, ret);
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, `_readMediaEntries()`,
          "\n\tret:", ret);
    }
  }

  async _destroyMediaInfo (mediaRawId: string) {
    try {
      return await _destroyMediaInfo(this, mediaRawId);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_destroyMediaInfo('${mediaRawId}')`);
    }
  }

  async _writeTruths (truths: EventBase[]) {
    if (!truths || !truths.length) return undefined;
    try {
      return await _writeTruths(this, truths);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          `_writeTruths([${tryAspect(truths[0], "log").index} ,${
              tryAspect(truths[truths.length - 1], "log").index}])`,
          "\n\teventLog:", ...dumpObject(truths));
    }
  }

  async _readTruths (options: Object) {
    try {
      return await _readTruths(this, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_readTruths()`,
          "\n\toptions", ...dumpObject(options));
    }
  }

  async _writeCommands (commands: EventBase[]) {
    try {
      return await _writeCommands(this, commands);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          `_writeCommands([${tryAspect(commands[0], "log").index},${
              tryAspect(commands[commands.length - 1], "log").index}])`,
          "\n\tcommands:", ...dumpObject(commands));
    }
  }

  async _readCommands (options: Object) {
    try {
      return await _readCommands(this, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_readCommands()`,
          "\n\toptions", ...dumpObject(options));
    }
  }

  async _deleteCommands (fromEventId: string, toEventId: string = fromEventId,
      expectedCommandIds?: string[]) {
    try {
      return await _deleteCommands(this, fromEventId, toEventId, expectedCommandIds);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_deleteCommands(${fromEventId}, ${toEventId})`,
          "\n\texpectedCommandIds:", ...dumpObject(expectedCommandIds));
    }
  }
}
