// @flow

import { Command, EventBase } from "~/raem/events";
import { getActionFromPassage, Story } from "~/raem/redux/Bard";

import FabricatorEvent from "~/sourcerer/api/FabricatorEvent";
import TransactionState from "~/sourcerer/FalseProphet/TransactionState";
import { initializeAspects } from "~/sourcerer/tools/EventAspects";
import EVENT_VERSION from "~/sourcerer/tools/EVENT_VERSION";

import { dumpObject } from "~/tools";

import FalseProphet from "./FalseProphet";
import FalseProphetConnection from "./FalseProphetConnection";
import {
  Prophecy, _confirmProphecyPartitionCommand, _reformProphecyCommand, _purgeHeresy,
} from "./_prophecyOps";
import StoryRecital from "./StoryRecital";

/**
 * Dispatches given event to the corpus and get the corresponding
 * story. This event can be a downstream-bound truth, a fresh
 * upstream-bound command, cached command narration or an existing
 * prophecy revision.
 * Returns a story which contains the action itself and the corpus
 * state before and after the action.
 *
 * @param  {type} event     an command to go upstream
 * @returns {type}          description
 */
export function _composeRecitalStoryFromEvent (falseProphet: FalseProphet, event: EventBase,
    dispatchDescription: string, timed: ?EventBase, transactionState?: TransactionState) {
  if (!event.aspects) initializeAspects(event, { version: EVENT_VERSION });
  let story = (transactionState && transactionState._tryFastForwardOnCorpus(falseProphet.corpus));
  if (!story) {
    // If no transaction or transaction is not a fast-forward, do a regular dispatch
    if (transactionState) {
      falseProphet.warnEvent(1, () => [
          `Committing a diverged transaction '${transactionState.name}' normally:`,
          "\n\trestrictedTransacted:", ...dumpObject(event)]);
    }
    story = falseProphet.corpus.dispatch(event, dispatchDescription);
  }
  story.timed = timed;
  if (dispatchDescription.slice(0, 8) === "prophecy") story.isProphecy = true;
  if (dispatchDescription === "receive-truth") story.isTruth = true;
  // story.id = story.aspects.command.id; TODO(iridian): what was this?
  falseProphet._primaryRecital.addStory(story);
  return story;
}

export function _purgeLatestRecitedStory (falseProphet: FalseProphet, heresy: EventBase) {
  const latestStory = falseProphet._primaryRecital.getLast();
  if (latestStory.aspects.command.id !== heresy.aspects.command.id) {
    throw new Error(`_purgeLatestRecitedStory.heresy.aspects.command.id ('${
      heresy.aspects.command.id}') does not equal that of the latest recited story ('${
        latestStory.aspects.command.id}')`);
  }
  falseProphet._primaryRecital.removeStory(latestStory);
  falseProphet.recreateCorpus(latestStory.previousState);
}

export function _confirmRecitalStories (instigatorConnection: FalseProphetConnection,
    confirmations: Command[]) {
  const falseProphet = instigatorConnection.getSourcerer();
  for (const confirmation of confirmations) {
    const story = falseProphet._primaryRecital.getStoryBy(confirmation.aspects.command.id);
    if (story) {
      if (!story.isProphecy) story.isTruth = true;
      else _confirmProphecyPartitionCommand(instigatorConnection, story, confirmation);
    } else {
      instigatorConnection.warnEvent(`_confirmRecitalStories encountered a command '${
            confirmation.aspects.command.id}' with no corresponding story, with:`,
          "\n\tcurrent command:", ...dumpObject(confirmation),
          "\n\tconfirmed commands:", ...dumpObject(confirmations),
          "\n\tprimary recital:", ...dumpObject(falseProphet._primaryRecital));
    }
  }
}

