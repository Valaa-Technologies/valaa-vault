// @flow

import { getActionFromPassage } from "~/raem";
import { Command, EventBase } from "~/raem/events";
import { Story } from "~/raem/redux/Bard";
import { AbsentChroniclesError } from "~/raem/tools/denormalized/partitions";
import { naiveURI } from "~/raem/ValaaURI";

import { ProclaimEventResult, Connection, ProphecyChronicleRequest, ProphecyEventResult }
    from "~/sourcerer/api/types";
import { tryAspect } from "~/sourcerer/tools/EventAspects";
import { FabricatorEvent } from "~/sourcerer/api/Fabricator";
import extractChronicleEvent0Dot2
    from "~/sourcerer/tools/event-version-0.2/extractPartitionEvent0Dot2";

import {
  dumpObject, isPromise, generateDispatchEventPath, outputError,
  thenChainEagerly, thisChainRedirect, thisChainReturn, mapEagerly,
} from "~/tools";

import { fabricatorOps } from "~/sourcerer/FalseProphet/TransactionState";
import FalseProphet from "./FalseProphet";
import {
  _composeEventIntoRecitalStory, _recomposeSchismaticStory, _purgeLatestRecitedStory,
} from "./_recitalOps";
import FalseProphetConnection from "./FalseProphetConnection";

export type Prophecy = Story & {
  timed: ?Object;
  isProphecy: true;
}

const DEFAULT_MAX_REFORM_ATTEMPTS = 10;

