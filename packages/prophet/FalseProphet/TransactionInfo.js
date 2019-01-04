// @flow

import { getActionFromPassage } from "~/raem";

import { transacted, EventBase } from "~/raem/events";
import type { Corpus } from "~/raem/Corpus";

import { ChronicleRequest, ChronicleEventResult } from "~/prophet/api/types";
import type { Transaction } from "~/prophet/api/Transaction";

import { dumpObject, invariantify } from "~/tools";

import { universalizeEvent, universalizeAction } from "./_universalizationOps";

let transactionCounter = 0;

export default class TransactionInfo {
  constructor (transaction: Transaction, name: string) {
    this.transaction = transaction;
    this.name = name;
    transaction._parentTransaction = null;
    transaction.setState(this.stateBefore = transaction.getState());
  }

  _lazyInit () {
    this.stateAfter = null;
    // actions is set to null when the transaction has been committed.
    this.actions = [];
    this.passages = [];
    this.transacted = universalizeEvent(transacted({ actions: [] }));
    this.transaction._prophet._assignCommandId(this.transacted, this.transaction);
    this.universalPartitions = {};
    this.resultPromises = [];
    const corpus = this.transaction.corpus = Object.create(this.transaction.corpus);
    transactionCounter += 1;
    this.transactionDescription = `tx#${transactionCounter} sub-chronicle`;
    corpus.setName(`${this.transaction.corpus.getName()}/tx#${transactionCounter}:${this.name}`);
    corpus.setState(this.stateBefore);
    return this;
  }

  isActiveTransaction () {
    return !this.transacted || this.actions;
  }

  obtainRootEvent () {
    return this.transacted || this._lazyInit().transacted;
  }

  createNestedTransaction (nestingTransaction: Transaction) {
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
      else if (!this.actions) {
        throw new Error(`Cannot chronicle new events against transaction '${
            this.transaction.corpus.getName()}' which has already been ${
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
      this.transacted.actions = events.map(event => universalizeAction(event));

      const previousState = this.transaction.state;
      const transactionStory = this.transaction.corpus.dispatch(
          this.transacted, this.transactionDescription);
      // Only alter transaction internals after the dispatch has
      // performed the content validations.
      this.actions.push(...this.transacted.actions);
      this.transacted.actions = [];
      this.passages.push(...transactionStory.passages);
      Object.assign(this.universalPartitions, (transactionStory.meta || {}).partitions);
      const state = this.transaction.corpus.getState();
      this.transaction.setState(state);
      return {
        eventResults: events.map((event, index) => {
          const result = new Promise(
              (succeed, fail) => this.resultPromises.push({ succeed, fail }));
          this.passages[index].state = state;
          this.passages[index].previousState = previousState;
          return new ChronicleEventResult(event, {
            story: transactionStory.passages[index],
            getPremiereStory: () => result,
          });
        })
      };
    } catch (error) {
      throw this.transaction.wrapErrorEvent(error,
          `chronicleEvents(${this.transaction.corpus.getName()})`,
          "\n\tevents:", ...dumpObject(events),
      );
    }
  }

  commit (): ChronicleEventResult {
    let command;
    try {
      if (!this.actions) {
        throw new Error(`Cannot commit a transaction '${this.transaction.corpus.getName()
            }' that has already been ${this._finalCommand ? "committed" : "aborted"}`);
      }
      this.stateAfter = this.transaction.getState();
      this.transacted.actions = this.actions;
      this.actions = null;
      if (this.transacted.actions.length) {
        // this.transaction.logEvent("committing transaction", this.name,
        //    `with ${this.transacted.actions.length} actions:`, this.transacted);
        command = this._finalCommand = this.transacted;
        if (!this._finalCommand.actions.length) {
          command = universalizeEvent(this._finalCommand);
          (command.meta || (command.meta = {})).partitions = {};
          return {
            event: this._finalCommand, story: command, getPremiereStory () { return command; },
          };
        }
        this._commitChronicleResult = this.transaction._prophet.chronicleEvent(
            this._finalCommand, { transactionInfo: this });

        Promise.resolve(this._commitChronicleResult.getPremiereStory()).then(
          // TODO(iridian): Implement returning results. What should they be anyway?
          transactionStoryResult => this.resultPromises.forEach((promise, index) =>
              promise.succeed((transactionStoryResult.actions || [])[index])),
          failure => this.resultPromises.forEach((promise) => promise.fail(failure)),
        );
      }
      return this._commitChronicleResult;
    } catch (error) {
      throw this.transaction.wrapErrorEvent(error,
        `transaction(${this.transaction.corpus.getName()}).commit()`,
          "\n\tcommand:", ...dumpObject(command),
      );
    }
  }

  markAsAborting () {
    if (!this.transacted) this.transacted = true; // prevent lazyInit in order to make tx inactive
    else if (!this.actions && this._finalCommand) {
      throw new Error(`Cannot abort a transaction '${this.transaction.corpus.getName()
          }' which has already been committed`);
    }
    this.actions = null;
  }

  finalize () {
    if (!this.transacted) this.transacted = true; // prevent lazyInit in order to make tx inactive
    // If the transaction has not yet been explicitly committed or discarded, commit it now.
    if (this.actions) this.commit();
    return this._commitChronicleResult;
  }

  /**
   * Tries to fast-forward this transaction on top of the given targetCorpus.
   * Returns a story of the transaction if successfull, undefined if fast forward was not possible.
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
    targetCorpus.reinitialize(this.stateAfter);
    // this.logEvent(`Committed '${transactionInfo.name}'`, story);

    const universalTransactedLike = {
      ...this.transacted,
      ...this._finalCommand,
      actions: this.passages.map(passage => getActionFromPassage(passage)),
      meta: { partitions: this.universalPartitions },
    };
    const story = targetCorpus.createPassageFromAction(universalTransactedLike);
    story.passages = this.passages;
    return story;
  }
}
