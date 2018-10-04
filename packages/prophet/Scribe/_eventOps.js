// @flow

import Command, { isTransactedLike, UniversalEvent } from "~/raem/command";
import { VRef, getRawIdFrom } from "~/raem/ValaaReference";

import type {
  MediaInfo, NarrateOptions, ChronicleOptions, PartitionConnection, ReceiveEvent,
  RetrieveMediaContent,
} from "~/prophet/api/Prophet";

import { dumpObject, invariantify, isPromise, thenChainEagerly, vdon } from "~/tools";

import ScribePartitionConnection from "./ScribePartitionConnection";

export const vdoc = vdon({
  "...": { heading:
    "Event ops manage events and commands",
  },
  0: [
    `Event ops are detail of ScribePartitionConnection.`,
  ],
});

/*
 ####   #    #  #####    ####   #    #     #     ####   #       ######
#    #  #    #  #    #  #    #  ##   #     #    #    #  #       #
#       ######  #    #  #    #  # #  #     #    #       #       #####
#       #    #  #####   #    #  #  # #     #    #       #       #
#    #  #    #  #   #   #    #  #   ##     #    #    #  #       #
 ####   #    #  #    #   ####   #    #     #     ####   ######  ######
*/

export function _chronicleEventLog (connection: ScribePartitionConnection,
    eventLog: UniversalEvent[], options: ChronicleOptions = {}): Promise<any> {
  if (!eventLog || !eventLog.length) return eventLog;
  if (!connection.isRemote() && !eventLog[0].eventId) _addCommandsToQueue(connection, eventLog);
  if (eventLog[0].eventId) return connection._recordEventLog(eventLog);

  if (connection.getFirstCommandEventId() < connection.getFirstUnusedTruthEventId()) {
    _setCommandQueueFirstEventId(connection, connection.getFirstUnusedTruthEventId());
  }
  _addCommandsToQueue(connection, eventLog); // assigns eventId's but doesn't persist.
  /*
  connection.warnEvent("\n\tclaimcommand:", ...dumpObject(command).commandId, commandEventId,
          command,
      "\n\tcommand/eventInfos:", connection._commandQueueInfo, connection._eventLogInfo,
      "\n\tcommandIds:", connection._commandQueueInfo.commandIds);
  //*/

  // FIXME(iridian): Go through the sequencing of all of these operations.

  const upstreamChronicleEventLog = thenChainEagerly(
      connection.getUpstreamConnection().getSyncedConnection(),
      (syncedConnection) => syncedConnection.chronicleEventLog(eventLog, options));
  const commandWriteProcess = !connection.isTransient() && connection._writeCommands(eventLog);
  const retrieveMediaContent = options.retrieveMediaContent
      || _throwOnMediaContentRetrieveRequest.bind(null, connection);
  const mediaEntryUpdates = {};
  const mediaUpdateProcess = Promise.all(eventLog.map(commandEvent => thenChainEagerly(
      _preprocessActionPrerequisites(connection, commandEvent, retrieveMediaContent), [
        (preOps) => preOps.length && Promise.all(preOps.map(preOp => preOp({ retryTimes: 1 }))),
        preOpResults => {
          (preOpResults || []).forEach(results => (mediaEntryUpdates[results.mediaId] = results));
        },
      ]
  ))).then(() => {
    connection._updateMediaEntries(Object.values(mediaEntryUpdates));
  });
  /*
  if (commandWriteProcess) {
    Promise.resolve(commandWriteProcess).then(writeResults => {
      connection.warnEvent("\n\twrote commands:", ...dumpObject(commandEventLog),
          "\n\twrite results:", ...dumpObject(writeResults),
          "\n\t:", connection.isLocal() ? "local" : "remote",
              connection.getFirstUnusedTruthEventId() - 1,
          "\n\tcommandIds:", connection._commandQueueInfo.commandIds);
    });
  }
  //*/
  return eventLog.map(commandEvent => ({
    eventId: commandEvent.eventId,
    finalizeLocal: () => thenChainEagerly(commandWriteProcess, [
      () => mediaUpdateProcess,
      () => commandEvent,
    ]),
  }));
}

// Update in-memory metadata commandIds array, no db changes
function _addCommandsToQueue (connection: ScribePartitionConnection, commands: Array<Command>) {
  connection._commandQueueInfo.commandIds.push(...commands.map(command => {
    command.eventId = ++connection._commandQueueInfo.lastEventId;
    return command.commandId;
  }));
  if (commands.length) {
    connection.setIsFrozen(commands[commands.length - 1].type === "FROZEN");
  }
  connection._notifyProphetOfCommandCount();
}

