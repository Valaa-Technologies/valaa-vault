import type Command, { Action, UniversalEvent } from "~/raem/command";
import type { State } from "~/raem/tools/denormalized/State";
import { isRestrictedCommand, createUniversalizableCommand, getActionFromPassage }
    from "~/raem/redux/Bard";

import FalseProphetDiscourse from "~/prophet/prophet/FalseProphetDiscourse";
import Follower from "~/prophet/api/Follower";
import Prophecy from "~/prophet/api/Prophecy";
import Prophet, { ClaimResult } from "~/prophet/api/Prophet";

import TransactionInfo from "~/prophet/prophet/TransactionInfo";

import { dumpObject, invariantify, invariantifyObject, invariantifyString, outputError }
    from "~/tools";
import thenChainEagerly from "../../tools/thenChainEagerly";

/**
 * FalseProphet is non-authoritative (cache) in-memory denormalized store as well as a two-way proxy
 * to backend event streams.
 * In addition to the proxy and cache functionality the main localized responsibility of the
 * FalseProphet is to manage the non-authorized Prophecy queues. When upstream purges some
 * previously dispatched command claim, FalseProphet is responsible for reforming the cache by
 * reviewing and reapplying all commands that come after the purged commands. This reapplication
 * can also include the purged commands themselves if the purge was not a discard but a basic
 * resequencing.
 * Finally, FalseProphet initiates the universalisation process, where so-called restricted commands
 * coming from downstream via .claim (whose meaning is well-defined only in current FalseProphet)
 * get rewritten as universal commands, whose meaning is well-defined for all clients.
 * This process is carried out and more closely documented by @valos/raem/redux/Bard and the
 * reducers contained within the FalseProphet.
 */
export default class FalseProphet extends Prophet {
  constructor ({ name, logger, schema, corpus, upstream }: Object) {
    super({ name, logger });
    this.schema = schema;
    this.corpus = corpus;

    // Prophecy queue is a sentinel-based linked list with a separate lookup structure.
    this._prophecySentinel = { id: "sentinel" };
    this._prophecySentinel.next = this._prophecySentinel.prev = this._prophecySentinel;
    this._prophecyByCommandId = {};
    if (upstream) this.setUpstream(upstream);
  }

  setUpstream (upstream) {
    this._upstream = upstream;
    upstream.addFollower(this);
  }

  debugId () { return `${this.constructor.name}(${this.corpus.debugId()})`; }

  getState () { return this.corpus.getState(); }

  _createDiscourse (follower: Follower) {
    return new FalseProphetDiscourse({ follower, prophet: this });
  }

  // Handle a restricted command claim towards upstream.
  claim (restrictedCommand: Command, { timed, transactionInfo } = {}): ClaimResult {
    invariantifyString(restrictedCommand.type, "restrictedCommand.type, with restrictedCommand:",
        { restrictedCommand });
    const prophecy = this._fabricateProphecy(restrictedCommand, "claim", timed, transactionInfo);
    // this.warnEvent("\n\tclaim", restrictedCommand.commandId, restrictedCommand,
    //    ...this._dumpStatus());
    let getBackendFinalEvent;
    if (!timed) {
      try {
        // TODO(iridian): If the upstream makes changes to the prophecy we won't see them as we
        // discard the .prophecy return value of _upstream.claim.
        const universalCommand = getActionFromPassage(prophecy.story);
        // console.log("universalCommand:", beaumpify(universalCommand));
        getBackendFinalEvent = this._upstream.claim(universalCommand).getFinalEvent;
      } catch (error) {
        try {
          this._rejectLastProphecyAsHeresy(prophecy.story);
        } catch (innerError) {
          outputError(innerError, `Caught an exception in the exception handler of${
              ""} a claim; the resulting purge threw exception of its own:`);
        }
        throw this.wrapErrorEvent(error, `claim():`,
            "\n\trestrictedCommand:", ...dumpObject(restrictedCommand),
            "\n\tprophecy (purged from corpus):", ...dumpObject(prophecy));
      }
    } else {
      getBackendFinalEvent = () => prophecy && prophecy.story;
    }
    let result;
    const onPostError = (error) => this.wrapErrorEvent(error, `claim().finalEvent:`,
        "\n\trestrictedCommand:", ...dumpObject(restrictedCommand),
        "\n\tprophecy:", ...dumpObject(prophecy),
        "\n\tresult:", ...dumpObject(result));
    try {
      result = this._revealProphecyToAllFollowers(prophecy);
      result.getBackendFinalEvent = getBackendFinalEvent;
      result.getFinalEvent = () => thenChainEagerly(null, [
        // Returns a promise which will resolve to the content received from the backend
        // but only after all the local follower reactions have been resolved as well
        // TODO(iridian): Exceptions from follower reactions can't reject the claim, so we should
        // catch and handle and/or expose them to the claim originator somehow.
        () => result.getFollowerReactions(),
        // TODO(iridian): Exceptions from upstream signal failure and possible heresy: we should
        // catch and have logic for either retrying the operation or for full rejection.
        // Nevertheless flushing the corpus is needed.
        () => result.getBackendFinalEvent(),
      ], onPostError);
      return result;
    } catch (error) {
      throw onPostError(error);
    }
  }

