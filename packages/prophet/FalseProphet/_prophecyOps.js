// @flow

import type Command, { Action, UniversalEvent } from "~/raem/command";
import { createUniversalizableCommand } from "~/raem/redux/Bard";

import Prophecy from "~/prophet/api/Prophecy";
import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";

import FalseProphet from "./FalseProphet";

export function _fabricateProphecy (falseProphet: FalseProphet, action: Action,
    dispatchDescription: string, timed: ?UniversalEvent, transactionInfo?: TransactionInfo,
    restrictedCommand: Command) {
  const previousState = falseProphet.getState();
  let story = (transactionInfo && transactionInfo.tryFastForwardOnCorpus(falseProphet.corpus));
  if (!story) {
    // If no transaction or transaction is not a fast-forward, do a regular dispatch
    if (transactionInfo) {
      falseProphet.logEvent(`Committing a diverged transaction '${transactionInfo.name}' normally:`,
          "\n\trestrictedTransacted:", action);
    }
    story = falseProphet.corpus.dispatch(
        !restrictedCommand ? action : createUniversalizableCommand(restrictedCommand),
        dispatchDescription);
  }
  const prophecy = new Prophecy(story, falseProphet.getState(), previousState, restrictedCommand,
      timed);
  prophecy.id = story.commandId;
  _addProphecy(falseProphet, prophecy);
  return prophecy;
}

/*
function _purgeCommandsWith (hereticEvent: UniversalEvent, purgedCorpusState: State,
    revisedEvents: UniversalEvent[]) {
  falseProphet.recreateCorpus(purgedCorpusState);
  falseProphet._followers.forEach(discourse =>
      discourse.rejectHeresy(hereticEvent, purgedCorpusState, revisedEvents));
}
*/

export function _revealProphecyToAllFollowers (falseProphet: FalseProphet, prophecy: Prophecy) {
  let followerReactions;
  falseProphet._followers.forEach((discourse, follower) => {
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

export function _rejectLastProphecyAsHeresy (falseProphet: FalseProphet,
    hereticClaim: UniversalEvent) {
  if (falseProphet._prophecySentinel.prev.story.commandId !== hereticClaim.commandId) {
    throw new Error(`rejectLastProphecyAsHeresy.hereticClaim.commandId (${hereticClaim.commandId
        }) does not match latest prophecy.commandId (${
          falseProphet._prophecySentinel.prev.story.commandId})`);
  }
  const hereticProphecy = _removeProphecy(falseProphet, falseProphet._prophecySentinel.prev);
  falseProphet.recreateCorpus(hereticProphecy.previousState);
}

function _addProphecy (falseProphet: FalseProphet, prophecy: Prophecy,
    before = falseProphet._prophecySentinel) {
  if (prophecy.story.commandId) {
    falseProphet._prophecyByCommandId[prophecy.story.commandId] = prophecy;
    // Legacy commands and other actions which don't have commandId set will be marked as truths.
  } else prophecy.isTruth = true;

  prophecy.next = before;
  prophecy.prev = before.prev;
  before.prev.next = prophecy;
  before.prev = prophecy;
}

export function _removeProphecy (falseProphet: FalseProphet, prophecy) {
  prophecy.prev.next = prophecy.next;
  prophecy.next.prev = prophecy.prev;
  delete prophecy.next;
  delete prophecy.prev;
  if (prophecy.story.commandId) delete falseProphet._prophecyByCommandId[prophecy.story.commandId];
  return prophecy;
}
