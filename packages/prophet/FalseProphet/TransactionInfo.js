// @flow

import { getActionFromPassage } from "~/raem";

import { transacted, EventBase } from "~/raem/events";
import type { Corpus } from "~/raem/Corpus";
import { StoryIndexTag, PassageIndexTag } from "~/raem/redux/Bard";

import { ChronicleRequest, ChronicleEventResult } from "~/prophet/api/types";
import Discourse from "~/prophet/api/Discourse";

import { dumpObject } from "~/tools";

let transactionCounter = 0;

export default class TransactionInfo {
  constructor (discourse: Discourse, name: string) {
    this.discourse = discourse;
    this.name = name;
    discourse._parentTransaction = null;
    discourse.setState(this.stateBefore = discourse.getState());
  }

  _lazyInit () {
    this.stateAfter = null;
    // actions is set to null when the transaction has been committed.
    this.actions = [];
    this.passages = [];
    this.transacted = this.discourse._universalizeEvent(transacted({ actions: [] }));
    this.universalPartitions = {};
    this.resultPromises = [];
    const corpus = this.discourse.corpus = Object.create(this.discourse.corpus);
    this.storyIndex = (corpus.getState()[StoryIndexTag] || 0) + 1;
    transactionCounter += 1;
    this.transactionDescription = `tx#${transactionCounter} sub-chronicle`;
    corpus.setName(`${this.discourse.corpus.getName()}/tx#${transactionCounter}:${this.name}`);
    corpus.setState(this.stateBefore);
    return this;
  }

  isActiveTransaction () {
    return !this.transacted || (this._finalCommand === undefined);
  }

  obtainRootEvent () {
    return this.transacted || this._lazyInit().transacted;
  }

  createNestedTransaction (nestingTransaction: Discourse) {
    if (!this.transacted) this._lazyInit();
    let parentTransaction = nestingTransaction;
    while (!parentTransaction.hasOwnProperty("_nonFinalizedTransactions")) {
      parentTransaction = Object.getPrototypeOf(parentTransaction);
    }
    const parentTransactionCount = parentTransaction._nonFinalizedTransactions;
    if (!parentTransactionCount) {
      throw new Error(`Cannot nest a transaction for an already-finalized parent transaction: ${
          parentTransaction._transactionName}`);
    }
    parentTransaction._nonFinalizedTransactions = parentTransactionCount + 1;
    const nestedTransaction = Object.create(nestingTransaction);
    nestedTransaction._parentTransaction = parentTransaction;
    return nestedTransaction;
  }

  isFastForwardFrom (previousState: Object) {
    return this.stateBefore === previousState;
  }

  chronicleEvents (events: EventBase[] /* , options: Object = {} */): ChronicleRequest {
    try {
      if (!this.transacted) this._lazyInit();
      else if (this._finalCommand !== undefined) {
        throw new Error(`Cannot chronicle new events as actions into the transaction '${
            this.discourse.corpus.getName()}' which has already been ${
                this._finalCommand ? "committed" : "aborted"}`);
      }
      // What goes on here is an incremental construction and
      // universalisation of a TRANSACTED event whenever a new event
      // comes in, via dispatching the on-going info.transacted only
      // containing that particular event. Once the transaction is
      // finally committed, the pieces are put together in a complete,
      // universal TRANSACTED. This is an awkward way to incrementally
      // construct the transacted.
      // Maybe javascript generators could somehow be useful here?
      this.transacted.actions = events.map(action => this.discourse._universalizeAction(action));
      const transactionStory = this.discourse.corpus.dispatch(
          this.transacted, this.transactionDescription);
      // Only alter transaction internals after the dispatch has
      // performed the content validations.
      const existingActionCount = this.actions.length;
      this.actions.push(...this.transacted.actions);
      this.transacted.actions = [];
      this.passages.push(...transactionStory.passages);
      Object.assign(this.universalPartitions, (transactionStory.meta || {}).partitions);
      const state = this.discourse.corpus.getState();
      state[StoryIndexTag] = this.storyIndex;
      state[PassageIndexTag] = existingActionCount + events.length;
      this.discourse.setState(state);
      const info = this;
      return {
        eventResults: events.map((event, index) => {
          let result;
          const passage = transactionStory.passages[index];
          return new ChronicleEventResult(event, {
            story: passage,
            getLocalStory () { return this.story; },
            getPremiereStory () {
              if (info._finalCommand !== undefined) return this.story;
              return result || (result = new Promise((succeed, fail) => {
                info.resultPromises[existingActionCount + index] = { succeed, fail };
              }));
            },
          });
        })
      };
    } catch (error) {
      throw this.discourse.wrapErrorEvent(error,
          `chronicleEvents(${this.discourse.corpus.getName()})`,
          "\n\tevents:", ...dumpObject(events),
          "\n\ttransaction:", ...dumpObject(this.discourse),
          "\n\ttransactionState:", ...dumpObject(this),
      );
    }
  }

