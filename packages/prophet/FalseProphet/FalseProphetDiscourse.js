// @flow

import Command, { created, duplicated, destroyed, EventBase } from "~/raem/command";
import { Action } from "~/raem";
import type { Corpus } from "~/raem/Corpus";
import type ValaaURI from "~/raem/ValaaURI";
import { dumpObject } from "~/raem/VALK";
import { addConnectToPartitionToError } from "~/raem/tools/denormalized/partitions";

import Discourse from "~/prophet/api/Discourse";
import Follower from "~/prophet/api/Follower";
import Prophet from "~/prophet/api/Prophet";
import type { ChronicleOptions, ChroniclePropheciesRequest, ProphecyEventResult }
    from "~/prophet/api/types";

import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";

import { createId, invariantify } from "~/tools";

export default class FalseProphetDiscourse extends Discourse {
  follower: Follower;
  prophet: Prophet;

  constructor ({
    follower, prophet, verbosity, logger, packFromHost, unpackToHost, builtinSteppers,
  }: Object) {
    // goes to Valker
    super(prophet.corpus.schema, verbosity, logger, packFromHost, unpackToHost, builtinSteppers);
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

  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}):
      ChroniclePropheciesRequest {
    if (this._transactionInfo) return this._transactionInfo.chronicleEvents(events, options);
    try {
      const ret = this.prophet.chronicleEvents(events, options);
      ret.eventResults.forEach(eventResult => {
        eventResult.waitOwnReactions = (() => eventResult.getFollowerReactions(this.follower));
        eventResult.getPremiereStory = (async () => {
          await eventResult.waitOwnReactions();
          return await eventResult.getTruthStory();
        });
      });
      return ret;
    } catch (error) {
      addConnectToPartitionToError(error, this.connectToMissingPartition);
      throw this.wrapErrorEvent(error, `chronicleEvents()`,
          "\n\tevents:", ...dumpObject(events),
      );
    }
  }
  chronicleEvent (event: EventBase, options: ChronicleOptions = {}): ProphecyEventResult {
    return this.chronicleEvents([event], options).eventResults[0];
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

  receiveCommands (commands: Command[]): ?Command[] {
    if (!commands.length) return undefined;
    this.setState(commands[commands.length - 1].state);
    return this.follower.receiveCommands(commands);
  }

  receiveTruths (truthEvents: EventBase[]) {
    return this.follower.receiveTruths(truthEvents);
  }

  rejectHeresy (hereticEvent: EventBase, purgedCorpus: Corpus, revisedEvents: EventBase[]) {
    return this.follower.rejectHerecy(hereticEvent, purgedCorpus, revisedEvents);
  }


  createId (mutationParams: any, options: Object) { createId(mutationParams, options); }

  /**
   * Returns a new valid transaction which wraps this Discourse and forks its corpus.
   * The returned transaction prototypically inherits the wrapped object and thus all of its
   * API; all chroniclings are intercepted in an internal transaction event log.
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
      return this._transactionInfo._createNestedTransaction(this, customCommand);
    }
    const transactionRoot = Object.create(this);
    transactionRoot._transactionInfo = new TransactionInfo(transactionRoot, customCommand);
    return transactionRoot;
  }

  transaction (customCommand: (actions: Action[]) => EventBase): FalseProphetDiscourse {
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
  }: Object): ProphecyEventResult {
    return this.chronicleEvent(created({ id, typeName, initialState }), {});
  }

  duplicate ({
    duplicateOf, initialState, isImmutable,
    id = createId({ duplicateOf, initialState }, { isImmutable }),
  }: Object): ProphecyEventResult {
    return this.chronicleEvent(duplicated({ id, duplicateOf, initialState }), {});
  }

  destroy ({ id, typeName, owner }: Object): ProphecyEventResult {
    return this.chronicleEvent(destroyed({ id, typeName, owner }), {});
  }
}
