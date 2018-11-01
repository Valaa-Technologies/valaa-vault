// @flow


import { Story } from "~/raem";
import Command, { Action, EventBase } from "~/raem/command";
import type { State } from "~/raem/tools/denormalized/State";

import Follower from "~/prophet/api/Follower";
import Prophet from "~/prophet/api/Prophet";
import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";

import { dumpObject } from "~/tools";

import FalseProphetDiscourse from "./FalseProphetDiscourse";
import FalseProphetPartitionConnection from "./FalseProphetPartitionConnection";

import { Prophecy, _chronicleEvents } from "./_proclamationOps";
import {
  _createStoryQueue, _dispatchEventForStory, _reciteStoriesToFollowers, _reviewProphecy,
} from "./_prophecyOps";

export class Proclamation extends Action {}

export type ClaimResult = {
  event: EventBase; // Preliminary event after universalization
  story: Story; // Preliminary story before any revisions
  getFinalStory: () => Promise<Story>; // Final story after the chronicling was authorized
  getCommandOf: (partitionURI: string) => Promise<Command>;
  getStoryPremiere: () => Promise<Story>; // Story after follower reaction promises have resolved.
}

/**
 * FalseProphet is non-authoritative denormalized in-memory store of
 * ValOS state representations (corpus) and a two-way proxy to backend
 * event streams.
 *
 * In addition FalseProphet manages an internal prophecy and story
 * queue as a central component of event revisioning and operational
 * transformations. When upstream purges some previously chronicled
 * commands, FalseProphet is responsible for reforming the cache by
 * revisioning all commands that have been reduced to the corpus after
 * the come after the purged commands.
 *
 * Finally, FalseProphet initiates the universalisation process, where
 * commands coming from downstream via .chronicleEvents (whose meaning
 * is well-defined only in current FalseProphet context) get rewritten
 * as universal commands so that their meaning is well-defined for all
 * clients. This process is carried out and more closely documented by
 * @valos/raem/redux/Bard and the reducers contained within the corpus.
 */
export default class FalseProphet extends Prophet {

  static PartitionConnectionType = FalseProphetPartitionConnection;

  _totalCommandCount: number;

  _storyQueue: Story;

  constructor ({ schema, corpus, upstream, commandCountCallback, ...rest }: Object) {
    super(rest);
    this.corpus = corpus;
    this.schema = schema || corpus.getSchema();

    // Story queue is a sentinel-based linked list with a separate lookup structure.
    this._storyQueue = _createStoryQueue();
    this._commandCountCallback = commandCountCallback;
    this._partitionCommandCounts = {};
    this._totalCommandCount = 0;
    if (upstream) this.setUpstream(upstream);
  }

  debugId () { return `${this.constructor.name}(${this.corpus.debugId()})`; }

  getState () { return this.corpus.getState(); }

  recreateCorpus (newState: State) {
    this.corpus.reinitialize(newState);
  }

  _createDiscourse (follower: Follower) {
    return new FalseProphetDiscourse({ prophet: this, follower });
  }

  // Split a command and transmit resulting partition commands towards upstream.
  chronicleEvents (commands: Command[], options:
      { timed: Object, transactionInfo: TransactionInfo } = {}): { eventResults: ClaimResult[] } {
    try {
      return _chronicleEvents(this, commands, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, "chronicleEvents()",
          "\n\toptions:", ...dumpObject(options));
    }
  }
  chronicleEvent (event: EventBase, options: Object = {}) {
    return this.chronicleEvents([event], options).eventResults[0];
  }


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
  _dispatchEventForStory (event: EventBase, dispatchDescription: string, timed: ?EventBase,
      transactionInfo?: TransactionInfo) {
    try {
      return _dispatchEventForStory(this, event, dispatchDescription, timed, transactionInfo);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_dispatchEventForStory(${dispatchDescription})`,
          "\n\tevent:", ...dumpObject(event),
          "\n\ttimed:", ...dumpObject(timed));
    }
  }

  _reviewProphecy (reformation: Object, oldProphecy: Prophecy) {
    try {
      _reviewProphecy(this, reformation, oldProphecy);
    } catch (error) {
      // Hard conflict. The new incoming truth has introduced a
      // low-level conflicting change, such as destroying a resource
      // which some prophecies are later trying to modify.
      oldProphecy.conflictReason = error;
    }
  }

  _reciteStoriesToFollowers (stories: Story[]) {
    try {
      return _reciteStoriesToFollowers(this, stories);
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error(`_reciteStoriesToFollowers()`),
          "\n\tstories:", ...dumpObject(stories));
    }
  }

  // command ops

  setConnectionCommandCount (connectionName: Object, value: number = 1) {
    const previous = this._partitionCommandCounts[connectionName] || 0;
    this._partitionCommandCounts[connectionName] = value;
    this._totalCommandCount += (value - previous);
    if (this._commandCountCallback) {
      this._commandCountCallback(this._totalCommandCount, this._partitionCommandCounts);
    }
  }

  _dumpStatus () {
    return this._storyQueue.dumpStatus();
  }
}