  commit (): ChronicleEventResult {
    let command;
    try {
      if (this._finalCommand !== undefined) {
        throw new Error(`Cannot commit a transaction '${this.discourse.corpus.getName()
            }' that has already been ${this._finalCommand ? "committed" : "aborted"}`);
      }
      if (!Array.isArray(this.actions) || !this.actions.length) {
        this._finalCommand = this.transacted;
      } else {
        this.stateAfter = this.discourse.getState();
        this.transacted.actions = this.actions;
        // this.discourse.logEvent("committing transaction", this.name,
        //    `with ${this.transacted.actions.length} actions:`, this.transacted);
        command = this._finalCommand = this.transacted;
        if (!this._finalCommand.actions.length) {
          return {
            event: this._finalCommand, story: command, getPremiereStory () { return command; },
          };
        }
        this._commitChronicleResult = this.discourse._prophet.chronicleEvent(
            this._finalCommand, { transactionInfo: this });

        Promise.resolve(this._commitChronicleResult.getPremiereStory()).then(
          // TODO(iridian): Implement returning results. What should they be anyway?
          transactionStoryResult => this.resultPromises.forEach((promise, index) =>
              promise && promise.succeed((transactionStoryResult.actions || [])[index])),
          failure => this.resultPromises.forEach((promise) =>
              promise && promise.fail(failure)),
        );
      }
      return this._commitChronicleResult;
    } catch (error) {
      throw this.discourse.wrapErrorEvent(error,
        `transaction(${this.discourse.corpus.getName()}).commit()`,
          "\n\tcommand:", ...dumpObject(command),
          "\n\ttransaction:", ...dumpObject(this.discourse),
          "\n\ttransactionState:", ...dumpObject(this),
      );
    }
  }

  markAsAborting (/* reason: string = "" */) {
    if (this._finalCommand) {
      throw new Error(`Cannot abort a transaction '${this.discourse.corpus.getName()
          }' which has already been committed`);
    }
    if (this._finalCommand !== undefined) return false;
    if (!this.transacted) this.transacted = true; // prevent lazyInit in order to make tx inactive
    this._finalCommand = false;
    /*
    const messages = [
      "Aborting transaction", this.discourse.corpus.getName(), reason,
      "\n\taborted actions:", ...dumpObject(this.actions),
      "\n\ttransaction state:", ...dumpObject(this),
    ];
    if (Array.isArray(this.actions) && this.actions.length) {
      this.discourse.errorEvent(...messages);
    } else {
      this.discourse.logEvent(...messages);
    }
    */
    return true;
  }

  finalize () {
    if (!this.transacted) this.transacted = true; // prevent lazyInit in order to make tx inactive
    // If the transaction has not yet been explicitly committed or discarded, commit it now.
    if (this._finalCommand === undefined) this.commit();
    return this._commitChronicleResult;
  }

  /**
   * Tries to fast-forward this transaction on top of the given
   * targetCorpus.
   * Returns a story of the transaction if successful, undefined if
   * fast forward was not possible.
   *
   * @param {Corpus} corpus
   * @returns
   *
   * @memberof TransactionInfo
   */
  _tryFastForwardOnCorpus (targetCorpus: Corpus) {
    // this.logEvent(`Committing fast-forward transaction '${transactionInfo.name}'`);
    const previousState = targetCorpus.getState();
    if (!this.isFastForwardFrom(previousState)) return undefined;
    // this.logEvent(`Committed '${transactionInfo.name}'`, story);
    const story = targetCorpus.createStoryFromEvent({
      ...this._finalCommand,
      actions: this.passages.map(passage => getActionFromPassage(passage)),
      meta: {
        ...(this.transacted.meta || {}),
        partitions: this.universalPartitions,
      },
    });
    story.passages = this.passages;
    story.state = this.stateAfter;
    story.state[StoryIndexTag] = story.storyIndex;

    targetCorpus.reinitialize(this.stateAfter);
    return story;
  }
}
