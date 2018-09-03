// @flow

import Command, { isTransactedLike, UniversalEvent } from "~/raem/command";
import { VRef, getRawIdFrom } from "~/raem/ValaaReference";

import type { MediaInfo, NarrateOptions, ChronicleOptions, RetrieveMediaContent }
    from "~/prophet/api/Prophet";

import { dumpObject, invariantify, vdon } from "~/tools";

import ScribePartitionConnection from "./ScribePartitionConnection";

export const vdoc = vdon({
  "...": { heading:
    "Event ops manage events and commands",
  },
  0: [
    `Event ops are detail of ScribePartitionConnection.`,
  ],
});

export async function _narrateEventLog (connection: ScribePartitionConnection,
    options: NarrateOptions = {}):
        Promise<{ scribeEventLog: any, scribeCommandQueue: any }> {
  // Narrates both authorized events as well as claim commands to _processEvent callback.
  // Commands have a truthy command.isCommand.
  const firstEventId = typeof options.firstEventId !== "undefined"
    ? options.firstEventId
    : connection._getFirstAuthorizedEventId();
  const lastEventId = typeof options.lastEventId !== "undefined"
    ? options.lastEventId
    : Math.max(connection.getLastAuthorizedEventId(), connection.getLastCommandEventId());

  const eventLastEventId = Math.min(connection.getLastAuthorizedEventId(), lastEventId);
  const eventList = firstEventId > eventLastEventId
    ? []
    : (await connection._readEvents({ firstEventId, lastEventId: eventLastEventId })) || [];

  const commandFirstEventId = eventLastEventId + 1;
  const commandList = (!options.commandCallback || (commandFirstEventId > lastEventId))
    ? []
    : (await connection._readCommands({ firstEventId: commandFirstEventId, lastEventId })) || [];

  const commandQueueLength =
      (connection.getLastCommandEventId() + 1) - connection._getFirstCommandEventId();
  if ((connection._commandQueueInfo.commandIds.length !== commandQueueLength)
    && (commandList.length === commandQueueLength)
    && commandFirstEventId === connection._getFirstCommandEventId()) {
    connection._commandQueueInfo.commandIds = commandList.map(command => command.commandId);

    connection.setIsFrozen(commandList[commandList.length - 1].type === "FROZEN");
  }
  return {
    scribeEventLog: await Promise.all(eventList.map(options.callback || connection._processEvent)),
    scribeCommandQueue: await Promise.all(commandList.map(options.commandCallback)),
  };
}

export async function _chronicleEventLog (connection: ScribePartitionConnection,
    eventLog: UniversalEvent[], options: ChronicleOptions = {}): Promise<any> {
}

export async function _recordTruth (connection: ScribePartitionConnection,
    { event, eventId }: Object, preAuthorizeCommand: () => any) {
  if (eventId <= connection.getLastAuthorizedEventId()) return false;
  invariantify(eventId === connection.getLastAuthorizedEventId() + 1,
      `eventID race, expected confirmed truth eventId to be lastEventId + 1 === ${
          connection.getLastAuthorizedEventId() + 1}, but got ${eventId} instead`);
  const { firstEventId: firstCommandId, lastEventId: lastCommandId, commandIds }
      = connection._commandQueueInfo;
  let purgedCommands;
  if ((firstCommandId <= eventId) && (lastCommandId >= eventId)
      && (event.commandId !== commandIds[0])) {
    // connection.warnEvent("\n\tPURGING by", event.commandId, eventId, event, commandIds,
    //    "\n\tcommandIds:", firstCommandId, lastCommandId, commandIds);
    // Frankly, we could just store the commands in the 'commandIds' fully.
    purgedCommands = await connection._readCommands(
        { firstEventId: firstCommandId, lastEventId: lastCommandId });
  }

  // Add the authorized truth to the event log.
  if (!connection.isTransient()) {
    await connection._writeEvent(eventId, event);
  }
  connection._eventLogInfo.lastEventId = eventId;

  const newCommandQueueFirstEventId = (purgedCommands ? lastCommandId : eventId) + 1;
  if (connection._getFirstCommandEventId() < newCommandQueueFirstEventId) {
    _setCommandQueueFirstEventId(connection, newCommandQueueFirstEventId);
  }
  if (connection._getFirstCommandEventId() > connection.getLastCommandEventId()) {
    connection.setIsFrozen(event.type === "FROZEN");
  }

  // Delete commands after event is stored, so we get no gaps.
  // TODO(iridian): Put these to the same transaction with the writeEvent
  if (!connection.isTransient()) {
    if (purgedCommands) {
      // TODO(iridian): Add merge-conflict-persistence. As it stands now, for the duration of
      // the merge process the purged commands are not persisted anywhere and could be lost.
      connection._deleteCommands(firstCommandId, lastCommandId);
    } else if ((firstCommandId <= eventId) && (lastCommandId >= eventId)) {
      connection._deleteCommand(eventId);
    }
  }

  // For local partitions where Scribe is the authority, always authorize the next
  // command in queue to the Oracle if one is available.
  if ((connection.isLocal() || connection.isTransient()) && (lastCommandId > eventId)) {
    invariantify(preAuthorizeCommand,
        "recordTruth.preAuthorizeCommand missing when command queue has futures");
    _preAuthorizeNextCommand(connection, eventId + 1, preAuthorizeCommand);
  }
  /*
  connection.warnEvent("\n\trecordTruth", event.commandId, eventId,
      "\n\tevent/commandInfos:", connection._eventLogInfo, connection._commandQueueInfo,
      "\n\tcommandIds:", connection.getFirstCommandEventId(),
          connection.getLastCommandEventId(), connection._commandQueueInfo.commandIds,
      ...(purgedCommands ? ["\n\tPURGING:", purgedCommands] : []));
  //*/
  return { purgedCommands };
}

