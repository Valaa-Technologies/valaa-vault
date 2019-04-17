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
    this._discourse = discourse;
    this.name = name;
    discourse._parentTransaction = null;
    discourse.setState(this._stateBefore = discourse.getState());
  }

  _lazyInit () {
    this._stateAfter = null;
    // actions is set to null when the transaction has been committed.
    this._actions = [];
    this._passages = [];
    this._transacted = this._discourse._universalizeEvent(transacted({ actions: [] }));
    this._universalPartitions = {};
    this._resultPromises = [];
    const corpus = this._discourse.corpus = Object.create(this._discourse.corpus);
    this._storyIndex = corpus.getState()[StoryIndexTag] || 0;
    // if (typeof this._storyIndex !== "number") {
    //   throw new Error("corpus.state[StoryIndexTag] missing");
    // }
    ++this._storyIndex;
    transactionCounter += 1;
    this._transactionDescription = `tx#${transactionCounter} sub-chronicle`;
    corpus.setName(`${this._discourse.corpus.getName()}/tx#${transactionCounter}:${this.name}`);
    corpus.setState(this._stateBefore);
    return this;
  }

  isActiveTransaction () {
    return !this._transacted || (this._finalCommand === undefined);
  }

  obtainRootEvent () {
    return this._transacted || this._lazyInit()._transacted;
  }

  createNestedTransaction (nestingTransaction: Discourse) {
    if (!this._transacted) this._lazyInit();
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
    nestedTransaction._firstActionIndex = this._actions.length;
    return nestedTransaction;
  }

  isFastForwardFrom (previousState: Object) {
    return this._stateBefore === previousState;
  }

  chronicleEvents (events: EventBase[] /* , options: Object = {} */): ChronicleRequest {
    try {
      if (!this._transacted) this._lazyInit();
      else if (this._finalCommand !== undefined) {
        throw new Error(`Cannot chronicle new events as actions into the transaction '${
            this._discourse.corpus.getName()}' which has already been ${
                this._finalCommand ? "committed" : "aborted"}`);
      }
      // What goes on here is an incremental construction and
      // universalisation of a TRANSACTED event whenever a new event
      // comes in, via dispatching the on-going info._transacted only
      // containing that particular event. Once the transaction is
      // finally committed, the pieces are put together in a complete,
      // universal TRANSACTED. This is an awkward way to incrementally
      // construct the transacted.
      // Maybe javascript generators could somehow be useful here?
      this._transacted.actions = events.map(action => this._discourse._universalizeAction(action));
      const transactionStory = this._discourse.corpus.dispatch(
          this._transacted, this._transactionDescription);
      // Only alter transaction internals after the dispatch has
      // performed the content validations.
      const existingActionCount = this._actions.length;
      this._actions.push(...this._transacted.actions);
      this._transacted.actions = [];
      this._passages.push(...transactionStory.passages);
      Object.assign(this._universalPartitions, (transactionStory.meta || {}).partitions);
      const state = this._discourse.corpus.getState();
      state[StoryIndexTag] = this._storyIndex;
      state[PassageIndexTag] = this._actions.length;
      this._discourse.setState(state);
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
                info._resultPromises[existingActionCount + index] = { succeed, fail };
              }));
            },
          });
        })
      };
    } catch (error) {
      throw this._discourse.wrapErrorEvent(error,
          `chronicleEvents(${this._discourse.corpus.getName()})`,
          "\n\tevents:", ...dumpObject(events),
          "\n\ttransaction:", ...dumpObject(this._discourse),
          "\n\ttransactionState:", ...dumpObject(this),
      );
    }
  }

  commit (): ChronicleEventResult {
    let command;
    try {
      if (this._finalCommand !== undefined) {
        throw new Error(`Cannot commit a transaction '${this._discourse.corpus.getName()
            }' that has already been ${this._finalCommand ? "committed" : "aborted"}`);
      }
      if (!Array.isArray(this._actions) || !this._actions.length) {
        this._finalCommand = this._transacted;
      } else {
        this._stateAfter = this._discourse.getState();
        this._transacted.actions = this._actions;
        // this._discourse.logEvent("committing transaction", this.name,
        //    `with ${this._transacted.actions.length} actions:`, this._transacted);
        command = this._finalCommand = this._transacted;
        if (!this._finalCommand.actions.length) {
          return {
            event: this._finalCommand, story: command, getPremiereStory () { return command; },
          };
        }
        this._commitChronicleResult = this._discourse._prophet.chronicleEvent(this._finalCommand, {
          transactionInfo: this, identity: this._discourse._identityManager,
        });

        Promise.resolve(this._commitChronicleResult.getPremiereStory()).then(
          // TODO(iridian): Implement returning results. What should they be anyway?
          transactionStoryResult => this._resultPromises.forEach((promise, index) =>
              promise && promise.succeed((transactionStoryResult.actions || [])[index])),
          failure => this._resultPromises.forEach((promise) =>
              promise && promise.fail(failure)),
        );
      }
      return this._commitChronicleResult;
    } catch (error) {
      throw this._discourse.wrapErrorEvent(error,
        `transaction(${this._discourse.corpus.getName()}).commit()`,
          "\n\tcommand:", ...dumpObject(command),
          "\n\ttransaction:", ...dumpObject(this._discourse),
          "\n\ttransactionState:", ...dumpObject(this),
      );
    }
  }

  rollbackNestedTransaction (nestedTransaction: Discourse /* , reason: any */) {
    if (!this._transacted) return; // Not lazy-inited yet even
    if (this._finalCommand !== undefined) {
      if (!this._finalCommand) return;
      throw new Error(`Cannot rollback a transaction '${this._discourse.corpus.getName()
          }' which has already been committed`);
    }
    const actionsAfterRollback = nestedTransaction._firstActionIndex || 0;
    const initialPassage = this._passages[actionsAfterRollback];
    if (initialPassage === undefined) return;
    const rollbackState = initialPassage.previousState;
    if (!rollbackState) {
      throw new Error("Cannot rollback nested transaction: can't determine initial previousState");
    }
    this._passages.length = actionsAfterRollback;
    this._actions.length = actionsAfterRollback;
    this._discourse.setState(rollbackState);
  }

  markAsAborting (/* reason: string = "" */) {
    if (this._finalCommand !== undefined) {
      if (!this._finalCommand) return false;
      throw new Error(`Cannot abort a transaction '${this._discourse.corpus.getName()
          }' which has already been committed`);
    }
    if (!this._transacted) this._transacted = true; // prevent lazyInit in order to make tx inactive
    this._finalCommand = false;
    /*
    const messages = [
      "Aborting transaction", this._discourse.corpus.getName(), reason,
      "\n\taborted actions:", ...dumpObject(this._actions),
      "\n\ttransaction state:", ...dumpObject(this),
    ];
    if (Array.isArray(this._actions) && this._actions.length) {
      this._discourse.errorEvent(...messages);
    } else {
      this._discourse.logEvent(...messages);
    }
    */
    return true;
  }

  finalize () {
    if (!this._transacted) this._transacted = true; // prevent lazyInit in order to make tx inactive
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
      actions: this._passages.map(passage => getActionFromPassage(passage)),
      meta: {
        ...(this._transacted.meta || {}),
        partitions: this._universalPartitions,
      },
    });
    story.passages = this._passages;
    story.state = this._stateAfter;
    story.state[StoryIndexTag] = story.storyIndex;

    targetCorpus.reinitialize(this._stateAfter);
    return story;
  }
}
