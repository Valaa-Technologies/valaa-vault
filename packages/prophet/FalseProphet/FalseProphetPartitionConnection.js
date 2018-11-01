// @flow

import { EventBase, Story } from "~/raem/command";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type { NarrateOptions, ChronicleOptions, ChronicleEventResult } from "~/prophet/api/Prophet";

import { dumpObject } from "~/tools";

import { _purgeAndRevisePartitionCommands } from "./_prophecyOps";

/**
 * @export
 * @class FalseProphetPartitionConnection
 * @extends {PartitionConnection}
 */
export default class FalseProphetPartitionConnection extends PartitionConnection {
  // _headEventId is the eventId of the first unconfirmed truth.
  // penndingTruths and unconfirmedCommands are based on this, ie.
  // their 0th entry eventId is always equal to this.
  _headEventId: number = 0;
  // Discontinuous, unreduced truths. If defined, the first entry is
  // always immediately reduced. This means that first entry is always
  // undefined.
  _pendingTruths: EventBase[] = [];
  // Continuous, reduced but unconfirmed commands. Whenever
  // _pendingTruths contains a truth at an equivalent position with
  // equivalent commandId, then all commands with eventId equal or less
  // to that are confirmed as truths and transferred to _pendingTruths.
  _unconfirmedCommands: EventBase[] = [];
  _firstUnconfirmedEventId = 0;
  _isFrozen: ?boolean;

  setIsFrozen (value: boolean = true) { this._isFrozen = value; }

  isFrozenConnection (): boolean { return !!this._isFrozen; }

