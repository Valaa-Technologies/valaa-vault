// @flow

import { getActionFromPassage } from "~/raem";

import { transacted, EventBase } from "~/raem/events";
import type { Corpus } from "~/raem/Corpus";
import { StoryIndexTag, PassageIndexTag } from "~/raem/redux/Bard";

import { ChronicleRequest, ChronicleEventResult } from "~/sourcerer/api/types";
import Fabricator, { fabricatorEventTypes, fabricatorMixinOps }
    from "~/sourcerer/api/Fabricator";
import type Transactor from "~/sourcerer/api/Transactor";
import type FalseProphetDiscourse from "~/sourcerer/FalseProphet/FalseProphetDiscourse";

import { _universalizeAction } from "./_universalizationOps";

import { dumpObject } from "~/tools";

let transactionCounter = 0;
let activeTransactionCounter = 0;

export const fabricatorOps = {
  ...fabricatorMixinOps,

  isActiveFabricator () {
    return this._finalizedFabricatorCount < this._fabricatorCount;
  },

  /**
   * Returns a new valid transaction discourse which wraps this
   * Discourse as prototype and forks its corpus. The returned
   * discourse thus inherits all of false prophet discourse API, but
   * in addition all chroniclings are intercepted in an internal
   * transaction event log.
   * These events are resolved immediately against the forked corpus,
   * but only claimed forward as commands once the transaction is
   * committed. This happens when the transaction discourse is released
   * usind releaseFabricator.
   *
   * Transactors can be nested by calling acquireFabricator
   * again on an existing transaction discourse. The main transaction
   * is committed only when all nested transactions have been released.
   */
  acquireFabricator (name: string): FalseProphetDiscourse & Fabricator {
    let ret;
    if (!this._transaction) {
      ret = Object.create(this);
      ret._fabricatorName = `#${++transactionCounter}:${name}`;
      ret._transaction = new TransactionState(ret, ret._fabricatorName);
      this.logEvent(2, () => [
        "\nBEGUN TRANSACTION", ret._fabricatorName, ":",
        ...dumpObject({ fabricator: ret, transaction: ret._transaction }),
      ]);
    } else {
      const fabricatorName = `${this._fabricatorName}/#${this._fabricatorCount}:${name}`;
      ret = this._transaction.createFabricator(this, name);
      ret._fabricatorName  = fabricatorName;
      this.logEvent(2, () => [
        "  ===>>>>   acquired fabricator", ret._fabricatorName, ":",
        ...dumpObject({ fabricator: ret, transaction: ret._transaction }),
      ]);
    }
    ret._fabricatorCount = 1;
    ret._finalizedFabricatorCount = 0;
    return ret;
  },

  releaseFabricator (options: ?{ abort: any, rollback: any }) {
    const transaction = this._transaction;
    if (!transaction) {
      throw new Error("Invalid call to releaseFabricator from outside Fabricator");
    }
    this.logEvent(2, () => [
      (options || {}).abort ? "  <<<<====   ABORTING"
          : (options || {}).rollback ? "  <<<<====   rolling back"
          : (this._finalizedFabricatorCount + 1 < this._fabricatorCount) ? "releasing on"
          : "  <<<<====  finalizing",
      this._parentFabricator ? "fabricator" : "TRANSACTION", this._fabricatorName, ":",
      ...dumpObject({ fabricator: this, transaction, options }),
    ]);
    if (options) {
      if (options.abort) {
        transaction.markAsAborting(options.abort.message || options.abort);
      } else if (options.rollback) {
        transaction.rollbackFabricator(this,
            options.rollback.message || options.rollback);
      }
    }
    if (++this._finalizedFabricatorCount < this._fabricatorCount) return false;
    if (this._parentFabricator) {
      return this._parentFabricator.releaseFabricator();
    }
    this.logEvent(2, () => [
      transaction._transacted ? "\nCOMMITTING" : "\nDISCARDING", "TRANSACTION",
      this._fabricatorName, ":", ...dumpObject({ fabricator: this, transaction }),
    ]);
    return transaction.finalizeTransactor();
  },
};

class TransactionEventResult extends ChronicleEventResult {
  getComposedStory () { return this.story; }
  getPremiereStory () {
    if (this.info._finalCommand !== undefined) return this.story;
    return this.premiereStory || (this.premiereStory = new Promise((succeed, fail) => {
      this.info_resultPromises[this.existingActionCount + this.index] = { succeed, fail };
    }));
  }
}

export default class TransactionState {
  constructor (transactor: Transactor, name: string) {
    this._transactor = transactor;
    this.name = name;
    transactor._parentFabricator = null;
    transactor.setState(this._stateBefore = transactor.getState());
  }

