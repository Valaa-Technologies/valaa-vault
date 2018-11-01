// @flow

import { Story } from "~/raem";
import { EventBase } from "~/raem/command";

import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";

import { dumpObject, outputError } from "~/tools";

import FalseProphet from "./FalseProphet";
import FalseProphetPartitionConnection from "./FalseProphetPartitionConnection";

export function _createStoryQueue () {
  const ret = {
    id: "sentinel",
    getFirst () { return this.next; },
    getLast () { return this.prev; },
    getStoryBy (commandId: string) { return this._storyByCommandId[commandId]; },
    addStory (story: Story, insertBefore: Story = this) {
      if (story.commandId) {
        this._storyByCommandId[story.commandId] = story;
      } else story.isTruth = true;

      story.next = insertBefore;
      story.prev = insertBefore.prev;
      insertBefore.prev.next = story;
      insertBefore.prev = story;
      return story;
    },
    removeStory (story: Story) {
      story.prev.next = story.next;
      story.next.prev = story.prev;
      delete story.next;
      delete story.prev;
      if (story.commandId) {
        delete this._storyByCommandId[story.commandId];
      }
      return story;
    },
    removeStories (firstStory: Story, lastStory: Story) {
      firstStory.prev.next = lastStory.next;
      lastStory.next.prev = firstStory.prev;
      firstStory.prev = lastStory;
      lastStory.next = null;
      for (let story = firstStory; story; story = story.next) {
        if (story.commandId) {
          delete this._storyByCommandId[story.commandId];
        }
      }
    },
    dumpStatus () {
      const ids = [];
      for (let c = this.next; c !== this; c = c.next) {
        ids.push(c.id);
      }
      return [
        "\n\tpending:", Object.keys(this._storyByCommandId).length,
            { ...this._storyByCommandId },
        "\n\tcommandIds:", ids,
      ];
    },
    _storyByCommandId: {},
  };
  ret.next = ret.prev = ret;
  return ret;
}

export function _dispatchEventForStory (falseProphet: FalseProphet, event: EventBase,
    dispatchDescription: string, timed: ?EventBase, transactionInfo?: TransactionInfo) {
  const previousState = falseProphet.getState();
  let story = (transactionInfo && transactionInfo._tryFastForwardOnCorpus(falseProphet.corpus));
  if (!story) {
    // If no transaction or transaction is not a fast-forward, do a regular dispatch
    if (transactionInfo) {
      falseProphet.logEvent(`Committing a diverged transaction '${transactionInfo.name}' normally:`,
          "\n\trestrictedTransacted:", event);
    }
    story = falseProphet.corpus.dispatch(event, dispatchDescription);
  }
  story.timed = timed;
  story.state = falseProphet.getState();
  story.previousState = previousState;
  // story.id = story.commandId; TODO(iridian): what was this?
  falseProphet._storyQueue.addStory(story);
  return story;
}

export function _purgeAndRevisePartitionCommands (connection: FalseProphetPartitionConnection,
    purgedStories: Story[]) {
  const falseProphet = connection.getProphet();
  const purgedState = purgedStories[0].previousState;
  falseProphet.recreateCorpus(purgedState);
  falseProphet._followers.forEach(discourse =>
      discourse.rejectHeresy(purgedStories[0], purgedState, []));
  return undefined;
}

export function _reciteStoriesToFollowers (falseProphet: FalseProphet, stories: Story[]) {
  let followerReactions;
  falseProphet._followers.forEach((discourse, follower) => {
    const reactions = discourse.receiveCommands(stories);
    if (typeof reactions !== "undefined") {
      if (!followerReactions) followerReactions = new Map();
      followerReactions.set(follower, reactions);
    }
  });
  return stories.map((story, index) => ({
    story,
    getFollowerReactions: !followerReactions ? () => {}
        : (async (filter) => {
          const storyReactions = [];
          for (const [allStoryReactions, follower] of followerReactions.entries()) {
            if (!filter
                || ((typeof filter !== "function") ? filter === follower : filter(follower))) {
              storyReactions.push(...await Promise.all(allStoryReactions[index]));
            }
          }
          return storyReactions;
        }),
  }));
}