export function _synthesizeRecital (instigatorConnection: FalseProphetConnection,
    newEvents: Command[], type: string, schismaticCommands: ?Command[]) {
  instigatorConnection.clockEvent(2, () => ["falseProphet.recital",
      `_synthesizeRecital(${newEvents.length}, ${type}, ${(schismaticCommands || []).length})`]);
  if (schismaticCommands && schismaticCommands.length) instigatorConnection.setIsFrozen(false);
  const reformation = {
    falseProphet: instigatorConnection.getSourcerer(),
    instigatorConnection, instigatorPartitionURI: instigatorConnection.getPartitionURI(),
    newEventIndex: 0, newRecitalStories: [],
    type, schismaticRecital: undefined, affectedPartitions: undefined,
  };
  newEvents.forEach((event, index) => {
    newEvents[index] = {
      ...event, meta: { ...(event.meta || {}), partitionURI: reformation.instigatorPartitionURI },
    };
  });

  let reviewee;
  if (schismaticCommands) {
    instigatorConnection.clockEvent(2, () => ["falseProphet.recital.reformation",
        `_launchReformation(${newEvents.length}, ${schismaticCommands.length})`]);
    reviewee = _launchReformation(reformation, schismaticCommands);
  }
  instigatorConnection.clockEvent(2, () => ["falseProphet.recital.extend",
      `Composing ${newEvents.length} and reforming ${
        (reformation.schismaticRecital || { size: 0 }).size} events`]);
  let nextSchism;
  while (true) { // eslint-disable-line
    // Alternate between reciting new events and reviewing schismatic
    // stories, always preferring new events unless a new event is part
    // of an existing schismatic story. In that case review, repeat,
    // revise and recite or remove schismatic stories until the schism
    // blocking new events is resolved. Then go back to dispatching new
    // events.
    if (!nextSchism) nextSchism = _extendRecitalUntilNextSchism(reformation, newEvents);

    // check if no reformation (both undefined) or if recital ring end
    // has been reached
    if (reviewee === reformation.schismaticRecital) break;

    if (!reviewee.review) _reviewSeparateStory(reviewee);

    const recomposition = ((reviewee.review || {}).isRevisable !== false)
        && _recomposeSchismaticRecitalStory(reformation.falseProphet, reviewee);
    if (recomposition) {
      if (!reviewee.review || !reviewee.review.isSchismatic) {
        reformation.newRecitalStories.push(recomposition);
      } else {
        const revision = instigatorConnection._reviseRecomposedSchism(reviewee, recomposition);
        if (revision) {
          reformation.newRecitalStories.push(revision);
        } else _purgeLatestRecitedStory(reformation.falseProphet, recomposition);
      }
    }

    if (reviewee === nextSchism) {
      nextSchism = undefined;
      _reformSchismaticProphecy(reformation, reviewee, newEvents[reformation.newEventIndex]);
      ++reformation.newEventIndex;
    }

    if (reviewee.review) {
      // Mark all of the reviewed prophecy's partitions as
      // schismatic/revised depending on whether a schism remains
      // after revision.
      // If schismatic all subsequent commands on these partitions
      // need to be fully, possibly asynchronously, even interactively
      // revised as they're likely to depend on the first schismatic
      // change.
      for (const partitionURI of Object.keys((reviewee.meta || {}).partitions || {})) {
        const affectedPartition = reformation.affectedPartitions[partitionURI]
            || (reformation.affectedPartitions[partitionURI] = {});
        if (!reviewee.review.isSchismatic) continue;
        if (!affectedPartition.isSchismatic) {
          affectedPartition.isSchismatic = true;
          affectedPartition.initialSchism = reviewee;
          affectedPartition.propheciesToReform = [];
        }
        affectedPartition.propheciesToReform.push(reviewee);
      }
    }

    // Remove successfully repeated/reviewed stories from the schismatic recital.
    reviewee = !(reviewee.review || {}).isSchismatic
        ? reformation.schismaticRecital.removeStory(reviewee) // Also advances to next
        : reviewee.next; // Keep it as schismatic, just advance to next
  }

  if (reviewee && _finalizeReformation(reformation, newEvents, schismaticCommands)) {
    reformation.schismaticRecital = undefined;
  }

  instigatorConnection.clockEvent(2, () => ["falseProphet.recital.deliver",
    `_deliverStoriesToFollowers(${reformation.newRecitalStories.length}, ${
      reformation.schismaticRecital ? reformation.schismaticRecital.size : 0})`]);
  reformation.falseProphet._deliverStoriesToFollowers(
      reformation.newRecitalStories, reformation.schismaticRecital);

  _confirmLeadingTruthsToFollowers(reformation.falseProphet);

  instigatorConnection._checkForFreezeAndNotify();
  instigatorConnection.clockEvent(2, "falseProphet.recital.done");
}

