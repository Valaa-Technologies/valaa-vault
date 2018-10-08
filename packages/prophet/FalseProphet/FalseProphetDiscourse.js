// @flow

import Command, { created, duplicated, destroyed } from "~/raem/command";
import type { Corpus } from "~/raem/Corpus";
import type ValaaURI from "~/raem/ValaaURI";
import { dumpObject } from "~/raem/VALK";
import { addConnectToPartitionToError } from "~/raem/tools/denormalized/partitions";

import Discourse from "~/prophet/api/Discourse";
import Follower from "~/prophet/api/Follower";
import Prophecy from "~/prophet/api/Prophecy";
import Prophet, { ClaimResult } from "~/prophet/api/Prophet";

import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";

import { createId, invariantify } from "~/tools";

export default class FalseProphetDiscourse extends Discourse {
  follower: Follower;
  prophet: Prophet;

  constructor ({
    follower, prophet, debugLevel, logger, packFromHost, unpackToHost, builtinSteppers,
  }: Object) {
    // goes to Valker
    super(prophet.corpus.schema, debugLevel, logger, packFromHost, unpackToHost, builtinSteppers);
    this.nonTransactionalBase = this;
    this.follower = follower;
    this.prophet = prophet;
    this.corpus = prophet.corpus;
    this._implicitlySyncingConnections = {};
    this.setState(this.prophet.getState());
    invariantify(this.state, "FalseProphetDiscourse.state");
  }

  debugId (options: ?Object): string {
    return `${this.constructor.name}(${
        this._transactionInfo ? this._transactionInfo.name : "non-transactional"}: ${
        this.follower.debugId(options)} <-> ${this.prophet.debugId(options)})`;
  }

  run (head: any, kuery: any, options: Object): any {
    try {
      return super.run(head, kuery, options);
    } catch (error) {
      addConnectToPartitionToError(error, this.connectToMissingPartition);
      throw error;
    }
  }

  claim (command: Command, options: Object): ClaimResult {
    if (this._transactionInfo) return this._transactionInfo.claim(command, options);
    try {
      const ret = this.prophet.claim(command, options);
      ret.waitOwnReactions = (() => ret.getFollowerReactions(this.follower));
      ret.getFinalEvent = (async () => {
        await ret.waitOwnReactions();
        return await ret.getBackendFinalEvent();
      });
      return ret;
    } catch (error) {
      addConnectToPartitionToError(error, this.connectToMissingPartition);
      throw this.wrapErrorEvent(error, `claim()`,
          "\n\tcommand:", ...dumpObject(command),
      );
    }
  }

  _implicitlySyncingConnections: Object;

  connectToMissingPartition = async (missingPartitionURI: ValaaURI) => {
    const partitionURIString = missingPartitionURI.toString();
    if (!this._implicitlySyncingConnections[partitionURIString]) {
      this._implicitlySyncingConnections[partitionURIString] = this.prophet
          .acquirePartitionConnection(missingPartitionURI)
          .getSyncedConnection();
    }
    return (this._implicitlySyncingConnections[partitionURIString] =
        await this._implicitlySyncingConnections[partitionURIString]);
  }

  revealProphecy (prophecy: Prophecy): ?Promise<any>[] {
    this.setState(prophecy.state);
    return this.follower.revealProphecy(prophecy);
  }

  receiveTruth (truthEvent: Command) {
    return this.follower.receiveTruth(truthEvent);
  }

  rejectHeresy (hereticEvent: Command, purgedCorpus: Corpus, revisedEvents: Command[]) {
    return this.follower.rejectHerecy(hereticEvent, purgedCorpus, revisedEvents);
  }


  createId (mutationParams: any, options: Object) { createId(mutationParams, options); }

  /**
   * Returns a new valid transaction which wraps this Discourse and forks its corpus.
   * The returned transaction prototypically inherits the wrapped object and thus all of its
   * API; all command functions are intercepted in an internal transaction event log.
   * These events are resolved immediately against the forked corpus, but only claimed forward to
   * the wrapped object once the transaction is committed using 'outermost' releaseTransaction.
   *
   * Transaction objects can be nested. Calling releaseTransaction on an inner transaction is a
   * no-op (other than setting the customCommand).
   *
   * A transaction is committed using TRANSACTED by default. A custom command can be specified
   * in any transaction, releaseTransaction or commit call as a function which takes the list of
   * transaction actions as the first parameter and returns the final command that is then sent
   * upstream.
   */
  acquireTransaction (customCommand: ?Object): FalseProphetDiscourse {
    if (this._transactionInfo) {
      return this._transactionInfo.createNestedTransaction(this, customCommand);
    }
    const transactionRoot = Object.create(this);
    transactionRoot._transactionInfo = new TransactionInfo(transactionRoot, customCommand);
    return transactionRoot;
  }

  transaction (customCommand: (actions: Command[]) => Command): FalseProphetDiscourse {
    this.errorEvent("\n\tDEPRECATED: FalseProphetDiscourse.transaction",
        "\n\tprefer: acquireTransaction");
    return this.acquireTransaction(customCommand);
  }

  isActiveTransaction () {
    return this._transactionInfo && this._transactionInfo.isCommittable();
  }

  releaseTransaction () {
    if (this._transactionInfo) this._transactionInfo.releaseTransaction();
  }

  commit (commitCustomCommand: ?Object) {
    if (!this._transactionInfo) {
      throw new Error("Cannot call commit on a non-transaction discourse");
    }
    this._transactionInfo.commit(commitCustomCommand, this);
  }

  abort () {
    if (!this._transactionInfo) throw new Error("Cannot call abort on a non-transaction discourse");
    this._transactionInfo.abort(this);
  }

  create ({
    typeName, initialState, isImmutable,
    id = createId({ typeName, initialState }, { isImmutable }),
  }: Object): ClaimResult {
    return this.claim(created({ id, typeName, initialState }), {});
  }

  duplicate ({
    duplicateOf, initialState, isImmutable,
    id = createId({ duplicateOf, initialState }, { isImmutable }),
  }: Object): ClaimResult {
    return this.claim(duplicated({ id, duplicateOf, initialState }), {});
  }

  destroy ({ id, typeName, owner }: Object): ClaimResult {
    return this.claim(destroyed({ id, typeName, owner }), {});
  }
}