  // Re-claim commands on application refresh which were cached during earlier executions.
  // The command is already universalized and there's no need to collect handler return values.
  repeatClaim (universalCommand: Command) {
    invariantify(universalCommand.commandId, "repeatClaim.universalCommand.commandId");
    if (this._prophecyByCommandId[universalCommand.commandId]) return undefined; // deduplicates
    // this.warnEvent("\n\trepeatClaim", universalCommand.commandId, universalCommand,
    //    ...this._dumpStatus());
    const prophecy = this._fabricateProphecy(universalCommand,
        `re-claim ${universalCommand.commandId.slice(0, 13)}...`);
    this._revealProphecyToAllFollowers(prophecy);
    return prophecy;
  }

  // Handle event confirmation coming from upstream, including a possible reformation.
  // Sends notifications downstream on the confirmed events.
  // Can also send new command claims upstream if old commands get rewritten during reformation.
  receiveTruth (truthEvent: UniversalEvent, purgedCommands?: Array<UniversalEvent>) {
    if (!truthEvent) return;
    /*
    this.warnEvent("\n\tconfirmTruth", truthEvent.commandId, truthEvent,
        ...(purgedCommands ? ["\n\tPURGES:", purgedCommands] : []),
        ...this._dumpStatus());
    //*/
    const reformation = purgedCommands && this._beginReformation(purgedCommands);

    // Even if a reformation is on-going we can outright add the new truth to the queue.
    // The future queue has been removed onwards from the first purged command. This is allowed
    // because no command or pending truth in the removed part of the queue can fundamentally
    // predate the new truth. Commands in the removed queue which belong to same partition(s) as
    // the new truth are those that have just been purged and which by definition become subsequent
    // events (if at all; they can still get rejected). Commands and pending truths which belong
    // to different partitions are temporarily removed from the state, but as per partition
    // semantics they can be reordered to happen later.
    // So add the truth to the end of current pending prophecies.
    this._addTruthToPendingProphecies(truthEvent);

    if (reformation) this._finishReformation(reformation);

    // Notify followers about the prophecies that have become permanent truths, ie. all prophecies
    // at the front of the pending prophecies list markes as isTruth, and which thus can no longer
    // be affected by any future reformation.
    while (this._prophecySentinel.next.isTruth) {
      const nextTruth = this._removeProphecy(this._prophecySentinel.next);
      this._confirmTruthToAllFollowers(nextTruth.story, purgedCommands);
    }
  }

  _dumpStatus () {
    const ids = [];
    for (let c = this._prophecySentinel.next; c !== this._prophecySentinel; c = c.next) {
      ids.push(c.id);
    }
    return [
      "\n\tpending:", Object.keys(this._prophecyByCommandId).length,
          { ...this._prophecyByCommandId },
      "\n\tcommandIds:", ids,
    ];
  }

  /**
   * Applies given action (which can be restricted upstream command claim, universalized command
   * replay or a downstream event) to the corpus.
   * Returns a Prophecy object which contains the action itself and the corpus state before and
   * after the action.
   *
   * @param  {type} prophecy  an command to go upstream
   * @returns {type}          description
   */
  _fabricateProphecy (action: Action, dispatchDescription: string,
      timed: ?UniversalEvent = undefined, transactionInfo?: TransactionInfo) {
    const restrictedCommand = isRestrictedCommand(action) ? action : undefined;
    try {
      const previousState = this.getState();
      let story = (transactionInfo && transactionInfo.tryFastForwardOnCorpus(this.corpus));
      if (!story) {
        // If no transaction or transaction is not a fast-forward, do a regular dispatch
        if (transactionInfo) {
          this.logEvent(`Committing a diverged transaction '${transactionInfo.name}' normally:`,
              "\n\trestrictedTransacted:", action);
        }
        story = this.corpus.dispatch(restrictedCommand
                ? createUniversalizableCommand(restrictedCommand)
                : action,
            dispatchDescription);
      }
      const prophecy = new Prophecy(
          story, this.getState(), previousState, restrictedCommand, timed);
      prophecy.id = story.commandId;
      this._addProphecy(prophecy);
      return prophecy;
    } catch (error) {
      throw this.wrapErrorEvent(error, `_fabricateProphecy(${dispatchDescription})`,
          "\n\taction:", action,
          "\n\ttimed:", timed);
    }
  }

