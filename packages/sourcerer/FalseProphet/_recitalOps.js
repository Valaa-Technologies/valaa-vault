// @flow

import { Command, EventBase } from "~/raem/events";
import { getActionFromPassage, Story } from "~/raem/redux/Bard";

import TransactionState from "~/sourcerer/FalseProphet/TransactionState";
import { initializeAspects } from "~/sourcerer/tools/EventAspects";
import EVENT_VERSION from "~/sourcerer/tools/EVENT_VERSION";

import { dumpObject, generateDispatchEventPath } from "~/tools";

import FalseProphet from "./FalseProphet";
import FalseProphetConnection from "./FalseProphetConnection";
import {
  Prophecy, _confirmVenueCommand, _rewriteVenueCommand, _purgeHeresy,
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

  const transactor = event.meta && event.meta.transactor;
  let progress;
  const previousState = falseProphet._corpus.getState();

  let story, dump;
  if (transactionState) {
    story = transactionState._tryFastForwardOnCorpus(falseProphet._corpus);
    if (story) {
      falseProphet.warnEvent(2, () => [
        `Committing a main line transaction '${transactionState.name}' as fast-forwarded event:`,
        "\n\tevent:", ...dumpObject(event),
        ...dumpObject(story),
      ]);
    } else {
      dump = true;
      falseProphet.warnEvent(2, () => [
        `Rebasing a branched transaction '${transactionState.name}' as a regular new event:`,
        "\n\tevent:", ...dumpObject(event),
      ]);
    }
  }
  if (!story) {
    const dispatchPath = generateDispatchEventPath(transactor, "replay");
    if (dispatchPath) {
      progress = event.meta.operation.getProgressEvent("replay");
      if (!transactor.dispatchAndDefaultActEvent(progress, { dispatchPath })) {
        return undefined;
      }
    }
    story = falseProphet._corpus.dispatch(event, dispatchDescription);
  }
  if (dump) {
    falseProphet.warnEvent(1, () => [
      `Rebased a branched transaction '${transactionState.name}' as a regular new event:`,
      "\n\tstory:", ...dumpObject(story),
    ]);
  }
  story.timed = timed;
  if (dispatchDescription.slice(0, 8) === "prophecy") story.isProphecy = true;
  if (dispatchDescription === "receive-truth") story.isTruth = true;
  // story.id = story.aspects.command.id; TODO(iridian): what was this?

  const dispatchPath = generateDispatchEventPath(transactor, "profess");
  if (dispatchPath) {
    if (!progress) progress = event.meta.operation.getProgressEvent();
    progress.type = "profess";
    progress.prophecy = story;
    if (!transactor.dispatchAndDefaultActEvent(progress, { dispatchPath })) {
      falseProphet.recreateCorpus(previousState);
      return undefined;
    }
  }
  falseProphet._primaryRecital.addStory(story);
  return story;
}

export function _purgeLatestRecitedStory (falseProphet: FalseProphet, heresy: EventBase, require) {
  const latestStory = falseProphet._primaryRecital.getLast();
  if (!latestStory
      || (((latestStory.aspects || {}).command || {}).id
          !== ((heresy.aspects || {}).command || {}).id)) {
    if (!require && !falseProphet._primaryRecital.getStoryBy(heresy.aspects.command.id)) {
      return; // Already purged.
    }
    throw new Error(`_purgeLatestRecitedStory.heresy.aspects.command.id ('${
        heresy.aspects.command.id}') prophecy was found in recital but not as the latest story ('${
        latestStory.aspects.command.id}')`);
  }
  const transactor = latestStory.meta.transactor;
  const dispatchPath = generateDispatchEventPath(transactor, "purge");
  if (dispatchPath) {
    transactor.dispatchAndDefaultActEvent(
        latestStory.meta.operation.getProgressEvent("purge"), { dispatchPath });
  }
  falseProphet._primaryRecital.removeStory(latestStory);
  falseProphet.recreateCorpus(latestStory.previousState);
}

