import ValaaURI from "~/raem/ValaaURI";
import Command, { isCreatedLike, isTransactedLike } from "~/raem/command";
import { VRef, obtainVRef, getRawIdFrom } from "~/raem/ValaaReference";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import { MediaInfo, NarrateOptions, RetrieveMediaContent } from "~/prophet/api/Prophet";
import DecoderArray from "~/prophet/prophet/DecoderArray";

import { invariantify, invariantifyString, dumpObject, thenChainEagerly } from "~/tools";
import { type DatabaseAPI } from "~/tools/indexedDB/databaseAPI";

import IndexedDBWrapper from "~/tools/html5/IndexedDBWrapper";
import { encodeDataURI } from "~/tools/html5/urlEncode";
import { bufferAndContentIdFromNative, stringFromUTF8ArrayBuffer } from "~/tools/textEncoding";
import { trivialCloneWith } from "~/tools/trivialClone";

export default class ScribePartitionConnection extends PartitionConnection {
  _processEvent: () => void;

  // Info structures

  _eventLogInfo: {
    firstEventId: number, // If not 0, the stored event is a snapshot whose last eventId is this
    lastEventId: number,
  };
  _commandQueueInfo: {
    firstEventId: number,
    lastEventId: number,
    commandIds: Array<string>,
  };

  _snapshotInfo: {}; // what goes here? Low priority.

  // Contains the media infos for most recent actions seen per media.
  // This lookup is updated whenever the media retrievers are created for the action, which is
  // before any medias are downloaded and before media info is persisted.
  // See Scribe._persistedMediaLookup for contrast.
  _pendingMediaLookup: {
    [mediaRawId: string]: {
      mediaId: string, // Scribe-specific info fields
      mediaInfo: MediaInfo,
      isPersisted: boolean,
      isInMemory: boolean,
      nativeContent: any,
    }
  };

  _db: IndexedDBWrapper;
  databaseAPI: DatabaseAPI;

  constructor (options: Object) {
    super(options);
    this._processEvent = options.processEvent;
    this._eventLogInfo = { firstEventId: 0, lastEventId: -1 };
    this._commandQueueInfo = { firstEventId: 0, lastEventId: -1, commandIds: [] };
    this.databaseAPI = options.databaseAPI;
    this._isFrozen = false;
    this._decoderArray = new DecoderArray({
      name: `Decoders of ${this.getName()}`,
      fallbackArray: this.getProphet().getDecoderArray(),
    });
  }

  getLastAuthorizedEventId () { return this._eventLogInfo.lastEventId; }
  getLastCommandEventId () { return this._commandQueueInfo.lastEventId; }

  _getFirstAuthorizedEventId () { return this._eventLogInfo.firstEventId; }
  _getFirstCommandEventId () { return this._commandQueueInfo.firstEventId; }

  async connect () {
    // TODO(iridian): Implement initialNarrateOptions
    // TODO(iridian): Load info structures from indexed_db. These are member fields described above.
    // Also create Scribe._contentLookup entries for contents referenced by the _pendingMediaLookup
    // entries, including the in-memory contents.
    // If the partition does not exist, create it and its structures.
    this._db = new IndexedDBWrapper(this._partitionURI.toString(), [
      { name: "events", keyPath: "eventId" },
      { name: "commands", keyPath: "eventId" },
      { name: "medias", keyPath: "mediaId" },
    ], this.getLogger(), this.databaseAPI);
    await this._db.initialize();

    // Populate _eventLogInfo with first and last events
    await this._transaction(["events", "commands"], "readonly", ({ events, commands }) => {
      // Get the last key in the events table and store it in eventLogInfo
      this._loadEventId(events, undefined, this._eventLogInfo, "firstEventId");
      this._loadEventId(events, "prev", this._eventLogInfo, "lastEventId");
      this._loadEventId(commands, undefined, this._commandQueueInfo, "firstEventId");
      this._loadEventId(commands, "prev", this._commandQueueInfo, "lastEventId");
    });
    this._notifyProphetOfCommandCount();

    this._pendingMediaLookup = await this._readMediaInfos(this);
    for (const [mediaRawId, info] of Object.entries(this._pendingMediaLookup)) {
      this._prophet._persistedMediaLookup[mediaRawId] = info;
    }
    return this;
  }

