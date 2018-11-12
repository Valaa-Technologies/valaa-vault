// @flow

import { Command, Story } from "~/raem";
import { EventBase } from "~/raem/command";
import { getActionFromPassage } from "~/raem/redux/Bard";

import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";

import { dumpObject, outputError } from "~/tools";

import FalseProphet from "./FalseProphet";
import FalseProphetPartitionConnection from "./FalseProphetPartitionConnection";
import { Prophecy, _confirmProphecyCommand, _reformProphecyCommand } from "./_prophecyOps";
import StoryRecital from "./StoryRecital";

export function _composeStoryFromEvent (falseProphet: FalseProphet, event: EventBase,
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
  if (dispatchDescription === "chronicleProphecy") story.isProphecy = true;
  if (dispatchDescription === "receiveTruth") story.isTruth = true;
  // story.id = story.commandId; TODO(iridian): what was this?
  falseProphet._primaryRecital.addStory(story);
  // console.log("Added dispatched event:", event, story, { state: story.state.toJS() });
  return story;
}

export function _rejectLastProphecyAsHeresy (falseProphet: FalseProphet, hereticClaim: EventBase) {
  if (falseProphet._primaryRecital.getLast().commandId !== hereticClaim.commandId) {
    throw new Error(`_rejectLastProphecyAsHeresy.hereticClaim.commandId (${hereticClaim.commandId
        }) does not match latest story.commandId (${
          falseProphet._primaryRecital.getLast().commandId})`);
  }
  const hereticProphecy = falseProphet._primaryRecital.getLast();
  falseProphet._primaryRecital.removeStory(hereticProphecy);
  falseProphet.recreateCorpus(hereticProphecy.previousState);
}

export function _confirmCommands (connection: FalseProphetPartitionConnection,
    confirmedCommands: Command[]) {
  const falseProphet = connection.getProphet();
  for (const confirmed of confirmedCommands) {
    const story = falseProphet._primaryRecital.getStoryBy(confirmed.commandId);
    if (story) {
      if (!story.isProphecy) story.isTruth = true;
      else _confirmProphecyCommand(connection, story, confirmed);
    } else {
      connection.warnEvent(`_confirmCommands encountered a command with id '${confirmed.commandId
          }' with no corresponding story, with:`,
          "\n\tconfirmed command:", ...dumpObject(confirmed),
          "\n\tconfirmed commands:", ...dumpObject(confirmedCommands),
          "\n\tprimary recital:", ...dumpObject(falseProphet._primaryRecital));
    }
  }
}

export function _purgeAndRecomposeStories (connection: FalseProphetPartitionConnection,
    purgedCommands: ?Command[], newEvents: Command[], type: string) {
  if (purgedCommands && purgedCommands.length) connection.setIsFrozen(false);
  const falseProphet = connection.getProphet();

  // Purge events.
  const purgedProphecyChain = purgedCommands && _beginPurge(falseProphet, purgedCommands);

  // Dispatch new events.
  // Even if a revisioning is on-going we can outright add new events
  // to the telling. The future tellings has been removed from the
  // first purged story onwards. This is allowed because no command or
  // pending truth in the removed part of the telling can fundamentally
  // predate the new truth. Commands in the purged telling which belong
  // to same partition(s) as the new truth are those that have just
  // been purged and which by definition become subsequent events (if
  // at all; they can still get rejected). Commands and pending truths
  // which belong to different partitions are temporarily removed from
  // the state, but as per partition semantics they are allowed to be
  // reordered to happen later.
  // Add the truth to the end of current pending prophecies.
  const newStories = [];
  if (newEvents) {
    for (const event of newEvents) {
      newStories.push(falseProphet._fabricateStoryFromEvent(event, type));
    }
  }

  // Revise purged events.
  if (purgedProphecyChain) {
    const { refreshedStories, partitions, conflictedTelling } =
        _dispatchAndRevisePurgedStories(connection, purgedProphecyChain);
    newStories.push(...refreshedStories);
  }
  falseProphet._tellStoriesToFollowers(newStories);

  _affirmLeadingTruthsToFollowers(falseProphet);

  connection._checkForFreezeAndNotify();
}

