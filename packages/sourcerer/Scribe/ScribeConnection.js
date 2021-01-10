// @flow

import type { EventBase } from "~/raem/events";
import type { VRL } from "~/raem/VRL";

import Connection from "~/sourcerer/api/Connection";
import {
  MediaInfo, NarrateOptions, ProclaimOptions, Proclamation, SourceryOptions,
  ReceiveEvents, RetrieveMediaBuffer,
} from "~/sourcerer/api/types";
import { tryAspect } from "~/sourcerer/tools/EventAspects";
import { deserializeVRL } from "~/sourcerer/FalseProphet";

import { DelayedQueue, dumpObject, thenChainEagerly, thisChainRedirect } from "~/tools";

import type IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";
import { bufferAndContentHashFromNative } from "~/tools/id/contentId";

import {
  MediaEntry, _prepareBvob, _determineEventMediaPreOps, _requestMediaContents
} from "./_contentOps";
import {
  _initializeConnectionIndexedDB,
  _updateMediaEntries, _readMediaEntries, _destroyMediaInfo,
  _writeTruths, _readTruths, _writeCommands, _readCommands, _deleteCommands,
} from "./_databaseOps";
import {
  _narrateLocalLogs, _integrateLocalNarrationResults, _reproclaimLocalCommandsToUpstream,
  _narrateUpstreamEventLog, _integrateUpstreamNarrationResults,
  _proclaimEvents, _receiveEvents, _triggerEventQueueWrites
} from "./_eventOps";

export default class ScribeConnection extends Connection {
  // Info structures

  // If not eventLogInfo eventIdBegin is not 0, it means the oldest
  // stored event is a snapshot with that id.
  _truthLogInfo: { eventIdBegin: number, eventIdEnd: number };
  _commandQueueInfo: { eventIdBegin: number, eventIdEnd: number, commandIds: string[] };

  // Contains the media infos for most recent actions seen per media.
  // This lookup is updated whenever the media retrievers are created for the action, which is
  // before any medias are downloaded and before media info is persisted.
  // See Scribe._persistedMediaLookup for contrast.
  _pendingMediaLookup: { [mediaRawId: string]: MediaEntry } = {};

