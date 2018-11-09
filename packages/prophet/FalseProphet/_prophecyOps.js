// @flow

import { getActionFromPassage } from "~/raem";
import { Command, EventBase } from "~/raem/command";
import type { Story } from "~/raem/redux/Bard";
import { MissingPartitionConnectionsError } from "~/raem/tools/denormalized/partitions";
import ValaaURI, { createPartitionURI } from "~/raem/ValaaURI";

import { ChronicleEventResult, PartitionConnection, ProphecyChronicleRequest, ProphecyEventResult }
    from "~/prophet/api/types";
import extractEventOfPartition from "~/prophet/tools/extractEventOfPartition";

import { dumpObject, isPromise, outputError, thenChainEagerly, mapEagerly } from "~/tools";
import { trivialCloneWith } from "~/tools/trivialClone";

import FalseProphet from "./FalseProphet";
import { _rejectLastProphecyAsHeresy } from "./_storyOps";
import FalseProphetPartitionConnection from "./FalseProphetPartitionConnection";

export type Prophecy = Story & {
  timed: ?Object;
  isProphecy: true;
}

const ProphecyOperationTag = Symbol("Prophecy Operation");

// Create prophecies out of provided events and send their partition
// commands upstream. Aborts all remaining events on first exception
// and rolls back previous ones.
export function _chronicleEvents (falseProphet: FalseProphet, events: EventBase[],
    { timed, transactionInfo, ...rest } = {}): ProphecyChronicleRequest {
  if (timed) throw new Error("timed events not supported yet");
  const prophecies = events.map(event => falseProphet._fabricateStoryFromEvent(
      universalizeEvent(falseProphet, event), "chronicleProphecy", timed, transactionInfo));
  const resultBase = new ProphecyOperation(null, {
    _prophet: falseProphet, _events: events, _options: rest,
    _reactions: falseProphet._tellStoriesToFollowers(prophecies),
  });
  resultBase._options.isProphecy = true;

  return {
    eventResults: prophecies.map(
        (prophecy, index) => Object.create(resultBase)._execute(prophecy, index)),
  };
}

export function universalizeEvent (falseProphet: FalseProphet, event: EventBase): EventBase {
  return trivialCloneWith(event,
      entry => (entry instanceof ValaaURI ? entry : undefined));
}

export function _confirmProphecyCommand (connection: FalseProphetPartitionConnection,
    prophecy: Prophecy, command: Command) {
  const operation = prophecy[ProphecyOperationTag];
  if (operation) {
    const partition = operation._partitions[String(connection.getPartitionURI())];
    if (!partition || !partition.confirmCommand) return false;
    partition.confirmCommand(command);
  } else {
    prophecy.confirmedCommandCount = (prophecy.confirmedCommandCount || 0) + 1;
    if (prophecy.confirmedCommandCount < Object.keys(prophecy.partitions).length) return false;
  }
  return true;
}

export function _revisePurgedProphecy (connection: FalseProphetPartitionConnection,
    purged: Prophecy, revised: Prophecy) {
  const softConflict = _checkForSoftConflict(purged, revised);
  if (softConflict) {
    purged.conflictReason = softConflict;
    return undefined;
  }
  connection.warnEvent("\n\trevised prophecy", revised.commandId,
          "from purged prophecy", purged.commandId,
      "\n\trevised prophecy:", ...dumpObject(revised),
      "\n\tpurged prophecy:", ...dumpObject(purged),
      ...connection._prophet._dumpStatus());
  return revised;
}

function _checkForSoftConflict (/* purgedProphecy: Prophecy, revisedProphecy: Prophecy */) {
  // TODO(iridian): Detect and resolve soft conflicts: ie. of the
  // type where the reformed commands modify something that has been
  // modified by the new incoming truth(s), thus overriding such
  // changes. This class of errors does not corrupt the event log so
  // cannot be detected as a reduction error but still most likely is
  // a ValaaSpace conflict and thus should be rejected.
  return undefined;
}