  _lazyInit () {
    const transactor = this._transactor;
    this._stateAfter = null;
    // actions is set to null when the transaction has been committed.
    this._actions = [];
    this._passages = [];
    this._transacted = transactor._universalizeEvent(transacted({ actions: [] }));
    this._transacted.meta.transactor = transactor;
    this._universalChronicles = {};
    this._resultPromises = [];
    const corpus = transactor._corpus = Object.create(transactor._corpus);
    this._storyIndex = corpus.getState()[StoryIndexTag] || 0;
    // if (typeof this._storyIndex !== "number") {
    //   throw new Error("corpus.state[StoryIndexTag] missing");
    // }
    ++this._storyIndex;
    activeTransactionCounter += 1;
    this._transactionDescription = `tx#${activeTransactionCounter} sub-chronicle`;
    corpus.setName(`${transactor._corpus.getName()}/tx#${activeTransactionCounter}:${this.name}:${
      this._transacted.aspects.command.id}`);
    corpus.setState(this._stateBefore);
    if (transactor.getVerbosity() >= 1) {
      Object.keys(fabricatorEventTypes).forEach(type => {
        transactor.addEventListener(type, event => {
          transactor.clockEvent(1, () => [
            `transactor.on${type}`,
            event.command.aspects.command.id,
            event.instigatorConnection ? event.instigatorConnection.getChronicleURI() : "",
            event.error && event.error.message,
            event.defaultPrevented ? "canceled" : "",
            event.isSchismatic === undefined ? ""
                : event.isSchismatic ? "schismatic" : "non-schismatic",
            event.isRevisable === undefined ? ""
                : event.isRevisable ? "revisable" : "non-revisable",
            event.isReformable === undefined ? ""
                : event.isReformable ? "reformable" : "non-reformable",
            event.isRefabricateable === undefined ? ""
                : event.isRefabricateable ? "refabricateable" : "non-refabricateable",
          ]);
        });
      });
    }
    return this;
  }

  isActiveFabricator () {
    return !this._transacted || (this._finalCommand === undefined);
  }

  obtainRootEvent () {
    return this._transacted || this._lazyInit()._transacted;
  }

  createFabricator (nestingFabricator: Fabricator) {
    if (!this._transacted) this._lazyInit();
    let parentFabricator = nestingFabricator;
    while (!parentFabricator.hasOwnProperty("_fabricatorCount")) {
      parentFabricator = Object.getPrototypeOf(parentFabricator);
    }
    const parentFabricatorCount = parentFabricator._fabricatorCount;
    if (parentFabricatorCount === parentFabricator._finalizedFabricatorCount) {
      throw new Error(`Cannot nest a transaction for an already-finalized parent transaction: ${
          parentFabricator._fabricatorName}`);
    }
    parentFabricator._fabricatorCount = parentFabricatorCount + 1;
    const nestedFabricator = Object.create(nestingFabricator);
    nestedFabricator._parentFabricator = parentFabricator;
    nestedFabricator._firstActionIndex = this._actions.length;
    return nestedFabricator;
  }

  isFastForwardFrom (previousState: Object) {
    return this._stateBefore === previousState;
  }

