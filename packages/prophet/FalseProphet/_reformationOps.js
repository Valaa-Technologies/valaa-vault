// @flow

import Prophecy from "~/prophet/api/Prophecy";

import { createUniversalizableCommand } from "~/raem/redux/Bard";

import { outputError } from "~/tools";

import FalseProphet from "./FalseProphet";

import { _addTruthToPendingProphecies, _rejectLastProphecyAsHeresy } from "./_prophecyOps";

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
  falseProphet._recreateCorpus(reformation.firstPurge.previousState);

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
  if (oldProphecy.restrictedCommand) {
    universalisableCommand = createUniversalizableCommand(oldProphecy.restrictedCommand);
  } else {
    throw new Error(`A prophecy under review should always have .restrictedCommand ${
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
    const {/* prophecy,*/ getFinalEvent } = falseProphet._upstream.claim(universalisableCommand);
    (async () => {
      try {
        await getFinalEvent();
        /*
        const finalEvent = await getFinalEvent();
        falseProphet.warnEvent("\n\t_reviewProphecy success:",
            "\n\treformation:", reformation, prophecy, finalEvent);
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
