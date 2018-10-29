// @flow

import { createPassageFromAction, createUniversalizableCommand, getActionFromPassage }
    from "~/raem/redux/Bard";

import { transacted } from "~/raem/command";
import type { Corpus } from "~/raem/Corpus";

import { ClaimResult } from "~/prophet/api/Prophet";
import Prophecy from "~/prophet/api/Prophecy";
import type { Transaction } from "~/prophet/api/Transaction";
import { Proclamation } from "~/prophet/FalseProphet/FalseProphet";

import { dumpObject, invariantify } from "~/tools";

let transactionCounter = 0;

export default class TransactionInfo {
  constructor (transaction: Transaction, customProclamation: Object) {
    this.transaction = transaction;
    this.stateBefore = transaction.getState();
    this.stateAfter = null;
    // proclamations is set to null when the transaction has been committed.
    this.proclamations = [];
    this.transacted = transacted({ actions: [] });
    this.storyPassages = [];
    this.universalPartitions = {};
    this.customProclamation = customProclamation;
    this.resultPromises = [];
    transaction.transactionDepth = 1;
    transaction.corpus = transaction.corpus.fork();
    transactionCounter += 1;
    this.transactionClaimDescription = `tx#${transactionCounter} sub-proclamation`;
    transaction.corpus.setName(
        `${transaction.corpus.getName()}/Transaction#${transactionCounter}`);
  }

  isCommittable () {
    return this.proclamations;
  }

  isFastForwardFrom (previousState: Object) {
    return this.stateBefore === previousState;
  }

  createNestedTransaction (transaction: Transaction, customProclamation?: Object) {
    const nestedTransaction = Object.create(transaction);
    nestedTransaction.transactionDepth = transaction.transactionDepth + 1;
    // Custom proclamation alters the custom proclamation of the whole transaction.
    this.setCustomProclamation(customProclamation, "creating new nested transaction");
    nestedTransaction.releaseTransaction = (releaseCustomProclamation) => {
      // Nested transactions only set the custom proclamation, only outermost transaction commits.
      this.setCustomProclamation(releaseCustomProclamation, "releasing nested transaction");
    };
    return nestedTransaction;
  }

  setCustomProclamation (customProclamationCandidate: any, context: string) {
    if (typeof customProclamationCandidate === "undefined") return;
    invariantify(typeof this.customProclamation === "undefined",
        `While ${context} '${this.transaction.corpus.getName()
            }' trying to override an existing customProclamation`,
        "\n\tin transactionInfo:", this,
        "\n\toverriding custom proclamation candidate:", customProclamationCandidate);
    this.customProclamation = customProclamationCandidate;
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

  commit (commitCustomProclamation: ?Object): ClaimResult {
    let proclamation;
    try {
      if (!this.proclamations) {
        throw new Error(`Transaction '${this.transaction.corpus.getName()}' has already been ${
                this.finalRestrictedTransactedLike ? "committed" : "aborted"
            }, when trying to commit it again`);
      }
      this.setCustomProclamation(commitCustomProclamation, "committing transaction");
      this.stateAfter = this.transaction.getState();

      this.transacted.actions = this.proclamations;
      this.proclamations = null;

      this.finalRestrictedTransactedLike = !this.customProclamation
          ? this.transacted
          : this.customProclamation(this.transacted);
      if (!this.customProclamation && !this.finalRestrictedTransactedLike.actions.length) {
        const universalNoOpProclamation = createUniversalizableCommand(
            this.finalRestrictedTransactedLike);
        universalNoOpProclamation.partitions = {};
        const prophecy = new Prophecy(universalNoOpProclamation);
        prophecy.proclamation = this.finalRestrictedTransactedLike;
        return { prophecy, getStoryPremiere () { return universalNoOpProclamation; } };
      }
      const result = this.transaction.prophet.proclaim(
          this.finalRestrictedTransactedLike, { transactionInfo: this });

      Promise.resolve(result.getStoryPremiere()).then(
        // TODO(iridian): Implement returning results. What should they be anyway?
        innerResult => this.resultPromises.forEach((promise, index) =>
            promise.succeed(innerResult.actions && innerResult.actions[index])),
        failure => this.resultPromises.forEach((promise) =>
            promise.fail(failure)),
      );
      this.commitResult = result;
      return result;
    } catch (error) {
      throw this.transaction.wrapErrorEvent(error,
        `transaction(${this.transaction.corpus.getName()}).commit()`,
          "\n\tproclamation:", ...dumpObject(proclamation),
      );
    }
  }

  abort () {
    if (!this.proclamations && this.finalRestrictedTransactedLike) {
      throw new Error(`Transaction '${this.transaction.corpus.getName()
          }' has already been committed, when trying to abort it`);
    }
    this.proclamations = null;
  }

  releaseTransaction (releaseCustomProclamation: ?Object) {
    this.setCustomProclamation(releaseCustomProclamation, "releasing transaction");
    // If the transaction has not yet been explicitly committed or discarded, commit it now.
    if (this.isCommittable()) this.commit();
    return this.commitResult;
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
  tryFastForwardOnCorpus (targetCorpus: Corpus) {
    // this.logEvent(`Committing fast-forward transaction '${transactionInfo.name}'`);
    const previousState = targetCorpus.getState();
    if (!this.isFastForwardFrom(previousState)) return undefined;
    targetCorpus.reinitialize(this.stateAfter);
    // this.logEvent(`Committed '${transactionInfo.name}'`, story);

    const universalTransactedLike = {
      ...this.latestUniversalTransacted,
      ...this.finalRestrictedTransactedLike,
      actions: this.storyPassages.map(passage => getActionFromPassage(passage)),
      partitions: this.universalPartitions,
    };
    const story = createPassageFromAction(universalTransactedLike);
    story.passages = this.storyPassages;
    return story;
  }
}