class ProphecyOperation extends ProphecyEventResult {
  _prophecy: Prophecy;
  _prophet: FalseProphet;
  _events: EventBase[];
  _options: Object; // partition command chronicleEvents options
  _partitions: { [partitionURI: string]: {
    connection: PartitionConnection,
    commandEvent: Command,
    chronicling: ChronicleEventResult,
    confirmCommand?: Function,
    purgeCommand?: Function,
  } };
  _activePartitions: Object[];
  _stages: Object;
  _fulfillment: Promise<Object>;

  getCommandOf (partitionURI) {
    return this._partitions[partitionURI].commandEvent;
  }

  getPersistedEvent () {
    return thenChainEagerly(
        mapEagerly(this._activePartitions, ({ chronicling }) => chronicling.getPersistedEvent()),
        () => this._prophecy,
        this.errorOnProphecyOperation.bind(null,
            new Error(`chronicleEvents.eventResults[${this.index}].getPersistedStory()`)));
  }

  getTruthStory () {
    return thenChainEagerly(
        this._fulfillment,
        () => this._prophecy,
        this.errorOnProphecyOperation.bind(null,
            new Error(`chronicleEvents.eventResults[${this.index}].getTruthStory()`)));
  }

  getPremiereStory () {
    return thenChainEagerly(
    // Returns a promise which will resolve to the content
    // received from the backend but only after all the local
    // follower reactions have been resolved as well.
    // TODO(iridian): Exceptions from follower reactions can't
    // reject the prophecy, but we should catch, handle and/or
    // expose them to the prophecy chronicleEvents originator.
        this.getFollowerReactions(),
    // TODO(iridian): Exceptions from upstream signal failure
    // and possible heresy: we should catch and have logic for
    // either retrying the operation or for full rejection.
    // Nevertheless flushing the corpus is needed.
        () => this.getPersistedEvent(),
        this.errorOnProphecyOperation.bind(null,
            new Error(`chronicleEvents.eventResults[${this.index}].getPremiereStory()`)));
  }

  errorOnProphecyOperation (errorWrap, error) {
    throw this._prophet.wrapErrorEvent(error, errorWrap,
        "\n\tevents:", ...dumpObject(this._events),
        "\n\tevent:", ...dumpObject(this._events[this.index]),
        "\n\tprophecy:", ...dumpObject(this.event),
        "\n\toperation:", ...dumpObject(this),
    );
  }

  _execute (prophecy: Prophecy, index: number) {
    this.event = getActionFromPassage(prophecy);
    this.index = index;
    this._prophecy = prophecy;
    prophecy[ProphecyOperationTag] = this;
    Object.assign(this, this._reactions[index]);
    try {
      this._prepareStagesAndCommands();
      this._initiateConnectionValidations();
      this._fulfillProphecy();
    } catch (error) {
      try {
        _rejectLastProphecyAsHeresy(this._prophet, prophecy);
      } catch (innerError) {
        outputError(innerError, `Caught an exception in the exception handler of${
            ""} chronicleEvents; the resulting purge threw exception of its own:`);
      }
      this.errorOnProphecyOperation(
          new Error(`chronicleEvents.eventResults[${index}].preparation`), error);
    }
    return this;
  }

  _prepareStagesAndCommands () {
    this._partitions = {};
    this._stages = [];
    const missingConnections = [];
    if (!this._prophecy.partitions) {
      throw new Error("prophecy is missing partition information");
    }
    const remotes = [];
    const locals = [];
    const memorys = [];
    Object.keys(this._prophecy.partitions).forEach((partitionURIString) => {
      const connection = this._prophet._connections[partitionURIString];
      if (!connection) {
        missingConnections.push(createPartitionURI(partitionURIString));
        return;
      }
      (connection.isRemoteAuthority() ? remotes
          : connection.isLocallyPersisted() ? locals
          : memorys
      ).push((this._partitions[partitionURIString] = {
        connection,
        commandEvent: extractEventOfPartition(getActionFromPassage(this._prophecy), connection),
      }));
    });
    if (remotes.length) this._stages.push({ name: "remotes", partitions: remotes });
    if (locals.length) this._stages.push({ name: "locals", partitions: locals });
    if (memorys.length) this._stages.push({ name: "memory", partitions: memorys });
    if (missingConnections.length) {
      throw new MissingPartitionConnectionsError(`Missing active partition connections: '${
          missingConnections.map(c => c.toString()).join("', '")}'`, missingConnections);
    }
  }

