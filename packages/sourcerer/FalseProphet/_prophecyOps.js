// @flow

import { getActionFromPassage } from "~/raem";
import { Command, EventBase } from "~/raem/events";
import type { Story } from "~/raem/redux/Bard";
import { MissingConnectionsError } from "~/raem/tools/denormalized/partitions";
import { naiveURI } from "~/raem/ValaaURI";

import { ChronicleEventResult, Connection, ProphecyChronicleRequest, ProphecyEventResult }
    from "~/sourcerer/api/types";
import { tryAspect } from "~/sourcerer/tools/EventAspects";
import FabricatorEvent from "~/sourcerer/api/FabricatorEvent";

import { dumpObject, isPromise, outputError, thenChainEagerly, mapEagerly } from "~/tools";

import FalseProphet from "./FalseProphet";
import {
  _composeRecitalStoryFromEvent, _purgeLatestRecitedStory, _recomposeSchismaticStory,
} from "./_recitalOps";
import FalseProphetConnection from "./FalseProphetConnection";

export type Prophecy = Story & {
  timed: ?Object;
  isProphecy: true;
}

// Create prophecies out of provided events and send their partition
// commands upstream. Aborts all remaining events on first exception
// and rolls back previous ones.
export function _chronicleEvents (falseProphet: FalseProphet, events: EventBase[],
    { timed, transactionState, ...rest } = {}): ProphecyChronicleRequest {
  if (timed) throw new Error("timed events not supported yet");
  const resultBase = new ProphecyOperation(null, {
    _sourcerer: falseProphet,
    _events: events,
    _options: rest,
  });
  resultBase._options.isProphecy = true;
  const prophecies = [];
  const ret = {
    eventResults: events.map((event, index) => {
      const operation = Object.create(resultBase);
      operation.event = event;
      operation.index = index;
      (event.meta || (event.meta = {})).operation = operation;
      const prophecy = _composeRecitalStoryFromEvent(
          falseProphet, event, "prophecy-chronicle", timed, transactionState);
      prophecies.push(prophecy);
      if (!prophecy) return undefined;
      operation._prophecy = prophecy;
      return operation;
    }),
  };
  resultBase._followerReactions = falseProphet._deliverStoriesToFollowers(prophecies);

  for (const operation of ret.eventResults) {
    if (operation) operation._execute();
  }

  // TODO(iridian): Implement prophecies' partition sub-commands grouping.
  // Also implement it for purge revision re-chronicles.
  //
  // For purge revision re-chronicles this is a potentially crucial
  // qualitative performance optimization. For _chronicleEvents this is
  // not crucial, but having both this function and revision
  // rechronicles use the same multi-event functionality will lead in
  // improved performance and code quality for both.
  //
  // Conflict purges might result in considerable sized revisions in
  // a high activity, poor latency conditions with authorities not
  // offering reordering services. If revision commands are being sent
  // one-by-one, and conflicts occur in more than one client, this
  // might result in rapidly degrading performance especially if new
  // commands are being generated and even longer command queues are
  // constantly being purged.
  // Grouping the revision commands together will ensure that even
  // larger revision rechroniclings can be cleared at once.
  // A naive authority implementation might still leave one client
  // undergoing a large revisioning in a starved state, if there exists
  // another client which is constantly chronicling commands.
  // This however is a problem that can and should be solved on the
  // authority side.
  // Various strategies for this can be devised.
  //
  // An especially noteworthy candidate is a situation where:
  // 1. a revision doesn't result in command payload changes, thus
  // 2. the command payload signatures remain the same even if their
  //    log.index changes, and
  // 3. a transport-level session can be maintained between the gateway
  //    and the authority, allowing
  // 4. client gateway to inform the partition authority that the
  //    commands are valid with just a log.index adjustment, this
  // 5. minimizing latency, bandwith usage and recurring conflicts,
  //    and maximizing throughput.
  //
  // For such eventuality the authority can provide a service where it
  // retains the events fully in memory for a short duration (on the
  // order of seconds) while simultaneously blocking other commands.
  //
  // Before soft-conflict resolution support is implemented this
  // situation is, in fact, the only alternative for hard conflict and
  // as such prominent.
  //
  // There are techniques that allow streamlining this process even
  // further once gateways can handle optimistic commands coming from
  // authorities: then the authority can choose to send the commands
  // pending reorder-revision to other clients as optimistic commands;
  // which can still be retracted.
  //
  // resultBase._chronicleAllPropheciesSubCommandsOfAllPartitions
  return ret;
}