function _launchReformation (reformation: Object, schismaticCommands: Command[]): Story {
  let initialSchism;
  const prophet = reformation.falseProphet;
  for (const command of schismaticCommands) {
    const prophecy = prophet._primaryRecital.getStoryBy(command.aspects.command.id);
    if (!prophecy) continue;
    if (!initialSchism) initialSchism = prophecy;
    if (!prophecy.review) {
      prophecy.review = new FabricatorEvent("schism", reformation.instigatorConnection, {
        prophecy, isSchismatic: true, isRevisable: false, isReformable: true,
      });
    }
  }
  if (!initialSchism) return undefined;

  prophet._primaryRecital.extractStoryChain(initialSchism);
  const purgedState = initialSchism.previousState;
  prophet.recreateCorpus(purgedState);
  reformation.schismaticRecital = new StoryRecital(
      initialSchism, `reform-${initialSchism.aspects.command.id}`);
  reformation.affectedPartitions = { [reformation.instigatorPartitionURI]: {} };
  reformation.reformedCommands = [];
  return reformation.schismaticRecital.getFirst();
}

function _extendRecitalUntilNextSchism (reformation, newEvents) {
  for (; reformation.newEventIndex !== newEvents.length; ++reformation.newEventIndex) {
    const newEvent = newEvents[reformation.newEventIndex];
    const nextSchism = reformation.schismaticRecital
        && reformation.schismaticRecital.getStoryBy(newEvent.aspects.command.id);
    if (nextSchism) {
      if (nextSchism.review) nextSchism.review.isRevisable = true;
      return nextSchism;
    }
    reformation.newRecitalStories.push(reformation.falseProphet
        ._composeRecitalStoryFromEvent(newEvent, reformation.type));
  }
  return undefined;
}

function _reviewSeparateStory (reformation, reviewee, nextSchism) { // eslint-disable-line
  if (!reviewee.isProphecy) return undefined; // No review for pre-existing truths needed
  const partitionURIs = !reviewee.meta ? []
      : reviewee.meta.partitions ? Object.keys(reviewee.meta.partitions)
      : reviewee.meta.partitionURI ? [reviewee.meta.partitionURI]
      : [];
  let review;
  for (const partitionURI of partitionURIs) {
    const affectedPartition = reformation.affectedPartitions[partitionURI];
    if (!affectedPartition) continue;
    if (!review) review = reviewee.review = new FabricatorEvent("schism", null);
    if (partitionURI === reformation.instigatorPartitionURI) {
      if (reviewee === nextSchism) continue;
      review.message = `schism created by a prophecy reordering reformation`;
      review.reorderingSchism = nextSchism;
    } else if (affectedPartition.isSchismatic) {
      if (review.type !== "reform") {
        review.type = "reform";
        review.message = `a prophecy partition contains a non-revised earlier schism`;
        review.isSchismatic = true;
        review.isReformable = review.isRevisable;
        review.isRevisable = false;
      }
    } else continue;
    (review.schismaticPartitions || (review.schismaticPartitions = []))
        .push(partitionURI);
  }
  return review;
}

export function _recomposeSchismaticRecitalStory (falseProphet: FalseProphet, story: Prophecy) {
  const event = getActionFromPassage(story);
  const review = story.review;
  // const oldPartitions = reviewedEvent.partitions;
  try {
    const dispatchDescription = !review ? "story-recompose"
        : !review.isSchismatic ? "prophecy-review" : "prophecy-schism-revise";
    const ret = _composeRecitalStoryFromEvent(falseProphet, event, dispatchDescription);
    if (review) review.isSchismatic = false;
    return ret;
  } catch (error) {
    const commandId = story.aspects.command.id;
    const wrappedError = falseProphet.wrapErrorEvent(error, review
            ? new Error(`_recomposeSchismaticRecitalStory.review.dispatch(${commandId
                }) recomposition schism: failed to reduce the purged command against fresh corpus`)
            : new Error(`_recomposeSchismaticRecitalStory.recompose.dispatch(${commandId
                }) INTERNAL ERROR: non-purged event recomposition resulted in an error`),
        "\n\tevent:", ...dumpObject(event),
        "\n\tstory:", ...dumpObject(story));
    if (!review) {
      outputError(wrappedError, "Exception caught during _recomposeSchismaticRecitalStory");
      story.review = new FabricatorEvent("composeerror", null, { prophecy: story });
    }
    story.review.type = "composeerror";
    story.review.message = `a reduction schism found when ${
        !review ? "recomposing" : review.isSchismatic ? "reviewing" : "revising"
      } a story of a purged command; ${error.message}`;
    story.review.isSchismatic = true;
    story.review.isRevisable = true;
    story.review.isReductionSchism = true;
    story.review.error = wrappedError;
  }
  return undefined;
}

