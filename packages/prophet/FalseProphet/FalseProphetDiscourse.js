// @flow

import { Action, Command, created, duplicated, destroyed, EventBase } from "~/raem/events";
import type { Corpus } from "~/raem/Corpus";
import ValaaURI, { createValaaURI, createPartitionURI } from "~/raem/ValaaURI";
import { vRef } from "~/raem/ValaaReference";
import { dumpObject } from "~/raem/VALK";
import { getHostRef } from "~/raem/VALK/hostReference";
import { addConnectToPartitionToError } from "~/raem/tools/denormalized/partitions";

import Discourse from "~/prophet/api/Discourse";
import Follower from "~/prophet/api/Follower";
import Prophet from "~/prophet/api/Prophet";
import type PartitionConnection from "~/prophet/api/PartitionConnection";
import type { ChronicleOptions, ChroniclePropheciesRequest, ConnectOptions, ProphecyEventResult }
    from "~/prophet/api/types";

import EVENT_VERSION from "~/prophet/tools/EVENT_VERSION";

import createResourceId0Dot2, { createPartitionId0Dot2 }
    from "~/prophet/tools/event-version-0.2/createResourceId0Dot2";
import { initializeAspects, obtainAspect, tryAspect } from "~/prophet/tools/EventAspects";

import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";

import { invariantify, invariantifyObject, trivialClone } from "~/tools";
import valaaUUID from "~/tools/id/valaaUUID";

export default class FalseProphetDiscourse extends Discourse {
  _follower: Follower;
  _prophet: Prophet;
  _transactionState: ?TransactionInfo = null;
  _assignCommandId: (command: Command, discourse: FalseProphetDiscourse) => string;

  constructor ({
    follower, prophet, verbosity, logger, packFromHost, unpackToHost, builtinSteppers,
    assignCommandId,
  }: Object) {
    // goes to Valker
    super(prophet.corpus.schema, verbosity, logger, packFromHost, unpackToHost, builtinSteppers);
    invariantifyObject(follower, "FalseProphetDiscourse.constructor.follower");
    this.setDeserializeReference(prophet.deserializeReference);
    this.rootDiscourse = this;
    this.corpus = prophet.corpus;
    this._follower = follower;
    this._prophet = prophet;
    this._implicitlySyncingConnections = {};
    this.setState(this._prophet.getState());
    invariantify(this.state, "FalseProphetDiscourse.state");
    this._assignCommandId = assignCommandId || (command => {
      obtainAspect(command, "command").id = valaaUUID();
    });
  }

  getProphet () { return this._prophet; }

  debugId (options: ?Object): string {
    return `${this.constructor.name}(${this._transactionState
            ? (this._transactionState.name || "stub-transaction") : "non-transactional"}: ${
        this._follower.getName(options)} <-> ${this._prophet.debugId(options)})`;
  }

  setAssignCommandId (assignCommandId) {
    this._assignCommandId = assignCommandId;
  }

  run (head: any, kuery: any, options: Object): any {
    try {
      if (options && options.transaction && (this !== options.transaction)) {
        return options.transaction.run(head, kuery, options);
      }
      return super.run(head, kuery, options);
    } catch (error) {
      addConnectToPartitionToError(error, this.connectToMissingPartition);
      throw error;
    }
  }

