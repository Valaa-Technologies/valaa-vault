// @flow

import { Command, EventBase } from "~/raem/events";
import { getActionFromPassage, Story } from "~/raem/redux/Bard";

import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";
import { initializeAspects } from "~/prophet/tools/EventAspects";
import EVENT_VERSION from "~/prophet/tools/EVENT_VERSION";

import { dumpObject, outputError } from "~/tools";

import FalseProphet from "./FalseProphet";
import FalseProphetPartitionConnection from "./FalseProphetPartitionConnection";
import { Prophecy, _confirmProphecyCommand, _reformProphecyCommand, _rejectHereticProphecy }
    from "./_prophecyOps";
import StoryRecital from "./StoryRecital";

export function _composeStoryFromEvent (falseProphet: FalseProphet, event: EventBase,
    dispatchDescription: string, timed: ?EventBase, transactionInfo?: TransactionInfo) {
  const previousState = falseProphet.getState();
  if (!event.aspects) initializeAspects(event, { version: EVENT_VERSION });
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
  if (dispatchDescription.slice(0, 8) === "prophecy") story.isProphecy = true;
  if (dispatchDescription === "receiveTruth") story.isTruth = true;
  // story.id = story.aspects.command.id; TODO(iridian): what was this?
  falseProphet._primaryRecital.addStory(story);
  // console.log("Added dispatched event:", event, story, { state: story.state.toJS() });
  return story;
}

export function _rejectLastProphecyAsHeresy (falseProphet: FalseProphet, hereticClaim: EventBase) {
  if (falseProphet._primaryRecital.getLast().aspects.command.id
      !== hereticClaim.aspects.command.id) {
    throw new Error(`_rejectLastProphecyAsHeresy.hereticClaim.aspects.command.id ('${
        hereticClaim.aspects.command.id}') does not that of the latest story ('${
        falseProphet._primaryRecital.getLast().aspects.command.id}')`);
  }
  const hereticProphecy = falseProphet._primaryRecital.getLast();
  falseProphet._primaryRecital.removeStory(hereticProphecy);
  falseProphet.recreateCorpus(hereticProphecy.previousState);
}

export function _confirmCommands (connection: FalseProphetPartitionConnection,
    confirmedCommands: Command[]) {
  const falseProphet = connection.getProphet();
  for (const confirmed of confirmedCommands) {
    const story = falseProphet._primaryRecital.getStoryBy(confirmed.aspects.command.id);
    if (story) {
      if (!story.isProphecy) story.isTruth = true;
      else _confirmProphecyCommand(connection, story, confirmed);
    } else {
      connection.warnEvent(`_confirmCommands encountered a command '${
              confirmed.aspects.command.id}' with no corresponding story, with:`,
          "\n\tcurrent command:", ...dumpObject(confirmed),
          "\n\tconfirmed commands:", ...dumpObject(confirmedCommands),
          "\n\tprimary recital:", ...dumpObject(falseProphet._primaryRecital));
    }
  }
}

