// @flow

import { getActionFromPassage } from "~/raem";
import { Command, EventBase } from "~/raem/events";
import type { Story } from "~/raem/redux/Bard";
import { AbsentChroniclesError } from "~/raem/tools/denormalized/partitions";
import { naiveURI } from "~/raem/ValaaURI";

import { ChronicleEventResult, Connection, ProphecyChronicleRequest, ProphecyEventResult }
    from "~/sourcerer/api/types";
import { tryAspect } from "~/sourcerer/tools/EventAspects";
import { FabricatorEvent } from "~/sourcerer/api/Fabricator";

import { dumpObject, isPromise, outputError, thenChainEagerly, mapEagerly } from "~/tools";

import FalseProphet from "./FalseProphet";
import { _composeRecitalStoryFromEvent, _purgeLatestRecitedStory } from "./_recitalOps";
import FalseProphetConnection from "./FalseProphetConnection";

export type Prophecy = Story & {
  timed: ?Object;
  isProphecy: true;
}

// Create prophecies out of provided events and send their chronicle
// commands upstream. Aborts all remaining events on first exception
// and rolls back previous ones.
export function _chronicleEvents (falseProphet: FalseProphet, events: EventBase[],
    { timed, transactionState, ...rest } = {}): ProphecyChronicleRequest {
  if (timed) throw new Error("timed events not supported yet");
  const resultBase = new ProphecyOperation(null, falseProphet, {
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
      if (!prophecy) return undefined;
      operation._prophecy = prophecy;
      operation._prophecyIndex = prophecies.length;
      prophecies.push(prophecy);
      return operation;
    }),
  };
  const followerReactions = falseProphet._deliverStoriesToFollowers(prophecies);
  for (const operation of ret.eventResults) {
    if (!operation) continue;
    operation._debugPhase = "execute";
    // TODO(iridian, 2019-05): Investigate this as probably obsolete.
    // The pathway from follower reactions to upstream is likely
    // something that will only be performed via valospace, not via
    // fabric callbacks like this (even if fabric pathway would be more
    // performant in principle)
    Object.assign(operation, followerReactions[operation._prophecyIndex]);
    operation._fulfillment = operation
        .performChain(undefined, "executeChain", "_errorOnProphecyExecute");
  }
  return ret;

  // TODO(iridian): Implement prophecies' chronicle sub-command grouping.
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
  // 4. client gateway to inform the authority that the
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
}

export function _confirmVenueCommand (connection: FalseProphetConnection,
    prophecy: Prophecy, command: Command) {
  const operation = (prophecy.meta || {}).operation;
  if (operation) {
    const venue = operation._venues[connection.getChronicleURI()];
    if (!venue) {
      connection.warnEvent(0, () => [
        "confirmVenueCommand operation venue missing",
        "\n\tcommand:", ...dumpObject(command),
        "\n\toperation:", ...dumpObject(operation),
      ]);
      return false;
    }
    if (!venue.confirmCommand) return false;
    /*
    connection.warnEvent(1, () => [
      "\n\t.confirmProphecyCommand:",
      "\n\tprophecy:", ...dumpObject(prophecy),
      "\n\tcommand:", ...dumpObject(command),
    ]);
    */
    venue.confirmCommand(command);
    venue.confirmCommand = null;
  }
  prophecy.confirmedCommandCount = (prophecy.confirmedCommandCount || 0) + 1;
  if (prophecy.meta && prophecy.meta.chronicles
      && (prophecy.confirmedCommandCount < Object.keys(prophecy.meta.chronicles).length)) {
    return false;
  }
  return true;
}