  narrateEventLog (options: NarrateOptions = {}): Promise<Object> {
    return super.narrateEventLog({
      ...options,
      receiveTruths: this.getReceiveTruths(options.receiveTruths),
      receiveCommands: this.getReceiveCommands(options.receiveCommands),
    });
  }

  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}):
      { eventResults: ChronicleEventResult[] } {
    if (!events || !events.length) return { eventResults: events };
    try {
      if (options.isProphecy) {
        // console.log("assigning ids:", this.getName(), this._headEventId,
        //     this._unconfirmedCommands.length, "\n\tevents:", ...dumpObject(eventLog));
        events.forEach(event => {
          event.eventId = this._headEventId + this._unconfirmedCommands.length;
          this._unconfirmedCommands.push(event);
        });
        this._checkForFreezeAndNotify();
      } else if (typeof events[0].eventId !== "number") {
        throw new Error("Can't chronicle events without eventId (options.isProphecy is not set)");
      }
      return super.chronicleEvents(events, {
        ...options,
        receiveTruths: this.getReceiveTruths(options.receiveTruths),
        receiveCommands: options.isProphecy ? null
            : this.getReceiveCommands(options.receiveCommands),
      });
    } catch (error) {
      throw this.wrapErrorEvent(error, `chronicleEvents(${events.length} events: [${
              events[0].eventId}, ${events[events.length - 1].eventId}])`,
          "\n\toptions:", ...dumpObject(options));
    }
  }

  receiveTruths (truths: EventBase[]) {
    const revisedStories = [];
    try {
      this._insertEventsToQueue(truths, this._pendingTruths, {
        continuous: false,
        onMismatch: (truth, queueIndex, existingTruth) => {
          this.errorEvent(`receiveTruths commandId mismatch to existing truth, expected '${
              existingTruth.commandId}', ignoring incoming truth with commandId: '${
              truth.commandId}'`);
          return false;
        },
        onInserted: (truth, queueIndex) => {
          const purgeEventId = this._correlateTruthToCommand(
              queueIndex, truth, this._unconfirmedCommands[queueIndex]);
          revisedStories.push(...(this._purgeAndReviseCommands(purgeEventId) || []));
        }
      });
      this._normalizeQueuesAndPostProcess(revisedStories);
      return truths;
    } catch (error) {
      throw this.wrapErrorEvent(error, `receiveTruths([${truths[0].eventId}, ${
              truths[truths.length - 1].eventId}])`,
          "\n\treceived truths:", ...dumpObject(truths),
          "\n\tpendingTruths:", ...dumpObject([...this._pendingTruths]),
          "\n\tunconfirmedCommands:", ...dumpObject([...this._unconfirmedCommands]),
          "\n\tthis:", ...dumpObject(this)
      );
    }
  }

  receiveCommands (commands: EventBase[]) {
    let revisedCommands;
    try {
      this._insertEventsToQueue(commands, this._unconfirmedCommands, {
        continuous: true,
        onMismatch: (command, queueIndex, existingCommand) => {
          revisedStories = this._purgeAndReviseCommands(existingCommand.eventId);
          this._unconfirmedCommands[queueIndex] = command;
          return true;
        },
        onInserted: (command, queueIndex) => {
          if (this._correlateTruthToCommand(queueIndex, this._pendingTruths[queueIndex], command)
              !== undefined) {
            this._unconfirmedCommands.splice(queueIndex);
            throw new Error(`INTERNAL ERROR: incoming command #${command.eventId
                } has inconsistent commandId '${command.commandId
                }' to corresponding pending truth commandId '${this._pendingTruths[queueIndex]}'`);
          }
          this._prophet._distpatchEventForAStory(command, "receiveCommand");
        },
      });
      this._normalizeQueuesAndPostProcess(revisedCommands);
      return commands;
    } catch (error) {
      throw this.wrapErrorEvent(error, `receiveCommand([${commands[0].eventId}, ${
              commands[commands.length - 1].eventId}])`,
          "\n\treceived commands:", ...dumpObject(commands),
          "\n\tpendingTruths:", ...dumpObject([...this._pendingTruths]),
          "\n\tunconfirmedCommands:", ...dumpObject([...this._unconfirmedCommands]),
          "\n\tthis:", ...dumpObject(this)
      );
    }
  }

  _insertEventsToQueue (events: EventBase[], targetQueue: EventBase[],
      { continuous, onMismatch, onInserted }: { onMismatch: Function, onInserted: Function }) {
    events.forEach((event, index) => {
      const queueIndex = !event ? -1 : (event.eventId - this._headEventId);
      try {
        if (queueIndex < 0) return;
        if (continuous && queueIndex && !targetQueue[queueIndex - 1]) {
          // TODO(iridian): non-continuousity support can be added in principle.
          // But maybe it makes sense to put this functionality to scribe? Or to Oracle?
          throw new Error(`Non-continuous eventId ${event.eventId
              } detected when inserting events to queue`);
        }
        const existingEvent = targetQueue[queueIndex];
        if (!existingEvent) {
          targetQueue[queueIndex] = event;
        } else if ((event.commandId === existingEvent.commandId)
            || !onMismatch(event, queueIndex, existingEvent)) {
          return;
        }
        onInserted(event, queueIndex, existingEvent);
      } catch (error) {
        throw this.wrapErrorEvent(error, `_insertEventsToQueue().events[${index}]`,
            "\n\tevents:", ...dumpObject(events),
            "\n\ttargetQueue:", ...dumpObject(targetQueue),
            "\n\tqueueIndex:", queueIndex,
            "\n\tthis:", ...dumpObject(this));
      }
    });
  }

  _correlateTruthToCommand (queueIndex: number, truth: ?EventBase, command: ?EventBase) {
    // Correlate to unconfirmed commands to detect confirmations and purges.
    if (!truth || !command) return undefined;
    if (command.commandId === truth.commandId) {
      this._firstUnconfirmedEventId = Math.max(truth.eventId + 1, this._firstUnconfirmedEventId);
      return undefined;
    }
    if (truth.eventId < this._firstUnconfirmedEventId) {
      this.errorEvent(`commandId SEQUENCING FAULT at eventId ${this._firstUnconfirmedEventId - 1}:`,
          "\n\tequivalent commandId detected between a unconfirmed command and an incoming truth",
          "even when unconfirmed commands are being purged earlier from eventId", truth.eventId,
          "\n\tpurge queue index:", queueIndex,
          "\n\tpending truths queue:", ...dumpObject([...this._pendingTruths]),
          "\n\tunconfirmed commands queue:", ...dumpObject([...this._unconfirmedCommands]));
      this._firstUnconfirmedEventId = truth.eventId;
    }
    return truth.eventId;
  }

  _purgeAndReviseCommands (firstPurgedEventId = this._headEventId) {
    let purgedStories;
    try {
      if (firstPurgedEventId >= this._headEventId) return undefined;
      purgedStories = this._unconfirmedCommands.splice(firstPurgedEventId - this._headEventId);
      return _purgeAndRevisePartitionCommands(this, purgedStories);
    } catch (error) {
      throw this.wrapErrorEvent(`_purgeAndReviseCommands(${firstPurgedEventId})`,
          "\n\tpurgedCommands:", ...dumpObject(purgedStories));
    }
  }

  _normalizeQueuesAndPostProcess (purgedStories: EventBase[]) {
    const confirmedCommandCount = Math.min(
        this._firstUnconfirmedEventId - this._headEventId, this._unconfirmedCommands.length);
    if (confirmedCommandCount > 0) {
      this._headEventId += confirmedCommandCount;
      // TODO(iridian): Check the consistency of the spliced sequences?
      // Corresponding non-empty entries should have same commandId's
      // This check has already been done once, however.
      this._pendingTruths.splice(0, confirmedCommandCount);
      this._unconfirmedCommands.splice(0, confirmedCommandCount);
    }

    if (this._unconfirmedCommands.length) {
      if (this._pendingTruths[0]) {
        throw new Error(`INTERNAL ERROR: can't resolve pending truths when there are still${
            ""} unconfirmed commands in the queue (those should have been confirmed or purged)`);
      }
    } else {
      while (this._pendingTruths[0]) {
        ++this._headEventId;
        this._prophet._distpatchEventForAStory(this._pendingTruths.shift(), "truth");
      }
    }

    if (purgedStories && purgedStories.length) {
      this.setIsFrozen(false);
      throw new Error("reformation not implemented yet against FalseProphet");
    }
    this._checkForFreezeAndNotify();
  }

  _checkForFreezeAndNotify (lastEvent: EventBase[]
      = this._unconfirmedCommands[(this._unconfirmedCommands.length || 1) - 1]) {
    if (lastEvent) this.setIsFrozen(lastEvent.type === "FROZEN");
    this._prophet.setConnectionCommandCount(
        this.getPartitionURI().toString(), this._unconfirmedCommands.length);
  }
}