export function _purgeAndRecomposeStories (connection: FalseProphetPartitionConnection,
    purgedCommands: ?Command[], newEvents: Command[], type: string) {
  if (purgedCommands && purgedCommands.length) connection.setIsFrozen(false);
  const falseProphet = connection.getProphet();
  const originatingPartitionURI = connection.getPartitionURI();
  const purgedPartitionURI = String(connection.getPartitionURI());
  const newAndRewrittenStories = [];
  let purgedRecital, purgedStory, reviewedPartitions;
  newEvents.forEach((event, index) => {
    newEvents[index] = {
      ...event,
      meta: { ...(event.meta || {}), partitionURI: originatingPartitionURI },
    };
  });

  // Purge events.
  if (purgedCommands) {
    purgedRecital = _beginPurge(falseProphet, purgedCommands);
    purgedStory = purgedRecital && purgedRecital.next;
    reviewedPartitions = { [purgedPartitionURI]: {} };
  }
  let newEventIndex = 0;
  let reformingPurgedProphecy;
  while (true) { // eslint-disable-line
    // Alternate between dispatching new events and purged stories,
    // always preferring new events unless a new event is part of an
    // existing purged story. In that case repeat-dispatch purged
    // stories until that existing story is repeated and then go back
    // to dispatching new events.
    for (; !reformingPurgedProphecy && (newEventIndex !== newEvents.length); ++newEventIndex) {
      const newEvent = newEvents[newEventIndex];
      reformingPurgedProphecy = purgedRecital
          && purgedRecital.getStoryBy(newEvent.aspects.command.id);
      if (!reformingPurgedProphecy) {
        newAndRewrittenStories.push(falseProphet._composeStoryFromEvent(newEvent, type));
      }
    }

    if (purgedStory === purgedRecital) break;

    if (purgedStory.isProphecy) {
      for (const partitionURI of Object.keys((purgedStory.meta || {}).partitions)) {
        const reviewedPartition = reviewedPartitions[partitionURI];
        if (!reviewedPartition) continue;
        purgedStory.needsReview = true;
        if (partitionURI === purgedPartitionURI) {
          if (purgedStory === reformingPurgedProphecy) continue;
          purgedStory.schismDescription = `schism created by a prophecy reordering reformation`;
          purgedStory.reorderingSchism = reformingPurgedProphecy;
        } else if (reviewedPartition.isSchismatic) {
          purgedStory.schismDescription = `a prophecy partition contains an earlier schism`;
          purgedStory.partitionSchism = partitionURI;
        } else continue;
        (purgedStory.schismPartitions || (purgedStory.schismPartitions = [])).push(partitionURI);
      }
    }

    let recomposedStory;
    if (!purgedStory.schismDescription) {
      recomposedStory = _recomposeStoryFromPurgedEvent(connection.getProphet(), purgedStory);
      if (recomposedStory && purgedStory.needsReview) {
        const revisedProphecy = connection._reviewPurgedProphecy(purgedStory, recomposedStory);
        if (!revisedProphecy) _rejectLastProphecyAsHeresy(connection.getProphet(), recomposedStory);
        recomposedStory = revisedProphecy;
      }
      if (recomposedStory) newAndRewrittenStories.push(recomposedStory);
    }

    if (purgedStory === reformingPurgedProphecy) {
      const reformingEvent = newEvents[newEventIndex - 1];
      _reformProphecyCommand(connection, purgedStory, reformingEvent);
      if (purgedStory.schismDescription) {
        connection.errorEvent("REFORMATION ERROR: a purged prophecy was reformed by new event but",
            "is also schismatic as a whole.",
            "\n\tRecomposing only the new event while rejecting the rest of the original prophecy.",
            "\n\tschism description:", purgedStory.schismDescription,
            "\n\tpurged prophecy:", purgedStory,
            "\n\treforming event:", reformingEvent,
            "\n\trecomposed prophecy:", recomposedStory);
        newAndRewrittenStories.push(
            falseProphet._composeStoryFromEvent(reformingEvent, `${type}-reformation-schism`));
      }
      reformingPurgedProphecy = null;
    }

    if (purgedStory.schismDescription || purgedStory.needsReview) {
      // Mark all partitions of the old prophecy as schismatic/revisioned.
      // If schismatic all subsequent commands on these partitions
      // need to be fully, possibly interactively revised as they're
      // likely to depend on the first schismatic change.
      for (const partitionURI of Object.keys((purgedStory.meta || {}).partitions)) {
        const partition = reviewedPartitions[partitionURI]
            || (reviewedPartitions[partitionURI] = {});
        if (purgedStory.schismDescription) {
          partition.isSchismatic = true;
          partition.originalSchism = purgedStory;
          (partition.purgedProphecies || (partition.purgedProphecies = [])).push(purgedStory);
        }
      }
    }

    // Remove successfully repeated/reviewed stories from the purged
    // recital so that only schismatic ones remain.
    purgedStory = !purgedStory.schismDescription
        ? purgedRecital.removeStory(purgedStory) // Also advances to next
        : purgedStory.next; // Keep it, just advance to next
  }

  // Revise purged events.
  if (purgedRecital && (purgedRecital.next !== purgedRecital)) {
    const revisions = falseProphet._reviseSchismaticRecital(
        purgedRecital, reviewedPartitions, connection, purgedCommands, newEvents);
    if (revisions) newAndRewrittenStories.push(...revisions);
  }

  falseProphet._tellStoriesToFollowers(newAndRewrittenStories);

  _affirmLeadingTruthsToFollowers(falseProphet);

  connection._checkForFreezeAndNotify();
}

function _beginPurge (falseProphet: FalseProphet, purgedCommands: Command[]): Story {
  let firstPurgedProphecy;
  for (const purgedCommand of purgedCommands) {
    const purged = falseProphet._primaryRecital.getStoryBy(purgedCommand.aspects.command.id);
    if (!purged) continue;
    if (!firstPurgedProphecy) firstPurgedProphecy = purged;
    purged.needsReview = true;
  }
  if (!firstPurgedProphecy) return undefined;
  falseProphet._primaryRecital.extractStoryChain(firstPurgedProphecy);
  const purgedState = firstPurgedProphecy.previousState;
  falseProphet.recreateCorpus(purgedState);
  falseProphet._followers.forEach(discourse =>
      discourse.rejectHeresy(firstPurgedProphecy, purgedState, []));
  return new StoryRecital(firstPurgedProphecy, `purge-${firstPurgedProphecy.aspects.command.id}`);
}