function _reformSchismaticProphecy (reformation: Object, schism, schismCausingNewEvent) {
  if (!schism.review || !schism.review.isSchismatic) {
    _reformProphecyCommand(reformation.instigatorConnection, schism, schismCausingNewEvent);
  } else {
    reformation.instigatorConnection.errorEvent(
        `REFORMATION BREACH ERROR: a schismatic prophecy with a new event remains schismatic even${
          ""} after recomposition`,
        "\n\tRecomposing only the new event while rejecting the rest of the original prophecy.",
        "\n\tschism description:", schism.review.message,
        "\n\tschism:", ...dumpObject(schism),
        "\n\tschism review:", ...dumpObject(schism.review),
        "\n\tschism cause event:", ...dumpObject(schismCausingNewEvent));
    schism.review.type = "breach";
    _purgeHeresy(reformation.falseProphet, schism);
    reformation.newRecitalStories.push(reformation.falseProphet
        ._composeRecitalStoryFromEvent(schismCausingNewEvent, `${reformation.type}-breach`));
  }
}

function _finalizeReformation (reformation: Object, newEvents: EventBase[], schismaticCommands) {
  // Schismatic recital is now considered to be heretic recital events.
  // Reform or purge each of the heretic stories.
  const hereticRecital = reformation.schismaticRecital;
  if (!hereticRecital || (hereticRecital.getFirst() === hereticRecital)) return true;
  reformation.instigatorConnection.clockEvent(2, () => ["falseProphet.recital.reform",
    `Reforming ${hereticRecital.size} events from #${reformation.newEventIndex} onward`]);
  const reformedHeresies = [];
  const purgedHeresies = [];
  for (let heresy = hereticRecital.getFirst(); heresy !== hereticRecital;) {
    const reformedHeresyParts = reformation.instigatorConnection
        ._reformHeresy(heresy, newEvents, schismaticCommands);
    if (reformedHeresyParts) {
      reformedHeresies.push(...reformedHeresyParts);
      heresy = hereticRecital.removeStory(heresy);
    } else {
      purgedHeresies.push(heresy);
      heresy = heresy.next;
    }
  }
  if (purgedHeresies.length) {
    purgedHeresies.forEach(purgedHeresy => _purgeHeresy(reformation.falseProphet, purgedHeresy));
    reformation.instigatorConnection.errorEvent(1, () => [
      "\n\nHERESIES PURGED:", purgedHeresies.map(getActionFromPassage),
      "\n\tby reformation:", ...dumpObject(reformation),
      "\n\tof heretic recital:", ...dumpObject(hereticRecital),
      "\n\tnew events:", ...dumpObject(newEvents),
      "\n\tschismatic commands:", ...dumpObject(schismaticCommands),
    ]);
  }
  if (reformedHeresies) reformation.newRecitalStories.push(...reformedHeresies);
  return hereticRecital.getFirst() === hereticRecital;
}

export function _deliverStoriesToFollowers (falseProphet: FalseProphet, stories: Story[],
    purgedRecital: ?StoryRecital) {
  let followerReactions;
  falseProphet.clockEvent(2, () => ["falseProphet.recital.deliver",
    `_deliverStoriesToFollowers(${stories.length}, ${purgedRecital ? purgedRecital.size : 0})`,
  ]);
  falseProphet._followers.forEach((discourse, follower) => {
    let reactions;
    try {
      reactions = discourse.receiveCommands(stories, purgedRecital);
      if (reactions !== undefined) {
        if (!followerReactions) followerReactions = new Map();
        followerReactions.set(follower, reactions);
      }
    } catch (error) {
      falseProphet.outputErrorEvent(falseProphet.wrapErrorEvent(error,
          "_deliverStoriesToFollowers",
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
export function _confirmLeadingTruthsToFollowers (falseProphet: FalseProphet) {
  const truths = [];
  for (let story = falseProphet._primaryRecital.getFirst(); story.isTruth; story = story.next) {
    truths.push(story);
  }
  falseProphet.clockEvent(2, () => ["falseProphet.truths.confirm",
    `_confirmLeadingTruthsToFollowers(${truths.length})`]);
  if (!truths.length) return;
  falseProphet._primaryRecital.extractStoryChain(truths[0], truths[truths.length - 1].next);
  falseProphet._followers.forEach(discourse => {
    try {
      discourse.receiveTruths(truths);
    } catch (error) {
      falseProphet.outputErrorEvent(falseProphet.wrapErrorEvent(error,
          "_confirmLeadingTruthsToFollowers",
          "\n\tstories:", ...dumpObject(truths),
          "\n\ttarget discourse:", ...dumpObject(discourse),
      ));
    }
  });
}