export function _confirmProphecyPartitionCommand (connection: FalseProphetConnection,
    prophecy: Prophecy, command: Command) {
  const operation = (prophecy.meta || {}).operation;
  if (operation) {
    const partition = operation._partitions[String(connection.getPartitionURI())];
    if (!partition) {
      connection.warnEvent(0, () => [
        "confirmProphecyCommand operation partition missing",
        "\n\tcommand:", ...dumpObject(command),
        "\n\toperation:", ...dumpObject(operation),
      ]);
      return false;
    }
    if (!partition.confirmCommand) return false;
    /*
    connection.warnEvent(1, () => [
      "\n\t.confirmProphecyCommand:",
      "\n\tprophecy:", ...dumpObject(prophecy),
      "\n\tcommand:", ...dumpObject(command),
    ]);
    */
    partition.confirmCommand(command);
    partition.confirmCommand = null;
  }
  prophecy.confirmedCommandCount = (prophecy.confirmedCommandCount || 0) + 1;
  if (prophecy.meta && prophecy.meta.partitions
      && (prophecy.confirmedCommandCount < Object.keys(prophecy.meta.partitions).length)) {
    return false;
  }
  return true;
}

export function _rewriteProphecyPartitionCommand (connection: FalseProphetConnection,
    prophecy: Prophecy, reformedCommand: Command) {
  const partition = prophecy.meta.operation._partitions[String(connection.getPartitionURI())];
  const originalCommand = partition.commandEvent;
  connection.warnEvent(1, () => [
    "\n\treforming prophecy", tryAspect(prophecy, "command").id,
    `command #${tryAspect(originalCommand, "log").index} with command #${
        tryAspect(reformedCommand, "log").index}`,
    "\n\toriginal command:", ...dumpObject(originalCommand),
    "\n\treformed command:", ...dumpObject(reformedCommand),
    "\n\treformed prophecy:", ...dumpObject(prophecy),
  ]);
  return (partition.commandEvent = reformedCommand);
}

export function _reviewRecomposedSchism (connection: FalseProphetConnection, schism: Prophecy,
    recomposition: Prophecy) {
  const semanticSchismReason = _checkForSemanticSchism(schism, recomposition);
  const progress = schism.meta.operation.getProgress();
  if (!semanticSchismReason) {
    progress.isSchismatic = false;
    return recomposition;
  }
  progress.type = "semanticSchism";
  progress.schism = schism;
  progress.recomposition = recomposition;
  progress.isSemanticSchism = true;
  progress.message = semanticSchismReason;
  return undefined;

  /*
  connection.warnEvent(1, () => [
    "\n\treviewed prophecy", tryAspect(reviewed, "command").id,
    "\n\tpurged prophecy:", ...dumpObject(purged),
    "\n\treviewed prophecy:", ...dumpObject(reviewed),
    "\n\tbase command:", getActionFromPassage(purged),
  ]);
  */
}

function _checkForSemanticSchism (/* purgedProphecy: Prophecy, revisedProphecy: Prophecy */) {
  // TODO(iridian): Detect and resolve semtnic schisms: for example if
  // a reformed command modifies something that has been modified by an
  // new incoming truth(s); this would incorrectly override and discard
  // the change made in the incoming truth. This class of errors does
  // not corrupt the event log so cannot be detected as a reduction
  // error but still most likely is a valospace schism and thus should
  // marked as needing revision.
  return undefined;
}

