// @flow

import { getActionFromPassage } from "~/raem";
import { Command, EventBase } from "~/raem/events";
import { Story } from "~/raem/redux/Bard";
import VRL from "~/raem/VRL";

import Connection from "~/sourcerer/api/Connection";
import { ChronicleOptions, ChronicleRequest, ChronicleEventResult, ConnectOptions, NarrateOptions }
    from "~/sourcerer/api/types";
import { initializeAspects, obtainAspect, tryAspect } from "~/sourcerer/tools/EventAspects";
import EVENT_VERSION from "~/sourcerer/tools/EVENT_VERSION";
import extractPartitionEvent0Dot2
    from "~/sourcerer/tools/event-version-0.2/extractPartitionEvent0Dot2";
import IdentityManager from "~/sourcerer/FalseProphet/IdentityManager";

import { dumpObject, mapEagerly, thenChainEagerly } from "~/tools";

import { Prophecy, _reviewRecomposedSchism } from "./_prophecyOps";
import {
  _confirmLeadingTruthsToFollowers, _confirmRecitalStories, _recomposeSchismaticStory,
  _refineRecital,
} from "./_recitalOps";

/**
 * @export
 * @class FalseProphetConnection
 * @extends {Connection}
 */
export default class FalseProphetConnection extends Connection {
  // _headEventId is the aspects.log.index of the first unconfirmed truth.
  // penndingTruths and unconfirmedCommands are based on this, ie.
  // their 0th entry aspects.log.index is always equal to this.
  _headEventId: number = 0;
  // Discontinuous, unreduced truths. If defined, the first entry is
  // always immediately reduced. This means that first entry is always
  // undefined.
  _pendingTruths: EventBase[] = [];
  // Continuous, reduced but unconfirmed commands. Whenever
  // _pendingTruths contains a truth at an equivalent position with
  // equivalent aspects.command.id, then all commands with
  // aspects.log.index equal or less to that are confirmed as truths
  // and transferred to _pendingTruths.
  _unconfirmedCommands: EventBase[] = [];
  _firstUnconfirmedEventId = 0;
  _isFrozen: ?boolean;
  _referencePrototype: VRL;
  _originatingIdentity: IdentityManager;

  constructor (options) {
    super(options);
    const existingRef = this._sourcerer._inactivePartitionVRLPrototypes[String(this._partitionURI)];
    if (existingRef) {
      this._referencePrototype = existingRef;
      delete this._sourcerer._inactivePartitionVRLPrototypes[String(this._partitionURI)];
    } else {
      this._referencePrototype = new VRL()
          .initResolverComponent({ inactive: true, partition: this._partitionURI });
    }
  }

  _doConnect (options: ConnectOptions, onError: Function) {
    this._originatingIdentity = options.discourse && options.discourse.getIdentityManager();
    return thenChainEagerly(super._doConnect(options, onError),
        ret => {
          this._referencePrototype.setInactive(false);
          return ret;
        });
  }

  isLocallyPersisted () {
    return this._isLocallyPersisted !== undefined ? this._isLocallyPersisted
        : (this._isLocallyPersisted = this._upstreamConnection.isLocallyPersisted());
  }
  isPrimaryAuthority () {
    return this._isPrimaryAuthority !== undefined ? this._isPrimaryAuthority
        : (this._isPrimaryAuthority = this._upstreamConnection.isPrimaryAuthority());
  }
  isRemoteAuthority () {
    return this._isRemoteAuthority !== undefined ? this._isRemoteAuthority
        : (this._isRemoteAuthority = this._upstreamConnection.isRemoteAuthority());
  }
  getEventVersion () {
    return this._eventVersion !== undefined ? this._eventVersion
        : (this._eventVersion = this._upstreamConnection.getEventVersion());
  }
  getMostRecentError () {
    return (this._mostRecentError || {}).message;
  }

  getStatus () {
    return {
      truths: this._headEventId,
      commands: this._unconfirmedCommands.length,
      frozen: this.isFrozenConnection(),
      ...(this.getMostRecentError() ? { error: this.getMostRecentError() } : {}),
      ...super.getStatus(),
    };
  }

