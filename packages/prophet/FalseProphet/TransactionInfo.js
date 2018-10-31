// @flow

import { createPassageFromAction, getActionFromPassage } from "~/raem";

import { transacted, EventBase } from "~/raem/command";
import type { Corpus } from "~/raem/Corpus";

import { ClaimResult } from "~/prophet/api/Prophet";
import type { Transaction } from "~/prophet/api/Transaction";

import { dumpObject, invariantify } from "~/tools";

import { universalizeEvent } from "~/prophet/FalseProphet/_proclamationOps";

let transactionCounter = 0;

export default class TransactionInfo {
  constructor (transaction: Transaction, customCommand: Object) {
    this.transaction = transaction;
    this.stateBefore = transaction.getState();
    this.stateAfter = null;
    // actions is set to null when the transaction has been committed.
    this.actions = [];
    this.passages = [];
    this.transacted = transacted({ actions: [] });
    this.universalPartitions = {};
    this.customCommand = customCommand;
    this.resultPromises = [];
    transaction.transactionDepth = 1;
    transaction.corpus = transaction.corpus.fork();
    transactionCounter += 1;
    this.transactionDescription = `tx#${transactionCounter} sub-chronicle`;
    transaction.corpus.setName(
        `${transaction.corpus.getName()}/Transaction#${transactionCounter}`);
  }

  isCommittable () {
    return this.actions;
  }

  isFastForwardFrom (previousState: Object) {
    return this.stateBefore === previousState;
  }

  setCustomCommand (customCommandCandidate: any, context: string) {
    if (typeof customCommandCandidate === "undefined") return;
    invariantify(typeof this.customCommand === "undefined",
        `While ${context} '${this.transaction.corpus.getName()
            }' trying to override an existing customCommand`,
        "\n\tin transactionInfo:", this,
        "\n\toverriding custom command candidate:", customCommandCandidate);
    this.customCommand = customCommandCandidate;
  }

  proclaim (proclamation: Proclamation): ClaimResult {
    try {
      if (!this.proclamations) {
        throw new Error(`Transaction '${this.transaction.corpus.getName()}' has already been ${
                this.finalRestrictedTransactedLike ? "committed" : "aborted"
            }, when trying to add an action to it`);
      }
      // What goes on here is an incremental construction and universalisation of a TRANSACTED
      // proclamation whenever a new proclamation comes in, via dispatching the on-going
      // info.transacted only containing that particular proclamation. Once the transaction is
      // finally committed, the pieces are put together in a complete, universal TRANSACTED.
      const index = this.proclamations.length;
      this.proclamations.push(proclamation);

      const previousState = this.transaction.state;
      // This is an awkward way to incrementally construct the transacted.
      // Maybe generators could somehow be useful here?
      this.latestUniversalTransacted = {
        ...this.transacted,
        actions: [createUniversalizableCommand(proclamation)],
      };
      const story = this.transaction.corpus.dispatch(
          this.latestUniversalTransacted, this.transactionClaimDescription);
      this.storyPassages.push(story.passages[0]);
      Object.assign(this.universalPartitions, story.partitions);

      const state = this.transaction.corpus.getState();
      this.transaction.setState(state);

      this.resultPromises.push(null);
      const result = new Promise((succeed, fail) =>
          (this.resultPromises[index] = { succeed, fail }));
      const prophecy = new Prophecy(story.passages[0], state, previousState);
      prophecy.proclamation = proclamation;
      return { prophecy, getStoryPremiere: () => result };
    } catch (error) {
      throw this.transaction.wrapErrorEvent(error,
          `transaction.proclaim(${this.transaction.corpus.getName()})`,
          "\n\tproclamation:", ...dumpObject(proclamation),
      );
    }
  }

  commit (commitCustomCommand: ?Object): ClaimResult {
    let command;
    try {
      if (!this.actions) {
        throw new Error(`Transaction '${this.transaction.corpus.getName()}' has already been ${
                this._finalCommand ? "committed" : "aborted"
            }, when trying to commit it again`);
      }
      this.setCustomCommand(commitCustomCommand, "committing transaction");
      this.stateAfter = this.transaction.getState();

      this.transacted.actions = this.actions;
      this.actions = null;

      command = this._finalCommand = !this.customCommand
          ? this.transacted
          : this.customCommand(this.transacted);
      if (!this.customCommand && !this._finalCommand.actions.length) {
        const universalNoOpProclamation = createUniversalizableCommand(
            this.finalRestrictedTransactedLike);
        universalNoOpProclamation.partitions = {};
        const prophecy = new Prophecy(universalNoOpProclamation);
        prophecy.proclamation = this.finalRestrictedTransactedLike;
        return { prophecy, getStoryPremiere () { return universalNoOpProclamation; } };
      }
      const result = this.transaction.prophet.chronicleEvent(
          this._finalCommand, { transactionInfo: this });

      Promise.resolve(result.getStoryPremiere()).then(
        // TODO(iridian): Implement returning results. What should they be anyway?
        transactionStoryResult => this.resultPromises.forEach((promise, index) =>
            promise.succeed((transactionStoryResult.actions || [])[index])),
        failure => this.resultPromises.forEach((promise) => promise.fail(failure)),
      );
      this._commitResult = result;
      return result;
    } catch (error) {
      throw this.transaction.wrapErrorEvent(error,
        `transaction(${this.transaction.corpus.getName()}).commit()`,
          "\n\tcommand:", ...dumpObject(command),
      );
    }
  }

  abort () {
    if (!this.actions && this._finalCommand) {
      throw new Error(`Transaction '${this.transaction.corpus.getName()
          }' has already been committed, when trying to abort it`);
    }
    this.actions = null;
  }

  releaseTransaction (releaseCustomCommand: ?Object) {
    this.setCustomCommand(releaseCustomCommand, "releasing transaction");
    // If the transaction has not yet been explicitly committed or discarded, commit it now.
    if (this.isCommittable()) this.commit();
    return this._commitResult;
  }

  _createNestedTransaction (transaction: Transaction, customCommand?: Object) {
    const nestedTransaction = Object.create(transaction);
    nestedTransaction.transactionDepth = transaction.transactionDepth + 1;
    // Custom command alters the final command of the whole transaction.
    this.setCustomCommand(customCommand, "creating new nested transaction");
    nestedTransaction.releaseTransaction = (releaseCustomCommand) => {
      // Nested transactions only set the custom command, only outermost transaction commits.
      this.setCustomCommand(releaseCustomCommand, "releasing nested transaction");
    };
    return nestedTransaction;
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
      ...this.latestUniversalTransacted,
      ...this._finalCommand,
      actions: this.passages.map(passage => getActionFromPassage(passage)),
      partitions: this.universalPartitions,
    };
    const story = createPassageFromAction(universalTransactedLike);
    story.passages = this.passages;
    return story;
  }
}