// Update in-memory metadata first event id, no db changes
function _setCommandQueueFirstEventId (connection: ScribePartitionConnection,
    firstEventId: number) {
  const discardedCommands = firstEventId - connection.getFirstCommandEventId();
  connection._commandQueueInfo.firstEventId = firstEventId;

  if (connection.getFirstCommandEventId() < connection.getFirstUnusedCommandEventId()) {
    connection._commandQueueInfo.commandIds.splice(0, discardedCommands);
  } else {
    connection._commandQueueInfo.lastEventId = connection.getFirstCommandEventId() - 1;
    connection._commandQueueInfo.commandIds = [];
  }
  connection._notifyProphetOfCommandCount();
}

/*
 #    #    ##    #####   #####     ##     #####  ######
 ##   #   #  #   #    #  #    #   #  #      #    #
 # #  #  #    #  #    #  #    #  #    #     #    #####
 #  # #  ######  #####   #####   ######     #    #
 #   ##  #    #  #   #   #   #   #    #     #    #
 #    #  #    #  #    #  #    #  #    #     #    ######
*/

export async function _narrateEventLog (connection: ScribePartitionConnection,
    options: NarrateOptions, ret: Object) {
  const localResults = await _narrateCachedEventLog(connection,
      options.receiveEvent, options.receiveCommand, options.firstEventId, options.lastEventId);

  Object.assign(ret, localResults);
  if ((options.remote === false) || !connection.getUpstreamConnection()) return ret;

  const upstreamNarration = _narrateUpstreamEventLog(connection, options.name, options.receiveEvent,
      options.subscribe,
      Math.max(options.firstEventId || 0, connection.getFirstUnusedTruthEventId()));

  if ((options.fullNarrate !== true)
      && ((ret.scribeEventLog || []).length || (ret.scribeCommandQueue || []).length)) {
    connection.logEvent(1, "Initiated async upstream narration, local narration results:", ret);
  } else {
    // Handle step 2 of the opportunistic narration if local narration didn't find any events by
    // waiting for the upstream narration.
    const upstreamResults = await upstreamNarration;
    connection.logEvent(1, "Awaited upstream narration, local narration results:", ret,
        "\n\tupstream results:", upstreamResults);
    Object.assign(ret, upstreamResults);
  }
  return ret;
}

async function _narrateCachedEventLog (connection: ScribePartitionConnection,
    downstreamReceiveEvent: ReceiveEvent = connection._receiveEvent,
    downstreamReceiveCommand: ReceiveEvent = !downstreamReceiveEvent
        && connection._prophet._repeatClaimToAllFollowers.bind(connection._prophet),
    firstEventId: ?number = connection.getFirstTruthEventId(),
    lastEventId: ?number =
        Math.max(connection.getFirstUnusedTruthEventId(), connection.getFirstUnusedCommandEventId())
            - 1,
): Promise<{ scribeEventLog: any, scribeCommandQueue: any }> {
  // Narrates both authorized events as well as claim commands to _receiveEvent callback.
  // Commands have a truthy command.isCommand.
  const eventLastEventId = Math.min(connection.getFirstUnusedTruthEventId() - 1, lastEventId);
  const eventList = firstEventId > eventLastEventId
    ? []
    : (await connection._readEvents({ firstEventId, lastEventId: eventLastEventId })) || [];

  const commandFirstEventId = eventLastEventId + 1;
  const commandList = (!downstreamReceiveCommand || (commandFirstEventId > lastEventId))
    ? []
    : (await connection._readCommands({ firstEventId: commandFirstEventId, lastEventId })) || [];

  const commandQueueLength =
      connection.getFirstUnusedCommandEventId() - connection.getFirstCommandEventId();
  if ((connection._commandQueueInfo.commandIds.length !== commandQueueLength)
    && (commandList.length === commandQueueLength)
    && commandFirstEventId === connection.getFirstCommandEventId()) {
    connection._commandQueueInfo.commandIds = commandList.map(command => command.commandId);
    connection.setIsFrozen(commandList[commandList.length - 1].type === "FROZEN");
  }
  return {
    scribeEventLog: await Promise.all(eventList.map(downstreamReceiveEvent)),
    scribeCommandQueue: await Promise.all(commandList.map(downstreamReceiveCommand)),
  };
}