  _loadEventId (entries, direction: ?"prev", target, eventIdTargetFieldName) {
    const req = entries.openCursor(...(direction ? [null, direction] : []));
    req.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) target[eventIdTargetFieldName] = cursor.key;
    };
  }

  _notifyProphetOfCommandCount () {
    this._prophet.setConnectionCommandCount(this.partitionURI().toString(),
        Math.max(0,
            (this.getLastCommandEventId() + 1) - this._getFirstCommandEventId()));
  }

  disconnect () {
    for (const info of Object.values(this._pendingMediaLookup)) {
      this._prophet._removeContentInMemoryReference(info.contentId);
      delete this._prophet._persistedMediaLookup[info.mediaId];
    }
    this._pendingMediaLookup = {};
  }

  async narrateEventLog (options: NarrateOptions = {}):
      Promise<{ scribeEventLog: any, scribeCommandQueue: any }> {
    // Narrates both authorized events as well as claim commands to _processEvent callback.
    // Commands have a truthy command.isCommand.
    const firstEventId = typeof options.firstEventId !== "undefined"
        ? options.firstEventId
        : this._getFirstAuthorizedEventId();
    const lastEventId = typeof options.lastEventId !== "undefined"
        ? options.lastEventId
        : Math.max(this.getLastAuthorizedEventId(), this.getLastCommandEventId());

    const eventLastEventId = Math.min(this.getLastAuthorizedEventId(), lastEventId);
    const eventList = firstEventId > eventLastEventId
        ? []
        : (await this._readEvents({ firstEventId, lastEventId: eventLastEventId })) || [];
    const commandFirstEventId = eventLastEventId + 1;
    const commandList = (!options.commandCallback || (commandFirstEventId > lastEventId))
        ? []
        : (await this._readCommands({ firstEventId: commandFirstEventId, lastEventId })) || [];
    const commandQueueLength = (this.getLastCommandEventId() + 1)
        - this._getFirstCommandEventId();
    if ((this._commandQueueInfo.commandIds.length !== commandQueueLength)
        && (commandList.length === commandQueueLength)
        && commandFirstEventId === this._getFirstCommandEventId()) {
      this._commandQueueInfo.commandIds = commandList.map(command => command.commandId);
      this.setIsFrozen(commandList[commandList.length - 1].type === "FROZEN");
    }
    return {
      scribeEventLog: await Promise.all(eventList.map(options.callback || this._processEvent)),
      scribeCommandQueue: await Promise.all(commandList.map(options.commandCallback)),
    };
  }

  claimCommandEvent (command: Command, retrieveMediaContent: RetrieveMediaContent): number {
    if (this._getFirstCommandEventId() <= this.getLastAuthorizedEventId()) {
      this._setCommandQueueFirstEventId(this.getLastAuthorizedEventId() + 1);
    }
    const commandEventId = this._addCommandsToQueue([command]);
    /*
    this.warnEvent("\n\tclaimCommand:", command.commandId, commandEventId, command,
        "\n\tcommand/eventInfos:", this._commandQueueInfo, this._eventLogInfo,
        "\n\tcommandIds:", this._commandQueueInfo.commandIds);
    //*/
    return {
      eventId: commandEventId,
      finalizeLocal: async () => {
        const finalizers = this._reprocessAction(command,
            retrieveMediaContent || this._throwOnMediaContentRetrieveRequest);
        if (!this.isTransient()) {
          await this._writeCommand(commandEventId, command);
          /*
          this.warnEvent("\n\twroteCommand:", command.commandId, commandEventId, command,
              "\n\t:", this.isLocal() ? "local" : "remote", this.getLastAuthorizedEventId(),
              "\n\tcommandIds:", this._commandQueueInfo.commandIds);
          //*/
        }
        return Promise.all(finalizers.map(finalize => finalize({ retryTimes: 1 })));
      }
    };
  }

  _setCommandQueueFirstEventId (firstEventId?: number) {
    const discardedCommands = firstEventId - this._getFirstCommandEventId();
    this._commandQueueInfo.firstEventId = firstEventId;

    if (this._getFirstCommandEventId() <= this.getLastCommandEventId()) {
      this._commandQueueInfo.commandIds.splice(0, discardedCommands);
    } else {
      this._commandQueueInfo.lastEventId = this._getFirstCommandEventId() - 1;
      this._commandQueueInfo.commandIds = [];
    }
    this._notifyProphetOfCommandCount();
  }

  _addCommandsToQueue (commands: Array<Command>) {
    this._commandQueueInfo.commandIds.push(...commands.map(command => command.commandId));
    if (commands.length) {
      this.setIsFrozen(commands[commands.length - 1].type === "FROZEN");
    }
    this._commandQueueInfo.lastEventId += commands.length;
    this._notifyProphetOfCommandCount();
    return this.getLastCommandEventId();
  }

  async recordTruth ({ event, eventId }: Object, preAuthorizeCommand: () => any) {
    if (eventId <= this.getLastAuthorizedEventId()) return false;
    try {
      invariantify(eventId === this.getLastAuthorizedEventId() + 1,
          `eventID race, expected confirmed truth eventId to be lastEventId + 1 === ${
              this.getLastAuthorizedEventId() + 1}, but got ${eventId} instead`);
      const { firstEventId: firstCommandId, lastEventId: lastCommandId, commandIds }
          = this._commandQueueInfo;
      let purgedCommands;
      if ((firstCommandId <= eventId) && (lastCommandId >= eventId)
          && (event.commandId !== commandIds[0])) {
        // this.warnEvent("\n\tPURGING by", event.commandId, eventId, event, commandIds,
        //    "\n\tcommandIds:", firstCommandId, lastCommandId, commandIds);
        // Frankly, we could just store the commands in the 'commandIds' fully.
        purgedCommands = await this._readCommands(
            { firstEventId: firstCommandId, lastEventId: lastCommandId });
      }

      // Add the authorized truth to the event log.
      if (!this.isTransient()) {
        await this._writeEvent(eventId, event);
      }
      this._eventLogInfo.lastEventId = eventId;

      const newCommandQueueFirstEventId = (purgedCommands ? lastCommandId : eventId) + 1;
      if (this._getFirstCommandEventId() < newCommandQueueFirstEventId) {
        this._setCommandQueueFirstEventId(newCommandQueueFirstEventId);
      }
      if (this._getFirstCommandEventId() > this.getLastCommandEventId()) {
        this.setIsFrozen(event.type === "FROZEN");
      }

      // Delete commands after event is stored, so we get no gaps.
      // TODO(iridian): Put these to the same transaction with the writeEvent
      if (!this.isTransient()) {
        if (purgedCommands) {
          // TODO(iridian): Add merge-conflict-persistence. As it stands now, for the duration of
          // the merge process the purged commands are not persisted anywhere and could be lost.
          this._deleteCommands(firstCommandId, lastCommandId);
        } else if ((firstCommandId <= eventId) && (lastCommandId >= eventId)) {
          this._deleteCommand(eventId);
        }
      }

      // For local partitions where Scribe is the authority, always authorize the next
      // command in queue to the Oracle if one is available.
      if ((this.isLocal() || this.isTransient()) && (lastCommandId > eventId)) {
        invariantify(preAuthorizeCommand,
            "recordTruth.preAuthorizeCommand missing when command queue has futures");
        this._preAuthorizeNextCommand(eventId + 1, preAuthorizeCommand);
      }
      /*
      this.warnEvent("\n\trecordTruth", event.commandId, eventId,
          "\n\tevent/commandInfos:", this._eventLogInfo, this._commandQueueInfo,
          "\n\tcommandIds:", this.getFirstCommandEventId(),
              this.getLastCommandEventId(), this._commandQueueInfo.commandIds,
          ...(purgedCommands ? ["\n\tPURGING:", purgedCommands] : []));
      //*/
      return { purgedCommands };
    } catch (error) {
      throw this.wrapErrorEvent(error, "recordTruth",
          "\n\tevent:", ...dumpObject(event),
          "\n\teventId:", eventId,
          "\n\tthis:", ...dumpObject(this));
    }
  }

  createEventFinalizers (pendingAuthorizedEvent: Object, eventId: number,
      retrieveMediaContent: RetrieveMediaContent): Promise<any> {
    const shouldRetrieveMedias = (eventId > this.getLastAuthorizedEventId())
        && (eventId > this.getLastCommandEventId());
    return this._reprocessAction(pendingAuthorizedEvent,
        shouldRetrieveMedias && (retrieveMediaContent || this._throwOnMediaContentRetrieveRequest));
  }

  _throwOnMediaContentRetrieveRequest = (mediaId, mediaInfo: MediaInfo) => {
    throw this.wrapErrorEvent(
        new Error(`Cannot retrieve media '${mediaInfo.name}' content through partition '${
            this.getName()}'`),
        "retrieveMediaContent",
        "\n\tdata not found in local blob cache and no remote content retriever is specified",
        ...(this.isLocal() || this.isTransient()
            ? ["\n\tlocal/transient partitions don't have remote storage backing"] : []),
        "\n\tmediaInfo:", ...dumpObject(mediaInfo));
  }

  _reprocessAction (event: Object, retrieveMediaContent: RetrieveMediaContent,
      rootEvent: Object = event) {
    if (isTransactedLike(event)) {
      return [].concat(
          ...event.actions
          .map(action =>
              this._reprocessAction(action, retrieveMediaContent, rootEvent))
          .filter(retriever => retriever));
    } else if (event.typeName === "MediaType") {
      this._prophet._mediaTypes[getRawIdFrom(event.id)] = event.initialState;
    } else if ((event.initialState !== undefined) || (event.sets !== undefined)) {
      if (getRawIdFrom(event.id) === this.partitionRawId()) {
        const newName = (event.initialState && event.initialState.name)
            || (event.sets && event.sets.name);
        if (newName) this._name = `'${newName}'/${this.partitionURI().toString()}`;
      }
      if (event.typeName === "Media") {
        return this._reprocessMedia(event, retrieveMediaContent, rootEvent);
      }
    }
    return [];
  }

  _reprocessMedia (mediaEvent: Object, retrieveMediaContent: RetrieveMediaContent,
      rootEvent: Object) {
    const mediaId = obtainVRef(mediaEvent.id);
    const mediaRawId = mediaId.rawId();
    const currentEntry = this._pendingMediaLookup[mediaRawId];
    let mediaInfo;
    let newEntry;
    try {
      if (currentEntry) {
        mediaInfo = { ...currentEntry.mediaInfo };
        newEntry = { ...currentEntry, mediaInfo, nativeContent: undefined };
      } else {
        if (mediaId.isInherited()) {
          mediaInfo = { ...this._getMediaEntry(mediaId).mediaInfo };
        } else if (isCreatedLike(mediaEvent)) {
          mediaInfo = {};
        } else {
          // FIXME(iridian): This should throw in principle: this is an indication of a corrupted
          // event log. For now we accept and replay the event logs due to lack of resources for
          // a proper fix - corrupted event logs must be accepted as a fact of life for the time
          // being.
          this.errorEvent(`mediaEvent for media has no previous media entry and ${
                  ""}event is not CREATED, DUPLICATED and resource is not ghost`,
              "\n\treplay not blocked but media accesses made against this Media will throw.",
              "\n\tmediaId:", String(mediaId),
              "\n\tmediaEvent:", ...dumpObject(mediaEvent),
              "\n\trootEvent:", ...dumpObject(rootEvent));
          return [];
        }
        newEntry = {
          mediaId: mediaRawId, mediaInfo, isPersisted: true, isInMemory: true,
        };
      }
      this._pendingMediaLookup[mediaRawId] = newEntry;

      const update = mediaEvent.initialState || mediaEvent.sets || {};
      if (update.name) mediaInfo.name = update.name;
      if (update.mediaType) {
        const mediaType = (typeof update.mediaType === "string")
            ? this._prophet._mediaTypes[getRawIdFrom(update.mediaType)]
            : update.mediaType;
        Object.assign(mediaInfo, mediaType);
      }
      if (update.content) mediaInfo.blobId = getRawIdFrom(update.content);

      if (!retrieveMediaContent) return [];

      const tryRetrieve = async () => {
        try {
          if (mediaInfo.blobId && this._prophet.tryGetCachedBlobContent(mediaInfo.blobId)) {
            if (currentEntry && (currentEntry.mediaInfo.blobId === mediaInfo.blobId)) {
              // content is in blob buffer cache with equal blobId. Reuse.
              newEntry.nativeContent = currentEntry.nativeContent;
            }
          } else if (mediaInfo.blobId || mediaInfo.sourceURL) {
            // TODO(iridian): Determine whether media content should be pre-cached or not.
            const content = await retrieveMediaContent(mediaId, mediaInfo);
            if (typeof content !== "undefined") {
              newEntry.nativeContent = content;
              const { persistProcess } = this.prepareBlob(newEntry.nativeContent, mediaInfo);
              await persistProcess;
            }
          }
          // Delays actual media info content update into a finalizer function so that recordTruth
          // can be sure event has been persisted before updating mediaInfo blob references
          invariantifyString(newEntry.mediaId, "readPersistAndUpdateMedia.newEntry.mediaId",
              "\n\tnewEntry", newEntry);
          return () => this._persistMediaEntry(newEntry, currentEntry);
        } catch (error) {
          throw this.wrapErrorEvent(error, `reprocessMedia.tryRetrieve('${mediaInfo.name}'/'${
                  mediaInfo.blobId || mediaInfo.sourceURL}')`,
              "\n\tmediaInfo:", ...dumpObject(mediaInfo));
        }
      };

      return [this._retrieveMedia.bind(this, {
        mediaInfo,
        tryRetrieve,
        initialAttempt: tryRetrieve(),
      })];
    } catch (error) {
      throw this.wrapErrorEvent(error, `_reprocessMedia(${
              newEntry && newEntry.mediaInfo && newEntry.mediaInfo.name}/${mediaRawId})`,
          "\n\tmediaEvent:", ...dumpObject(mediaEvent),
          "\n\tmediaId:", mediaId,
          "\n\tnewEntry:", ...dumpObject(newEntry),
          "\n\tcurrentEntry:", ...dumpObject(currentEntry),
          "\n\troot event:", ...dumpObject(rootEvent),
          "\n\tthis:", ...dumpObject(this),
      );
    }
  }

  async _retrieveMedia ({ mediaInfo, tryRetrieve, initialAttempt },
      options: { getNextBackoffSeconds?: Function, retryTimes?: number,
          delayBaseSeconds?: number } = {}) {
    let previousBackoff;
    let getNextBackoffSeconds = options.getNextBackoffSeconds;
    if (!getNextBackoffSeconds && (typeof options.retryTimes === "number")) {
      getNextBackoffSeconds = (previousRetries: number) =>
          (previousRetries < options.retryTimes
              ? (previousBackoff || 0) + (previousRetries * (options.delayBaseSeconds || 1))
              : undefined);
    }
    if (!getNextBackoffSeconds) getNextBackoffSeconds = (() => undefined);

    let i = 0;
    for (let currentAttempt = initialAttempt; ++i; currentAttempt = tryRetrieve()) {
      try {
        const persistMedia = await currentAttempt;
        await persistMedia();
        break;
      } catch (error) {
        const nextBackoff = getNextBackoffSeconds
            && getNextBackoffSeconds(i - 1, mediaInfo, error);
        const wrappedError = this.wrapErrorEvent(error,
            `takeNextPendingDownstreamTruth.scribe.retrieveMedia("${mediaInfo.name}") attempt#${i}`,
            "\n\tmedia name:", mediaInfo.name,
            "\n\tmediaInfo:", mediaInfo,
            ...(i > 1 ? ["\n\tbackoff was:", previousBackoff] : []),
            ...(typeof nextBackoff === "undefined"
                ? ["\n\tthis was final retry attempt"]
                : ["\n\tnext retry after (seconds):", nextBackoff]),
        );
        if (typeof nextBackoff !== "number") throw wrappedError;
        this.outputErrorEvent(wrappedError);
        if (i > 1) await ScribePartitionConnection.waitBackoff(nextBackoff);
        previousBackoff = nextBackoff;
      }
    }
  }

  static async waitBackoff (backoffSeconds: number) {
    await new Promise(resolve => {
      setTimeout(() => { resolve(); }, backoffSeconds * 1000);
    });
  }

  async _preAuthorizeNextCommand (eventId, preAuthorizeCommand: (command: Command) => void) {
    const preAuthorizeCommandCandidates = await this._readCommands({
      firstEventId: eventId,
      lastEventId: eventId,
    });
    if (preAuthorizeCommandCandidates && preAuthorizeCommandCandidates.length) {
      preAuthorizeCommand(preAuthorizeCommandCandidates[0]);
    }
  }

  // Returns the requested media content immediately as a native object if it is in in-memory cache.
  // Otherwise if the media is in a local persisted cache returns a promise to a native object.
  // Otherwise is known in the partition returns undefined.
  // Otherwise throws an error.
  readMediaContent (mediaId: VRef, mediaInfo?: MediaInfo): any {
    const mediaEntry = this._getMediaEntry(mediaId, false);
    let actualInfo = mediaInfo;
    try {
      if (!actualInfo) {
        actualInfo = mediaEntry && mediaEntry.mediaInfo;
        if (!actualInfo) throw new Error(`No media info found for ${mediaId}`);
      }
      // Only return cached in-memory nativeContent if its id matches the requested id.
      if (mediaEntry
          && (typeof mediaEntry.nativeContent !== "undefined")
          && (actualInfo.blobId === mediaEntry.mediaInfo.blobId)) {
        return mediaEntry.nativeContent;
      }
      if (!actualInfo.blobId) return undefined;
    } catch (error) { throw onError.call(this, error); }
    return thenChainEagerly(
        this._prophet.readBlobContent(actualInfo.blobId),
        (buffer) => {
          if (!buffer) return undefined;
          const nativeContent = _nativeObjectFromBufferAndMediaInfo(buffer, actualInfo);
          if (mediaEntry && (actualInfo.blobId === mediaEntry.mediaInfo.blobId)) {
            mediaEntry.nativeContent = nativeContent;
          }
          return nativeContent;
        },
        onError.bind(this));
    function onError (error) {
      return this.wrapErrorEvent(error, `readMediaContent(${
              actualInfo && actualInfo.name ? `'${actualInfo.name}'` : `unnamed media`}`,
          "\n\tmediaId:", mediaId,
          "\n\tactualMediaInfo:", ...dumpObject(actualInfo),
          "\n\tmediaEntry:", ...dumpObject(mediaEntry),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  decodeMediaContent (mediaId: VRef, mediaInfo?: MediaInfo): any {
    let actualInfo = mediaInfo;
    let decoder;
    let name = "unknown media";
    try {
      if (!actualInfo) {
        const mediaEntry = this._getMediaEntry(mediaId, false);
        actualInfo = mediaEntry && mediaEntry.mediaInfo;
        if (!actualInfo) throw new Error(`No media info found for ${mediaId}`);
      }
      if (!actualInfo.blobId) return undefined;
      name = actualInfo.name ? `'${actualInfo.name}'` : `unnamed media`;
      decoder = this._decoderArray.findDecoder(actualInfo);
      if (!decoder) {
        throw new Error(`Can't find decoder for ${actualInfo.type}/${actualInfo.subtype} in ${
            this.getName()}`);
      }
    } catch (error) { throw onError.call(this, error); }
    return thenChainEagerly(
        this._prophet.decodeBlobContent(
            actualInfo.blobId, decoder, { mediaName: name, partitionName: this.getName() }),
        undefined,
        onError.bind(this));
    function onError (error) {
      return this.wrapErrorEvent(error, `decodeMediaContent(${name}`,
          "\n\tmediaId:", mediaId,
          "\n\tactualMediaInfo:", ...dumpObject(actualInfo),
          "\n\tthis:", ...dumpObject(this));
    }
  }


  getMediaURL (mediaId: VRef, mediaInfo?: MediaInfo): any {
    const mediaEntry = this._getMediaEntry(mediaId);
    try {
      let nativeContent;
      // Only use cached in-memory nativeContent if its id matches the requested id.
      if ((!mediaInfo || !mediaInfo.blobId || (mediaInfo.blobId === mediaEntry.mediaInfo.blobId))
          && (typeof mediaEntry.nativeContent !== "undefined")) {
        nativeContent = mediaEntry.nativeContent;
      } else {
        const blobId = (mediaInfo && mediaInfo.blobId) || mediaEntry.mediaInfo.blobId;
        if (!blobId) return undefined;
        const bufferCandidate = this._prophet.tryGetCachedBlobContent(blobId);
        nativeContent = bufferCandidate &&
            _nativeObjectFromBufferAndMediaInfo(bufferCandidate, mediaInfo || mediaEntry.mediaInfo);
        if (blobId === mediaEntry.mediaInfo.blobId) {
          mediaEntry.nativeContent = nativeContent;
        }
      }
      if ((typeof nativeContent === "string") && nativeContent.length < 10000) {
        // TODO(iridian): Is there a use case to create data URI's for json types?
        const { type, subtype } = mediaInfo || mediaEntry.mediaInfo;
        return encodeDataURI(nativeContent, type, subtype);
      }
      // TODO(iridian): With systems that support Service Workers we return URL's which the service
      // workers recognize and can redirect to 'smooth' IndexedDB accesses, see
      // https://gist.github.com/inexorabletash/687e7c5914049536f5a3
      // ( https://www.google.com/search?q=url+to+indexeddb )
      // Otherwise IndexedDB can't be accessed by the web pages directly, but horrible hacks must be
      // used like so:
      // https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
      return undefined;
    } catch (error) {
      throw this.wrapErrorEvent(error, `getMediaURL(${
              (mediaInfo && mediaInfo.name) ? `'${mediaInfo.name}'` : `unnamed media`}`,
          "\n\tmediaId:", mediaId,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
          "\n\tmediaEntry:", ...dumpObject(mediaEntry),
          "\n\tthis:", ...dumpObject(this),
      );
    }
  }

  prepareBlob (content: any, mediaInfo?: MediaInfo):
      { buffer: ArrayBuffer, contentId: string, persistProcess: ?Promise<any> } {
    const { buffer, contentId } = bufferAndContentIdFromNative(content, mediaInfo);
    return {
      content,
      buffer,
      contentId,
      persistProcess: this._prophet._persistBlobContent(buffer, contentId),
    };
  }

  _getMediaEntry (mediaId: VRef, require = true) {
    let currentStep;
    try {
      do {
        const mediaRawId = currentStep ? currentStep.headRawId() : mediaId.rawId();
        const ret = this._pendingMediaLookup[mediaRawId]
            || this._prophet._persistedMediaLookup[mediaRawId];
        if (ret) return ret;
        currentStep = currentStep ? currentStep.previousStep() : mediaId.previousGhostStep();
      } while (currentStep);
      if (require) throw new Error(`Media entry for ${mediaId.toString()} not found`);
      return undefined;
    } catch (error) {
      throw this.wrapErrorEvent(error, `_getMediaEntry(..., require = ${require})`,
          "\n\tmediaId:", ...dumpObject(mediaId),
          "\n\tcurrent ghost step:", ...dumpObject(currentStep),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  async _persistMediaEntry (newMediaEntry: Object, oldEntry: Object) {
    try {
      const ret = await this._transaction(["medias"], "readwrite", ({ medias }) => {
        const req = medias.put(newMediaEntry);
        req.onsuccess = () => {
          const newInfo = newMediaEntry.mediaInfo;
          const oldBlobId = oldEntry && oldEntry.mediaInfo.blobId;
          if (newInfo.blobId !== oldBlobId) {
            if (newInfo.blobId) {
              if (newMediaEntry.isInMemory) this._prophet._addContentInMemoryReference(newInfo);
              if (newMediaEntry.isPersisted) this._prophet._addContentPersistReference(newInfo);
            }
            if (oldBlobId) {
              if (oldEntry.isInMemory) this._prophet._removeContentInMemoryReference(oldBlobId);
              if (oldEntry.isPersisted) this._prophet._removeContentPersistReference(oldBlobId);
            }
          }
        };
      });
      this._prophet._persistedMediaLookup[newMediaEntry.mediaId] = newMediaEntry;
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, "_persistMediaEntry",
          "\n\tnewMediaEntry:", ...dumpObject(newMediaEntry),
          "\n\toldEntry:", ...dumpObject(oldEntry));
    }
  }

  _destroyMediaInfo (mediaRawId: string) {
    const mediaEntry = this._pendingMediaLookup[mediaRawId];
    if (!mediaEntry) return undefined;
    delete this._pendingMediaLookup[mediaRawId];
    delete this._prophet._persistedMediaLookup[mediaRawId];

    return this._transaction(["medias"], "readwrite", ({ medias }) => {
      const req = medias.delete(mediaRawId);
      req.onsuccess = () => {
        const blobId = mediaEntry.mediaInfo.blobId;
        if (blobId) {
          if (mediaEntry.isInMemory) this._prophet._removeContentInMemoryReference(blobId);
          if (mediaEntry.isPersisted) this._prophet._removeContentPersistReference(blobId);
        }
      };
    });
  }

  getMediaInfo (mediaId: VRef) {
    return this._getMediaEntry(mediaId).mediaInfo;
  }

  _transaction (stores: Array<string>, mode: string = "readonly", opsCallback: Function) {
    return this._db.transaction(stores, mode, opsCallback);
  }

  async _readMediaInfos () {
    const ret = {};
    try {
      await this._transaction(["medias"], "readwrite", ({ medias }) =>
          new Promise((resolve, reject) => {
            const req = medias.openCursor();
            req.onsuccess = event => {
              const cursor: IDBCursorWithValue = event.target.result;
              // Cursor is null when end of record set is reached
              if (!cursor) {
                resolve();
                return;
              }
              const thisMediaInfo = { ...cursor.value, isInMemory: true };
              if (thisMediaInfo.mediaInfo && thisMediaInfo.mediaInfo.blobId
                  && thisMediaInfo.isInMemory) {
                this._prophet._addContentInMemoryReference(thisMediaInfo.mediaInfo);
              }
              ret[cursor.key] = thisMediaInfo;
              cursor.update(thisMediaInfo);
              cursor.continue();
            };
            req.onerror = (evt) => reject(new Error(evt.target.error.message));
          }));
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, `_readMediaInfos()`,
          "\n\tret:", ret);
    }
  }

  async _writeEvent (eventId: number, event: Object) {
    let eventJSON;
    let errorEvent;
    try {
      return await this._transaction(["events"], "readwrite", ({ events }) => {
        const req = events.get(eventId);
        req.onsuccess = reqEvent => {
          if (reqEvent.target.result) {
            if (reqEvent.target.result.commandId === event.commandId) return;
            throw this.wrapErrorEvent(
                new Error(`Mismatching existing event commandId when persisting event`),
                `_writeEvent(${eventId})`,
                "\n\texisting commandId:", reqEvent.target.result.commandId,
                "\n\tnew event commandId:", event.commandId,
                "\n\texisting event:", ...dumpObject(reqEvent.target.result),
                "\n\tnew event:", ...dumpObject(event));
          }
          eventJSON = this._serializeEventAsJSON(event);
          eventJSON.eventId = eventId;
          events.put(eventJSON);
        };
      });
    } catch (error) {
      throw this.wrapErrorEvent(error, `_writeEvent(${eventId})`,
          "\n\tevent:", event,
          "\n\teventJSON:", eventJSON,
          "\n\tevents.add.error:", errorEvent);
    }
  }

  _serializeEventAsJSON (event) {
    return trivialCloneWith(event, (value) => {
      try {
        if ((typeof value !== "object") || (value === null)) return value;
        if (typeof value.toJSON === "function") return value.toJSON();
        if (value instanceof ValaaURI) return value.toString();
        return undefined;
      } catch (error) {
        throw this.wrapErrorEvent(error, "serializeEventAsJSON.trivialClone.customizer",
            "\n\tvalue:", { value });
      }
    });
  }

  async _readEvents (options: Object) {
    try {
      const range = this._db.getIDBKeyRange(options);
      if (range === null) return undefined;
      return await this._transaction(["events"], "readonly",
          ({ events }) => new Promise(_getAllShim.bind(null, events, range)));
    } catch (error) {
      throw this.wrapErrorEvent(error, `_readEvents()`,
          "\n\toptions", options);
    }
  }

  async _writeCommand (eventId: number, command: Object) {
    let commandJSON;
    try {
      // invariantify(command.isCommand, "writeCommand.command.isCommand must be specified");
      return await this._transaction(["commands"], "readwrite", ({ commands }) =>
          new Promise((resolve, reject) => {
            commandJSON = this._serializeEventAsJSON(command);
            commandJSON.eventId = eventId;
            const req = commands.add(commandJSON);
            req.onsuccess = () => {
              resolve(eventId);
            };
            req.onerror = (evt => reject(new Error(evt.target.error.message)));
          }));
    } catch (error) {
      throw this.wrapErrorEvent(error, `_writeCommand(${eventId})`,
          "\n\tcommand:", command,
          "\n\tcommandJSON:", commandJSON);
    }
  }


  async _readCommands (options: Object) {
    try {
      const range = this._db.getIDBKeyRange(options);
      if (range === null) return undefined;
      return await this._transaction(["commands"], "readonly",
          ({ commands }) => new Promise(_getAllShim.bind(null, commands, range)));
    } catch (error) {
      throw this.wrapErrorEvent(error, `_readCommands()`,
          "\n\toptions", options);
    }
  }

  async _deleteCommand (eventId: number) {
    try {
      return await this._transaction(["commands"], "readwrite", ({ commands }) =>
          new Promise((resolve, reject) => {
            const req = commands.delete(eventId);
            req.onsuccess = () => resolve();
            req.onerror = (evt => reject(new Error(evt.target.error.message)));
          }));
    } catch (error) {
      throw this.wrapErrorEvent(error, `_deleteCommand()`,
          "\n\teventId:", eventId);
    }
  }

  async _deleteCommands (fromEventId: string, toEventId: string) {
    try {
      return await this._transaction(["commands"], "readwrite", ({ commands }) =>
          new Promise((resolve, reject) => {
            const req = commands.delete(IDBKeyRange.bound(fromEventId, toEventId));
            req.onsuccess = () => resolve();
            req.onerror = (evt => reject(new Error(evt.target.error.message)));
          }));
    } catch (error) {
      throw this.wrapErrorEvent(error, `_deleteCommands()`,
          "\n\tfromEventId:", fromEventId,
          "\n\ttoEventId:", toEventId);
    }
  }
}

function _nativeObjectFromBufferAndMediaInfo (buffer: ArrayBuffer, mediaInfo?:
    { type?: string, subtype?: string, name?: string
  /* TODO(iridian): any other types we'd need for
    https://html.spec.whatwg.org/multipage/parsing.html#determining-the-character-encoding ?
  */ }) {
  // TODO(iridian): This is a quick hack for common types: we should really obey the above practice.
  if (!mediaInfo) return buffer;
  if (_isTextType(mediaInfo)) {
    const text = stringFromUTF8ArrayBuffer(buffer);
    if (mediaInfo.subtype === "json") return JSON.parse(text);
    return text;
  }
  return buffer;
}

function _getAllShim (database, range: IDBKeyRange, resolve: Function, reject: Function) {
  let req;
  if (typeof database.getAll !== "undefined") {
    req = database.getAll(range);
    req.onsuccess = () => _resolveWith(req.result);
  } else {
    console.warn("Using openCursor because getAll is not implemented (by Edge?)");
    const result = [];
    req = database.openCursor(range);
    req.onsuccess = () => {
      const nextCursor = event.target.result;
      if (nextCursor) {
        result.push(nextCursor.value);
        nextCursor.continue();
      } else {
        // complete
        console.log("Cursor processing complete, result:", result);
        _resolveWith(result);
      }
    };
  }
  function _resolveWith (results) {
    resolve(results.map(event => {
      delete event.eventId;
      return event;
    }));
  }
  req.onerror = (evt => reject(new Error(evt.target.error.message)));
}

function _isTextType ({ type, subtype }: { type: string, subtype: string }) {
  if (type === "text") return true;
  if (type === "application") return _applicationTextSubtypes[subtype];
  return false;
}

const _applicationTextSubtypes: any = {
  valaascript: true,
  "x-javascript": true,
  javascript: true,
  ecmascript: true,
  vsx: true,
  jsx: true,
};