  _addTruthToPendingProphecies (truthEvent: UniversalEvent) {
    // Add the authorized and notify downstrea
    // no truthId means a legacy command.
    const truthId = truthEvent.commandId;
    // TODO(iridian): After migration to zero missing commandId should be at create warnings
    let prophecy = truthId && this._prophecyByCommandId[truthId];
    if (!prophecy) {
      if (!truthId) {
        this.warnEvent("Warning: encountered an authorized event with missing commandId:",
            truthEvent);
      }
      prophecy = this._fabricateProphecy(truthEvent,
          `event ${!truthId ? "legacy" : truthId.slice(0, 13)}...`);
      this._revealProphecyToAllFollowers(prophecy);
    }
    prophecy.isTruth = true;
  }

  _purgeCommandsWith (hereticEvent: UniversalEvent, purgedCorpusState: State, revisedEvents) {
    this._recreateCorpus(purgedCorpusState);
    this._followers.forEach(discourse =>
        discourse.rejectHeresy(hereticEvent, purgedCorpusState, revisedEvents));
  }

  _revealProphecyToAllFollowers (prophecy: Prophecy) {
    let followerReactions;
    invariantifyObject(prophecy, "_revealProphecyToAllFollowers.prophecy",
        { instanceof: Prophecy, allowNull: false, allowEmpty: false });
    this._followers.forEach((discourse, follower) => {
      const reaction = discourse.revealProphecy(prophecy);
      if (typeof reaction !== "undefined") {
        if (!followerReactions) followerReactions = new Map();
        followerReactions.set(follower, reaction);
      }
    });
    return {
      prophecy,
      getFollowerReactions: !followerReactions
          ? () => {}
          : (async (filter) => {
            for (const [reaction, follower] of followerReactions.entries()) {
              if (!filter
                  || ((typeof filter !== "function") ? filter === follower : filter(follower))) {
                followerReactions.set(follower, await Promise.all(reaction));
              }
            }
            return followerReactions;
          }),
    };
  }

  _recreateCorpus (newState: State) {
    this.corpus.reinitialize(newState);
  }

  _beginReformation (purgedCommands) {
    if (!purgedCommands.length) return undefined;
    purgedCommands.forEach(command => {
      this._prophecyByCommandId[command.commandId].shouldReview = true;
    });
    const reformation = {
      purgedCommands,
      firstPurge: this._prophecySentinel.next,
    };

    while (!reformation.firstPurge.shouldReview) {
      reformation.firstPurge = reformation.firstPurge.next;
    }
    // Begin reformation.
    // Remove the purged prophecies (and pending truths alike!) from the prophecies list.
    // Retain all lookup entries.
    this._removeProphecySequence(reformation.firstPurge, this._prophecySentinel.prev);
    this._recreateCorpus(reformation.firstPurge.previousState);

    // TODO(iridian): notify followers of the reformation

    return reformation;
  }

  _finishReformation (reformation: { purgedCommands: Array<Object>, firstPurge: Prophecy }) {
    reformation.conflictedPartitions = {};
    for (let oldProphecy = reformation.firstPurge; oldProphecy; oldProphecy = oldProphecy.next) {
      const oldPartitions = oldProphecy.story.partitions;

      if (Object.keys(oldPartitions).find(
          partitionRawId => reformation.conflictedPartitions[partitionRawId])) {
        oldProphecy.conflictReason = "previous prophecy conflicted";
        if (!oldProphecy.shouldReview) {
          this.errorEvent("TODO: non-purged conflict: this command should be purged from upstream");
        }
      } else if (oldProphecy.shouldReview) {
        this._reviewProphecy(reformation, oldProphecy);
      } else {
        // Event or command in a partition that's not being purged: don't send to upstream.
        const action = Object.getPrototypeOf(oldProphecy.story);
        if (oldProphecy.isTruth) {
          this._addTruthToPendingProphecies(action);
        } else {
          try {
            this.repeatClaim(action);
          } catch (error) {
            const wrappedError = this.wrapErrorEvent("_finishReformation on non-purged action",
                "\n\tINTERNAL ERROR: reforming non-purged actions should not cause errors");
            outputError(wrappedError);
            oldProphecy.conflictReason = wrappedError;
          }
        }
      }

      if (oldProphecy.conflictReason) {
      // Mark all partitions of the old prophecy as conflicted. All subsequent commands need to
      // be evaluated as they're likely to depend on the first conflicting change.
        Object.keys(oldPartitions).forEach(partitionRawId => {
          reformation.conflictedPartitions[partitionRawId] = true;
        });
        (reformation.conflictedProphecies || (reformation.conflictedProphecies = []))
            .push(oldProphecy);
      }
    }
  }