async function _narrateUpstreamEventLog (connection: ScribePartitionConnection,
    narrationName: string = "unnamed",
    downstreamReceiveEvent: ReceiveEvent = connection._receiveEvent,
    subscribe: boolean,
    firstEventId: ?number = connection.getFirstUnusedTruthEventId()) {
  const upstream = await connection.getUpstreamConnection().getSyncedConnection();
  const upstreamResults = await upstream.narrateEventLog({
    subscribe,
    firstEventId,
    receiveEvent (event: UniversalEvent, retrieveMediaContent: RetrieveMediaContent) {
      let myPartitionInfo;
      try {
        const lastAuthorizedEventId = connection.getFirstUnusedTruthEventId() - 1;
        if (event.eventId <= lastAuthorizedEventId) return event;
        const preOps = _preprocessActionPrerequisites(connection, event,
            retrieveMediaContent || PartitionConnection.retrieveMediaContent.bind(connection));
        // FIXME(iridian): This code path is unused. Should be used by revelation chronicleEventLog
        //    || _throwOnMediaContentRetrieveRequest.bind(null, connection)));
        const preOpsExecution = preOps.length && Promise.all(preOps.map(
            preOp => preOp({ retryTimes: 4, delayBaseSeconds: 5 })));
        return thenChainEagerly(preOpsExecution, [
          preOpResults => { if (preOpResults) event.preOpResults = preOpResults; },
          // Send the event downstream immediately after all of its media retrievals have been
          // persisted to the bvob cache, even before media infos or event logs have been persisted.
          // Their state is reflected in the in-memory structures. If browser dies before events are
          // written to indexeddb, the worst case is that bvobs which have no persist refcount will
          // be cleared at startup and need to be re-downloaded.
          // This is tolerable enough so we can send events downstream immediately and have the UI
          // start responding to the incoming changes.
          // This delivery is unordered: downstream must handle ordering.
          () => downstreamReceiveEvent(event),
          () => event,
        ], onError);
      } catch (error) { throw onError(error); }
      function onError (error) {
        return connection.wrapErrorEvent(error,
            `_narrateUpstreamEventLog("${narrationName}").narrate(${event.eventId})`,
            "\n\tpartitionInfo:", ...dumpObject(myPartitionInfo),
            "\n\tevent:", ...dumpObject(event),
            "\n\tconnection:", ...dumpObject(connection));
      }
    },
  });

  for (const key of Object.keys(upstreamResults)) {
    const resultEntryLog = upstreamResults[key];
    if (!Array.isArray(resultEntryLog)) continue;
    for (let i = 0; i !== resultEntryLog.length; ++i) {
      const value = resultEntryLog[i];
      if (isPromise(value)) {
        try {
          resultEntryLog[i] = await value;
        } catch (error) {
          const wrapped = connection.wrapErrorEvent(error,
                  `narrateEventLog.authorityResults[${key}][${i}]`,
              "\n\toptions:", ...dumpObject({ subscribe, firstEventId }),
              "\n\tcurrent upstreamResults:", ...dumpObject(upstreamResults));
          if (error.blocksNarration) throw wrapped;
          connection.outputErrorEvent(wrapped);
          resultEntryLog[i] = error.event;
        }
      }
    }
    connection._recordEventLog(resultEntryLog);
  }
  return upstreamResults;
}

/*
  ####    ####   #    #  #    #   ####   #    #
 #    #  #    #  ##  ##  ##  ##  #    #  ##   #
 #       #    #  # ## #  # ## #  #    #  # #  #
 #       #    #  #    #  #    #  #    #  #  # #
 #    #  #    #  #    #  #    #  #    #  #   ##
  ####    ####   #    #  #    #   ####   #    #
*/

export function _throwOnMediaContentRetrieveRequest (connection: ScribePartitionConnection,
    mediaId: VRef, mediaInfo: MediaInfo) {
  throw connection.wrapErrorEvent(
      new Error(`Cannot retrieve media '${mediaInfo.name}' content through partition '${
        connection.getName()}'`),
      "retrieveMediaContent",
      "\n\tdata not found in local bvob cache and no remote content retriever is specified",
      ...(connection.isLocal() || connection.isTransient()
          ? ["\n\tlocal/transient partitions don't have remote storage backing"] : []),
      "\n\tmediaInfo:", ...dumpObject(mediaInfo));
}

