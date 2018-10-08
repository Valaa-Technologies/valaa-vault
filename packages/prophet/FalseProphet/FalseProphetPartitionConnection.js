// @flow

import { UniversalEvent } from "~/raem/command";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type { NarrateOptions, ChronicleOptions, ChronicleEventResult } from "~/prophet/api/Prophet";

import { dumpObject } from "~/tools";

/**
 * @export
 * @class FalseProphetPartitionConnection
 * @extends {PartitionConnection}
 */
export default class FalseProphetPartitionConnection extends PartitionConnection {
  _firstNonAuthorizedCommandId: number = 0;
  _nonAuthorizedCommands: Array<UniversalEvent>;
  _eventsPendingSequencing: Object[] = [];
  _isFrozen: ?boolean;

  // this._notifyProphetOfCommandCount(),

  setIsFrozen (value: boolean = true) { this._isFrozen = value; }

  isFrozen (): boolean { return !!this._isFrozen; }


  receiveEvent (truthEvent: UniversalEvent) {
      }
  }

  _addNonAuthorizedCommands (eventLog: UniversalEvent[]) {
    this._nonAuthorizedCommands.push(...eventLog);
    this.setIsFrozen(eventLog[eventLog.length - 1].type === "FROZEN");
    this._notifyProphetOfCommandCount();
  }

  _notifyProphetOfCommandCount () {
    this._prophet.setConnectionCommandCount(this.getPartitionURI().toString(),
        this._nonAuthorizedCommands.length);
  }
}

/*
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
*/