  _initiateConnectionValidations () {
    this._stages.forEach(stage => stage.partitions.forEach(partition => {
      partition.validatedConnection = thenChainEagerly(partition.connection.getSyncedConnection(),
        (connection) => {
          if (connection.isFrozenConnection()) {
            throw new Error(`Trying to chronicle events to a frozen partition ${
                connection.getName()}`);
          }
          // Perform other partition validation
          // TODO(iridian): extract partition content
          partition.validatedConnection = connection;
        },
      );
    }));
  }

  _fulfillProphecy () {
    return (this._fulfillment = mapEagerly(this._stages,
        stage => this._fulfillStage(stage),
        (error, stage) => {
          throw this._prophet.wrapErrorEvent(error,
            new Error(`chronicleEvents._fulfillStage(${stage.name})`),
            "\n\toperation:", ...dumpObject(this),
            "\n\tstage.partitions:", ...dumpObject(stage.partitions));
        }));
  }

  _fulfillStage (stage: Object) {
    return thenChainEagerly(stage, [
      () => mapEagerly(stage.partitions,
          partition => partition.validatedConnection,
          (error, partition) => {
            throw this._prophet.wrapErrorEvent(error,
                new Error(`chronicleEvents.stage["${stage.name}"].connection["${
                    partition.connection.getName()}"].validate`));
          }),
      () => {
        // Persist the prophecy and add refs to all associated event bvobs.
        // This is necessary for prophecy reattempts so that the bvobs aren't
        // garbage collected on browser refresh. Otherwise they can't be
        // reuploaded if their upload didn't finish before refresh.
        // TODO(iridian): Implement prophecy reattempts.
        // TODO(iridian): Implement bvob refcounting once reattempts are implemented.

        // Wait for remote bvob persists to complete.
        // TODO(iridian): Implement.
        // await Promise.all(this.authorityPersistProcesses);

        // Maybe determine eventId's beforehand?

        // Get eventId and scribe persist finalizer for each partition
        this._activePartitions = [];
        for (const partition of stage.partitions) {
          try {
            partition.chronicling = partition.connection.chronicleEvent(
                partition.commandEvent, Object.create(this._options));
            this._activePartitions.push(partition);
          } catch (error) {
            throw this._prophet.wrapErrorEvent(error,
                new Error(`chronicleEvents.stage["${stage.name}"].connection["${
                    partition.connection.getName()}"].chronicleEvents`),
                "\n\tcommandEvent:", ...dumpObject(partition.commandEvent),
                "\n\tchronicling:", ...dumpObject(partition.chronicling),
            );
          }
        }
        return mapEagerly(this._activePartitions,
            partition => {
              const maybeQuickTruth = partition.chronicling.getTruthEvent();
              return !isPromise(maybeQuickTruth)
                  ? maybeQuickTruth
                  : Promise.race([maybeQuickTruth, new Promise((resolve, reject) => {
                    partition.confirmCommand = resolve;
                    partition.purgeCommand = reject;
                  })]);
            },
            (error, { chronicling }, index) => {
              throw this._prophet.wrapErrorEvent(error,
                  new Error(`chronicleEvents.stage["${stage.name}"]._activePartitions[${index}](${
                      chronicling && chronicling.event.eventId}).getTruthEvent()"`),
                  "\n\tchroniclings:", ...dumpObject(this._activePartitions));
            }
        );
      },
      () => {
        this._prophecy.isTruth = true;
        return this._prophecy;
      }
    ], (error, index) => {
      this._prophecy.isRejected = true;
      this._prophecy = null;
      throw this._prophet.wrapErrorEvent(error,
          new Error(`chronicleEvents.stage["${stage.name}"].step#${index}`));
    });
  }
}
