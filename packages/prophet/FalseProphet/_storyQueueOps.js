// @flow

import { Story } from "~/raem";
import { EventBase } from "~/raem/command";

import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";

import { outputError } from "~/tools";

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
        if (story.commandId) delete this._storyByCommandId[story.commandId];
      }
      return firstStory;
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
  if (dispatchDescription === "prophecy") story.isProphecy = true;
  // story.id = story.commandId; TODO(iridian): what was this?
  falseProphet._storyQueue.addStory(story);
  // console.log("Added dispatched event:", event, story, { state: story.state.toJS() });
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
  // be affected by any future revisioning.
  while (falseProphet._storyQueue.getFirst().isTruth) {
    const nextTruth = falseProphet._storyQueue
        .removeStory(falseProphet._storyQueue.getFirst());
    _confirmTruthToAllFollowers(nextTruth, purgedProphecies);
  }
  function _confirmTruthToAllFollowers (confirmedProphecy: Object) {
    (falseProphet._followers || []).forEach(discourse => {
      try {
        discourse.onConfirmProphecy(confirmedProphecy, purgedProphecies);
      } catch (error) {
        falseProphet.outputErrorEvent(falseProphet.wrapErrorEvent(error,
            "_confirmTruthToAllFollowers",
            "\n\ttruthEvent:", confirmedProphecy,
            "\n\tpurgedCommands:", purgedProphecies,
            "\n\ttarget discourse:", discourse,
        ));
      }
    });
  }
}
/*
function _addTruthToPendingProphecies (falseProphet: FalseProphet, truthEvent: EventBase) {
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
*/
export function _beginReformation (falseProphet: FalseProphet, purgedStories) {
  if (!purgedStories.length) return undefined;
  purgedStories.forEach(command => {
    falseProphet._storyByCommandId[command.commandId].shouldReview = true;
  });
  const revisioning = {
    purgedStories,
    firstPurge: falseProphet._storyQueue.getFirst(),
  };

  while (!revisioning.firstPurge.shouldReview) {
    revisioning.firstPurge = revisioning.firstPurge.next;
  }
  // Begin revisioning.
  // Remove the purged prophecies (and pending truths alike!) from the prophecies list.
  // Retain all lookup entries.
  falseProphet._storyQueue
      .removeStories(revisioning.firstPurge, falseProphet._storyQueue.getLast());
  falseProphet.recreateCorpus(revisioning.firstPurge.previousState);

  // TODO(iridian): notify followers of the revisioning

  return revisioning;
}

export function _finishReformation (falseProphet: FalseProphet, revisioning:
    { purgedStories: Array<Story>, firstPurge: Story }) {
  revisioning.conflictedPartitions = {};
  for (let oldStory = revisioning.firstPurge; oldStory; oldStory = oldStory.next) {
    const oldPartitions = oldStory.partitions;

    if (Object.keys(oldPartitions).find(
        partitionURIString => revisioning.conflictedPartitions[partitionURIString])) {
      oldStory.conflictReason = "previous prophecy conflicted";
      if (!oldStory.shouldReview) {
        falseProphet.errorEvent(
            "TODO: non-purged conflict: this command should be purged from upstream");
      }
    } else if (oldStory.shouldReview) {
      falseProphet._reviewProphecy(revisioning, oldStory);
    } else {
      // Event or command in a partition that's not being purged: don't send to upstream.
      const action = Object.getPrototypeOf(oldStory);
      if (oldStory.isTruth) {
        _addTruthToPendingProphecies(falseProphet, action);
      } else {
        try {
          falseProphet.repeatClaim(action);
        } catch (error) {
          const wrappedError = falseProphet.wrapErrorEvent(
              "_finishReformation on non-purged action",
              "\n\tINTERNAL ERROR: reforming non-purged actions should not cause errors");
          outputError(wrappedError);
          oldStory.conflictReason = wrappedError;
        }
      }
    }

    if (oldStory.conflictReason) {
    // Mark all partitions of the old prophecy as conflicted. All subsequent commands need to
    // be evaluated as they're likely to depend on the first conflicting change.
      Object.keys(oldPartitions).forEach(partitionURIString => {
        revisioning.conflictedPartitions[partitionURIString] = true;
      });
      (revisioning.conflictedProphecies || (revisioning.conflictedProphecies = []))
          .push(oldStory);
    }
  }
}

/*
export function _reviewProphecy (falseProphet: FalseProphet, revisioning: Object, oldStory: Story) {
  const revisedProphecy = falseProphet._dispatchEventForStory(oldStory, "reform");
  const softConflict = _checkForSoftConflict(falseProphet, oldStory, revisedProphecy);
  if (softConflict) {
    oldStory.conflictReason = softConflict;
    _rejectLastProphecyAsHeresy(falseProphet, revisedProphecy);
  } else {
    falseProphet.warnEvent("\n\treview claiming", universalisableCommand.commandId,
        "was", oldCommand.commandId,
        "\n\treformation:", revisioning,
        "\n\tnew prophecy:", revisedProphecy,
        "\n\told prophecy:", oldStory,
        ...falseProphet._dumpStatus());
    const { getPremiereStory } = falseProphet._upstream.chronicleEvent(getActionFromPassage(revisedProphecy));
    (async () => {
      try {
        await getPremiereStory();
        const finalStory = await getPremiereStory();
        falseProphet.warnEvent("\n\t_reviewProphecy success:",
            "\n\treformation:", revisioning, prophecy, finalStory);
      } catch (error) {
        outputError(falseProphet.wrapErrorEvent(error,
            new Error(`_reviewProphecy(${oldStory.commandId})`),
            "\n\trevised prophecy:", ...dumpObject(revisedProphecy),
            "\n\tpurged prophecy:", ...dumpObject(oldStory),
            ...falseProphet._dumpStatus()));
      }
    })();
    falseProphet._reciteStoriesToFollowers(revisedProphecy);
    return;
  }
}
*/

