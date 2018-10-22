// @flow

import { created, duplicated, destroyed } from "~/raem/command";
import type { Corpus } from "~/raem/Corpus";
import type ValaaURI from "~/raem/ValaaURI";
import { dumpObject } from "~/raem/VALK";
import { addConnectToPartitionToError } from "~/raem/tools/denormalized/partitions";

import Discourse from "~/prophet/api/Discourse";
import Follower from "~/prophet/api/Follower";
import Prophecy from "~/prophet/api/Prophecy";
import Prophet, { ClaimResult } from "~/prophet/api/Prophet";

import type { Proclamation } from "~/prophet/FalseProphet/FalseProphet";
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

  proclaim (proclamation: Proclamation, options: Object): ClaimResult {
    if (this._transactionInfo) return this._transactionInfo.proclaim(proclamation, options);
    try {
      const ret = this.prophet.proclaim(proclamation, options);
      ret.waitOwnReactions = (() => ret.getFollowerReactions(this.follower));
      ret.getStoryPremiere = (async () => {
        await ret.waitOwnReactions();
        return await ret.getFinalStory();
      });
      return ret;
    } catch (error) {
      addConnectToPartitionToError(error, this.connectToMissingPartition);
      throw this.wrapErrorEvent(error, `proclaim()`,
          "\n\tproclamation:", ...dumpObject(proclamation),
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

  receiveTruth (truthEvent: Proclamation) {
    return this.follower.receiveTruth(truthEvent);
  }

  rejectHeresy (hereticEvent: Proclamation, purgedCorpus: Corpus, revisedEvents: Proclamation[]) {
    return this.follower.rejectHerecy(hereticEvent, purgedCorpus, revisedEvents);
  }


  createId (mutationParams: any, options: Object) { createId(mutationParams, options); }

  /**
   * Returns a new valid transaction which wraps this Discourse and forks its corpus.
   * The returned transaction prototypically inherits the wrapped object and thus all of its
   * API; all proclamation functions are intercepted in an internal transaction event log.
   * These events are resolved immediately against the forked corpus, but only claimed forward to
   * the wrapped object once the transaction is committed using 'outermost' releaseTransaction.
   *
   * Transaction objects can be nested. Calling releaseTransaction on an inner transaction is a
   * no-op (other than setting the customProclamation).
   *
   * A transaction is committed using TRANSACTED by default. A custom proclamation can be specified
   * in any transaction, releaseTransaction or commit call as a function which takes the list of
   * transaction actions as the first parameter and returns the final proclamation that is then sent
   * upstream.
   */
  acquireTransaction (customProclamation: ?Object): FalseProphetDiscourse {
    if (this._transactionInfo) {
      return this._transactionInfo.createNestedTransaction(this, customProclamation);
    }
    const transactionRoot = Object.create(this);
    transactionRoot._transactionInfo = new TransactionInfo(transactionRoot, customProclamation);
    return transactionRoot;
  }

  transaction (
      customProclamation: (actions: Proclamation[]) => Proclamation
  ): FalseProphetDiscourse {
    this.errorEvent("\n\tDEPRECATED: FalseProphetDiscourse.transaction",
        "\n\tprefer: acquireTransaction");
    return this.acquireTransaction(customProclamation);
  }

  isActiveTransaction () {
    return this._transactionInfo && this._transactionInfo.isCommittable();
  }

  releaseTransaction () {
    if (this._transactionInfo) this._transactionInfo.releaseTransaction();
  }

  commit (commitCustomProclamation: ?Object) {
    if (!this._transactionInfo) {
      throw new Error("Cannot call commit on a non-transaction discourse");
    }
    this._transactionInfo.commit(commitCustomProclamation, this);
  }

  abort () {
    if (!this._transactionInfo) throw new Error("Cannot call abort on a non-transaction discourse");
    this._transactionInfo.abort(this);
  }

  create ({
    typeName, initialState, isImmutable,
    id = createId({ typeName, initialState }, { isImmutable }),
  }: Object): ClaimResult {
    return this.proclaim(created({ id, typeName, initialState }), {});
  }

  duplicate ({
    duplicateOf, initialState, isImmutable,
    id = createId({ duplicateOf, initialState }, { isImmutable }),
  }: Object): ClaimResult {
    return this.proclaim(duplicated({ id, duplicateOf, initialState }), {});
  }

  destroy ({ id, typeName, owner }: Object): ClaimResult {
    return this.proclaim(destroyed({ id, typeName, owner }), {});
  }
}