export function _reformHeresy (connection: FalseProphetConnection,
    schism: Prophecy, newEvents: EventBase[], purgedStories: Story[]) {
  const operation = (schism.meta || {}).operation;
  // No way to revise non-prophecy schisms: these come from elsewhere so not our job.
  if (!operation) return undefined;
  // First try to revise using the original chronicleEvents options.reformHeresy
  if (operation._options.reformHeresy) {
    return operation._options.reformHeresy(schism, connection, newEvents, purgedStories);
  }
  // Then if the schism is not a semantic schism try basic revise-recompose.
  if (operation._progress.isSemanticSchism || (operation._progress.isReformable === false)) {
    return undefined;
  }
  const recomposedProphecy = _recomposeSchismaticStory(connection.getSourcerer(), schism);
  const partitionURI = String(connection.getPartitionURI());
  if (!recomposedProphecy
      || (Object.keys((recomposedProphecy.meta || {}).partitions).length !== 1)) {
    // Can't revise multi-partition commands (for now).
    return undefined;
  }
  const revisedProphecyCommand = getActionFromPassage(recomposedProphecy);
  if (!revisedProphecyCommand.meta) throw new Error("revisedProphecy.meta missing");
  const revisedPartitionCommandEvent = connection.extractPartitionEvent(revisedProphecyCommand);
  // Can only revise commands belonging to the originating partition
  if (!revisedPartitionCommandEvent) return undefined;
  (recomposedProphecy.meta || (Object.getPrototypeOf(recomposedProphecy).meta = {})).operation =
      operation;
  operation._prophecy = recomposedProphecy;
  operation._reformationAttempt = (operation._reformationAttempt || 0) + 1;
  operation._persistedStory = null;
  const progress = operation._progress;
  if (progress) {
    progress.previousProphecy = progress.prophecy;
    progress.prophecy = recomposedProphecy;
  }
  const operationPartition = operation._partitions[partitionURI];
  operationPartition.commandEvent = revisedPartitionCommandEvent;
  operationPartition.chronicling = connection.chronicleEvent(
      operationPartition.commandEvent, Object.create(operation._options));
  return [recomposedProphecy];
}

export function _purgeHeresy (falseProphet: FalseProphet, heresy: Prophecy) {
  const meta = heresy.meta || {};
  const operation = meta.operation;
  if (!operation || !operation._partitions) return;
  const progress = operation.getProgress({ type: "purge", isSchismatic: true });
  const error = progress.error || new Error(progress.message);
  if (meta.transactor && meta.transactor.onpurge) {
    meta.transactor.dispatchAndDefaultActEvent(progress);
  }
  for (const partition of Object.values(operation._partitions)) {
    if (!partition.confirmedTruth) {
      partition.rejectCommand(partition.rejectionReason || error);
      partition.commandEvent = null;
    }
  }
}

class ProphecyOperation extends ProphecyEventResult {
  _prophecy: Prophecy;
  _sourcerer: FalseProphet;
  _events: EventBase[];
  _options: Object; // partition command chronicleEvents options
  _partitions: { [partitionURI: string]: {
    // note: this does _not_ correspond to _prophecy.meta.partitions
    connection: Connection,
    commandEvent: Command,
    chronicling: ChronicleEventResult,
    confirmCommand?: Function,
    rejectCommand?: Function,
  } };
  _fulfillment: Promise<Object>;
  _stageIndex: number = 0;
  _firstStage: Promise<Object>;
  _persistment: Promise<Object>;
  _debugPhase: string = "construct";

  getDebugPhase () { return this._debugPhase; }
  getCommandOf (partitionURI) {
    return this._partitions[String(partitionURI)].commandEvent;
  }
  getLogAspectOf (partitionURI) {
    return this._partitions[String(partitionURI)].commandEvent.aspects.log;
  }
  getProgress (fields) {
    const ret = this._progress || (this._progress = new FabricatorEvent("", {
      command: this.event, prophecy: this._prophecy,
    }));
    if (fields) Object.assign(ret, fields);
    return ret;
  }