/*
async function _confirmOrPurgeQueuedCommands (connection: ScribePartitionConnection,
    lastNewEvent: EventBase) {
  let purgedStories;
  const { eventIdBegin: beginCommandId, eventIdEnd: endCommandId, commandIds }
      = connection._commandQueueInfo;
  if ((beginCommandId <= lastNewEvent.eventId) && (lastNewEvent.eventId < endCommandId)
      && (lastNewEvent.commandId !== commandIds[lastNewEvent.eventId - beginCommandId])) {
    // connection.warnEvent("\n\tPURGING by", event.commandId, eventId, event, commandIds,
    //    "\n\tcommandIds:", beginCommandId, endCommandId, commandIds);
    // Frankly, we could just store the commands in the 'commandIds' fully.
    purgedStories = await connection._readCommands(
        { eventIdBegin: beginCommandId, eventIdEnd: endCommandId });
  }

  const newCommandQueueFirstEventId = (purgedStories ? endCommandId : lastNewEvent.eventId) + 1;
  if (connection.getFirstCommandEventId() < newCommandQueueFirstEventId) {
    _setCommandQueueFirstEventId(connection, newCommandQueueFirstEventId);
  }

  // Delete commands after event is stored, so we get no gaps.
  // TODO(iridian): Put these to the same transaction with the writeEvent
  if (connection.isLocallyPersisted()) {
    if (purgedStories) {
      // TODO(iridian): Add merge-conflict-persistence. As it stands now, for the duration of
      // the merge process the purged commands are not persisted anywhere and could be lost.
      connection._deleteCommands(beginCommandId, endCommandId);
    } else if (lastNewEvent.eventId >= beginCommandId) {
      connection._deleteCommands(beginCommandId, Math.min(lastNewEvent.eventId + 1, endCommandId));
    }
  }
  return purgedStories;
}
*/
