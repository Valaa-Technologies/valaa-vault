// @flow

import type Command, { UniversalEvent } from "~/raem/command";
import { getActionFromPassage } from "~/raem/redux/Bard";

import { ClaimResult } from "~/prophet/api/Prophet";

import { dumpObject, invariantifyString, outputError, thenChainEagerly } from "~/tools";

import FalseProphet from "./FalseProphet";
import {
  _addTruthToPendingProphecies, _removeProphecy, _rejectLastProphecyAsHeresy,
} from "./_prophecyOps";
import { _beginReformation, _finishReformation } from "./_reformationOps";

// Handle a restricted command claim towards upstream.
export function _claim (falseProphet: FalseProphet, restrictedCommand: Command,
    { timed, transactionInfo } = {}): ClaimResult {
  invariantifyString(restrictedCommand.type, "restrictedCommand.type, with restrictedCommand:",
      { restrictedCommand });
  const prophecy = falseProphet._fabricateProphecy(restrictedCommand, "claim", timed,
      transactionInfo);
  // falseProphet.warnEvent("\n\tclaim", restrictedCommand.commandId, restrictedCommand,
  //    ...falseProphet._dumpStatus());
  let getBackendFinalEvent;
  if (!timed) {
    try {
      // TODO(iridian): If the upstream makes changes to the prophecy we won't see them as we
      // discard the .prophecy return value of _upstream.claim.
      const universalCommand = getActionFromPassage(prophecy.story);
      // console.log("universalCommand:", beaumpify(universalCommand));
      getBackendFinalEvent = falseProphet._upstream.claim(universalCommand).getFinalEvent;
    } catch (error) {
      try {
        _rejectLastProphecyAsHeresy(falseProphet, prophecy.story);
      } catch (innerError) {
        outputError(innerError, `Caught an exception in the exception handler of${
            ""} a claim; the resulting purge threw exception of its own:`);
      }
      throw falseProphet.wrapErrorEvent(error, `claim():`,
          "\n\trestrictedCommand:", ...dumpObject(restrictedCommand),
          "\n\tprophecy (purged from corpus):", ...dumpObject(prophecy));
    }
  } else {
    getBackendFinalEvent = () => prophecy && prophecy.story;
  }
  let result;
  const onPostError = (error) => falseProphet.wrapErrorEvent(error, `claim().finalEvent:`,
      "\n\trestrictedCommand:", ...dumpObject(restrictedCommand),
      "\n\tprophecy:", ...dumpObject(prophecy),
      "\n\tresult:", ...dumpObject(result));
  try {
    result = falseProphet._revealProphecyToAllFollowers(prophecy);
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
export function _repeatClaim (falseProphet: FalseProphet, universalCommand: Command) {
  if (falseProphet._prophecyByCommandId[universalCommand.commandId]) return undefined; // dedup
  // falseProphet.warnEvent("\n\trepeatClaim", universalCommand.commandId, universalCommand,
  //    ...falseProphet._dumpStatus());
  const prophecy = falseProphet._fabricateProphecy(universalCommand,
      `re-claim ${universalCommand.commandId.slice(0, 13)}...`);
  falseProphet._revealProphecyToAllFollowers(prophecy);
  return prophecy;
}

// Handle event confirmation coming from upstream, including a possible reformation.
// Sends notifications downstream on the confirmed events.
// Can also send new command claims upstream if old commands get rewritten during reformation.
export function _receiveTruth (falseProphet: FalseProphet, truthEvent: UniversalEvent,
    purgedCommands?: Array<UniversalEvent>) {
  if (!truthEvent) return;
  /*
  falseProphet.warnEvent("\n\tconfirmTruth", truthEvent.commandId, truthEvent,
      ...(purgedCommands ? ["\n\tPURGES:", purgedCommands] : []),
      ...falseProphet._dumpStatus());
  //*/
  const reformation = purgedCommands && _beginReformation(falseProphet, purgedCommands);

  // Even if a reformation is on-going we can outright add the new truth to the queue.
  // The future queue has been removed onwards from the first purged command. This is allowed
  // because no command or pending truth in the removed part of the queue can fundamentally
  // predate the new truth. Commands in the removed queue which belong to same partition(s) as
  // the new truth are those that have just been purged and which by definition become subsequent
  // events (if at all; they can still get rejected). Commands and pending truths which belong
  // to different partitions are temporarily removed from the state, but as per partition
  // semantics they can be reordered to happen later.
  // So add the truth to the end of current pending prophecies.
  _addTruthToPendingProphecies(falseProphet, truthEvent);

  if (reformation) _finishReformation(falseProphet, reformation);

  // Notify followers about the prophecies that have become permanent truths, ie. all prophecies
  // at the front of the pending prophecies list markes as isTruth, and which thus can no longer
  // be affected by any future reformation.
  while (falseProphet._prophecySentinel.next.isTruth) {
    const nextTruth = _removeProphecy(falseProphet, falseProphet._prophecySentinel.next);
    falseProphet._confirmTruthToAllFollowers(nextTruth.story, purgedCommands);
  }
}