  // Contains chronicle specific bvob state data.
  _pendingBvobLookup: { [contentHash: string]: {
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

  getScribe () { return this._parent; }

  getStatus () {
    return {
      indexedDB: { truthLog: this._truthLogInfo, commandQueue: this._commandQueueInfo },
      name: this._chronicleName,
      ...super.getStatus(),
    };
  }

  setChronicleName (name: string) {
    this._chronicleName = name;
    this.setName(`'${name}'/${this.getChronicleURI()}`);
  }

  getChronicleName () { return this._chronicleName; }

  getName () {
    if (this._chronicleName) return `'${this._chronicleName}'/${this.getRawName()}`;
    return super.getName();
  }

  static sourceryOpsName = "scribeSourcery";
  static scribeSourcery = [
    ScribeConnection.prototype._sourcerUpstream,
    ScribeConnection.prototype._readMediaEntries,
    ScribeConnection.prototype._initializeMediaLookups,
    Connection.prototype._narrateEventLog,
    Connection.prototype._finalizeSourcery,
  ]

  _sourcerUpstream (options: SourceryOptions) {
    if (this.getScribe()._upstream) {
      const upstreamOptions = Object.create(options);
      // Set the permanent receiver without options.pushTruths,
      // initiate connection but disable initial narration;
      // perform the initial optimistic narrateEventLog later.
      upstreamOptions.pushTruths = this.getReceiveTruths();
      upstreamOptions.narrateOptions = false;
      upstreamOptions.subscribeEvents = (options.narrateOptions === false)
          && options.subscribeEvents;
      this.setUpstreamConnection(this.getScribe()._upstream
          .sourcerChronicle(this.getChronicleURI(), upstreamOptions));
      // Unlike with other sourcerers scribe does not wait for upstream
      // sourcery to complete: ScribeConnection can satisfy the
      // optimistic narration criteria of the sourcery process via
      // events in the local cache.
    }
    if (options.narrateOptions !== false) {
      if (!options.narrateOptions) options.narrateOptions = {};
      options.narrateOptions.subscribeEvents = options.subscribeEvents;
    }
    return this.isLocallyRecorded()
        ? [options, _initializeConnectionIndexedDB(this)]
        : thisChainRedirect(
            (options.narrateOptions !== false) ? "_narrateEventLog" : "_finalizeSourcery", options);
  }

  _readMediaEntries (options, localDatabase) {
    return [options, _readMediaEntries(this, localDatabase)];
  }

  _initializeMediaLookups (options, localMediaEntries) {
    if (localMediaEntries) {
      this._pendingMediaLookup = localMediaEntries;
      for (const [mediaRawId, entry] of Object.entries(this._pendingMediaLookup)) {
        this.getScribe()._persistedMediaLookup[mediaRawId] = entry;
      }
    }
    return (options.narrateOptions !== false) ? options
        : thisChainRedirect("_finalizeSourcery", options);
  }

  disconnect () {
    super.disconnect();
    const adjusts = {};
    for (const entry of Object.values(this._pendingMediaLookup)) {
      const contentHash = entry.mediaInfo.contentHash;
      if (contentHash && entry.isInMemory) adjusts[contentHash] = -1;
      if (entry.isPersisted) delete this.getScribe()._persistedMediaLookup[entry.mediaId];
    }
    this.getScribe()._adjustInMemoryBvobBufferRefCounts(adjusts);
    this._pendingMediaLookup = {};
    if (this._db) {
      this._db.release();
      this._db = null;
    }
  }

  getFirstTruthEventId () { return this._truthLogInfo.eventIdBegin; }
  getFirstUnusedTruthEventId () { return this._truthLogInfo.eventIdEnd; }

  getFirstCommandEventId () { return this._commandQueueInfo.eventIdBegin; }
  getFirstUnusedCommandEventId () { return this._commandQueueInfo.eventIdEnd; }

  narrateEventLog (options: ?NarrateOptions = {}):
      Promise<{ scribeTruthLog: any, scribeCommandQueue: any }> {
    if (!options) return undefined; // if explicitly null
    if (!this.isLocallyRecorded()) return super.narrateEventLog(options);
    if (!this._db) {
      throw new Error(
          "INTERNAL ERROR: Missing _db for locally persisted ScribeConnection.narrateEventLog");
    }
    options.plog = this.opLog(2, options.plog, "narrate");
    return this.opChain("scribeNarrate", options, "_errorOnScribeNarrateOps", options.plog);
  }

  static scribeNarrate = [
    _narrateLocalLogs,
    _integrateLocalNarrationResults,
    _reproclaimLocalCommandsToUpstream,
    _narrateUpstreamEventLog,
    _integrateUpstreamNarrationResults,
    function _finalizeNarration (options, narrationResult) { return narrationResult; }
  ]

  _errorOnScribeNarrateOps (error, index, [options, narrationResult, ...rest]) {
    throw this.wrapErrorEvent(error, 1, new Error("scribeNarrate"),
        "\n\toptions:", ...dumpObject(options),
        "\n\tnarrationResult:", ...dumpObject(narrationResult),
        "\n\trest of params:", ...dumpObject(rest));
  }

  proclaimEvents (events: EventBase[], options: ProclaimOptions = {}): Proclamation {
    if (!this.isLocallyRecorded() || (options.isLocallyRecorded === false)) {
      return super.proclaimEvents(events, options);
    }
    const connection = this;
    let wrap = new Error("proclaimEvents()");
    try {
      return _proclaimEvents(this, events, options, errorOnScribeChronicleEvents);
    } catch (error) { return errorOnScribeChronicleEvents(error); }
    function errorOnScribeChronicleEvents (error) {
      const cycleWraps = wrap;
      wrap = new Error("proclaimEvents()");
      throw connection.wrapErrorEvent(error, 1, cycleWraps,
          "\n\teventLog:", ...dumpObject(events),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  receiveTruths (truths: EventBase[], retrieveMediaBuffer?: RetrieveMediaBuffer,
      pushTruths: ReceiveEvents, type: ("receiveTruths" | "receiveCommands") = "receiveTruths",
  ) {
    if (!truths.length) return truths;
    const connection = this;
    const wrap = new Error(`${type}([${tryAspect(truths[0], "log").index}, ${
        tryAspect(truths[truths.length - 1], "log").index}])`);
    try {
      return _receiveEvents(this, truths, retrieveMediaBuffer, pushTruths,
          type, errorOnReceiveTruths);
    } catch (error) { throw errorOnReceiveTruths(error); }
    function errorOnReceiveTruths (error) {
      throw connection.wrapErrorEvent(error, 1, wrap,
          "\n\ttruths:", ...dumpObject(truths), truths,
          "\n\tthis:", ...dumpObject(this));
    }
  }

  receiveCommands (commands: EventBase[], retrieveMediaBuffer?: RetrieveMediaBuffer,
      pushCommands: ReceiveEvents) {
    return this.receiveTruths(commands, retrieveMediaBuffer, pushCommands, "receiveCommands");
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
          if (error.disconnected) return null;
          // Check for cross-tab writes
          throw error;
        });
  }

  // Returns a promise to a write operation after which all entries
  // currently in the truth log write queue have been written, or
  // undefined if there are no pending truth writes.
  _triggerTruthLogWrites (lastTruthCommandId?: any) {
    this._clampCommandQueueByTruthEventIdEnd(lastTruthCommandId);
    if (!this._truthLogInfo.writeQueue.length) return undefined;
    if (this._truthLogInfo.writeProcess) {
      return this._truthLogInfo.writeProcess.then(() => this._truthLogInfo.writeProcess);
    }
    return _triggerEventQueueWrites(this, this._truthLogInfo, this._writeTruths.bind(this),
        undefined, (error) => {
          if (error.disconnected) return null;
          // Check for cross-tab writes
          throw error;
        });
  }

  _clampCommandQueueByTruthEventIdEnd (lastTruthCommandId?: any) {
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
    const wrap = new Error(`_clampCommandQueueByTruthEventIdEnd(${lastTruthCommandId})`);
    return !deletedIds.length ? undefined : thenChainEagerly(
        _deleteCommands(this, deleteBegin, deleteBegin + deletedIds.length, deletedIds),
        commands => commands,
        error => {
          if (typeof error.conflictingCommandEventId === "number") {
            return this._reloadCommandQueue(error.conflictingCommandEventId);
          }
          throw this.wrapErrorEvent(error, 1, wrap,
              "\n\tdeleteBegin:", deleteBegin,
              "\n\tdeleteBegin + len:", deleteBegin + deletedIds.length,
              "\n\tdeletedIds:", deletedIds);
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
    const mediaVRL = deserializeVRL(mediaEvent.id);
    let pendingEntry = this._pendingMediaLookup[mediaVRL.rawId()];
    try {
      return _determineEventMediaPreOps(this, mediaEvent, rootEvent, mediaVRL, pendingEntry);
    } catch (error) {
      if (!pendingEntry) pendingEntry = this._pendingMediaLookup[mediaVRL.rawId()];
      throw this.wrapErrorEvent(error, 1, `_initiateMediaRetrievals(${
              ((pendingEntry || {}).mediaInfo || {}).name || ""}/${mediaVRL.rawId()})`,
          "\n\tmediaVRL:", mediaVRL,
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
      throw connection.wrapErrorEvent(error, 1, wrap,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tmediaInfos:", ...dumpObject(mediaInfos),
          "\n\tconnection:", ...dumpObject(connection),
      );
    }
  }

  prepareBvob (content: any, mediaInfo?: MediaInfo):
      Promise<Object> | { buffer: ArrayBuffer, contentHash: string, persistProcess: ?Promise } {
    const connection = this;
    const wrap = new Error(`prepareBvob(${
        mediaInfo && mediaInfo.name ? `of Media "${mediaInfo.name}"` : typeof content})`);
    try {
      return thenChainEagerly(
          bufferAndContentHashFromNative(content, mediaInfo),
          ({ buffer, contentHash }) =>
              _prepareBvob(this, content, buffer, contentHash, mediaInfo, errorOnPrepareBvob));
    } catch (error) { return errorOnPrepareBvob(error); }
    function errorOnPrepareBvob (error) {
      throw connection.wrapErrorEvent(error, 1, wrap,
          "\n\tcontent:", ...dumpObject({ content }),
          "\n\tmediaInfo:", ...dumpObject(mediaInfo));
    }
  }

  _getMediaEntry (mediaVRL: VRL, require_ = true) {
    let currentStep;
    try {
      // Fetch from lookups - traverse media prototype chain.
      do {
        const mediaRawId = currentStep ? currentStep.headRawId() : mediaVRL.rawId();
        const ret = this._pendingMediaLookup[mediaRawId]
            || this.getScribe()._persistedMediaLookup[mediaRawId];
        if (ret) return ret;
        currentStep = currentStep ? currentStep.previousGhostStep() : mediaVRL.previousGhostStep();
      } while (currentStep);
      if (require_) throw new Error(`Media entry for ${mediaVRL.toString()} not found`);
      return undefined;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `_getMediaEntry(..., require = ${require_})`,
          "\n\tmediaId:", ...dumpObject(mediaVRL));
    }
  }

  async _updateMediaEntries (updates: MediaEntry[]) {
    try {
      return await _updateMediaEntries(this, updates);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `_updateMediaEntries(${updates.length} updates)`,
          "\n\tupdates:", ...dumpObject(updates));
    }
  }

  async _destroyMediaInfo (mediaRawId: string) {
    try {
      return await _destroyMediaInfo(this, mediaRawId);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `_destroyMediaInfo('${mediaRawId}')`);
    }
  }

  async _writeTruths (truths: EventBase[]) {
    if (!truths || !truths.length) return undefined;
    try {
      return await _writeTruths(this, truths);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1,
          `_writeTruths([${tryAspect(truths[0], "wrapErrorEventlog").index} ,${
              tryAspect(truths[truths.length - 1], "log").index}])`,
          "\n\teventLog:", ...dumpObject(truths));
    }
  }

  async _readTruths (options: Object = {}) {
    try {
      return await _readTruths(this, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `_readTruths()`,
          "\n\toptions", ...dumpObject(options));
    }
  }

  async _writeCommands (commands: EventBase[]) {
    try {
      return await _writeCommands(this, commands);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1,
          `_writeCommands([${tryAspect(commands[0], "log").index},${
              tryAspect(commands[commands.length - 1], "log").index}])`,
          "\n\tcommands:", ...dumpObject(commands));
    }
  }

  async _readCommands (options: Object = {}) {
    try {
      return await _readCommands(this, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `_readCommands()`,
          "\n\toptions", ...dumpObject(options));
    }
  }

  async _deleteCommands (fromEventId: string, toEventId: string = fromEventId,
      expectedCommandIds?: string[]) {
    try {
      return await _deleteCommands(this, fromEventId, toEventId, expectedCommandIds);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `_deleteCommands(${fromEventId}, ${toEventId})`,
          "\n\texpectedCommandIds:", ...dumpObject(expectedCommandIds));
    }
  }
}