export function _rejectLastProphecyAsHeresy (falseProphet: FalseProphet,
    hereticClaim: EventBase) {
  if (falseProphet._storyQueue.getLast().commandId !== hereticClaim.commandId) {
    throw new Error(`rejectLastProphecyAsHeresy.hereticClaim.commandId (${hereticClaim.commandId
        }) does not match latest story.commandId (${
          falseProphet._storyQueue.getLast().commandId})`);
  }
  const hereticProphecy = falseProphet._storyQueue
      .removeStory(falseProphet._storyQueue.getLast());
  falseProphet.recreateCorpus(hereticProphecy.previousState);
}

// Handle event confirmation coming from upstream, including a possible revisioning.
// Sends notifications downstream on the confirmed events.
// Can also send new command claims upstream if old commands get rewritten during revisioning.
export function _confirmProphecy (falseProphet: FalseProphet, truthEvent: EventBase,
  purgedProphecies?: Array<EventBase>) {
  if (!truthEvent) return;
  /*
  falseProphet.warnEvent("\n\tconfirmTruth", truthEvent.commandId, truthEvent,
      ...(purgedProphecies ? ["\n\tPURGES:", purgedProphecies] : []),
      ...falseProphet._dumpStatus());
  //*/
  const revisioning = purgedProphecies && _beginReformation(falseProphet, purgedProphecies);

  // Even if a revisioning is on-going we can outright add the new truth to the queue.
  // The future queue has been removed onwards from the first purged command. This is allowed
  // because no command or pending truth in the removed part of the queue can fundamentally
  // predate the new truth. Commands in the removed queue which belong to same partition(s) as
  // the new truth are those that have just been purged and which by definition become subsequent
  // events (if at all; they can still get rejected). Commands and pending truths which belong
  // to different partitions are temporarily removed from the state, but as per partition
  // semantics they can be reordered to happen later.
  // So add the truth to the end of current pending prophecies.
  _addTruthToPendingProphecies(falseProphet, truthEvent);

  if (revisioning) _finishReformation(falseProphet, revisioning);

  // Notify followers about the prophecies that have become permanent truths, ie. all prophecies
  // at the front of the pending prophecies list markes as isTruth, and which thus can no longer
  // be affected by any future reformation.
  while (falseProphet._prophecySentinel.next.isTruth) {
    const nextTruth = _removeProphecy(falseProphet, falseProphet._prophecySentinel.next);
    falseProphet._confirmTruthToAllFollowers(nextTruth.story, purgedCommands);
  }
}

function _addTruthToPendingProphecies (falseProphet: FalseProphet,
    truthEvent: EventBase) {
  // Add the authorized and notify downstream
  // no truthId means a legacy command.
  const truthId = truthEvent.commandId;
  // TODO(iridian): After migration to zero missing commandId should be at create warnings
  let story = truthId && falseProphet._storyByCommandId[truthId];
  if (!story) {
    if (!truthId) {
      falseProphet.warnEvent("Warning: encountered an authorized event with missing commandId:",
          truthEvent);
    }
    story = falseProphet._dispatchEventForStory(truthEvent,
        `truth ${!truthId ? "legacy" : truthId.slice(0, 13)}...`);
    falseProphet._reciteStoriesToFollowers([story]);
  }
  story.isTruth = true;
}

export function _beginReformation (falseProphet: FalseProphet, purgedCommands) {
  if (!purgedCommands.length) return undefined;
  purgedCommands.forEach(command => {
    falseProphet._prophecyByCommandId[command.commandId].shouldReview = true;
  });
  const reformation = {
    purgedCommands,
    firstPurge: falseProphet._prophecySentinel.next,
  };

  while (!reformation.firstPurge.shouldReview) {
    reformation.firstPurge = reformation.firstPurge.next;
  }
  // Begin reformation.
  // Remove the purged prophecies (and pending truths alike!) from the prophecies list.
  // Retain all lookup entries.
  _removeProphecySequence(falseProphet, reformation.firstPurge,
      falseProphet._prophecySentinel.prev);
  falseProphet.recreateCorpus(reformation.firstPurge.previousState);

  // TODO(iridian): notify followers of the reformation

  return reformation;
}

