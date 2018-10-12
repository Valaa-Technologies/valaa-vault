// @flow

import { isTransactedLike, UniversalEvent } from "~/raem/command";
import { getRawIdFrom } from "~/raem/ValaaReference";

import type {
  MediaInfo, NarrateOptions, ChronicleOptions, ChronicleEventResult, PartitionConnection,
  ReceiveEvent, RetrieveMediaBuffer,
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
    eventLog: UniversalEvent[], options: ChronicleOptions = {}
): Promise<{ eventResults: ChronicleEventResult[] }> {
  if (!eventLog || !eventLog.length) return { eventResults: eventLog };
  if (options.authorized === true) return { eventResults: connection._recordEventLog(eventLog) };

  /*
  connection.warnEvent("\n\tclaimcommand:", ...dumpObject(command).commandId, commandEventId,
          command,
      "\n\tcommand/eventInfos:", connection._commandQueueInfo, connection._eventLogInfo);
  //*/

  // FIXME(iridian): Go through the sequencing of all of these operations.

  const upstreamChroniclingResult = thenChainEagerly(
      connection.getUpstreamConnection().getSyncedConnection(),
      (syncedConnection) => syncedConnection.chronicleEventLog(eventLog, options));
  const commandWriteProcess = connection.isLocallyPersisted()
      && connection._writeCommands(eventLog);
  const retrieveMediaBuffer = options.retrieveMediaBuffer
      || _throwOnMediaContentRetrieveRequest.bind(null, connection);
  const mediaEntryUpdates = {};
  const mediaUpdateProcess = Promise.all(eventLog.map(commandEvent => thenChainEagerly(
      _preprocessActionPrerequisites(connection, commandEvent, retrieveMediaBuffer), [
        (preOps) => preOps.length && Promise.all(preOps.map(preOp => preOp({ retryTimes: 1 }))),
        preOpResults => {
          (preOpResults || []).forEach(results => (mediaEntryUpdates[results.mediaId] = results));
        },
      ]
  ))).then(() => connection._updateMediaEntries(Object.values(mediaEntryUpdates)));
  /*
  if (commandWriteProcess) {
    Promise.resolve(commandWriteProcess).then(writeResults => {
      connection.warnEvent("\n\twrote commands:", ...dumpObject(commandEventLog),
          "\n\twrite results:", ...dumpObject(writeResults),
          "\n\t:", connection.isLocallyPersisted() ? "local" : "remote",
              connection.getFirstUnusedTruthEventId() - 1);
    });
  }
  //*/
  return {
    eventResults: eventLog.map((commandEvent, index) => ({
      event: commandEvent,
      getLocallyPersistedEvent: () => thenChainEagerly(commandWriteProcess, [
        () => mediaUpdateProcess,
        () => commandEvent,
      ]),
      getAuthorizedEvent: () => thenChainEagerly(commandWriteProcess, [
        // TODO(iridian): Also allow downstream events to complete this
        // request
        () => upstreamChroniclingResult,
        ({ eventResults }) => eventResults[index].getAuthorizedEvent(),
      ]),
    })),
  };
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
    receiveEvent (event: UniversalEvent, retrieveMediaBuffer: RetrieveMediaBuffer) {
      let myPartitionInfo;
      try {
        const lastAuthorizedEventId = connection.getFirstUnusedTruthEventId() - 1;
        if (event.eventId <= lastAuthorizedEventId) return event;
        const preOps = _preprocessActionPrerequisites(connection, event,
            retrieveMediaBuffer || PartitionConnection.readMediaContent.bind(connection));
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
    mediaInfo: MediaInfo) {
  throw connection.wrapErrorEvent(
      new Error(`Cannot retrieve media '${mediaInfo.name}' content through partition '${
        connection.getName()}'`),
      "retrieveMediaBuffer",
      "\n\tdata not found in local bvob cache and no remote content retriever is specified",
      ...(connection.isRemoteAuthority()
          ? ["\n\tlocal/transient partitions don't have remote storage backing"] : []),
      "\n\tmediaInfo:", ...dumpObject(mediaInfo));
}

export function _preprocessActionPrerequisites (connection: ScribePartitionConnection,
    event: Object, retrieveMediaBuffer: ?RetrieveMediaBuffer, rootEvent: Object = event) {
  if (isTransactedLike(event)) {
    return [].concat(
        ...event.actions
        .map(action => _preprocessActionPrerequisites(connection, action, retrieveMediaBuffer,
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
      return connection._initiateMediaRetrievals(event, retrieveMediaBuffer, rootEvent);
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

  connection._eventLogInfo.lastEventId = newEvents[newEvents.length - 1].eventId;
  connection._writeEvents(newEvents);
  connection._updateMediaEntries(Object.values(mediaEntryUpdates));
  return true;
}