export function _preprocessActionPrerequisites (connection: ScribePartitionConnection,
    event: Object, retrieveMediaContent: ?RetrieveMediaContent, rootEvent: Object = event) {
  if (isTransactedLike(event)) {
    return [].concat(
        ...event.actions
        .map(action => _preprocessActionPrerequisites(connection, action, retrieveMediaContent,
            rootEvent))
        .filter(notFalsy => notFalsy));
  } else if (event.typeName === "MediaType") {
    connection._prophet._mediaTypes[getRawIdFrom(event.id)] = event.initialState;
  } else if ((event.initialState !== undefined) || (event.sets !== undefined)) {
    if (getRawIdFrom(event.id) === connection.getPartitionRawId()) {
      const newName = (event.initialState || event.sets || {}).name;
      if (newName) connection.setName(`'${newName}'/${connection.getPartitionURI().toString()}`);
    }
    if (event.typeName === "Media") {
      return connection._initiateMediaRetrievals(event, retrieveMediaContent, rootEvent);
    }
  }
  return [];
}

export async function _recordEventLog (connection: ScribePartitionConnection,
    eventLog: UniversalEvent[]) {
  let newLastEventId = connection.getFirstUnusedTruthEventId() - 1;
  const mediaEntryUpdates = {};
  const newEvents = eventLog.filter(event => {
    // Also skip updating media entries for existing events
    if (event.eventId <= newLastEventId) return false;
    if (event.eventId > ++newLastEventId) {
      invariantify(event.eventId === newLastEventId,
          `eventID race, expected confirmed truth eventId to be the first free event id (${
            newLastEventId}), instead got: ${event.eventId}`);
    }
    if (event.preOpResults) {
      // Only update to the last media entry for each media
      event.preOpResults.forEach(results => (mediaEntryUpdates[results.mediaId] = results));
      delete event.preOpResults;
    }
    return true;
  });
  if (newLastEventId === connection.getFirstUnusedTruthEventId() - 1) return [];

  const lastNewEvent = newEvents[newEvents.length - 1];
  const purgedCommands = await _confirmOrPurgeQueuedCommands(connection, lastNewEvent);
  if (connection.getFirstCommandEventId() >= connection.getFirstUnusedCommandEventId()) {
    connection.setIsFrozen(lastNewEvent.type === "FROZEN");
  }

  connection._eventLogInfo.lastEventId = lastNewEvent.eventId;
  connection._writeEvents(newEvents);
  connection._updateMediaEntries(Object.values(mediaEntryUpdates));
  return { purgedCommands };
  /*
  connection.warnEvent("\n\trecordTruth", event.commandId, eventId,
      "\n\tevent/commandInfos:", connection._eventLogInfo, connection._commandQueueInfo,
      "\n\tcommandIds:", connection.getFirstCommandEventId(),
          connection.getFirstUnusedCommandEventId(), connection._commandQueueInfo.commandIds,
      ...(purgedCommands ? ["\n\tPURGING:", purgedCommands] : []));
  */
}

async function _confirmOrPurgeQueuedCommands (connection: ScribePartitionConnection,
    lastNewEvent: UniversalEvent) {
  let purgedCommands;
  const { firstEventId: firstCommandId, lastEventId: lastCommandId, commandIds }
      = connection._commandQueueInfo;
  if ((firstCommandId <= lastNewEvent.eventId) && (lastNewEvent.eventId <= lastCommandId)
      && (lastNewEvent.commandId !== commandIds[lastNewEvent.eventId - firstCommandId])) {
    // connection.warnEvent("\n\tPURGING by", event.commandId, eventId, event, commandIds,
    //    "\n\tcommandIds:", firstCommandId, lastCommandId, commandIds);
    // Frankly, we could just store the commands in the 'commandIds' fully.
    purgedCommands = await connection._readCommands(
        { firstEventId: firstCommandId, lastEventId: lastCommandId });
  }

  const newCommandQueueFirstEventId = (purgedCommands ? lastCommandId : lastNewEvent.eventId) + 1;
  if (connection.getFirstCommandEventId() < newCommandQueueFirstEventId) {
    _setCommandQueueFirstEventId(connection, newCommandQueueFirstEventId);
  }

  // Delete commands after event is stored, so we get no gaps.
  // TODO(iridian): Put these to the same transaction with the writeEvent
  if (!connection.isTransient()) {
    if (purgedCommands) {
      // TODO(iridian): Add merge-conflict-persistence. As it stands now, for the duration of
      // the merge process the purged commands are not persisted anywhere and could be lost.
      connection._deleteCommands(firstCommandId, lastCommandId);
    } else if (lastNewEvent.eventId >= firstCommandId) {
      connection._deleteCommands(firstCommandId, Math.min(lastNewEvent.eventId, lastCommandId));
    }
  }
  return purgedCommands;
}