export function _tellStoriesToFollowers (falseProphet: FalseProphet, stories: Story[]) {
  let followerReactions;
  falseProphet._followers.forEach((discourse, follower) => {
    let reactions;
    try {
      reactions = discourse.receiveCommands(stories);
      if (typeof reactions !== "undefined") {
        if (!followerReactions) followerReactions = new Map();
        followerReactions.set(follower, reactions);
      }
    } catch (error) {
      falseProphet.outputErrorEvent(falseProphet.wrapErrorEvent(error,
          "_tellStoriesToFollowers",
          "\n\tstories:", ...dumpObject(stories),
          "\n\treactions:", ...dumpObject(reactions),
          "\n\ttarget discourse:", ...dumpObject(discourse),
      ));
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

// Notify followers about the stories that have been confirmed as
// permanent truths in chronological order, ie. all stories at the
// front of the recital marked as isTruth and which thus can no
// longer be affected by any future purges and revisionings.
function _affirmLeadingTruthsToFollowers (falseProphet: FalseProphet) {
  const truths = [];
  for (let story = falseProphet._primaryRecital.getFirst(); story.isTruth; story = story.next) {
    truths.push(story);
  }
  if (truths.length) {
    falseProphet._primaryRecital.extractStoryChain(truths[0], truths[truths.length - 1].next);
  }
  falseProphet._followers.forEach(discourse => {
    try {
      discourse.receiveTruths(truths);
    } catch (error) {
      falseProphet.outputErrorEvent(falseProphet.wrapErrorEvent(error,
          "_affirmLeadingTruthsToFollowers",
          "\n\tstories:", ...dumpObject(truths),
          "\n\ttarget discourse:", ...dumpObject(discourse),
      ));
    }
  });
}

function _beginPurge (falseProphet: FalseProphet, purgedCommands: Command[]): Story {
  let purgedProphecyChain;
  for (const purgedCommand of purgedCommands) {
    const purged = falseProphet._storyTelling.getStoryBy(purgedCommand.commandId);
    if (!purged) continue;
    if (!purgedProphecyChain) purgedProphecyChain = purged;
    purged.needsRevision = true;
  }
  if (!purgedProphecyChain) return undefined;
  falseProphet._storyTelling.removeStories(purgedProphecyChain, falseProphet._storyTelling.getLast());
  const purgedState = purgedProphecyChain.previousState;
  falseProphet.recreateCorpus(purgedState);
  falseProphet._followers.forEach(discourse =>
      discourse.rejectHeresy(purgedProphecyChain, purgedState, []));
  return purgedProphecyChain;
}

function _dispatchAndRevisePurgedStories (connection: FalseProphetPartitionConnection,
    purgedProphecyChain: Prophecy) {
  const partitions = {};
  const refreshedStories = [];
  const purgedTelling = _createStoryTelling(purgedProphecyChain);
  for (let purged = purgedTelling.getFirst(); purged !== purgedTelling; purged = purged.next) {
    for (const partitionURI of Object.keys(purged.partitions)) {
      const partition = partitions[partitionURI];
      if (partition.isRevised) purged.needsRevision = true;
      if (partition.isConflicted) {
        purged.conflictReason = `prophecy partition(s) are conflicted`;
        (purged.conflictsIn || (purged.conflictsIn = [])).push(partitionURI);
      }
    }

    if (!purged.conflictReason) {
      let newProphecy = _dispatchPurgedEvent(connection.getProphet(), purged);
      if (newProphecy && purged.needsRevision) {
        const revisedProphecy = connection._revisePurgedProphecy(purged, newProphecy);
        if (!revisedProphecy) _rejectLastProphecyAsHeresy(connection.getProphet(), newProphecy);
        newProphecy = revisedProphecy;
      }
      if (newProphecy) refreshedStories.push(newProphecy);
    }

    if (purged.conflictReason || purged.needsRevision) {
      // Mark all partitions of the old prophecy as conflicted/revisioned.
      // If conflicted, all subsequent commands on these partitions
      // need to be fully, possibly interactively revised as they're
      // likely to depend on the first conflicting change.
      for (const partitionURI of Object.keys(purged.partitions)) {
        const partition = partitions[partitionURI] || (partitions[partitionURI] = {});
        partition.isRevised = true;
        if (purged.conflictReason) {
          partition.isConflicted = true;
          (partition.purgedProphecies || (partition.purgedProphecies = [])).push(purged);
        }
      }
    }
    if (!purged.conflictReason) purgedTelling.removeStory(purged);
  }
  return { refreshedStories, partitions, conflictedTelling: purgedTelling };
}

function _dispatchPurgedEvent (falseProphet: FalseProphet, purged: Prophecy) {
  const purgedEvent = getActionFromPassage(purged);
  const isRevision = purged.needsRevision;
  try {
    return _fabricateStoryFromEvent(falseProphet, purgedEvent,
        isRevision ? "revisePurged" : "repeatPurged");
  } catch (error) {
    const wrappedError = falseProphet.wrapErrorEvent(error, isRevision
            ? new Error(`_dispatchAndRevisePurgedStories.revise.dispatch(${purged.commandId
                }) hard conflict: failed to reduce a purged command`)
            : new Error(`_dispatchAndRevisePurgedStories.repeat.dispatch(${purged.commandId
                }) INTERNAL ERROR: non-purged event repeat dispatch shouldn't cause errors`),
        "\n\tpurgedEvent:", ...dumpObject(purgedEvent),
        "\n\tpurgedProphecy:", ...dumpObject(purged));
    outputError(wrappedError);
    purged.conflictReason = wrappedError;
    purged.needsRevision = true;
  }
  return undefined;
}

/*
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