export function _finishReformation (falseProphet: FalseProphet, reformation:
    { purgedCommands: Array<Object>, firstPurge: Prophecy }) {
  reformation.conflictedPartitions = {};
  for (let oldProphecy = reformation.firstPurge; oldProphecy; oldProphecy = oldProphecy.next) {
    const oldPartitions = oldProphecy.story.partitions;

    if (Object.keys(oldPartitions).find(
        partitionURIString => reformation.conflictedPartitions[partitionURIString])) {
      oldProphecy.conflictReason = "previous prophecy conflicted";
      if (!oldProphecy.shouldReview) {
        falseProphet.errorEvent(
            "TODO: non-purged conflict: this command should be purged from upstream");
      }
    } else if (oldProphecy.shouldReview) {
      falseProphet._reviewProphecy(reformation, oldProphecy);
    } else {
      // Event or command in a partition that's not being purged: don't send to upstream.
      const action = Object.getPrototypeOf(oldProphecy.story);
      if (oldProphecy.isTruth) {
        _addTruthToPendingProphecies(falseProphet, action);
      } else {
        try {
          falseProphet.repeatClaim(action);
        } catch (error) {
          const wrappedError = falseProphet.wrapErrorEvent(
              "_finishReformation on non-purged action",
              "\n\tINTERNAL ERROR: reforming non-purged actions should not cause errors");
          outputError(wrappedError);
          oldProphecy.conflictReason = wrappedError;
        }
      }
    }

    if (oldProphecy.conflictReason) {
    // Mark all partitions of the old prophecy as conflicted. All subsequent commands need to
    // be evaluated as they're likely to depend on the first conflicting change.
      Object.keys(oldPartitions).forEach(partitionURIString => {
        reformation.conflictedPartitions[partitionURIString] = true;
      });
      (reformation.conflictedProphecies || (reformation.conflictedProphecies = []))
          .push(oldProphecy);
    }
  }
}

export function _reviewProphecy (falseProphet: FalseProphet, reformation: Object,
    oldProphecy: Prophecy) {
  let universalisableCommand;
  if (oldProphecy.proclamation) {
    universalisableCommand = createUniversalizableCommand(oldProphecy.proclamation);
  } else {
    throw new Error(`A prophecy under review should always have .proclamation ${
        ""} ie. originate from the local context`);
    // universalisableCommand = { ...Object.getPrototypeOf(oldProphecy.story) };
    // delete universalisableCommand.partitions;
  }
  const reformedProphecy = falseProphet._fabricateProphecy(universalisableCommand, "reform");
  const softConflict = _checkForSoftConflict(falseProphet, oldProphecy, reformedProphecy);
  if (softConflict) {
    oldProphecy.conflictReason = softConflict;
    _rejectLastProphecyAsHeresy(falseProphet, reformedProphecy);
  } else {
    /*
    falseProphet.warnEvent("\n\treview claiming", universalisableCommand.commandId,
        "was", oldCommand.commandId,
        "\n\treformation:", reformation,
        "\n\tnew prophecy:", reformedProphecy,
        "\n\told prophecy:", oldProphecy,
        ...falseProphet._dumpStatus());
    //*/
    const {/* prophecy,*/ getStoryPremiere } =
        falseProphet._upstream.proclaim(universalisableCommand);
    (async () => {
      try {
        await getStoryPremiere();
        /*
        const finalStory = await getStoryPremiere();
        falseProphet.warnEvent("\n\t_reviewProphecy success:",
            "\n\treformation:", reformation, prophecy, finalStory);
        //*/
      } catch (error) {
        outputError(falseProphet.wrapErrorEvent(error,
            "_reviewProphecy:", universalisableCommand.commandId,
            "was", oldProphecy.story.commandId,
            "\n\treformation:", reformation,
            "\n\tnew prophecy:", reformedProphecy,
            "\n\told prophecy:", oldProphecy,
            ...falseProphet._dumpStatus()));
      }
    })();
    falseProphet._revealProphecyToAllFollowers(reformedProphecy);
    return;
  }
}

export function _checkForSoftConflict (/* falseProphet: FalseProphet, oldProphecy: Prophecy,
    reformedProphecy: Prophecy */) {
  // TODO(iridian): Detect and resolve soft conflicts: ie. of the type where the reformed
  // commands modify something that has been modified by the new incoming truth(s), thus
  // overriding such changes. This class of errors does not corrupt the event log, but
  // most likely is a ValaaSpace conflict.
  return undefined;
}

function _removeProphecySequence (falseProphet: FalseProphet, firstProphecy: Prophecy,
    lastProphecy: Prophecy) {
  firstProphecy.prev.next = lastProphecy.next;
  lastProphecy.next.prev = firstProphecy.prev;
  firstProphecy.prev = lastProphecy;
  lastProphecy.next = null;
  for (let prophecy = firstProphecy; prophecy; prophecy = prophecy.next) {
    if (prophecy.story.commandId) {
      delete falseProphet._prophecyByCommandId[prophecy.story.commandId];
    }
  }
}