  chronicleEvents (events: EventBase[], options: Object = {}): ChronicleRequest {
    try {
      if (!this._transacted) this._lazyInit();
      else if (this._finalCommand !== undefined) {
        throw new Error(`Cannot chronicle new events as actions into the transaction '${
            this._transactor._corpus.getName()}' which has already been ${
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
      for (const event of events) {
        _universalizeAction(event, this._transactor, options.chronicleURI);
      }
      this._transacted.actions = events;
      const transactionStory = this._transactor._corpus.dispatch(
          this._transacted, this._transactionDescription);
      // Only alter transaction internals after the dispatch has
      // performed the content validations.
      const resultBase = new TransactionEventResult(this._transactor);
      resultBase.info = this;
      resultBase.existingActionCount = this._actions.length;

      this._actions.push(...this._transacted.actions);
      this._transacted.actions = [];
      this._passages.push(...transactionStory.passages);
      Object.assign(this._universalChronicles, (transactionStory.meta || {}).chronicles);
      const state = this._transactor._corpus.getState();
      state[StoryIndexTag] = this._storyIndex;
      state[PassageIndexTag] = this._actions.length;
      this._transactor.setState(state);
      return {
        eventResults: events.map((event, index) => {
          const ret = Object.create(resultBase);
          ret.event = event;
          ret.index = index;
          ret.story = transactionStory.passages[index];
          return ret;
        })
      };
    } catch (error) {
      throw this._transactor.wrapErrorEvent(error, 1,
          `chronicleEvents(${this._transactor._corpus.getName()})`,
          "\n\tevents:", ...dumpObject(events),
          "\n\ttransactor:", ...dumpObject(this._transactor),
          "\n\ttransactionState:", ...dumpObject(this),
      );
    }
  }

  commit (): ChronicleEventResult {
    let command;
    try {
      if (this._finalCommand !== undefined) {
        throw new Error(`Cannot commit a transaction '${this._transactor._corpus.getName()
            }' that has already been ${this._finalCommand ? "committed" : "aborted"}`);
      }
      if (!Array.isArray(this._actions) || !this._actions.length) {
        this._finalCommand = this._transacted;
      } else {
        this._stateAfter = this._transactor.getState();
        this._transacted.actions = this._actions;
        // this._transactor.logEvent("committing transaction", this.name,
        //    `with ${this._transacted.actions.length} actions:`, this._transacted);
        command = this._finalCommand = this._transacted;
        if (!this._finalCommand.actions.length) {
          return {
            event: this._finalCommand, story: command, getPremiereStory () { return command; },
          };
        }
        this._commitChronicleResult = this._transactor._falseProphet.chronicleEvent(
            this._finalCommand, {
          transactionState: this, discourse: this._transactor,
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
      throw this._transactor.wrapErrorEvent(error, 1,
        `transaction(${this._transactor._corpus.getName()}).commit()`,
          "\n\tcommand:", ...dumpObject(command),
          "\n\ttransaction:", ...dumpObject(this._transactor),
          "\n\ttransactionState:", ...dumpObject(this),
      );
    }
  }

  rollbackFabricator (fabricator: Fabricator, reason: any) {
    try {
      if (!this._transacted) return; // Not lazy-inited yet even
      if (this._finalCommand !== undefined) {
        if (!this._finalCommand) return;
        throw new Error(`Cannot rollback a transaction '${this._transactor._corpus.getName()
            }' which has already been committed`);
      }
      const actionsAfterRollback = fabricator._firstActionIndex || 0;
      const initialPassage = this._passages[actionsAfterRollback];
      if (initialPassage === undefined) return;
      const rollbackState = initialPassage.previousState;
      if (!rollbackState) {
        throw new Error(
            "Cannot rollback nested transaction: can't determine initial previousState");
      }
      this._passages.length = actionsAfterRollback;
      this._actions.length = actionsAfterRollback;
      this._transactor.setState(rollbackState);
    } catch (error) {
      throw fabricator.wrapErrorEvent(error, new Error("rollbackFabricator()"),
          "\n\trollback reason:", ...dumpObject(reason));
    }
  }

  markAsAborting (/* reason: string = "" */) {
    if (this._finalCommand !== undefined) {
      if (!this._finalCommand) return false;
      throw new Error(`Cannot abort a transaction '${this._transactor._corpus.getName()
          }' which has already been committed`);
    }
    if (!this._transacted) this._transacted = true; // prevent lazyInit in order to make tx inactive
    this._finalCommand = false;
    /*
    const messages = [
      "Aborting transaction", this._transactor._corpus.getName(), reason,
      "\n\taborted actions:", ...dumpObject(this._actions),
      "\n\ttransaction state:", ...dumpObject(this),
    ];
    if (Array.isArray(this._actions) && this._actions.length) {
      this._transactor.errorEvent(...messages);
    } else {
      this._transactor.logEvent(...messages);
    }
    */
    return true;
  }

  finalizeTransactor () {
    if (!this._transacted) {
      // Nothing to commit. Prevent lazyInit in order to make tx inactive
      this._transacted = true;
    }
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
   * @memberof TransactionState
   */
  _tryFastForwardOnCorpus (targetCorpus: Corpus) {
    // this.logEvent(`Committing fast-forward transaction '${transactionState.name}'`);
    const previousState = targetCorpus.getState();
    if (!this.isFastForwardFrom(previousState)) return undefined;
    // this.logEvent(`Committed '${transactionState.name}'`, story);
    const story = targetCorpus.createStoryFromEvent({
      ...this._finalCommand,
      actions: this._passages.map(passage => getActionFromPassage(passage)),
      meta: {
        ...(this._transacted.meta || {}),
        partitions: this._universalChronicles,
      },
    });
    story.passages = this._passages;
    story.state = this._stateAfter;
    story.state[StoryIndexTag] = story.storyIndex;

    targetCorpus.reinitialize(this._stateAfter);
    return story;
  }
}