  getComposedStory () {
    return thenChainEagerly(
        this._firstStage,
        () => this._prophecy || this.throwRejectionError(),
        this.errorOnProphecyOperation.bind(this,
            new Error(`chronicleEvents.eventResults[${this.index}].getComposedStory()`)));
  }

  getPersistedStory () {
    let reformationAttempt = this._reformationAttempt;
    return this._persistedStory || (this._persistedStory = thenChainEagerly(
        // TODO(iridian, 2019-01): Add also local stage chroniclings to
        // the waited list, as _firstStage only contains remote
        // stage chroniclings. This requires refactoring: local
        // stage persisting currently waits remote truths. This command
        // must be operable offline, so it cannot rely on remote truths.
        // Local persisting must thus be refactored to not await on
        // remote truths, but this needs to have support for discarding
        // the locally persisted commands if the remotes rejected.
        this._firstStage
            && mapEagerly(this._firstStage, ({ chronicling }) => chronicling.getPersistedEvent()),
        () => {
          if (reformationAttempt !== this._reformationAttempt) {
            throw ({ retry: true }); // eslint-disable-line no-throw-literal
          }
          const prophecy = this._prophecy || this.throwRejectionError();
          const transactor = this.event.meta.transactor;
          if (transactor && transactor.onpersist) {
            Promise.resolve(this._persistedStory).then(() =>
                transactor.dispatchAndDefaultActEvent(this.getProgress({ type: "persist" })));
          }
          return (this._persistedStory = prophecy);
        },
        (error, index, head, functionChain, onRejected) => {
          if (error.retry && (reformationAttempt !== this._reformationAttempt)) {
            reformationAttempt = this._reformationAttempt;
            return thenChainEagerly(head, functionChain, onRejected);
          }
          return this.errorOnProphecyOperation(this,
            new Error(`chronicleEvents.eventResults[${this.index}].getPersistedStory()`));
        },
      ));
  }