export function _recomposeStoryFromPurgedEvent (falseProphet: FalseProphet, purged: Prophecy) {
  const purgedEvent = getActionFromPassage(purged);
  // const oldPartitions = purgedEvent.partitions;
  try {
    return _composeStoryFromEvent(falseProphet, purgedEvent,
        !purged.needsReview
            ? "story-repeat"
        : !purged.schismDescription
            ? "prophecy-review"
            : "prophecy-schism-revise");
  } catch (error) {
    const wrappedError = falseProphet.wrapErrorEvent(error, purged.needsReview
            ? new Error(`_recomposeStoryFromPurgedEvent.review.dispatch(${purged.aspects.command.id
                }) structural schism: failed to reduce the purged command against fresh corpus`)
            : new Error(`_recomposeStoryFromPurgedEvent.repeat.dispatch(${purged.aspects.command.id
                }) INTERNAL ERROR: non-purged event repeat dispatch shouldn't cause errors`),
        "\n\tpurgedEvent:", ...dumpObject(purgedEvent),
        "\n\tpurgedProphecy:", ...dumpObject(purged));
    if (!purged.needsReview) {
      outputError(wrappedError, "Exception caught during _recomposeStoryFromPurgedEvent");
      purged.needsReview = true;
    }
    purged.schismDescription = `a structural schism found when ${
        purged.needsReview ? "review" : "repeat"}-recomposing a story from a purged command; ${
            error.message}`;
    purged.structuralSchism = wrappedError;
  }
  return undefined;
}

export function _reviseSchismaticRecital (falseProphet: FalseProphet,
    schismaticRecital: StoryRecital, reviewedPartitions: Object,
    originatingConnection: FalseProphetPartitionConnection, purgedStories: Story[],
    newEvents: EventBase[]) {
  const ret = [];
  const rejectedSchisms = [];
  for (const schism of schismaticRecital) {
    const revisedProphecies = originatingConnection._reviseSchism(schism, purgedStories, newEvents);
    if (revisedProphecies) ret.push(...revisedProphecies);
    else rejectedSchisms.push(schism);
  }
  if (rejectedSchisms.length) {
    rejectedSchisms.forEach(herecy => _rejectHereticProphecy(falseProphet, herecy));
    originatingConnection.errorEvent(1, () => [
      "\n\nSCHISMS REJECTED (ie. conflicting prophecies):",
      "\n\trejected schisms:", ...dumpObject(rejectedSchisms),
      "\n\tof schismatic recital:", ...dumpObject(schismaticRecital),
      "\n\treviewed partitions:", ...dumpObject(reviewedPartitions),
      "\n\toriginating partition:", ...dumpObject(originatingConnection),
      "\n\tpurged stories:", ...dumpObject(purgedStories),
      "\n\tnew events:", ...dumpObject(newEvents),
    ]);
  }
  return ret;
}

export function _tellStoriesToFollowers (falseProphet: FalseProphet, stories: Story[]) {
  let followerReactions;
  falseProphet._followers.forEach((discourse, follower) => {
    let reactions;
    try {
      reactions = discourse.receiveCommands(stories);
      if (reactions !== undefined) {
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
              const reactions = allStoryReactions[index];
              storyReactions.push(...(!reactions ? [] : await Promise.all(reactions)));
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

/*
remoteAuthority = operation.authorities[authorityURIs[0]];
if (falseProphet.getVerbosity() === 1) {
  falseProphet.logEvent(1, `${remoteAuthority
    ? "Queued a remote command locally"
    : "Done claiming a local event"} of authority "${authorityURIs[0]}":`,
    "of partitions:", ...[].concat(...partitionDatas.map(([pdata]) => [conn.getName()])));
} else if (falseProphet.getVerbosity() >= 2) {
  falseProphet.warnEvent(2, () => [
    `Done ${remoteAuthority
        ? "queuing a remote command locally"
        : "claiming a local event"} of authority "${authorityURIs[0]}":`,
    "\n\tpartitions:", ...partitionDatas.map(([, conn]) => conn.getName()),
    "\n\tcommand:", operation.prophecy,
  ]);
}

if (!remoteAuthority) {
  const event = { ...operation.prophecy };
  try {
    partitionDatas.map(([, connection]) =>
        connection._receiveTruthOf("localAuthority", event));
  } catch (error) {
    throw falseProphet.wrapErrorEvent(error, new Error("chronicleEvents.meta.onConfirmTruth"));
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
  falseProphet.logEvent(1, () => [
    `Done claiming remote command of authority`, remoteAuthority,
    "and of partitions:", ...[].concat(...partitionDatas.map(([pdata]) => [conn.getName()])),
  ]);
} else if (falseProphet.getVerbosity() === 2) {
  falseProphet.warnEvent(2, () => [`Done claiming remote command"`, ret]);
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
          connection.getActiveConnection(),
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
