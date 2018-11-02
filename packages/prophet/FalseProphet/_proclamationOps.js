// @flow

import { getActionFromPassage } from "~/raem";
import { EventBase } from "~/raem/command";
import type { Story } from "~/raem/redux/Bard";
import { MissingPartitionConnectionsError } from "~/raem/tools/denormalized/partitions";
import ValaaURI, { createPartitionURI } from "~/raem/ValaaURI";

import type { ProphecyChronicleRequest } from "~/prophet/api/types";
import extractEventOfPartition from "~/prophet/tools/extractEventOfPartition";

import { dumpObject, outputError, thenChainEagerly, mapEagerly } from "~/tools";
import { trivialCloneWith } from "~/tools/trivialClone";

import FalseProphet from "./FalseProphet";
import { _rejectLastProphecyAsHeresy } from "./_prophecyOps";

export type Prophecy = Story & {
  timed: ?Object;
  isProphecy: true;
}

// Create prophecies out of provided events and send their partition
// commands upstream. Aborts all remaining events on first exception
// and rolls back previous ones.
export function _chronicleEvents (falseProphet: FalseProphet, events: EventBase[],
    { timed, transactionInfo } = {}): ProphecyChronicleRequest {
  const prophecies = events.map(event => falseProphet._dispatchEventForStory(
      universalizeEvent(falseProphet, event), "prophecy", timed, transactionInfo));
  const reactions = falseProphet._reciteStoriesToFollowers(prophecies);

  return {
    eventResults: prophecies.map((prophecy, index) => {
      let getCommandOf;
      let prophecyFulfillment;
      if (!timed) {
        try {
          const operation = { prophecy };
          _prepareStagesAndCommands(falseProphet, operation);
          _initiateConnectionValidations(falseProphet, operation);
          prophecyFulfillment = _fulfillProphecy(falseProphet, operation);
          getCommandOf = (partitionURI) => operation.partitionCommands[String(partitionURI)];
        } catch (error) {
          try {
            _rejectLastProphecyAsHeresy(falseProphet, prophecy);
          } catch (innerError) {
            outputError(innerError, `Caught an exception in the exception handler of${
                ""} chronicleEvents; the resulting purge threw exception of its own:`);
          }
          errorOnChronicleEvents(
              new Error(`chronicleEvents.eventResults[${index}].preparation`), error);
        }
      }
      let result;
      try {
        result = reactions[index];
        result.getCommandOf = getCommandOf;
        result.getFinalStory = () => thenChainEagerly(prophecyFulfillment,
            () => prophecy,
            errorOnChronicleEvents.bind(null,
                new Error(`chronicleEvents.eventResults[${index}].getFinalStory()`)));
        result.getPremiereStory = () => thenChainEagerly(
            // Returns a promise which will resolve to the content
            // received from the backend but only after all the local
            // follower reactions have been resolved as well.
            // TODO(iridian): Exceptions from follower reactions can't
            // reject the prophecy, but we should catch, handle and/or
            // expose them to the prophecy chronicleEvents originator.
            result.getFollowerReactions(),
            // TODO(iridian): Exceptions from upstream signal failure
            // and possible heresy: we should catch and have logic for
            // either retrying the operation or for full rejection.
            // Nevertheless flushing the corpus is needed.
            () => result.getFinalStory(),
            errorOnChronicleEvents.bind(null,
                new Error(`chronicleEvents.eventResults[${index}].getPremiereStory()`)));
      } catch (error) {
        errorOnChronicleEvents(
            new Error(`chronicleEvents.eventResults[${index}].revealToFollowers()`), error);
      }
      return result;
      function errorOnChronicleEvents (errorWrap, error) {
        throw falseProphet.wrapErrorEvent(error, errorWrap,
            "\n\tevents:", ...dumpObject(events),
            "\n\tevent:", ...dumpObject(events[index]),
            "\n\tprophecy:", ...dumpObject(prophecy),
            "\n\tresult:", ...dumpObject(result),
        );
      }
    }),
  };
}

export function universalizeEvent (falseProphet: FalseProphet, event: EventBase): EventBase {
  return trivialCloneWith(event,
      entry => (entry instanceof ValaaURI ? entry : undefined));
}