  getTruthStory () {
    return this._truthStory || (this._truthStory = thenChainEagerly(
        this._fulfillment,
        () => {
          const prophecy = this._prophecy || this.throwRejectionError();
          const transactor = this.event.meta.transactor;
          if (transactor && transactor.ontruth) {
            Promise.resolve(this._truthStory).then(() =>
                transactor.dispatchAndDefaultActEvent(this.getProgress({ type: "truth" })));
          }
          return (this._truthStory = prophecy);
        },
        this.errorOnProphecyOperation.bind(this,
            new Error(`chronicleEvents.eventResults[${this.index}].getTruthStory()`))));
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
        () => this.getComposedEvent(),
        this.errorOnProphecyOperation.bind(this,
            new Error(`chronicleEvents.eventResults[${this.index}].getPremiereStory()`)));
  }

  errorOnProphecyOperation (errorWrap, error) {
    throw this._sourcerer.wrapErrorEvent(error, errorWrap,
        "\n\tduring:", this._debugPhase,
        "\n\tevents:", ...dumpObject(this._events),
        "\n\tevent:", ...dumpObject(this._events[this.index]),
        "\n\tprophecy:", ...dumpObject(this.event),
        "\n\tpartitions:", ...dumpObject(this._partitions),
        "\n\tremote stage:", ...dumpObject(this._remoteStage),
        "\n\tlocal stage:", ...dumpObject(this._localStage),
        "\n\tmemory stage:", ...dumpObject(this._memoryStage),
        "\n\toperation:", ...dumpObject(this),
    );
  }

  throwRejectionError () {
    throw this._rejectionError || new Error(
        "INTERNAL ERROR: ProphecyOperation._prophecy and _rejectionReason are both missing");
  }

  _execute () {
    this._debugPhase = "execute";
    const prophecy = this._prophecy;
    const meta = prophecy.meta;
    Object.assign(this, this._followerReactions[this.index]);
    this._fulfillment = thenChainEagerly(null, [
      () => this._prepareStagesAndCommands(),
      () => this._initiateConnectionValidations(),
      () => (this._remoteStage || this._localStage) && (this._persistsment = thenChainEagerly(
        null, [
          () => {
            this._firstStage = thenChainEagerly(
              this._initiateStage(...(this._remoteStage
                  ? [this._remoteStage, "remote"]
                  : [this._localStage, "local"])),
              firstStage => (this._firstStage = firstStage),
            );
            if (meta.transactor && meta.transactor.onpersist) this.getPersistedStory();
            return this._firstStage;
          },
          () => this._completeStage(this._firstStage, this._remoteStage ? "remote" : "local"),
          () => this._initiateStage(this._remoteStage && this._localStage, "local"),
          () => this._completeStage(this._remoteStage && this._localStage, "local"),
          () => (this._persistsment = [...(this._remoteStage || []), ...(this._localStage || [])]),
        ],
      )),
      () => this._initiateStage(this._memoryStage, "memory"),
      () => this._completeStage(this._memoryStage, "memory"),
      () => {
        this._prophecy.isTruth = true;
        (this._fulfillment = this._prophecy);
        if (meta.transactor && meta.transactor.ontruth) this.getTruthStory();
        return this._fulfillment;
      },
    ], (error, head, phaseIndex) => {
      this._prophecy.isRejected = true;
      this._rejectionError = this._prophecy.rejectionReason =
          this.errorOnProphecyOperation(
              new Error(`chronicleEvents.eventResults[${this.index}].execute(phase#${phaseIndex}/${
                  this._debugPhase})`),
              error);
      this._prophecy = null;
      try {
        _purgeLatestRecitedStory(this._sourcerer, prophecy);
      } catch (innerError) {
        outputError(innerError, `Exception caught during chronicleEvents.execute.purge`);
      }
      throw this._rejectionError;
    });
    return this;
  }

  _prepareStagesAndCommands () {
    this._debugPhase = "prepare stages";
    this._partitions = {};
    const missingConnections = [];
    const partitions = (this._prophecy.meta || {}).partitions;
    if (!partitions) {
      throw new Error("prophecy is missing partition information");
    }
    Object.keys(partitions).forEach((partitionURIString) => {
      const connection = this._sourcerer._connections[partitionURIString];
      if (!connection) {
        missingConnections.push(naiveURI.createPartitionURI(partitionURIString));
        return;
      }
      if (!this._prophecy.meta) throw new Error("prophecy.meta missing");
      const commandEvent = connection.extractPartitionEvent(getActionFromPassage(this._prophecy));
      (connection.isRemoteAuthority() ? (this._remoteStage || (this._remoteStage = []))
          : connection.isLocallyPersisted() ? (this._localStage || (this._localStage = []))
          : (this._memoryStage || (this._memoryStage = []))
      ).push((this._partitions[partitionURIString] = { connection, commandEvent }));
    });
    if (missingConnections.length) {
      throw new MissingConnectionsError(`Missing active partition connections: '${
          missingConnections.map(c => c.toString()).join("', '")}'`, missingConnections);
    }
  }

  getStages () {
    return this._allStages || (this._allStages =
        [this._remoteStage, this._localStage, this._memoryStage].filter(s => s));
  }

  _initiateConnectionValidations () {
    this._debugPhase = `validate partitions`;
    this.getStages().forEach(stagePartitions => stagePartitions.forEach(partition => {
      partition.validatedConnection = thenChainEagerly(
          partition.connection.asActiveConnection(),
          (connection) => {
            this._debugPhase = `validate partition ${connection.getName()}`;
            if (connection.isFrozenConnection()) {
              throw new Error(`Trying to chronicle events to a frozen partition ${
                  connection.getName()}`);
            }
            const commandEventVersion = partition.commandEvent.aspects.version;
            const connectionEventVersion = connection.getEventVersion();
            if (!connectionEventVersion || (connectionEventVersion !== commandEventVersion)) {
              throw new Error(`Command event version "${commandEventVersion
                  }" not supported by connection ${connection.getName()} which only supports "${
                  connectionEventVersion}"`);
            }
            // Perform other partition validation
            // TODO(iridian): extract partition content (EDIT: a what now?)
            return (partition.validatedConnection = connection);
          },
      );
    }));
  }

  _initiateStage (stagePartitions: Object, stageName: string) {
    return stagePartitions && thenChainEagerly(stagePartitions, [
      () => {
        this._debugPhase = `await stage #${this._stageIndex} '${stageName}' partition validations`;
        return mapEagerly(stagePartitions,
          partition => partition.validatedConnection,
          (error, partition) => {
            throw this._sourcerer.wrapErrorEvent(error,
                new Error(`chronicleEvents.initiateStage("${stageName}").validatePartition("${
                    partition.connection.getName()}")`));
          });
      },
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

        // Maybe determine aspects.log.index's beforehand?

        // Get aspects.log.index and scribe persist finalizer for each partition
        this._debugPhase = `chronicle stage #${this._stageIndex} '${stageName}' commands`;
        for (const partition of stagePartitions) {
          try {
            this._debugPhase = `chronicle stage #${this._stageIndex} '${stageName}' command to ${
                partition.connection.getName()}`;
            partition.chronicling = partition.connection.chronicleEvent(
                partition.commandEvent, Object.create(this._options));
          } catch (error) {
            throw this._sourcerer.wrapErrorEvent(error,
                new Error(`chronicleEvents.stage["${stageName}"].connection["${
                    partition.connection.getName()}"].chronicleEvents`),
                "\n\tcommandEvent:", ...dumpObject(partition.commandEvent),
                "\n\tchronicling:", ...dumpObject(partition.chronicling),
            );
          }
        }
        return stagePartitions;
      },
    ]);
  }

  _completeStage (stagePartitions: Object[], stageName: string) {
    const stageIndex = this._stageIndex++;
    return stagePartitions && mapEagerly(stagePartitions,
        partition => this._processStagePartition(partition, stageIndex, stageName),
        (error, { chronicling }, index) => {
          throw this._sourcerer.wrapErrorEvent(error,
              new Error(`chronicleEvents.completeStage("${stageName}").partition[${index
                  }].eventResults[${tryAspect(chronicling && chronicling.event, "log").index
                  }].getTruthEvent()"`),
              "\n\tstagePartitions:", ...dumpObject(stagePartitions));
        });
  }

  _processStagePartition (partition: Object, stageIndex: number, stageName: string) {
    this._debugPhase = `await stage #${stageIndex} '${stageName}' truth of ${
        partition.connection.getName()}`;
    const thisChroniclingProcess = partition.chronicling;
    let chronicledTruth, receivedTruth;
    return thenChainEagerly(thisChroniclingProcess, [
      chronicling => {
        chronicledTruth = chronicling.getTruthEvent();
        if (!isPromise(chronicledTruth)) return chronicledTruth;
        receivedTruth = new Promise((resolve, reject) => {
          partition.confirmCommand = resolve;
          partition.rejectCommand = reject;
        });
        return Promise.race([receivedTruth, chronicledTruth]);
      },
      truth => {
        if (!truth) {
          if (partition.chronicling !== thisChroniclingProcess) { // retry
            return this._processStagePartition(partition, stageIndex, stageName);
          }
          Promise.all([chronicledTruth, receivedTruth]).then(([chronicled, received]) => {
            partition.connection.errorEvent(
              "\n\tnull truth when fulfilling prophecy:", ...dumpObject(this._prophecy),
              "\n\tchronicled:", isPromise(chronicledTruth),
                  ...dumpObject(chronicled), ...dumpObject(chronicledTruth),
              "\n\treceived:", isPromise(receivedTruth),
                  ...dumpObject(received), ...dumpObject(receivedTruth));
          });
        } else if (truth.aspects.log.index !== partition.commandEvent.aspects.log.index) {
          // this partition command was/will be revised
        }
        this._prophecy.meta.partitions[String(partition.connection.getPartitionURI())].truth
            = partition.confirmedTruth = truth;
        return partition;
      },
    ], error => {
      if (partition.chronicling !== thisChroniclingProcess) { // retry
        return this._processStagePartition(partition, stageIndex, stageName);
      }
      partition.rejectionReason = error;
      throw error;
    });
  }
}