export function _rewriteVenueCommand (connection: FalseProphetConnection,
    prophecy: Prophecy, reformedCommand: Command) {
  const venue = prophecy.meta.operation._venues[connection.getChronicleURI()];
  const originalCommand = venue.commandEvent;
  connection.warnEvent(1, () => [
    "\n\treforming prophecy", tryAspect(prophecy, "command").id,
    `command #${tryAspect(originalCommand, "log").index} with command #${
        tryAspect(reformedCommand, "log").index}`,
    "\n\toriginal command:", ...dumpObject(originalCommand),
    "\n\treformed command:", ...dumpObject(reformedCommand),
    "\n\treformed prophecy:", ...dumpObject(prophecy),
  ]);
  return (venue.commandEvent = reformedCommand);
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

export function _purgeHeresy (falseProphet: FalseProphet, heresy: Prophecy) {
  const meta = heresy.meta || {};
  const operation = meta.operation;
  if (!operation || !operation._venues) return;
  const progress = operation.getProgress({ type: "purge", isSchismatic: true });
  const error = progress.error || new Error(progress.message);
  if (meta.transactor && meta.transactor.onpurge) {
    meta.transactor.dispatchAndDefaultActEvent(progress);
  }
  for (const venue of Object.values(operation._venues)) {
    if (!venue.confirmedTruth) {
      venue.rejectCommand(venue.rejectionReason || error);
      venue.commandEvent = null;
    }
  }
}

class ProphecyOperation extends ProphecyEventResult {
  _prophecy: Prophecy;
  _sourcerer: FalseProphet;
  _events: EventBase[];
  _options: Object; // upstream chronicleEvents options
  _venues: { [chronicleURI: string]: {
    connection: Connection,
    commandEvent: Command,
    chronicling: Promise<ChronicleEventResult>,
    confirmCommand?: Function,
    rejectCommand?: Function,
  } };
  _fulfillment: Promise<Object>;
  _stageIndex: number = 0;
  _firstStageVenues: Promise<Object>;
  _persistment: Promise<Object>;
  _debugPhase: string = "construct";

  getDebugPhase () { return this._debugPhase; }
  getCommandOf (chronicleURI: string) {
    return this._venues[chronicleURI].commandEvent;
  }
  getLogAspectOf (chronicleURI: string) {
    return this._venues[chronicleURI].commandEvent.aspects.log;
  }
  getProgress (fields) {
    const ret = this._progress || (this._progress = new FabricatorEvent("", {
      command: this.event, prophecy: this._prophecy,
    }));
    if (fields) Object.assign(ret, fields);
    return ret;
  }
  getErroringProgress (error, fields) {
    const ret = this.getProgress();
    ret.error = error;
    if (!ret.typePrecedingError) ret.typePrecedingError = ret.type || "external";
    ret.type = "error";
    ret.isSchismatic = true;
    if (fields) Object.assign(ret, fields);
    return ret;
  }

  getComposedStory () {
    return thenChainEagerly(
        this._firstStageVenues,
        () => this._prophecy || this.throwRejectionError(),
        this.errorOnProphecyOperation.bind(this,
            new Error(`chronicleEvents.eventResults[${this.index}].getComposedStory()`)));
  }

  getPersistedStory () {
    let reformationAttempt = this._reformationAttempt;
    return this._persistedStory || (this._persistedStory = thenChainEagerly(
        // TODO(iridian, 2019-01): Add also local stage chroniclings to
        // the waited list, as _firstStageVenues only contains remote
        // stage chroniclings. This requires refactoring: local
        // stage persisting currently waits remote truths. This command
        // must be operable offline, so it cannot rely on remote truths.
        // Local persisting must thus be refactored to not await on
        // remote truths, but this needs to have support for discarding
        // the locally persisted commands if the remotes rejected.
        this._firstStageVenues
            && mapEagerly(this._firstStageVenues, ({ chronicling }) => {
              if (!chronicling) throw new Error("Heresy pending reformation");
              return chronicling.getPersistedEvent();
            }),
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
          return this.errorOnProphecyOperation.bind(this,
            new Error(`chronicleEvents.eventResults[${this.index}].getPersistedStory()`));
        },
      ));
  }

  getTruthStory () {
    return this._truthStory || (this._truthStory = thenChainEagerly(
        this._fulfillment,
        (fulfillment) => {
          if (fulfillment === null) throw this._rejectionError;
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

  errorOnProphecyOperation (errorWrap, error, nothrow) {
    const wrappedError = this._sourcerer.wrapErrorEvent(error, 1, errorWrap,
        "\n\tduring:", this._debugPhase,
        "\n\tevents:", ...dumpObject(this._events),
        "\n\tevent:", ...dumpObject(this._events[this.index]),
        "\n\tprophecy:", ...dumpObject(this.event),
        "\n\tvenues:", ...dumpObject(this._venues),
        "\n\tremote stage:", ...dumpObject(this._remoteVenues),
        "\n\tlocal stage:", ...dumpObject(this._localVenues),
        "\n\tmemory stage:", ...dumpObject(this._memoryVenues),
        "\n\toperation:", ...dumpObject(this),
    );
    if (!nothrow) throw wrappedError;
    return wrappedError;
  }

  throwRejectionError () {
    throw this._rejectionError || new Error(
        "INTERNAL ERROR: ProphecyOperation._prophecy and _rejectionReason are both missing");
  }

  static executeChain = [
    ProphecyOperation.prototype._prepareStagesAndCommands,
    ProphecyOperation.prototype._initiateConnectionValidations,
    ProphecyOperation.prototype._processRemoteVenues,
    ProphecyOperation.prototype._processLocalVenues,
    ProphecyOperation.prototype._processMemoryVenues,
    ProphecyOperation.prototype._fulfillProphecy,
  ];

  _prepareStagesAndCommands () {
    this._debugPhase = "prepare stages";
    this._venues = {};
    const missingConnections = [];
    const chronicles = (this._prophecy.meta || {}).chronicles;
    if (!chronicles) {
      throw new Error("prophecy is missing chronicle information");
    }
    Object.keys(chronicles).forEach(chronicleOrPartitionURI => {
      let chronicleURI = chronicleOrPartitionURI;
      let connection = this._sourcerer._connections[chronicleURI];
      if (!connection) {
        chronicleURI = naiveURI.createChronicleURI(chronicleOrPartitionURI);
        connection = this._sourcerer._connections[chronicleURI];
        if (!connection) {
          missingConnections.push(chronicleURI);
          return;
        }
      }
      if (!this._prophecy.meta) throw new Error("prophecy.meta missing");
      const commandEvent = connection.extractChronicleEvent(getActionFromPassage(this._prophecy));
      (connection.isRemoteAuthority()
              ? (this._remoteVenues || (this._remoteVenues = []))
          : connection.isLocallyPersisted()
              ? (this._localVenues || (this._localVenues = []))
              : (this._memoryVenues || (this._memoryVenues = []))
      ).push((this._venues[chronicleURI] = { connection, commandEvent }));
    });
    if (missingConnections.length) {
      throw new AbsentChroniclesError(`Missing active connections: '${
          missingConnections.map(c => c.toString()).join("', '")}'`, missingConnections);
    }
  }

  getStages () {
    return this._allStages || (this._allStages = [
      this._remoteVenues, this._localVenues, this._memoryVenues,
    ].filter(s => s));
  }

  _initiateConnectionValidations () {
    this._debugPhase = `validate venues`;
    this.getStages().forEach(stageVenues => stageVenues.forEach(venue => {
      venue.validatedConnection = thenChainEagerly(
          venue.connection.asActiveConnection(),
          (connection) => {
            this._debugPhase = `validate venue connection ${connection.getName()}`;
            if (connection.isFrozenConnection()) {
              throw new Error(`Trying to chronicle events to a frozen chronicle ${
                  connection.getName()}`);
            }
            const commandEventVersion = venue.commandEvent.aspects.version;
            const connectionEventVersion = connection.getEventVersion();
            if (!connectionEventVersion || (connectionEventVersion !== commandEventVersion)) {
              throw new Error(`Command event version "${commandEventVersion
                  }" not supported by connection ${connection.getName()} which only supports "${
                  connectionEventVersion}"`);
            }
            // Perform other chronicle validation
            // TODO(iridian): extract chronicle content (EDIT: a what now?)
            return (venue.validatedConnection = connection);
          },
      );
    }));
  }

  _processRemoteVenues () {
    if (!this._remoteVenues) return undefined;
    return this.performChain(["remote", this._remoteVenues], "_processFirstStageChain");
  }

  _processLocalVenues () {
    if (!this._localVenues) return undefined;
    return this.performChain(["local", this._localVenues],
        this._firstStageVenues ? "_processStageChain" : "_processFirstStageChain");
  }

  _processMemoryVenues () {
    if (!this._memoryVenues) return undefined;
    return this.performChain(["memory", this._memoryVenues], "_processStageChain");
  }

  static _processStageChain = [
    ProphecyOperation.prototype._validateConnections,
    ProphecyOperation.prototype._chronicleStageVenueCommands,
    ProphecyOperation.prototype._processStageVenues,
  ];

  static _processFirstStageChain = [
    ProphecyOperation.prototype._validateConnections,
    ProphecyOperation.prototype._chronicleFirstStageVenueCommands,
    ProphecyOperation.prototype._processStageVenues,
  ];

  _validateConnections (stageName, venues) {
    this._stageName = stageName;
    this._debugPhase = `await stage #${this._stageIndex} '${stageName}' connection validations`;
    return [venues, ...venues.map(venue => venue.validatedConnection)];
  }

  _chronicleFirstStageVenueCommands (venues) {
    this._firstStageVenues = venues;
    const ret = this._chronicleStageVenueCommands(venues);
    const transactor = this.event.meta.transactor;
    if (transactor && transactor.onpersist) this.getPersistedStory();
    return ret;
  }

  _chronicleStageVenueCommands (venues) {
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

    // Get aspects.log.index and scribe persist finalizer for each chronicle
    this._debugPhase = `chronicle stage #${this._stageIndex} '${this._stageName}' commands`;
    for (const venue of venues) {
      try {
        this._debugPhase = `chronicle stage #${this._stageIndex} '${this._stageName}' command to ${
            venue.connection.getName()}`;
        venue.chronicling = venue.connection
            .chronicleEvent(venue.commandEvent, Object.create(this._options));
      } catch (error) {
        throw this._sourcerer.wrapErrorEvent(error, 1,
            new Error(`chronicleEvents.stage["${this._stageName}"].connection["${
                venue.connection.getName()}"].chronicleEvents`),
            "\n\tcommandEvent:", ...dumpObject(venue.commandEvent),
            "\n\tchronicling:", ...dumpObject(venue.chronicling),
        );
      }
    }
    this._stageIndex++;
    this._debugPhase = `await stage #${this._stageIndex} '${this._stageName}' truths`;
    return [venues];
  }

  _processStageVenues (venues) {
    return venues.map(venue => this.performChain(
        [venue, venue.currentChronicling = venue.chronicling],
        "_stageVenuesChain",
        "_errorOnProcessStageVenue"));
  }

  static _stageVenuesChain = [
    ProphecyOperation.prototype._divergentWaitStageVenueChronicling,
    ProphecyOperation.prototype._resolveStageVenueTruth,
  ];

  _divergentWaitStageVenueChronicling (venue, chroniclingResult) {
    if (!chroniclingResult) return [venue, undefined, []];
    const chronicledTruth = chroniclingResult.getTruthEvent();
    if (!isPromise(chronicledTruth)) return [venue, chronicledTruth];
    const receivedTruth = new Promise((resolve, reject) => {
      venue.confirmCommand = resolve;
      venue.rejectCommand = reject;
    });
    const truthProcesses = [
      chronicledTruth.catch(reason => {
        if (reason.isSchismatic === false) return receivedTruth;
        throw reason;
      }),
      receivedTruth,
    ];
    return [venue, Promise.race(truthProcesses), truthProcesses];
  }

  _resolveStageVenueTruth (venue, truth, truthProcesses) {
    if (!truth) {
      if (venue.chronicling !== venue.currentChronicling) {
        return { // retry
          0: [venue, venue.currentChronicling = venue.chronicling],
        };
      }
      Promise.all(truthProcesses).then(([chronicled, received]) => {
        venue.connection.errorEvent(
          "\n\tnull truth when fulfilling prophecy:", ...dumpObject(this._prophecy),
          "\n\tchronicled:", isPromise(truthProcesses[0]),
              ...dumpObject(chronicled), ...dumpObject(truthProcesses[0]),
          "\n\treceived:", isPromise(truthProcesses[1]),
              ...dumpObject(received), ...dumpObject(truthProcesses[1]));
      });
    } else if (truth.aspects.log.index !== venue.commandEvent.aspects.log.index) {
      // this chronicle command was/will be revised
    }
    this._prophecy.meta.chronicles[venue.connection.getChronicleURI()].truth
        = venue.confirmedTruth = truth;
    return [venue];
  }

  _errorOnProcessStageVenue (error, index, params) {
    const venue = params[0];
    if ((!this._progress || !this._progress.isSchismatic)
        && (venue.chronicling !== venue.currentChronicling)) {
      // retry
      return { 0: [venue, venue.currentChronicling = venue.chronicling] };
    }
    venue.rejectionReason = error;
    throw error;
  }

  _fulfillProphecy () {
    this._prophecy.isTruth = true;
    (this._fulfillment = this._prophecy);
    const transactor = this.event.meta.transactor;
    if (transactor && transactor.ontruth) this.getTruthStory();
    return [this._fulfillment];
  }

  _errorOnProphecyExecute (error, phaseIndex) {
    const prophecy = this._prophecy;
    if (!prophecy) throw this._rejectionError;
    prophecy.isRejected = true;
    this._fulfillment = null;
    this._rejectionError = prophecy.rejectionReason = this.errorOnProphecyOperation(
        new Error(`chronicleEvents.eventResults[${this.index}].execute(phase#${phaseIndex}/${
            this._debugPhase})`),
        error, true);
    this._prophecy = null;
    const transactor = this.event.meta.transactor;
    if (transactor) {
      const progress = this.getErroringProgress(this._rejectionError, { prophecy });
      transactor.dispatchAndDefaultActEvent(progress);
    } else if (!this._truthStory && (this.getVerbosity() >= 1)) {
      this.outputErrorEvent(this._rejectionError,
          `Exception caught during a fire-and-forget chronicleEvents.execute`);
    }
    try {
      _purgeLatestRecitedStory(this._sourcerer, prophecy, false);
    } catch (innerError) {
      outputError(innerError, `Exception caught during chronicleEvents.execute.purge`);
    }
    return null;
  }
}