export function _checkForSoftConflict (/* falseProphet: FalseProphet, oldStory: Story,
    revisedProphecy: Story */) {
  // TODO(iridian): Detect and resolve soft conflicts: ie. of the type where the reformed
  // commands modify something that has been modified by the new incoming truth(s), thus
  // overriding such changes. This class of errors does not corrupt the event log, but
  // most likely is a ValaaSpace conflict.
  return undefined;
}

/*
while (falseProphet._claimOperationQueue[0] !== operation) {
  if (!falseProphet._claimOperationQueue[0].pendingClaim) {
    falseProphet._claimOperationQueue.shift();
  } else {
    try {
      await falseProphet._claimOperationQueue[0].pendingClaim;
    } catch (error) {
      // Silence errors which arise from other chronicleEvents operations.
    }
  }
}

remoteAuthority = operation.authorities[authorityURIs[0]];
if (falseProphet.getVerbosity() === 1) {
  falseProphet.logEvent(1, `${remoteAuthority
    ? "Queued a remote command locally"
    : "Done claiming a local event"} of authority "${authorityURIs[0]}":`,
    "of partitions:", ...[].concat(
        ...partitionDatas.map(([pdata, conn]) => [conn.getName(), pdata.eventId])));
} else if (falseProphet.getVerbosity() >= 2) {
  falseProphet.warnEvent(2, `Done ${remoteAuthority
          ? "queuing a remote command locally"
          : "claiming a local event"} of authority "${authorityURIs[0]}":`,
      "\n\tpartitions:", ...partitionDatas.map(([, conn]) => conn.getName()),
      "\n\tcommand:", operation.prophecy);
}

if (!remoteAuthority) {
  const event = { ...operation.prophecy };
  try {
    partitionDatas.map(([, connection]) =>
        connection._receiveTruthOf("localAuthority", event));
  } catch (error) {
    throw falseProphet.wrapErrorEvent(error, new Error("chronicleEvents.local.onConfirmTruth"));
  }
  return operation.prophecy;
}
let ret;
try {
  ret = await remoteAuthority.chronicleEvent(operation.prophecy, operation.options)
      .getPremiereStory();
} catch (error) {
  throw falseProphet.wrapErrorEvent(error,
      new Error("chronicleEvents.remoteAuthority.chronicleEvent"));
}
if (falseProphet.getVerbosity() === 1) {
  falseProphet.logEvent(1, `Done claiming remote command of authority`, remoteAuthority,
      "and of partitions:", ...[].concat(
        ...partitionDatas.map(([pdata, conn]) => [conn.getName(), pdata.eventId])));
} else if (falseProphet.getVerbosity() === 2) {
  falseProphet.warnEvent(2, `Done claiming remote command"`, ret);
}
*/

/*
  const authorityURIs = Object.keys(operation.authorities);
  if (!authorityURIs.length) throw new Error("command is missing authority information");
  else if (authorityURIs.length > 1) {
    throw new Error(`Valaa FalseProphet: multi-authority commands not supported, authorities:"${
        authorityURIs.join(`", "`)}"`);
  }

// operation.authorityPersistProcesses = _getOngoingAuthorityPersists(falseProphet, operation);

function _getOngoingAuthorityPersists (falseProphet: FalseProphet, { command }: Object) {
  const ret = [];
  for (const bvobId of Object.keys(command.addedBvobReferences || {})) {
    for (const { referrerId } of command.addedBvobReferences[bvobId]) {
      let connection;
      try {
        const partitionURIString = String(referrerId.getPartitionURI());
        connection = falseProphet._connections[partitionURIString];
        invariantifyObject(connection, `partitionConnections[${partitionURIString}]`);
      } catch (error) {
        throw errorOnGetOngoingAuthorityPersists.call(falseProphet, bvobId, referrerId, error);
      }
      const persistProcess = thenChainEagerly(
          connection.getSyncedConnection(),
          () => {
            const authorityConnection = connection.getUpstreamConnection();
            return authorityConnection && authorityConnection.getContentPersistProcess(bvobId);
          },
          errorOnGetOngoingAuthorityPersists.bind(falseProphet, bvobId, referrerId),
      );
      if (persistProcess) ret.push(persistProcess);
    }
  }
  return ret;
  function errorOnGetOngoingAuthorityPersists (bvobId, referrerId, error) {
    throw falseProphet.wrapErrorEvent(error, new Error("_getOngoingAuthorityPersists"),
            "\n\tcurrent referrerId:", ...dumpObject(referrerId),
            "\n\tcurrent bvobId:", ...dumpObject(bvobId),
            "\n\tret (so far):", ...dumpObject(ret),
            "\n\tcommand:", ...dumpObject(command));
  }
}
*/