// Create prophecies out of provided events and send their chronicle
// commands upstream. Aborts all remaining events on first exception
// and rolls back previous ones.
export function _proclaimEvents (falseProphet: FalseProphet, events: EventBase[], options = {}):
    ProphecyChronicleRequest {
  if (options.timed) throw new Error("timed events not supported yet");
  const resultBase = new ProphecyOperation(falseProphet, options.verbosity);
  resultBase._events = events;
  resultBase._options = options;
  resultBase._options.isProphecy = true;
  const prophecies = [];
  const ret = {
    eventResults: events.map((event, index) => {
      const operation = (event.meta || (event.meta = {})).operation = Object.create(resultBase);
      operation.event = event;
      operation.index = index;
      const dispatchPath = generateDispatchEventPath(event.meta.transactor, "proclaim");
      if (dispatchPath) {
        const progress = operation.getProgressEvent("proclaim");
        if (!event.meta.transactor.dispatchAndDefaultActEvent(progress, { dispatchPath })) {
          throw new Error("Command rejected by 'proclaim' default action cancelation");
        }
      }
      const prophecy = _composeEventIntoRecitalStory(
          falseProphet, event, "prophecy-chronicle", options.timed, options.transactionState);
      if (prophecy) prophecies.push(prophecy);
      else if ((operation._progress || {}).isReformable) {
        operation.launchFullReform();
      }
      return operation;
    }),
  };
  falseProphet._reciteStoriesToFollowers(prophecies);
  for (const recitedProphecy of prophecies) {
    const operation = recitedProphecy.meta.operation;
    operation._sceneName = "profess";
    operation._fulfillment = operation.opChain("_professChain", null, "_errorOnProfess");
  }
  return ret;

  // TODO(iridian): Implement prophecies' chronicle sub-command grouping.
  // Also implement it for purge revision re-chronicles.
  //
  // For purge revision re-chronicles this is a potentially crucial
  // qualitative performance optimization. For _proclaimEvents this is
  // not crucial, but having both this function and revision
  // reproclaims use the same multi-event functionality will lead in
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
  // larger revision reproclamations can be cleared at once.
  // A naive authority implementation might still leave one client
  // undergoing a large revisioning in a starved state, if there exists
  // another client which is constantly proclaiming commands.
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
  const progress = schism.meta.operation.getProgressEvent();
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

export class ProgressEvent extends FabricatorEvent {
  command: Command;
  prophecy: Prophecy;
}

export class ProphecyOperation extends ProphecyEventResult {
  _parent: FalseProphet;
  _events: EventBase[];
  _options: Object; // upstream proclaimEvents options

  _prophecy: Prophecy;
  _venues: { [chronicleURI: string]: {
    connection: Connection,
    commandEvent: Command,
    proclamation: Promise<ProclaimEventResult>,
    confirmCommand?: Function,
    rejectCommand?: Function,
  } };
  _fulfillment: Promise<Object>;
  _actIndex: number = 0;
  _sceneName: string = "construct";
  _firstStageVenues: Promise<Object>;

  launchPartialReform (elaboration: Object) {
    if (!elaboration.instigatorChronicleURI) {
      throw new Error(`launchPartialReform instigatorChronicleURI missing`);
    }
    return this.opChain("_partialReformChain", elaboration, "_errorOnReform");
  }

  launchFullReform () {
    return this.opChain("_fullReformChain", {}, "_errorOnReform");
  }

  purge (heresy) {
    if (this._prophecy) {
      this._prophecy.heresy = heresy;
      this._prophecy = null;
    }
    const progress = this.getProgressEvent("purge");
    if (progress.heresy) return;
    progress.heresy = heresy;
    progress.isSchismatic = true;
    const error = progress.error || new Error(
        typeof heresy === "string" ? heresy
        : Array.isArray(heresy) ? heresy[0]
        : progress.message);
    if (this.event.meta.transactor) {
      this.event.meta.transactor.dispatchAndDefaultActEvent(progress);
    }
    for (const venue of Object.values(this._venues || {})) {
      if (!venue.confirmedTruth) {
        if (venue.rejectCommand) venue.rejectCommand(venue.rejectionReason || error);
        venue.commandEvent = null;
      }
    }
  }

  getSceneName () { return this._sceneName; }
  getCommandOf (chronicleURI: string) {
    return this._venues[chronicleURI].commandEvent;
  }
  getLogAspectOf (chronicleURI: string) {
    return this._venues[chronicleURI].commandEvent.aspects.log;
  }
  getProgressEvent (newType) {
    if (!this._progress) {
      this._progress = new ProgressEvent(newType, {
        command: this.event,
        prophecy: this._prophecy,
        chronicles: this.event.meta.chronicles,
        isSchismatic: false,
      });
    } else if (newType) {
      this._progress.type = newType;
    }
    return this._progress;
  }
  getProgressErrorEvent (errorAct, error, assignErrorFields, assignProgressFields = {
    isSchismatic: true,
  }) {
    const progress = this.getProgressEvent(errorAct);
    if (!progress.errorAct) progress.errorAct = errorAct;
    progress.error = error;
    Object.assign(progress, assignProgressFields);

    const ret = new ProgressEvent("error");
    Object.assign(ret, progress, assignErrorFields || {});
    ret.errorAct = errorAct;
    ret.type = "error";
    return ret;
  }

  getComposedStory () {
    return thenChainEagerly(
        this._firstStageVenues,
        () => this._prophecy || this.throwRejectionError(),
        this.errorOnProphecyOperation.bind(this,
            new Error(`proclaimEvents.eventResults[${this.index}].getComposedStory()`)));
  }

  getRecordedStory (dispatchPath_) {
    let reformAttempt = this._reformAttempt;
    return this._recordedStory || (this._recordedStory = thenChainEagerly(
        // TODO(iridian, 2019-01): Add also local act proclamations to
        // the waited list, as _firstAct only contains remote
        // act proclamations. This requires refactoring: local
        // act persisting currently waits remote truths. This command
        // must be operable offline, so it cannot rely on remote truths.
        // Local persisting must thus be refactored to not await on
        // remote truths, but this needs to have support for discarding
        // the locally persisted commands if the remotes rejected.
        this._firstStageVenues
            && mapEagerly(this._firstStageVenues, ({ proclamation }) => {
              if (!proclamation) throw new Error("Heresy pending reformation");
              return proclamation.getRecordedEvent();
            }),
        () => {
          if (reformAttempt !== this._reformAttempt) {
            throw ({ retry: true }); // eslint-disable-line no-throw-literal
          }
          const prophecy = this._prophecy || this.throwRejectionError();
          const dispatchPath = dispatchPath_
              || generateDispatchEventPath(this.event.meta.transactor, "record");
          if (dispatchPath) {
            Promise.resolve(this._recordedStory).then(() =>
                this.event.meta.transactor.dispatchAndDefaultActEvent(
                    this.getProgressEvent("record"), { dispatchPath }));
          }
          return (this._recordedStory = prophecy);
        },
        (error, index, head, functionChain, onRejected) => {
          if (error.retry && (reformAttempt !== this._reformAttempt)) {
            reformAttempt = this._reformAttempt;
            return thenChainEagerly(head, functionChain, onRejected);
          }
          return this.errorOnProphecyOperation.bind(this,
            new Error(`proclaimEvents.eventResults[${this.index}].getRecordedStory()`));
        },
      ));
  }

  getTruthStory (dispatchPath_) {
    return this._truthStory || (this._truthStory = thenChainEagerly(
        this._fulfillment,
        (fulfillment) => {
          if (fulfillment === null) this.throwRejectionError();
          const prophecy = this._prophecy || this.throwRejectionError();
          const dispatchPath = dispatchPath_
              || generateDispatchEventPath(this.event.meta.transactor, "truth");
          if (dispatchPath) {
            Promise.resolve(prophecy).then(() => {
              const progress = this.getProgressEvent("truth");
              this.event.meta.transactor.dispatchAndDefaultActEvent(progress, { dispatchPath });
            });
          }
          return (this._truthStory = prophecy);
        },
        this.errorOnProphecyOperation.bind(this,
            new Error(`proclaimEvents.eventResults[${this.index}].getTruthStory()`))));
  }

  getPremiereStory () {
    return thenChainEagerly(
    // Returns a promise which will resolve to the content
    // received from the backend but only after all the local
    // follower reactions have been resolved as well.
    // TODO(iridian): Exceptions from follower reactions can't
    // reject the prophecy, but we should catch, handle and/or
    // expose them to the prophecy proclaimEvents originator.
        this.getFollowerReactions(),
    // TODO(iridian): Exceptions from upstream signal failure
    // and possible heresy: we should catch and have logic for
    // either retrying the operation or for full rejection.
    // Nevertheless flushing the corpus is needed.
        () => this.getComposedEvent(),
        this.errorOnProphecyOperation.bind(this,
            new Error(`proclaimEvents.eventResults[${this.index}].getPremiereStory()`)));
  }

  getFollowerReactions (ofSpecificFollower) {
    const reactions = this._reactions;
    if (reactions === null) return [];
    if (reactions === undefined) {
      if (this._reactionPromise) return this._reactionPromise;
      return this._reactionPromise = new Promise(resolve => {
        this._resolveReactions = resolve;
      }).then(() => {
        this._reactionPromise = null;
        return this.getFollowerReactions(ofSpecificFollower);
      });
    }
    const storyReactions = ofSpecificFollower
        ? [].concat(reactions.get(ofSpecificFollower) || [])
        : [].concat(...reactions.values());
    return Promise.all(storyReactions);
  }

  errorOnProphecyOperation (errorWrap, error, nothrow) {
    const wrappedError = this.getChronicler().wrapErrorEvent(error, 1, errorWrap,
        "\n\tduring:", this._sceneName,
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
    throw (this._rejectionError || new Error(
        "INTERNAL ERROR: ProphecyOperation._prophecy and _rejectionReason are both missing"));
  }

  static _professChain = [
    ProphecyOperation.prototype._prepareActsAndCommands,
    ProphecyOperation.prototype._initiateAllVenueValidations,
    ProphecyOperation.prototype._processRemoteVenues,
    ProphecyOperation.prototype._processLocalVenues,
    ProphecyOperation.prototype._processMemoryVenues,
    ProphecyOperation.prototype._fulfillProphecy,
  ];

  static _fullReformChain = [
    ProphecyOperation.prototype._prepareReform,
    ProphecyOperation.prototype._checkReformConditions,
    ProphecyOperation.prototype._reciteProphecy,
    ...ProphecyOperation._professChain,
  ];

  static _partialReformChain = [
    ProphecyOperation.prototype._prepareReform,
    ProphecyOperation.prototype._checkReformConditions,
    ProphecyOperation.prototype._reformRecompose,
  ];

  _prepareActsAndCommands () {
    this._sceneName = "prepare acts";
    this._venues = {};
    let missingConnections;
    const chronicles = (this._prophecy.meta || {}).chronicles;
    if (!chronicles) {
      throw new Error("prophecy is missing chronicle information");
    }
    const prophet = this._parent;
    for (const chronicleOrPartitionURI of Object.keys(chronicles)) {
      let chronicleURI = chronicleOrPartitionURI;
      let connection = prophet._connections[chronicleURI];
      if (!connection) {
        chronicleURI = naiveURI.createPartitionURI(chronicleOrPartitionURI);
        connection = prophet._connections[chronicleURI];
        if (!connection) {
          if (!chronicleInfo.isNewConnection) {
            (missingConnections || (missingConnections = [])).push(chronicleURI);
            continue;
          }
          connection = prophet._connections[chronicleURI] = prophet
              .sourcerChronicle(chronicleURI, { newChronicle: true });
        }
      }
      if (!this._prophecy.meta) throw new Error("prophecy.meta missing");
      const commandEvent = extractChronicleEvent0Dot2(
          chronicleURI, getActionFromPassage(this._prophecy));
      (connection.isRemoteAuthority()
              ? (this._remoteVenues || (this._remoteVenues = []))
          : connection.isLocallyRecorded()
              ? (this._localVenues || (this._localVenues = []))
              : (this._memoryVenues || (this._memoryVenues = []))
      ).push((this._venues[chronicleURI] = { connection, commandEvent }));
    }
    if (missingConnections) {
      throw new AbsentChroniclesError(`Missing active connections: '${
          missingConnections.map(c => c.toString()).join("', '")}'`, missingConnections);
    }
  }

  getActs () {
    return this._allStages || (this._allStages = [
      this._remoteVenues, this._localVenues, this._memoryVenues,
    ].filter(s => s));
  }

  _initiateAllVenueValidations () {
    this._sceneName = `validate venues`;
    this.getActs().forEach(actVenues => actVenues.forEach(venue => {
      venue.validatedVenue = thenChainEagerly(
          venue.connection.asSourceredConnection(),
          (connection) => {
            this._sceneName = `validate venue connection ${connection.getName()}`;
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
            // Perform other chronicle validatedVenue
            // TODO(iridian): extract chronicle content (EDIT: a what now?)
            return (venue.validatedVenue = venue);
          },
      );
    }));
  }

  _processRemoteVenues () {
    if (!this._remoteVenues) return undefined;
    return this.opChain("_processFirstStageChain", ["remote", this._remoteVenues]);
  }

  _processLocalVenues () {
    if (!this._localVenues) return undefined;
    return this.opChain(this._firstStageVenues ? "_processStageChain" : "_processFirstStageChain",
        ["local", this._localVenues]);
  }

  _processMemoryVenues () {
    if (!this._memoryVenues) return undefined;
    return this.opChain("_processStageChain", ["memory", this._memoryVenues]);
  }

  ];
  static _processActChain = [
    ProphecyOperation.prototype._finalizeActVenueValidations,
    ProphecyOperation.prototype._chronicleActVenueCommands,
    ProphecyOperation.prototype._processActVenues,

  static _processFirstStageChain = [
    ProphecyOperation.prototype._validateConnections,
    ProphecyOperation.prototype._chronicleFirstStageVenueCommands,
    ProphecyOperation.prototype._processStageVenues,
  ];

  _finalizeActVenueValidations (actName, venues) {
    this._actName = actName;
    this._sceneName = `await act #${this._actIndex} '${actName}' connection validatedVenues`;
    return venues.map(venue => venue.validatedVenue);
  }

  _chronicleFirstStageVenueCommands (venues) {
    this._firstStageVenues = venues;
    const ret = this._chronicleStageVenueCommands(venues);
    const onRecordDispatchPath = generateDispatchEventPath(this.event.meta.transactor, "record");
    if (onRecordDispatchPath) this.getRecordedStory(onRecordDispatchPath);
    return ret;
  }
  _chronicleActVenueCommands (...validatedVenues) {
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

    // Get aspects.log.index and scribe record finalizer for each chronicle
    this._sceneName = `chronicle act #${this._actIndex} '${this._actName}' commands`;
    for (const venue of validatedVenues) {
      try {
        this._sceneName = `chronicle act #${this._actIndex} '${this._actName}' command to ${
            venue.connection.getName()}`;
        venue.proclamation = venue.connection
            .proclaimEvent(venue.commandEvent, Object.create(this._options));
      } catch (error) {
        throw this._parent.wrapErrorEvent(error, 1,
            new Error(`proclaimEvents.act["${this._actName}"].connection["${
                venue.connection.getName()}"].proclaimEvents`),
            "\n\tcommandEvent:", ...dumpObject(venue.commandEvent),
            "\n\tproclamation:", ...dumpObject(venue.proclamation),
        );
      }
    }
    this._actIndex++;
    this._sceneName = `await act #${this._actIndex} '${this._actName}' truths`;
    return [validatedVenues];
  }

  _processActVenues (venues) {
    return venues.map(venue => this.opChain(
        "_actVenuesChain", [venue, venue.currentProclamation = venue.proclamation],
        "_errorOnProcessActVenue"));
  }

  static _actVenuesChain = [
    ProphecyOperation.prototype._divergeVenueProclamationResolutions,
    ProphecyOperation.prototype._convergeVenueProclamationTruth,
  ];

  _divergeVenueProclamationResolutions (venue, proclamation) {
    if (!proclamation) return [venue];
    const proclaimedTruth = proclamation.getTruthEvent();
    if (!isPromise(proclaimedTruth)) return [venue, proclaimedTruth];
    const receivedTruth = new Promise((resolve, reject) => {
      venue.confirmCommand = resolve;
      venue.rejectCommand = reject;
    });
    const truthProcesses = [
      proclaimedTruth.then(
          event => event || receivedTruth,
          reason => {
            if (reason.isSchismatic === false) return receivedTruth;
            throw reason;
          }),
      receivedTruth,
    ];
    return [venue, Promise.race(truthProcesses), truthProcesses];
  }

  _convergeVenueProclamationTruth (venue, truth, truthProcesses) {
    if (!truth) {
      const actualTruthProcesses = truthProcesses || [];
      if (venue.proclamation !== venue.currentProclamation) {
        // retry
        return thisChainRedirect(0, [venue, venue.currentProclamation = venue.proclamation, []]);
      }
      Promise.all(actualTruthProcesses).then(([proclaimed, received]) => {
        venue.connection.errorEvent(
          "\n\tnull truth when fulfilling prophecy:", ...dumpObject(this._prophecy),
          "\n\tproclaimed:", isPromise(actualTruthProcesses[0]),
              ...dumpObject(proclaimed), ...dumpObject(actualTruthProcesses[0]),
          "\n\treceived:", isPromise(actualTruthProcesses[1]),
              ...dumpObject(received), ...dumpObject(actualTruthProcesses[1]));
      });
    } else if (truth.aspects.log.index !== venue.commandEvent.aspects.log.index) {
      // this chronicle command was/will be revised
    }
    this._prophecy.meta.chronicles[venue.connection.getChronicleURI()].truth
        = venue.confirmedTruth = truth;
    return [venue];
  }

  _errorOnPerformVenue (error, index, params) {
    const venue = params[0];
    if ((!this._progress || !this._progress.isSchismatic)
        && (venue.proclamation !== venue.currentProclamation)) {
      // retry
      return thisChainRedirect(0, [venue, venue.currentProclamation = venue.proclamation]);
    }
    venue.rejectionReason = error;
    throw error;
  }

  _fulfillProphecy () {
    this._prophecy.isTruth = true;
    this._fulfillment = this._prophecy;
    const dispatchPath = generateDispatchEventPath(this.event.meta.transactor, "truth");
    if (dispatchPath) this.getTruthStory(dispatchPath);
    return [this._fulfillment];
  }

  _errorOnProfess (error, phaseIndex) {
    const prophecy = this._prophecy;
    if (!prophecy && this._rejectionError) throw this._rejectionError;
    this._fulfillment = null;
    if (prophecy) this.purge(error);
    this._rejectionError = this.errorOnProphecyOperation(
        new Error(`proclaimEvents.eventResults[${this.index}].profess(phase#${phaseIndex}/${
            this._sceneName})`),
        error, true);
    this._prophecy = null;
    const transactor = this.event.meta.transactor;
    if (transactor) {
      const progress = this.getProgressErrorEvent("profess", this._rejectionError, { prophecy });
      transactor.dispatchAndDefaultActEvent(progress);
    } else if (!this._truthStory && (this.getVerbosity() >= 1)) {
      this.outputErrorEvent(this._rejectionError,
          `Exception caught during a fire-and-forget proclaimEvents.profess`);
    }
    if (prophecy) {
      prophecy.rejectionReason = this._rejectionError;
      try {
        _purgeLatestRecitedStory(this._parent, prophecy, false);
      } catch (innerError) {
        outputError(innerError, `Exception caught during proclaimEvents.profess.purge`);
        outputError(error, "Exception caught during proclaim");
        throw innerError;
      }
    }
    return null;
  }

  _prepareReform (reformation) {
    const transactor = this.event.meta.transactor;
    const venues = this._venues;
    if (venues) {
      for (const venue of reformation.instigatorChronicleURI
          ? [[reformation.instigatorChronicleURI]]
          : Object.values(this._venues)) {
        if (!venue) continue;
        this._recordedStory = null;
        venue.proclamation = null;
      }
    }
    const progress = this._progress;
    if (progress.isSemanticSchism || (progress.isReformable === false)) {
      // If the schism is a semantic schism no reform can be attempted
      return thisChainReturn(this._reformFailed(["_prepareReform unreformable", progress]));
    }
    progress.type = "reform";
    progress.isReformable = undefined;
    if (this._options.onReform) {
      this._options.onReform(progress);
    } else {
      const dispatchPath = generateDispatchEventPath(transactor, "reform");
      if (!dispatchPath) {
        progress.isSchismatic = false;
      } else {
        progress.message = `revisioning due ${
            (reformation.schismaticRecital || {}).id || "explicit request"}`;
        transactor.dispatchAndDefaultActEvent(progress, { dispatchPath });
        progress.error = null;
      }
    }
    if (progress.isSchismatic) {
      return thisChainReturn(this._reformFailed(["_prepareReform schismatic", progress]));
    }
    return [reformation, ...(progress._proceedAfterAll || [])];
  }

  _checkReformConditions (reformation, ...proceedConditions) {
    if (proceedConditions.length) {
      const failingIndex = proceedConditions.findIndex(v => (v === false));
      if (failingIndex >= 0) {
        throw new Error(`Reformation aborted due to falsy proceed condition #${failingIndex}`);
      }
    }
    const maxAttempts = this._options.maxReformAttempts || DEFAULT_MAX_REFORM_ATTEMPTS;
    if ((this._reformAttempt || 0) >= maxAttempts) {
      throw new Error(`Max reform attempts (${maxAttempts}) exceeded`);
    }
    const reformedProphecy = _recomposeSchismaticStory(this._parent, this._prophecy);
    if (!reformedProphecy
        || (reformation.instigatorChronicleURI
            && (Object.keys((reformedProphecy.meta || {}).chronicles).length !== 1))) {
      if ((this._progress || {}).isReformable) {
        return thisChainRedirect("_prepareReform", [reformation]);
      }
      // Recomposition or revision failed, or this is an instigated
      // multi-chronicle command reformation which is not supported (for now).
      return thisChainReturn(this._reformFailed(!reformedProphecy
          ? ["_checkReformConditions unrecomposable"]
          : ["_checkReformConditions instigated multi-chronicle",
              reformation.instigatorChronicleURI, (reformedProphecy.meta || {}).chronicles,
          ]));
    }
    const reformedCommand = getActionFromPassage(reformedProphecy);
    if (!reformedCommand.meta) throw new Error("reformedCommand.meta missing");
    reformedCommand.meta.operation = this;
    this._recordedStory = null;
    this._prophecy = reformedProphecy;
    return [reformation, reformedCommand];
  }

  _reciteProphecy () {
    this._parent._reciteStoriesToFollowers([this._prophecy]);
  }

  _reformRecompose (reformation, reformedCommand) {
    this._reformAttempt = (this._reformAttempt || 0) + 1;

    for (const [chronicleURI, venue] of reformation.instigatorChronicleURI
        ? [[reformation.instigatorChronicleURI, this._venues[reformation.instigatorChronicleURI]]]
        : Object.entries(this._venues)) {
      const recomposedSubCommand = extractChronicleEvent0Dot2(chronicleURI, reformedCommand);
      // Can only revise commands belonging to the originating chronicle
      if (!recomposedSubCommand) return thisChainReturn(false);
      venue._reformAttempt = this._reformAttempt;
      venue.commandEvent = recomposedSubCommand;
      venue.proclamation = this._parent._connections[chronicleURI]
          .proclaimEvent(venue.commandEvent, Object.create(this._options));
      venue.proclamation.reformAttempt = this._reformAttempt;
    }
    if (this._progress) {
      this._progress.previousProphecy = this._progress.prophecy;
      this._progress.prophecy = this._prophecy;
    }
    return this._prophecy;
  }

  _reformFailed (reformHeresy) {
    this.purge(reformHeresy);
    return false;
  }

  _errorOnReform (error, index, reformation_) {
    const reformation = Array.isArray(reformation_) ? reformation_[0] : reformation_;
    const connection = reformation.instigatorConnection;
    const wrappedError = !connection ? error : this.wrapErrorEvent(error, 2,
        new Error(`reformAsHeresy(${connection._dumpEventIds(this._prophecy)}, ${
          connection._dumpEventIds(reformation.newEvents || [])}, ${
          connection._dumpEventIds(reformation.schismaticCommands || [])})`));
    const transactor = ((this._prophecy || {}).meta || {}).transactor;
    if (transactor) {
      const progress = this.getProgressErrorEvent(
          "reform", wrappedError, { prophecy: this._prophecy });
      transactor.dispatchAndDefaultActEvent(progress);
    }
    if (reformation.isComplete) {
      this.outputErrorEvent(wrappedError, "Exception caught when reforming heresy");
    }
    return thisChainReturn(this._reformFailed(["_errorOnReform", error]));
  }
}

Object.assign(ProphecyOperation.prototype, fabricatorOps);
