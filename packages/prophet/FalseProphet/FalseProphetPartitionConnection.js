// @flow

import { Command, EventBase } from "~/raem/events";
import { Story } from "~/raem/redux/Bard";
import VRL from "~/raem/VRL";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import { ChronicleOptions, ChronicleRequest, ChronicleEventResult, ConnectOptions, NarrateOptions }
    from "~/prophet/api/types";
import { initializeAspects, obtainAspect, tryAspect } from "~/prophet/tools/EventAspects";
import EVENT_VERSION from "~/prophet/tools/EVENT_VERSION";
import extractPartitionEvent0Dot2
    from "~/prophet/tools/event-version-0.2/extractPartitionEvent0Dot2";
import IdentityManager from "~/prophet/FalseProphet/IdentityManager";

import { dumpObject, mapEagerly, thenChainEagerly } from "~/tools";

import { Prophecy, _reviewPurgedProphecy, _reviseSchism } from "./_prophecyOps";
import { _confirmCommands, _purgeAndRecomposeStories } from "./_storyOps";

/**
 * @export
 * @class FalseProphetPartitionConnection
 * @extends {PartitionConnection}
 */
export default class FalseProphetPartitionConnection extends PartitionConnection {
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
    const existingRef = this._prophet._inactivePartitionVRLPrototypes[String(this._partitionURI)];
    if (existingRef) {
      this._referencePrototype = existingRef;
      delete this._prophet._inactivePartitionVRLPrototypes[String(this._partitionURI)];
    } else {
      this._referencePrototype = new VRL()
          .initResolverComponent({ inactive: true, partition: this._partitionURI });
    }
  }

  _doConnect (options: ConnectOptions, onError: Function) {
    this._originatingIdentity = options.identity;
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

  getStatus () {
    return {
      truths: this._headEventId,
      commands: this._unconfirmedCommands.length,
      frozen: this.isFrozenConnection(),
      ...super.getStatus(),
    };
  }

  setIsFrozen (value: boolean = true) { this._isFrozen = value; }

  isFrozenConnection (): boolean { return !!this._isFrozen; }

  narrateEventLog (options: ?NarrateOptions = {}): Promise<Object> {
    if (!options) return undefined;
    if (options.identity === undefined) options.identity = this._originatingIdentity;
    return super.narrateEventLog(options);
  }

  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}): ChronicleRequest {
    if (!events || !events.length) return { eventResults: events };
    const connection = this;
    let chronicling, resultBase, leadingTruths, firstSchismaticCommand, upstreamResults,
        renarration, rechronicle;
    try {
      this.clockEvent(2, () => ["falseProphet.chronicle", `chronicleEvents(${events.length})`]);
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

      const receiveTruths = !options.isTruth && this.getReceiveTruths(options.receiveTruths);
      if (receiveTruths) options.receiveTruths = receiveTruths;
      options.receiveCommands = options.isProphecy ? null
          : this.getReceiveCommands(options.receiveCommands);
      if (options.identity === undefined) options.identity = this._originatingIdentity;
      this.clockEvent(2, () => ["falseProphet.chronicle.upstream",
        `upstream.chronicleEvents(${events.length})`]);

      chronicling = this._upstreamConnection.chronicleEvents(events, options);

      resultBase = new ChronicleEventResult(null, {
        _events: events,
        onError: errorOnFalseProphetChronicleEvents.bind(this, new Error("chronicleResultBase")),
      });
      const primaryRecital = this._prophet._primaryRecital;
      const partitionURI = this.getPartitionURI();

      resultBase._truthForwardResults = thenChainEagerly(null, this.addChainClockers(2,
          "falseProphet.chronicle.upstream.ops", [
        function _awaitUpstreamChronicling () {
          return (resultBase._forwardResults = chronicling.eventResults);
        },
        function _awaitUpstreamTruths (eventResults) {
          return mapEagerly((upstreamResults = (eventResults || events)),
              result => result.getTruthEvent(),
              (error, head, index, truthResults, entries, callback, onRejected) => {
                if (!leadingTruths) leadingTruths = truthResults.slice(0, index);
                const purgedStory = primaryRecital.getStoryBy(events[index].aspects.command.id);
                if (((error.retry || {}).when === "narrated") && (renarration === undefined)) {
                  renarration = connection.narrateEventLog({
                    eventIdBegin: connection._headEventId,
                    receiveTruths: null,
                  });
                }
                if (purgedStory && (error.isSchismatic !== false)) {
                  if (firstSchismaticCommand === undefined) firstSchismaticCommand = events[index];
                  purgedStory.schismPartition = partitionURI;
                  if (error.isReviseable) {
                    purgedStory.schismDescription =
                        `chronicleEvents reviseable schism: ${error.message}`;
                  } else {
                    purgedStory.schismDescription =
                        `chronicleEvents schism rejection: ${error.message}`;
                    purgedStory.unreviseableSchismError = error;
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
          return receiveTruths && receiveTruths(
              receivableTruths, undefined, undefined, firstSchismaticCommand);
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
        chronicling = connection._upstreamConnection.chronicleEvents(events, {
          isLocallyPersisted: false, ...options,
        });
        return thenChainEagerly(null, functionChain, onRejected);
      });
      return {
        eventResults: events.map((event, index) => {
          const ret = Object.create(resultBase); ret.event = event; ret.index = index; return ret;
        }),
      };
    } catch (error) { return errorOnFalseProphetChronicleEvents.call(this, new Error(""), error); }
    function errorOnFalseProphetChronicleEvents (wrap, error) {
      const wrap_ = new Error(`chronicleEvents(${events.length} events).${wrap.message}`);
      wrap_.stack = wrap.stack;
      throw connection.wrapErrorEvent(error, wrap_,
          "\n\toptions:", ...dumpObject(options),
          "\n\tevents:", tryAspect(events[0], "log").index,
              tryAspect(events[events.length - 1], "log").index,
          "\n\tinternal:", ...dumpObject({
            connection, chronicling, resultBase, leadingTruths, firstSchismaticCommand,
            upstreamResults, renarration, rechronicle,
          }));
    }
  }

  receiveTruths (truths: EventBase[], unused1, unused2, schismaticCommand: EventBase) {
    let purgedCommands, confirms = 0, confirmedCommands, newTruthCount = 0, newTruths;
    try {
      this.clockEvent(2, () => ["falseProphet.receive.truths", `receiveTruths(${truths.length})`]);
      this._insertEventsToQueue(truths, this._pendingTruths, false,
          (truth, queueIndex, existingTruth) => {
            this.errorEvent(
                `receiveTruths aspects.command.id mismatch with existing truth, expected '${
                existingTruth.aspects.command.id}', got incoming truth with: '${
                truth.aspects.command.id}'`,
                "\n\tresolution: overwriting with incoming truth");
          });
      for (; this._unconfirmedCommands[confirms] && this._pendingTruths[confirms]; ++confirms) {
        if (this._pendingTruths[confirms].aspects.command.id !==
            this._unconfirmedCommands[confirms].aspects.command.id) {
          purgedCommands = this._unconfirmedCommands.slice(confirms);
          this._unconfirmedCommands = [];
          break;
        }
      }
      if (confirms) {
        confirmedCommands = this._pendingTruths.splice(0, confirms);
        if (!purgedCommands) this._unconfirmedCommands.splice(0, confirms);
        // purge clears all unconfirmed commands
      }
      if (!purgedCommands && schismaticCommand
          && (schismaticCommand === this._unconfirmedCommands[0])) {
        purgedCommands = this._unconfirmedCommands;
        this._unconfirmedCommands = [];
      }
      while (this._pendingTruths[newTruthCount]) ++newTruthCount;
      this._headEventId += confirms + newTruthCount;
      if (confirmedCommands) _confirmCommands(this, confirmedCommands);
      newTruths = this._pendingTruths.splice(0, newTruthCount);
      /*
      this.logEvent(1, () => ["receiveTruths.confirm&purge",
        "\n\tconfirmedCommands:", ...dumpObject(confirmedCommands),
        "\n\tpurgedCommands:", ...dumpObject(purgedCommands),
        "\n\tnewTruths:", ...dumpObject(newTruths)
      ]);
      */
      _purgeAndRecomposeStories(this, newTruths, "receiveTruth", purgedCommands);
      return truths;
    } catch (error) {
      throw this.wrapErrorEvent(error, `receiveTruths([${
              tryAspect(truths[0], "log").index}, ${
              tryAspect(truths[(truths.length || 1) - 1], "log").index}])`,
          "\n\treceived truths:", ...dumpObject(truths),
          "\n\tpendingTruths:", ...dumpObject([...this._pendingTruths]),
          "\n\tunconfirmedCommands:", ...dumpObject([...this._unconfirmedCommands]),
          "\n\tinternal:", ...dumpObject({
            this: this, purgedCommands, confirms, confirmedCommands, newTruthCount, newTruths,
          }),
      );
    }
  }

  receiveCommands (commands: EventBase[]) {
    // This is not called by chronicle, but either by command recall on
    // startup or to update a conflicting command read from another tab.
    let purgedCommands;
    try {
      this.clockEvent(2, () => ["falseProphet.receive.commands",
        `receiveTruths(${commands.length})`]);
      const newCommands = this._insertEventsToQueue(commands, this._unconfirmedCommands, true,
          (command, queueIndex) => {
            purgedCommands = this._unconfirmedCommands.splice(queueIndex);
          });
      _purgeAndRecomposeStories(this, newCommands || [], "receiveCommand", purgedCommands);
      return commands;
    } catch (error) {
      throw this.wrapErrorEvent(error, `receiveCommand([${
              tryAspect(commands[0], "log").index}, ${
              tryAspect(commands[(commands.length || 1) - 1], "log").index}])`,
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
    // const identity = command.meta.identity;
  }

  _checkForFreezeAndNotify (lastEvent: EventBase[] =
      this._unconfirmedCommands[(this._unconfirmedCommands.length || 1) - 1]) {
    this.clockEvent(2, () => ["falseProphet.unconfirmed.notify",
      `_checkForFreezeAndNotify(${this._unconfirmedCommands.length})`]);
    if (lastEvent) this.setIsFrozen(lastEvent.type === "FROZEN");
    this._prophet.setConnectionCommandCount(
        this.getPartitionURI().toString(), this._unconfirmedCommands.length);
  }

  _reviewPurgedProphecy (purged: Prophecy, newProphecy: Prophecy) {
    try {
      return _reviewPurgedProphecy(this, purged, newProphecy);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          new Error(`_reviewPurgedProphecy(${tryAspect(purged, "command").id} -> ${
              tryAspect(newProphecy, "command").id})`),
          "\n\tpurged prophecy:", ...dumpObject(purged),
          "\n\tnew prophecy:", ...dumpObject(newProphecy));
    }
  }

  _reviseSchism (schism: Prophecy, purgedStories: Story[], newEvents: EventBase[]) {
    try {
      return _reviseSchism(this, schism, purgedStories, newEvents);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          new Error(`_reviseSchism(${tryAspect(schism, "command").id})`),
          "\n\tschism:", ...dumpObject(schism),
          "\n\tpurged stories:", ...dumpObject(purgedStories),
          "\n\tnew events:", ...dumpObject(newEvents));
    }
  }
}