export function _claimCommandEvent (connection: ScribePartitionConnection,
    command: Command, retrieveMediaContent: RetrieveMediaContent): Object {
  if (connection._getFirstCommandEventId() <= connection.getLastAuthorizedEventId()) {
    _setCommandQueueFirstEventId(connection, connection.getLastAuthorizedEventId() + 1);
  }
  const commandEventId = _addCommandsToQueue(connection, [command]);
  /*
  connection.warnEvent("\n\tclaimcommand:", ...dumpObject(command).commandId, commandEventId,
          command,
      "\n\tcommand/eventInfos:", connection._commandQueueInfo, connection._eventLogInfo,
      "\n\tcommandIds:", connection._commandQueueInfo.commandIds);
  //*/
  return {
    eventId: commandEventId,
    finalizeLocal: async () => {
      const finalizers = _reprocessAction(connection, command,
          retrieveMediaContent || _throwOnMediaContentRetrieveRequest.bind(null, connection));
      if (!connection.isTransient()) {
        await connection._writeCommand(commandEventId, command);
        /*
        connection.warnEvent("\n\twrotecommand:", ...dumpObject(command).commandId, commandEventId,
                command,
            "\n\t:", connection.isLocal() ? "local" : "remote",
                connection.getLastAuthorizedEventId(),
            "\n\tcommandIds:", connection._commandQueueInfo.commandIds);
        //*/
      }
      return Promise.all(finalizers.map(finalize => finalize({ retryTimes: 1 })));
    }
  };
}

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


export function _reprocessAction (connection: ScribePartitionConnection, event: Object,
    retrieveMediaContent: ?RetrieveMediaContent, rootEvent: Object = event) {
  if (isTransactedLike(event)) {
    return [].concat(
        ...event.actions
        .map(action => _reprocessAction(connection, action, retrieveMediaContent, rootEvent))
        .filter(retriever => retriever));
  } else if (event.typeName === "MediaType") {
    connection._prophet._mediaTypes[getRawIdFrom(event.id)] = event.initialState;
  } else if ((event.initialState !== undefined) || (event.sets !== undefined)) {
    if (getRawIdFrom(event.id) === connection.partitionRawId()) {
      const newName = (event.initialState && event.initialState.name)
          || (event.sets && event.sets.name);
      if (newName) connection._name = `'${newName}'/${connection.partitionURI().toString()}`;
    }
    if (event.typeName === "Media") {
      return connection._reprocessMedia(event, retrieveMediaContent, rootEvent);
    }
  }
  return [];
}

async function _preAuthorizeNextCommand (connection: ScribePartitionConnection, eventId,
    preAuthorizeCommand: (command: Command) => void) {
  const preAuthorizeCommandCandidates = await connection._readCommands({
    firstEventId: eventId,
    lastEventId: eventId,
  });
  if (preAuthorizeCommandCandidates && preAuthorizeCommandCandidates.length) {
    preAuthorizeCommand(preAuthorizeCommandCandidates[0]);
  }
}

function _setCommandQueueFirstEventId (connection: ScribePartitionConnection,
    firstEventId?: number) {
  const discardedCommands = firstEventId - connection._getFirstCommandEventId();
  connection._commandQueueInfo.firstEventId = firstEventId;

  if (connection._getFirstCommandEventId() <= connection.getLastCommandEventId()) {
    connection._commandQueueInfo.commandIds.splice(0, discardedCommands);
  } else {
    connection._commandQueueInfo.lastEventId = connection._getFirstCommandEventId() - 1;
    connection._commandQueueInfo.commandIds = [];
  }
  connection._notifyProphetOfCommandCount();
}

function _addCommandsToQueue (connection: ScribePartitionConnection, commands: Array<Command>) {
  connection._commandQueueInfo.commandIds.push(...commands.map(command => command.commandId));
  if (commands.length) {
    connection.setIsFrozen(commands[commands.length - 1].type === "FROZEN");
  }
  connection._commandQueueInfo.lastEventId += commands.length;
  connection._notifyProphetOfCommandCount();
  return connection.getLastCommandEventId();
}