export function _confirmRecitalStories (instigatorConnection: FalseProphetConnection,
    confirmations: Command[]) {
  const falseProphet = instigatorConnection.getFalseProphet();
  for (const confirmation of confirmations) {
    const story = falseProphet._primaryRecital.getStoryBy(confirmation.aspects.command.id);
    if (story) {
      if (!story.isProphecy) story.isTruth = true;
      else _confirmVenueCommand(instigatorConnection, story, confirmation);
    } else {
      instigatorConnection.warnEvent(`_confirmRecitalStories encountered a command '${
            confirmation.aspects.command.id}' with no corresponding story, with:`,
          "\n\tcurrent command:", ...dumpObject(confirmation),
          "\n\tconfirmed commands:", ...dumpObject(confirmations),
          "\n\tprimary recital:", ...dumpObject(falseProphet._primaryRecital));
    }
  }
}

export function _refineRecital (instigatorConnection: FalseProphetConnection,
    newEvents: Command[], type: string, schismaticCommands: ?Command[]) {
  instigatorConnection.clockEvent(2, () => ["falseProphet.recital",
      `_refineRecital(${
          instigatorConnection._dumpEventIds(newEvents)}, ${type}, ${
          instigatorConnection._dumpEventIds(schismaticCommands)})`]);
  if (schismaticCommands && schismaticCommands.length) instigatorConnection.setIsFrozen(false);
  const reformation = {
    falseProphet: instigatorConnection.getFalseProphet(),
    instigatorConnection,
    instigatorChronicleURI: instigatorConnection.getChronicleURI(),
    newEventIndex: 0,
    newRecitalStories: [],
    type,
    schismaticRecital: undefined,
    affectedChronicles: undefined,
  };
  newEvents.forEach((event, index) => {
    newEvents[index] = {
      ...event, meta: { ...(event.meta || {}), chronicleURI: reformation.instigatorChronicleURI },
    };
  });

  let reformee;
  if (schismaticCommands) {
    instigatorConnection.clockEvent(2, () => ["falseProphet.recital.reformation",
        `_launchReformation(${newEvents.length}, ${schismaticCommands.length})`]);
    reformee = _launchReformation(reformation, schismaticCommands);
  }
  instigatorConnection.clockEvent(2, () => ["falseProphet.recital.refine",
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
    if (reformee === reformation.schismaticRecital) break;

    let progress = reformee.meta.operation._progress;

    if (!progress) progress = _reviewForeignStory(reformation, reformee, nextSchism);

    const recomposition = (!progress || (progress.isRevisable !== false))
        && _recomposeSchismaticStory(reformation.falseProphet, reformee);
    if (recomposition) {
      progress = recomposition.meta.operation._progress;
      if (!progress || !progress.isSchismatic) {
        reformation.newRecitalStories.push(recomposition);
      } else {
        const revision = instigatorConnection._reviewRecomposedSchism(reformee, recomposition);
        if (revision) {
          reformation.newRecitalStories.push(revision);
        } else {
          _purgeLatestRecitedStory(reformation.falseProphet, recomposition);
        }
      }
    }

    if (reformee === nextSchism) {
      nextSchism = undefined;
      progress = _rewriteSchismaticVenueCommand(
          reformation, reformee, recomposition, newEvents[reformation.newEventIndex]);
      ++reformation.newEventIndex;
    }

    if (progress) {
      // Mark all of the reviewed prophecy's chronicles as
      // schismatic/revised depending on whether a schism remains
      // after revision.
      // If schismatic all subsequent commands on these chronicles
      // need to be fully, possibly asynchronously, even interactively
      // revised as they're likely to depend on the first schismatic
      // change.
      for (const chronicleURI of Object.keys((reformee.meta || {}).chronicles || {})) {
        const affectedChronicle = reformation.affectedChronicles[chronicleURI]
            || (reformation.affectedChronicles[chronicleURI] = {});
        if (!progress.isSchismatic) continue;
        if (!affectedChronicle.isSchismatic) {
          affectedChronicle.isSchismatic = true;
          affectedChronicle.initialSchism = reformee;
          affectedChronicle.propheciesToReform = [];
        }
        affectedChronicle.propheciesToReform.push(reformee);
      }
    }

    // Remove successfully repeated/reviewed stories from the schismatic recital.
    reformee = !progress || !progress.isSchismatic
        ? reformation.schismaticRecital.removeStory(reformee) // Also advances to next
        : reformee.next; // Keep it as schismatic, just advance to next
  }

  if (reformee && _finalizeReformation(reformation, newEvents, schismaticCommands)) {
    reformation.schismaticRecital = undefined;
  }

  reformation.falseProphet
      ._deliverStoriesToFollowers(reformation.newRecitalStories, reformation.schismaticRecital);
  reformation.isComplete = true;

  _confirmLeadingTruthsToFollowers(reformation.falseProphet);

  instigatorConnection._checkForFreezeAndNotify();
  instigatorConnection.clockEvent(2, "falseProphet.recital.refine.done");
}

function _launchReformation (reformation: Object, schismaticCommands: Command[]): Story {
  let initialSchism;
  const prophet = reformation.falseProphet;
  for (const command of schismaticCommands) {
    const prophecy = prophet._primaryRecital.getStoryBy(command.aspects.command.id);
    if (!prophecy) continue;
    if (!initialSchism) initialSchism = prophecy;
    if (!prophecy.meta || !prophecy.meta.operation) continue;
    const progress = prophecy.meta.operation.getProgressEvent("schism");
    progress.schismaticCommand = command;
    if (progress.isSchismatic === undefined) progress.isSchismatic = true;
    // Mark schismatic prophecies as non-revisable but reformably by default to trigger reorder.
    if (progress.isRevisable === undefined) progress.isRevisable = false;
    if (progress.isReformable === undefined) progress.isReformable = true;
    const transactor = prophecy.meta.transactor;
    if (transactor) transactor.dispatchAndDefaultActEvent(progress);
  }
  if (!initialSchism) return undefined;

  prophet._primaryRecital.extractStoryChain(initialSchism);
  const purgedState = initialSchism.previousState;
  prophet.recreateCorpus(purgedState);
  reformation.schismaticRecital = new StoryRecital(
      initialSchism, `reform-${initialSchism.aspects.command.id}`);
  reformation.affectedChronicles = { [reformation.instigatorChronicleURI]: {} };
  reformation.reformedCommands = [];
  return reformation.schismaticRecital.getFirst();
}

function _extendRecitalUntilNextSchism (reformation, newEvents) {
  for (; reformation.newEventIndex !== newEvents.length; ++reformation.newEventIndex) {
    const newEvent = newEvents[reformation.newEventIndex];
    const nextSchism = reformation.schismaticRecital
        && reformation.schismaticRecital.getStoryBy(newEvent.aspects.command.id);
    if (nextSchism) { // This new event revises an existing schism.
      if (nextSchism.meta.operation._progress) {
        nextSchism.meta.operation._progress.isRevisable = true; // Mark schism as reviseable.
      }
      return nextSchism; // Switch to schism review phase.
    }
    const story = _composeRecitalStoryFromEvent(
        reformation.falseProphet, newEvent, reformation.type);
    if (story) reformation.newRecitalStories.push(story);
  }
  return undefined;
}

function _reviewForeignStory (reformation, reformee, nextSchism) { // eslint-disable-line
  const meta = reformee.meta;
  // No progression tracking for pre-existing truths needed
  if (!reformee.isProphecy || !meta) return undefined;
  const chronicleURIs = meta.chronicles ? Object.keys(meta.chronicles)
      : meta.chronicleURI ? [meta.chronicleURI]
      : undefined;
  if (!chronicleURIs) return undefined;
  const progress = meta.operation.getProgressEvent();
  for (const chronicleURI of chronicleURIs) {
    const affectedChronicle = reformation.affectedChronicles[chronicleURI];
    if (!affectedChronicle) continue;
    if (chronicleURI === reformation.instigatorChronicleURI) {
      if (reformee === nextSchism) continue;
      progress.message = `schism created by a prophecy reordering reformation`;
      progress.reorderingSchism = nextSchism;
    } else if (affectedChronicle.isSchismatic) {
      if (progress.type !== "reform") {
        progress.type = "reform";
        progress.message = `a prophecy chronicle contains a non-revised earlier schism`;
        progress.isSchismatic = true;
        progress.isReformable = progress.isRevisable;
        progress.isRevisable = false;
      }
    } else continue;
    (progress.schismaticChronicles || (progress.schismaticChronicles = []))
        .push(chronicleURI);
  }
  return progress;
}

export function _recomposeSchismaticStory (falseProphet: FalseProphet, story: Prophecy) {
  const event = getActionFromPassage(story);
  const transactor = event.meta.transactor;
  const operation = event.meta.operation;
  let progress = operation._progress;
  let recomposedStory;
  const composeDescription = !progress ? "story-recompose"
      : !progress.isSchismatic ? "prophecy-review"
      : "prophecy-schism-revise";
  try {
    recomposedStory = _composeRecitalStoryFromEvent(falseProphet, event, composeDescription);
    if (!recomposedStory) return undefined;
    const dispatchPath = generateDispatchEventPath(transactor, "review");
    if (dispatchPath) {
      progress = operation.getProgressEvent("review");
      progress.prophecy = recomposedStory;
      progress.oldProphecy = story;
      if (!transactor.dispatchAndDefaultActEvent(progress, { dispatchPath })) {
        _purgeLatestRecitedStory(falseProphet, recomposedStory);
        return undefined;
      }
    } else if (progress) {
      progress.isSchismatic = false;
    }
    return recomposedStory;
  } catch (error) {
    const commandId = story.aspects.command.id;
    const wrappedError = falseProphet.wrapErrorEvent(error, 1,
        new Error(`_recomposeSchismaticStory.${composeDescription}.dispatch(${commandId}) ${
          (composeDescription !== "story-recompose")
              ? "recomposition schism: failed to reduce the purged command against fresh corpus"
              : "INTERNAL ERROR: non-purged event recomposition resulted in an error"}
        }`),
        "\n\tevent:", ...dumpObject(event),
        "\n\tstory:", ...dumpObject(story));
    if (recomposedStory) {
      _purgeLatestRecitedStory(falseProphet, recomposedStory, false);
    } else if (progress) {
      progress.type = "reform";
    }
    progress = operation.getErroringProgress(wrappedError, {
      oldProphecy: story, isRevisable: true, isComposeSchism: true, composeDescription,
      message: `a reduction schism found during ${composeDescription
          } of a story of a purged command; ${error.message}`,
    });
    if (transactor && !transactor.dispatchAndDefaultActEvent(progress)) return undefined;
    throw wrappedError;
  }
}

function _rewriteSchismaticVenueCommand (
    reformation: Object, schism, recomposition, schismCausingNewEvent) {
  const progress = schism.meta.operation._progress;
  if (!progress || !progress.isSchismatic) {
    _rewriteVenueCommand(
        reformation.instigatorConnection, schism, schismCausingNewEvent);
    return progress;
  }
  const error = reformation.instigatorConnection.wrapErrorEvent(
      new Error(`REFORMATION BREACH ERROR: a schismatic prophecy with a new truth${
        ""} remains schismatic after recomposition.`),
      1,
      new Error("_rewriteSchismaticVenueCommand"),
      "\n\tRecomposing only the new event while rejecting the rest of the original prophecy.",
      "\n\tschism description:", progress.message,
      "\n\tschism:", ...dumpObject(schism),
      "\n\trecomposition:", ...dumpObject(recomposition),
      "\n\tschism progress:", ...dumpObject(progress),
      "\n\tschism cause event:", ...dumpObject(schismCausingNewEvent),
  );
  Object.assign(progress, {
    error, errorOrigin: "breach",
    isRevisable: false, isReformable: false, isRefabricateable: false,
    message: error.message,
  });
  reformation.instigatorConnection.outputErrorEvent(error,
      "Exception caught during schismatic command rewrite");
  _purgeHeresy(reformation.falseProphet, schism);
  progress.type = "breach";
  reformation.newRecitalStories.push(
      _composeRecitalStoryFromEvent(
          reformation.falseProphet, schismCausingNewEvent, `${reformation.type}-breach`));
  return progress;
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
        ._reformHeresy(heresy, reformation, newEvents, schismaticCommands);
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
      falseProphet.outputErrorEvent(
          falseProphet.wrapErrorEvent(error, 2,
              "_deliverStoriesToFollowers",
              "\n\tstories:", ...dumpObject(stories),
              "\n\treactions:", ...dumpObject(reactions),
              "\n\ttarget discourse:", ...dumpObject(discourse),
          ),
          "Exception caught when delivering stories to follower");
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
      falseProphet.outputErrorEvent(
          falseProphet.wrapErrorEvent(error, 2,
              "_confirmLeadingTruthsToFollowers",
              "\n\tstories:", ...dumpObject(truths),
              "\n\ttarget discourse:", ...dumpObject(discourse),
          ),
          "Exception caught during follower truth confirmation");
    }
  });
}