  _reviewProphecy (reformation: Object, oldProphecy: Prophecy) {
    try {
      let universalisableCommand;
      if (oldProphecy.restrictedCommand) {
        universalisableCommand = createUniversalizableCommand(oldProphecy.restrictedCommand);
      } else {
        throw new Error(`A prophecy under review should always have .restrictedCommand ${
            ""} ie. originate from the local context`);
        // universalisableCommand = { ...Object.getPrototypeOf(oldProphecy.story) };
        // delete universalisableCommand.partitions;
      }
      const reformedProphecy = this._fabricateProphecy(universalisableCommand, "reform");
      const softConflict = this._checkForSoftConflict(oldProphecy, reformedProphecy);
      if (softConflict) {
        oldProphecy.conflictReason = softConflict;
        this._rejectLastProphecyAsHeresy(reformedProphecy);
      } else {
        /*
        this.warnEvent("\n\treview claiming", universalisableCommand.commandId,
            "was", oldCommand.commandId,
            "\n\treformation:", reformation,
            "\n\tnew prophecy:", reformedProphecy,
            "\n\told prophecy:", oldProphecy,
            ...this._dumpStatus());
        //*/
        const {/* prophecy,*/ getFinalEvent } = this._upstream.claim(universalisableCommand);
        (async () => {
          try {
            await getFinalEvent();
            /*
            const finalEvent = await getFinalEvent();
            this.warnEvent("\n\t_reviewProphecy success:",
                "\n\treformation:", reformation, prophecy, finalEvent);
            //*/
          } catch (error) {
            outputError(this.wrapErrorEvent(error,
                "_reviewProphecy:", universalisableCommand.commandId,
                "was", oldProphecy.story.commandId,
                "\n\treformation:", reformation,
                "\n\tnew prophecy:", reformedProphecy,
                "\n\told prophecy:", oldProphecy,
                ...this._dumpStatus()));
          }
        })();
        this._revealProphecyToAllFollowers(reformedProphecy);
        return;
      }
    } catch (error) {
      // Hard conflict. The new incoming truth has introduced a low-level conflicting change,
      // such as destroying a resource which the prophecies modify.
      oldProphecy.conflictReason = error;
    }
  }

  _checkForSoftConflict (/* oldProphecy: Prophecy, reformedProphecy: Prophecy */) {
    // TODO(iridian): Detect and resolve soft conflicts: ie. of the type where the reformed
    // commands modify something that has been modified by the new incoming truth(s), thus
    // overriding such changes. This class of errors does not corrupt the event log, but
    // most likely is a ValaaSpace conflict.
    return undefined;
  }

  _addProphecy (prophecy, before = this._prophecySentinel) {
    if (prophecy.story.commandId) this._prophecyByCommandId[prophecy.story.commandId] = prophecy;
    // Legacy commands and other actions which don't have commandId set will be marked as truths.
    else prophecy.isTruth = true;
    prophecy.next = before;
    prophecy.prev = before.prev;
    before.prev.next = prophecy;
    before.prev = prophecy;
  }

  _removeProphecy (prophecy) {
    prophecy.prev.next = prophecy.next;
    prophecy.next.prev = prophecy.prev;
    delete prophecy.next;
    delete prophecy.prev;
    if (prophecy.story.commandId) delete this._prophecyByCommandId[prophecy.story.commandId];
    return prophecy;
  }

  _rejectLastProphecyAsHeresy (hereticClaim: UniversalEvent) {
    if (this._prophecySentinel.prev.story.commandId !== hereticClaim.commandId) {
      throw new Error(`rejectLastProphecyAsHeresy.hereticClaim.commandId (${hereticClaim.commandId
          }) does not match latest prophecy.commandId (${
          this._prophecySentinel.prev.story.commandId})`);
    }
    const hereticProphecy = this._removeProphecy(this._prophecySentinel.prev);
    this._recreateCorpus(hereticProphecy.previousState);
  }

  _removeProphecySequence (firstProphecy, lastProphecy) {
    firstProphecy.prev.next = lastProphecy.next;
    lastProphecy.next.prev = firstProphecy.prev;
    firstProphecy.prev = lastProphecy;
    lastProphecy.next = null;
    for (let prophecy = firstProphecy; prophecy; prophecy = prophecy.next) {
      if (prophecy.story.commandId) delete this._prophecyByCommandId[prophecy.story.commandId];
    }
  }
}