  setIsFrozen (value: boolean = true) { this._isFrozen = value; }

  isFrozenConnection (): boolean { return !!this._isFrozen; }

  narrateEventLog (options: ?NarrateOptions = {}): Promise<Object> {
    if (!options) return undefined;
    this._resolveOptionsIdentity(options);
    if (options.rechronicleOptions !== false) {
      if (!options.rechronicleOptions) options.rechronicleOptions = {};
      options.rechronicleOptions.discourse = options.discourse;
      options.rechronicleOptions.identity = options.identity;
    }
    return super.narrateEventLog(options);
  }

  _resolveOptionsIdentity (options) {
    if (options.identity !== undefined) return;
    const identity = options.discourse && options.discourse.getIdentityManager();
    options.identity = identity || this._originatingIdentity;
  }

  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}): ChronicleRequest {
    if (!events || !events.length) return { eventResults: events };
    const connection = this;
    let chronicling, resultBase, leadingTruths, initialSchism, upstreamResults, renarration,
        rechronicle;
    try {
      if (options.isProphecy) {
        // console.log("assigning ids:", this.getName(), this._headEventId,
        //     this._unconfirmedCommands.length, "\n\tevents:", ...dumpObject(events));
        for (const event of events) {
          if (!event.aspects || !event.aspects.version) {
            initializeAspects(event, { version: EVENT_VERSION });
          }
          obtainAspect(event, "log").index = this._headEventId + this._unconfirmedCommands.length;
          this._unconfirmedCommands.push(event);
        }
        this._checkForFreezeAndNotify();
      } else if (typeof events[0].aspects.log.index !== "number") {
        throw new Error(`Can't chronicle events without aspects.log.index ${
            ""}(while options.isProphecy is not set)`);
      }
      this.clockEvent(2, () => [
        "falseProphet.chronicle", `chronicleEvents(${this._dumpEventIds(events)})`,
      ]);

      const receiveTruths = !options.isTruth && this.getReceiveTruths(options.receiveTruths);
      if (receiveTruths) options.receiveTruths = receiveTruths;
      options.receiveCommands = options.isProphecy ? null
          : this.getReceiveCommands(options.receiveCommands);
      this._resolveOptionsIdentity(options);
      this.clockEvent(2, () => ["falseProphet.chronicle.upstream",
        `upstream.chronicleEvents(${events.length})`]);
      chronicling = this._upstreamConnection.chronicleEvents(events, options);

      resultBase = new ChronicleEventResult(null, this, {
        _events: events,
        onError: errorOnFalseProphetChronicleEvents.bind(this, new Error("chronicleResultBase")),
      });
      const primaryRecital = this._sourcerer._primaryRecital;
      const ret = {
        eventResults: events.map((event, index) => {
          const result = Object.create(resultBase);
          result.event = event;
          result.index = index;
          return result;
        }),
      };
      resultBase._truthForwardResults = thenChainEagerly(null, this.addChainClockers(2,
          "falseProphet.chronicle.upstream.ops", [
        function _awaitUpstreamChronicling () {
          return (resultBase._forwardResults = chronicling.eventResults);
        },
        function _awaitUpstreamTruths (upstreamEventResults) {
          return mapEagerly((upstreamResults = (upstreamEventResults || events)),
              result => result.getTruthEvent(),
              (error, head, index, truthResults, entries, callback, onRejected) => {
                if (!leadingTruths) leadingTruths = truthResults.slice(0, index);
                const command = events[index];
                const prophecy = command && primaryRecital.getStoryBy(command.aspects.command.id);
                if (error) connection._mostRecentError = error;
                if (((error.proceed || {}).when === "narrated") && (renarration === undefined)) {
                  renarration = connection.narrateEventLog({
                    eventIdBegin: connection._headEventId,
                    receiveTruths: null,
                  });
                }
                if (prophecy) {
                  const progress = prophecy.meta.operation.getErroringProgress(error, {
                    instigatorConnection: connection,
                    isSchismatic: error.isSchismatic !== false,
                    isRevisable: error.isRevisable !== false,
                    isReformable: error.isReformable !== false,
                    isRefabricateable: error.isRefabricateable !== false,
                  });
                  if (options.discourse) {
                    options.discourse.dispatchAndDefaultActEvent(progress);
                  }
                  if (renarration) {
                    progress.proceedWhenTruthy(renarration);
                  }
                  if (progress.isSchismatic !== false) {
                    if (initialSchism === undefined) initialSchism = events[index];
                    progress.type = "schism";
                    progress.schismaticCommand = events[index];
                    progress.message = `chronicleEvents error as ${
                      progress.isRevisable ? "reviseable"
                      : progress.isReformable ? "reformable"
                      : progress.isRefabricateable ? "refabricateable"
                      : "to-be-rejected"
                    } schism: ${error.message}`;
                  }
                }
                // Process the remaining entries so that fully
                // rejected commands will not be needlessly revised
                return mapEagerly(entries, callback, onRejected, index + 1, truthResults);
              });
        },
        function _awaitPossibleRenarration (truthResults) {
          if (!leadingTruths) leadingTruths = truthResults;
          return renarration;
        },
        function _receiveTruthsLocally (renarratedEvents = []) {
          let receivableTruths = (!leadingTruths.length && !renarratedEvents.length) ? []
              : !leadingTruths.length ? renarratedEvents
              : !renarratedEvents.length && leadingTruths;
          if (!receivableTruths) {
            // TODO(iridian): Check that the truths -> narratedLog
            // log.index transition is monotonous
            receivableTruths = leadingTruths.concat(renarratedEvents);
          }
          if (!receivableTruths.length && renarration && connection._unconfirmedCommands.length) {
            if (!rechronicle) {
              rechronicle = new Error();
              rechronicle.headIndex = events[0].aspects.log.index;
            }
            throw rechronicle;
          }
          return receiveTruths && (receivableTruths.length || initialSchism)
              && receiveTruths(receivableTruths, undefined, undefined, initialSchism);
        },
        function _finalizeChronicleResults () {
          return (resultBase._truthForwardResults = !rechronicle ? upstreamResults
              : upstreamResults.slice(
                  rechronicle.headIndex - upstreamResults[0].aspects.log.index));
        },
      ]), (error, index, head, functionChain, onRejected) => {
        if (error !== rechronicle) {
          return errorOnFalseProphetChronicleEvents(new Error("chronicleUpstream"), error);
        }
        leadingTruths = undefined;
        renarration = undefined;
        events = connection._unconfirmedCommands; // eslint-disable-line no-param-reassign
        options.isLocallyPersisted = false;
        chronicling = connection._upstreamConnection.chronicleEvents(events, options);
        return thenChainEagerly(null, functionChain, onRejected);
      });
      return ret;
    } catch (error) { return errorOnFalseProphetChronicleEvents.call(this, new Error(""), error); }
    function errorOnFalseProphetChronicleEvents (wrap, error) {
      const wrap_ = new Error(`chronicleEvents(${events.length} events).${wrap.message}`);
      wrap_.stack = wrap.stack;
      throw connection.wrapErrorEvent(error, wrap_,
          "\n\toptions:", ...dumpObject(options),
          "\n\tevents:", ...dumpObject(connection._dumpEventIds(events)),
          "\n\tinternal:", ...dumpObject({
            connection, chronicling, resultBase, leadingTruths, initialSchism,
            upstreamResults, renarration, rechronicle,
          }));
    }
  }

  receiveTruths (truths: EventBase[], unused1, unused2, schismaticCommand: EventBase) {
    let schismaticCommands, confirmCount = 0, confirmations, newTruthCount = 0, newTruths;
    try {
      this.clockEvent(2, () => [
        "falseProphet.receive.truths",
        `receiveTruths(${this._dumpEventIds(truths)},${this._dumpEventIds(schismaticCommand)})`,
      ]);
      this._insertEventsToQueue(truths, this._pendingTruths, false,
          (truth, queueIndex, existingTruth) => {
            this.errorEvent(
                `receiveTruths aspects.command.id mismatch with existing truth, expected '${
                existingTruth.aspects.command.id}', got incoming truth with: '${
                truth.aspects.command.id}'`,
                "\n\tresolution: overwriting with incoming truth");
          });
      for (; this._unconfirmedCommands[confirmCount] && this._pendingTruths[confirmCount];
          ++confirmCount) {
        if (this._pendingTruths[confirmCount].aspects.command.id !==
            this._unconfirmedCommands[confirmCount].aspects.command.id) {
          schismaticCommands = this._unconfirmedCommands.slice(confirmCount);
          this._unconfirmedCommands = [];
          break;
        }
      }
      if (confirmCount) {
        confirmations = this._pendingTruths.splice(0, confirmCount);
        if (!schismaticCommands) this._unconfirmedCommands.splice(0, confirmCount);
        // purge clears all unconfirmed commands
      }
      if (!schismaticCommands && schismaticCommand) {
        const index = this._unconfirmedCommands.indexOf(schismaticCommand);
        if (index < 0) {
          this.errorEvent("schismatic command noticed but not in queue of", this.debugId(),
              "\n\tschismaticCommand.aspects:", JSON.stringify(schismaticCommand.aspects, null, 2),
              "\n\tschismaticCommand:", JSON.stringify(schismaticCommand),
              "\n\tunconfirmed:", this._unconfirmedCommands.map(
                  unconfirmed => ({ aspects: JSON.stringify(unconfirmed.aspects) })));
        } else {
          schismaticCommands = this._unconfirmedCommands.splice(index);
        }
      }
      while (this._pendingTruths[newTruthCount]) ++newTruthCount;
      this._headEventId += confirmCount + newTruthCount;
      newTruths = this._pendingTruths.splice(0, newTruthCount);
      if (confirmations) {
        _confirmRecitalStories(this, confirmations);
        if (!newTruths.length && !(schismaticCommands || []).length) {
          _confirmLeadingTruthsToFollowers(this.getSourcerer());
          this._checkForFreezeAndNotify();
          return truths;
        }
      }
      /*
      this.logEvent(1, () => ["receiveTruths.confirm&purge",
        "\n\tconfirmedCommands:", ...dumpObject(confirmedCommands),
        "\n\tschismaticCommands:", ...dumpObject(schismaticCommands),
        "\n\tnewTruths:", ...dumpObject(newTruths)
      ]);
      */
      _refineRecital(this, newTruths, "receive-truth", schismaticCommands);
      return truths;
    } catch (error) {
      throw this.wrapErrorEvent(error, `receiveTruths(${this._dumpEventIds(truths)})`,
          "\n\treceived truths:", ...dumpObject(truths),
          "\n\tpendingTruths:", ...dumpObject([...this._pendingTruths]),
          "\n\tunconfirmedCommands:", ...dumpObject([...this._unconfirmedCommands]),
          "\n\tinternal:", ...dumpObject({
            this: this, schismaticCommands, confirmCount, confirmations, newTruthCount, newTruths,
          }),
      );
    }
  }

  receiveCommands (commands: EventBase[]) {
    // This is not called by chronicle, but either by command recall on
    // startup or to update a conflicting command read from another tab.
    let schismaticCommands;
    try {
      this.clockEvent(2, () => ["falseProphet.receive.commands",
        `receiveTruths(${commands.length})`]);
      const newCommands = this._insertEventsToQueue(commands, this._unconfirmedCommands, true,
          (command, queueIndex) => {
            schismaticCommands = this._unconfirmedCommands.splice(queueIndex);
          });
      _refineRecital(this, newCommands || [], "receive-command", schismaticCommands);
      return commands;
    } catch (error) {
      throw this.wrapErrorEvent(error, `receiveCommand(${this._dumpEventIds(commands)})`,
          "\n\treceived commands:", ...dumpObject(commands),
          "\n\tpendingTruths:", ...dumpObject([...this._pendingTruths]),
          "\n\tunconfirmedCommands:", ...dumpObject([...this._unconfirmedCommands]),
          "\n\tthis:", ...dumpObject(this)
      );
    }
  }

  _insertEventsToQueue (events: EventBase[], targetQueue: EventBase[], isCommand: boolean,
      onMismatch: Function) {
    for (let index = 0; index !== events.length; ++index) {
      const event = events[index];
      const queueIndex = !event ? -1 : (event.aspects.log.index - this._headEventId);
      try {
        if (queueIndex < 0) continue;
        if (isCommand && queueIndex && !targetQueue[queueIndex - 1]) {
          // TODO(iridian): non-continuousity support can be added in principle.
          // But maybe it makes sense to put this functionality to scribe? Or to Oracle?
          throw new Error(`Non-continuous aspects.log.index ${event.aspects.log.index
              } detected when inserting commands to queue`);
        }
        const existingEvent = targetQueue[queueIndex];
        if (existingEvent) {
          if (event.aspects.command.id === existingEvent.aspects.command.id) continue;
          onMismatch(event, queueIndex, existingEvent);
        }
        if (isCommand) {
          const newCommands = events.slice(index);
          targetQueue.push(...newCommands);
          return newCommands;
        }
        targetQueue[queueIndex] = event;
      } catch (error) {
        throw this.wrapErrorEvent(error, isCommand
                ? `_insertUnconfirmedCommandsToQueue().events[${index}]`
                : `_insertPendingTruthsToQueue().events[${index}]`,
            "\n\tevents:", ...dumpObject(events),
            `\n\tevents[${index}]:`, ...dumpObject(events[index]),
            "\n\ttargetQueue:", ...dumpObject(targetQueue),
            "\n\tqueueIndex:", queueIndex,
            "\n\tthis:", ...dumpObject(this));
      }
    }
    return undefined;
  }

  extractPartitionEvent (command: Command) {
    return extractPartitionEvent0Dot2(this, command);
  }

  createCommandPartitionInfo (/* action: Object, command: Command , bard: Bard */) {
    if (this._isFrozen) {
      throw new Error(`Cannot chronicle a command to frozen partition: <${
          this.getPartitionURI()}>`);
    }
    return {};
  }

  _checkForFreezeAndNotify (lastEvent: EventBase[] =
      this._unconfirmedCommands[(this._unconfirmedCommands.length || 1) - 1]) {
    this.clockEvent(2, () => ["falseProphet.unconfirmed.notify",
      `_checkForFreezeAndNotify(${this._unconfirmedCommands.length})`]);
    if (lastEvent) this.setIsFrozen(lastEvent.type === "FROZEN");
    this._sourcerer.setConnectionCommandCount(
        this.getPartitionURI().toString(), this._unconfirmedCommands.length);
  }

  _reviewRecomposedSchism (purged: Prophecy, newProphecy: Prophecy) {
    try {
      return _reviewRecomposedSchism(this, purged, newProphecy);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          new Error(`_reviewRecomposedSchism(${tryAspect(purged, "command").id} -> ${
              tryAspect(newProphecy, "command").id})`),
          "\n\tpurged prophecy:", ...dumpObject(purged),
          "\n\tnew prophecy:", ...dumpObject(newProphecy));
    }
  }

  _reformHeresy (schism: Prophecy, reformation: Object, purgedStories: Story[],
      newEvents: EventBase[]) {
    const ret = this.performChain([{ schism, reformation, purgedStories, newEvents }],
        "_reformHeresyChain", "_errorOnReformHeresy");
    // if ret is a promise return undefined to denote purge.
    if (!Array.isArray(ret) || (ret[0] === false)) return undefined;
    return ret;
  }

  static _reformHeresyChain = [
    FalseProphetConnection.prototype._prepareHeresyReformation,
    FalseProphetConnection.prototype._recomposeHeresy,
    FalseProphetConnection.prototype._deliverStoriesIfReformationComplete,
  ];

  _prepareHeresyReformation (params) {
    const meta = params.schism.meta || {};
    const operation = meta.operation;
    // No way to revise non-prophecy schisms: these come from elsewhere so not our job.
    if (!operation) return false;
    const operationPartition = operation._partitions[String(this.getPartitionURI())];
    if (operationPartition) {
      operation._persistedStory = null;
      operationPartition.chronicling = null;
    }
    // First try to revise using the original chronicleEvents options.reformHeresy
    if (operation._options.reformHeresy) {
      return {
        "": operation._options
            .reformHeresy(params.schism, this, params.newEvents, params.purgedStories)
                || false,
      };
    }
    const progress = operation._progress;
    // Then if the schism is not a semantic schism try basic revise-recompose.
    if (progress.isSemanticSchism || (progress.isReformable === false)) {
      return false;
    }
    progress.type = "reform";
    if (meta.transactor && meta.transactor.onreform) {
      meta.transactor.dispatchAndDefaultActEvent(progress);
    } else {
      progress.isSchismatic = false;
    }
    if (progress.isSchismatic) return false;
    return [params, ...(progress._proceedWhenTruthy || [])];
  }

  _recomposeHeresy (params, ...proceedConditions) {
    if (!params) return false;
    const failingIndex = proceedConditions.findIndex(v => !v);
    if (failingIndex >= 0) {
      throw new Error(`Reformation aborted due to falsy proceed condition #${failingIndex}`);
    }
    const recomposedProphecy = _recomposeSchismaticStory(this.getSourcerer(), params.schism);
    if (!recomposedProphecy
        || (Object.keys((recomposedProphecy.meta || {}).partitions).length !== 1)) {
      // Recomposition failed, revision failed or a multi-partition command reformation
      // which is not supported (for now).
      return false;
    }
    const recomposedCommand = getActionFromPassage(recomposedProphecy);
    if (!recomposedCommand.meta) throw new Error("recomposedCommand.meta missing");
    const recomposedPartitionCommand = this.extractPartitionEvent(recomposedCommand);
    // Can only revise commands belonging to the originating partition
    if (!recomposedPartitionCommand) return false;

    const operation = recomposedCommand.meta.operation = params.schism.meta.operation;
    operation._prophecy = recomposedProphecy;
    operation._reformationAttempt = (operation._reformationAttempt || 0) + 1;
    operation._persistedStory = null;
    if (operation._progress) {
      operation._progress.previousProphecy = operation._progress.prophecy;
      operation._progress.prophecy = recomposedProphecy;
    }
    const operationPartition = operation._partitions[String(this.getPartitionURI())];
    operationPartition._reformationAttempt = operation._reformationAttempt;
    operationPartition.commandEvent = recomposedPartitionCommand;
    operationPartition.chronicling = this.chronicleEvent(
        operationPartition.commandEvent, Object.create(operation._options));
    return [params, recomposedProphecy];
  }

  _deliverStoriesIfReformationComplete (params, ...recomposedProphecies) {
    if (params) {
      if (!params.reformation.isComplete) return recomposedProphecies;
      this._sourcerer._deliverStoriesToFollowers(recomposedProphecies);
    }
    return false;
  }

  _errorOnReformHeresy (error, index, [{ schism, reformation, newEvents, purgedStories }]) {
    const wrappedError = this.wrapErrorEvent(error,
        new Error(`_reformHeresy(${this._dumpEventIds(schism)}, ${
          this._dumpEventIds(newEvents)}, ${this._dumpEventIds(purgedStories)})`));
    const transactor = schism && schism.meta && schism.meta.transactor;
    if (transactor) {
      const progress = schism.meta.operation.getErroringProgress(wrappedError, {
        oldProphecy: schism, isReformSchism: true,
      });
      if (!transactor.dispatchAndDefaultActEvent(progress)) return false; // just prevents output
    }
    if (reformation.isComplete) {
      this.outputErrorEvent(wrappedError, "Exception caught during reformHeresy");
    }
    return false;
  }
}