  acquirePartitionConnection (partitionURI: ValaaURI,
      options: ConnectOptions = {}): ?PartitionConnection {
    return this._prophet.acquirePartitionConnection(partitionURI, options);
  }

  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}):
      ChroniclePropheciesRequest {
    if (this._transactionState) return this._transactionState.chronicleEvents(events, options);
    try {
      options.discourse = this;
      const ret = this._prophet
          .chronicleEvents(events.map(event => this._universalizeEvent(event)), options);

      ret.eventResults.forEach(eventResult => {
        const getPremiereStory = eventResult.getPremiereStory;
        eventResult.waitOwnReactions = (() => eventResult.getFollowerReactions(this._follower));
        eventResult.getPremiereStory = (async () => {
          await eventResult.waitOwnReactions();
          return getPremiereStory.call(eventResult);
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

  _universalizeEvent (event: EventBase): EventBase {
    const ret = initializeAspects(this._universalizeAction(event), { version: EVENT_VERSION });
    if (!ret.meta) ret.meta = {};
    // This communicates with @valos/raem reducers somewhat awkwardly.
    ret.meta.isBeingUniversalized = true;
    if (!tryAspect(ret, "command").id) this._assignCommandId(ret, this);
    return ret;
  }

  _universalizeAction (action: Action): Action {
    return trivialClone(action, entry => (entry instanceof ValaaURI ? entry : undefined));
  }

  _implicitlySyncingConnections: Object;

  connectToMissingPartition = async (missingPartitionURI: ValaaURI) => {
    const partitionURIString = missingPartitionURI.toString();
    if (!this._implicitlySyncingConnections[partitionURIString]) {
      this._implicitlySyncingConnections[partitionURIString] = this._prophet
          .acquirePartitionConnection(missingPartitionURI)
          .getActiveConnection();
    }
    return (this._implicitlySyncingConnections[partitionURIString] =
        await this._implicitlySyncingConnections[partitionURIString]);
  }

  receiveCommands (commands: Command[]): ?Command[] {
    if (!commands.length) return undefined;
    this.setState(commands[commands.length - 1].state);
    return this._follower.receiveCommands(commands);
  }

  receiveTruths (truthEvents: EventBase[]) {
    return this._follower.receiveTruths(truthEvents);
  }

  rejectHeresy (hereticEvent: EventBase, purgedCorpus: Corpus, revisedEvents: EventBase[]) {
    return this._follower.rejectHerecy(hereticEvent, purgedCorpus, revisedEvents);
  }

  assignNewResourceId (targetAction: EventBase, partitionURI: string, explicitRawId?: string) {
    if (!partitionURI) throw new Error("assignNewResourceId.partitionURI missing");
    const root = this._transactionState ? this._transactionState.obtainRootEvent() : targetAction;
    if (!tryAspect(root, "command").id) this._assignCommandId(root, this);
    const partitions = (root.meta || (root.meta = {})).partitions || (root.meta.partitions = {});
    const partition = partitions[partitionURI] || (partitions[partitionURI] = {});
    if (!partition.createIndex) partition.createIndex = 0;
    let resourceRawId;
    if (!explicitRawId) {
      if (targetAction.typeName === "Property") {
        const ownerRawId = getHostRef(targetAction.initialState.owner,
            `${targetAction.type}.Property.initialState.owner`).rawId();
        const propertyName = targetAction.initialState.name;
        if (!targetAction.initialState.name) {
          throw new Error(`${targetAction.type
              }.Property.initialState.name required for Property id secondary part`);
        }
        resourceRawId = `${ownerRawId}/.:${encodeURIComponent(propertyName)}`;
      } else {
        resourceRawId = createResourceId0Dot2(
            root.aspects.command.id, partitionURI, partition.createIndex++);
      }
    } else {
      if (partitionURI.slice(0, 13) !== "valaa-memory:") {
        this.warnEvent(`assignNewResourceId.explicitRawId was explicitly provided for a regular${
            ""} partition resource in non-'valaa-memory:' partition: this will be deprecated`,
            "\n\texplicitrawId:", explicitRawId,
            "\n\tpartitionURI:", partitionURI);
      }
      resourceRawId = explicitRawId;
    }

    targetAction.id = vRef(resourceRawId, undefined, undefined, createValaaURI(partitionURI));
    /*
    console.log("assignNewResourceId", tryAspect(root, "command").id, partitionURI, explicitRawId,
        "\n\tresourceRawId:", resourceRawId,
        "\n\tresults:", String(targetAction.id), targetAction.id,
        "\n\ttargetAction:", ...dumpObject(targetAction),
        "\n\ttargetAction.initialState:", ...dumpObject(targetAction.initialState));
    // */
    return targetAction.id;
  }

  assignNewPartitionlessResourceId (targetAction: EventBase, explicitRawId?: string) {
    if (targetAction.typeName === "Property") {
      throw new Error(
          "Cannot create a resource id for a structural type 'Property' which is missing an owner");
    }
    targetAction.id = vRef(explicitRawId || valaaUUID());
    /*
    console.log("assignNewPartitionlessResourceId", String(targetAction.id), explicitRawId,
        "\n\ttargetAction:", ...dumpObject(targetAction),
        "\n\ttargetAction.initialState:", ...dumpObject(targetAction.initialState));
    */
    return targetAction.id;
  }

  assignNewPartitionId (targetAction: EventBase, partitionAuthorityURI: string,
      explicitPartitionRawId?: string) {
    const root = this._transactionState ? this._transactionState.obtainRootEvent() : targetAction;
    if (!tryAspect(root, "command").id) this._assignCommandId(root, this);
    const partitionRawId = explicitPartitionRawId
        || createPartitionId0Dot2(root.aspects.command.id, partitionAuthorityURI);
    targetAction.id = vRef(partitionRawId, undefined, undefined,
        createPartitionURI(partitionAuthorityURI, partitionRawId));
    /*
    console.log("assignNewPartitionId", String(targetAction.id), partitionAuthorityURI,
        explicitPartitionRawId, "\n\ttargetAction:", ...dumpObject(targetAction));
    */
    return targetAction.id;
  }

  /**
   * Returns a new valid transaction which wraps this Discourse and
   * forks its corpus. The returned transaction prototypically inherits
   * the wrapped object and thus all of its API; all chroniclings are
   * intercepted in an internal transaction event log.
   * These events are resolved immediately against the forked corpus,
   * but only claimed forward to the wrapped object once the
   * transaction is committed using 'outermost' releaseTransaction.
   *
   * Transaction objects can be nested. Calling releaseTransaction on
   * an inner transaction is a no-op.
   *
   * A transaction is committed using TRANSACTED by default. A custom
   * command can be specified in any transaction, releaseTransaction or
   * commit call as a function which takes the list of transaction
   * actions as the first parameter and returns the final command that
   * is then sent upstream.
   */
  acquireTransaction (name: string): FalseProphetDiscourse {
    let ret;
    const transactionName = `${name}/${++FalseProphetDiscourse.nestIndex}`;
    if (!this._transactionState) {
      ret = Object.create(this);
      const transactionState = ret._transactionState = new TransactionInfo(ret, name);
      ret.releaseTransaction = function releaseTransaction (options: ?{ abort: boolean }) {
        if (options && options.abort) transactionState.markAsAborting();
        if (--this._nonFinalizedTransactions) return false;
        if (this._parentTransaction) {
          return this._parentTransaction.releaseTransaction();
        }
        return transactionState.finalize();
      };
    } else {
      ret = this._transactionState.createNestedTransaction(this, name);
    }
    ret._transactionName = transactionName;
    ret._nonFinalizedTransactions = 1;
    return ret;
  }
  static nestIndex = 0;

  isActiveTransaction () {
    return this._transactionState && this._transactionState.isActiveTransaction();
  }

  create ({ typeName, initialState, id }: Object): ProphecyEventResult {
    const command = created({ id, typeName, initialState });
    if (!command.id) command.id = this.assignNewResourceId(command);
    return this.chronicleEvent(command, {});
  }

  duplicate ({
    duplicateOf, initialState, id,
  }: Object): ProphecyEventResult {
    const command = duplicated({ id, duplicateOf, initialState });
    if (!command.id) command.id = this.assignNewResourceId(command);
    return this.chronicleEvent(command, {});
  }

  destroy ({ id }: Object): ProphecyEventResult {
    return this.chronicleEvent(destroyed({ id }), {});
  }
}