function _prepareStagesAndCommands (falseProphet: FalseProphet, operation: Object) {
  operation.partitionCommands = {};
  operation.stages = [];
  const missingConnections = [];
  if (!operation.prophecy.partitions) {
    throw new Error("prophecy is missing partition information");
  }
  const remotes = [];
  const locals = [];
  const memorys = [];
  Object.keys(operation.prophecy.partitions).forEach((partitionURIString) => {
    const connection = falseProphet._connections[partitionURIString];
    if (!connection) {
      missingConnections.push(createPartitionURI(partitionURIString));
      return;
    }
    const commandEvent = extractEventOfPartition(
        getActionFromPassage(operation.prophecy), connection);
    operation.partitionCommands[partitionURIString] = commandEvent;
    (connection.isRemoteAuthority() ? remotes
        : connection.isLocallyPersisted() ? locals
        : memorys
    ).push({ connection, commandEvent });
  });
  if (remotes.length) operation.stages.push({ name: "remotes", partitions: remotes });
  if (locals.length) operation.stages.push({ name: "locals", partitions: locals });
  if (memorys.length) operation.stages.push({ name: "memory", partitions: memorys });
  if (missingConnections.length) {
    throw new MissingPartitionConnectionsError(`Missing active partition connections: '${
        missingConnections.map(c => c.toString()).join("', '")}'`, missingConnections);
  }
}

function _initiateConnectionValidations (falseProphet: FalseProphet, operation: Object) {
  operation.stages.forEach(stage => stage.partitions.forEach(partition => {
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

function _fulfillProphecy (falseProphet: FalseProphet, operation: Object) {
  return mapEagerly(operation.stages,
      stage => _fulfillStage(falseProphet, stage),
      (error, stage) => {
        throw falseProphet.wrapErrorEvent(error,
          new Error(`chronicleEvents._fulfillStage(${stage.name})`),
          "\n\toperation:", ...dumpObject(operation),
          "\n\tstage.partitions:", ...dumpObject(stage.partitions),
          "\n\tthis:", falseProphet);
      });
}

function _fulfillStage (falseProphet: FalseProphet, stage: Object) {
  return thenChainEagerly(stage, [
    () => mapEagerly(stage.partitions, partition => partition.validatedConnection,
        (error, partition) => {
          throw falseProphet.wrapErrorEvent(error,
              new Error(`chronicleEvents.stage["${stage.name}"].connection["${
                  partition.connection.getName()}"].validate`));
        }),
    () => {
      // Persist the prophecy and add refs to all associated event bvobs.
      // This is necessary for prophecy reattempts so that the bvobs aren't
      // garbage collected on browser refresh. Otherwise they can't be
      // reuploaded if their upload didn't finish before refresh.
      // TODO(iridian): Implement.

      // Wait for remote bvob persists to complete.
      // TODO(iridian): Implement.
      // await Promise.all(operation.authorityPersistProcesses);

      // Maybe determine eventId's beforehand?

      // Get eventId and scribe persist finalizer for each partition
      const chroniclings = [];
      for (const { connection, commandEvent } of stage.partitions) {
        let chronicling;
        try {
          chronicling = connection.chronicleEvent(commandEvent, { isProphecy: true });
          chroniclings.push(chronicling);
        } catch (error) {
          throw falseProphet.wrapErrorEvent(error,
              new Error(`chronicleEvents.stage["${stage.name}"].connection["${
                  connection.getName()}"].chronicleEvents`),
              "\n\tcommandEvent:", ...dumpObject(commandEvent),
              "\n\tevent chronicling:", ...dumpObject(chronicling),
          );
        }
      }
      return mapEagerly(chroniclings,
          chronicling => chronicling.getTruthEvent(),
          (error, chronicling, index) => {
            throw falseProphet.wrapErrorEvent(error,
                new Error(`chronicleEvents.stage["${stage.name}"].chroniclings[${index}](${
                      chronicling && chronicling.event.eventId}).getTruthEvent()"`),
                "\n\tchroniclings:", ...dumpObject(chroniclings));
          }
      );
    },
  ], (error, index) => {
    throw falseProphet.wrapErrorEvent(error,
        new Error(`chronicleEvents.stage["${stage.name}"].step#${index}`));
  });
}
