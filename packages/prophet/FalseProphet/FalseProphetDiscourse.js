// @flow

import { Action, Command, created, duplicated, destroyed, EventBase } from "~/raem/events";
import type { Corpus } from "~/raem/Corpus";
import { StoryIndexTag, PassageIndexTag } from "~/raem/redux/Bard";
import { ValaaURI, naiveURI, hasScheme } from "~/raem/ValaaURI";
import { vRef } from "~/raem/VRL";
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
import IdentityManager from "~/prophet/FalseProphet/IdentityManager";

import { invariantify, invariantifyObject, thenChainEagerly, trivialClone } from "~/tools";
import valosUUID from "~/tools/id/valosUUID";

export default class FalseProphetDiscourse extends Discourse {
  _follower: Follower;
  _prophet: Prophet;
  _transactionState: ?TransactionInfo = null;
  _assignCommandId: (command: Command, discourse: FalseProphetDiscourse) => string;

  constructor ({
    follower, prophet, verbosity, logger, packFromHost, unpackToHost, steppers,
    assignCommandId,
  }: Object) {
    // goes to Valker
    super(prophet.corpus.schema, verbosity, logger, packFromHost, unpackToHost, steppers);
    invariantifyObject(follower, "FalseProphetDiscourse.constructor.follower");
    this.setDeserializeReference(prophet.deserializeReference);
    this.rootDiscourse = this;
    this.corpus = prophet.corpus;
    this._follower = follower;
    this._prophet = prophet;
    this._implicitlySyncingConnections = {};
    this._identityManager = new IdentityManager(prophet);
    this.setState(this._prophet.getState());
    invariantify(this.state, "FalseProphetDiscourse.state");
    this._assignCommandId = assignCommandId || (command => {
      obtainAspect(command, "command").id = valosUUID();
    });
  }

  debugId (): string {
    return `${this.constructor.name}(${this._transactionState
            ? (this._transactionName || "stub-transactional") : "non-transactional"
        }: #${this.state[StoryIndexTag]}/${this.state[PassageIndexTag]})`;
  }

  setAssignCommandId (assignCommandId) {
    this._assignCommandId = assignCommandId;
  }

  run (head: any, kuery: any, options: Object): any {
    try {
      if (options && options.discourse && (this !== options.discourse)) {
        return options.discourse.run(head, kuery, options);
      }
      return super.run(head, kuery, options);
    } catch (error) {
      addConnectToPartitionToError(error, this.connectToMissingPartition);
      throw error;
    }
  }

  acquirePartitionConnection (partitionURI: ValaaURI,
      options: ConnectOptions = {}): ?PartitionConnection {
    options.identity = this._identityManager;
    return this._prophet.acquirePartitionConnection(partitionURI, options);
  }

  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}):
      ChroniclePropheciesRequest {
    this.logEvent(1, () => ["chronicling", events.length, "events:", events]);
    if (this._transactionState) return this._transactionState.chronicleEvents(events, options);
    try {
      options.discourse = this;
      options.identity = this._identityManager;
      const ret = this._prophet.chronicleEvents(
          events.map(event => this._universalizeEvent(event)), options);

      ret.eventResults.forEach(eventResult => {
        const getPremiereStory = eventResult.getPremiereStory;
        eventResult.waitOwnReactions = (() => eventResult.getFollowerReactions(this._follower));
        eventResult.getPremiereStory = () => thenChainEagerly(
            eventResult.waitOwnReactions(),
            () => getPremiereStory.call(eventResult));
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
    ret.meta.identity = this._identityManager;
    if (!tryAspect(ret, "command").id) this._assignCommandId(ret, this);
    return ret;
  }

  _universalizeAction (action: Action): Action {
    return trivialClone(action);
  }

  _implicitlySyncingConnections: Object;

  connectToMissingPartition = async (missingPartitionURI: ValaaURI) => {
    const partitionURIString = String(missingPartitionURI);
    if (!this._implicitlySyncingConnections[partitionURIString]) {
      this._implicitlySyncingConnections[partitionURIString] = this
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
    return this._follower.rejectHeresy(hereticEvent, purgedCorpus, revisedEvents);
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
      if (!hasScheme(partitionURI, "valaa-memory")) {
        this.warnEvent(`assignNewResourceId.explicitRawId was explicitly provided for a regular${
            ""} partition resource in non-'valaa-memory:' partition: this will be deprecated`,
            "\n\texplicitrawId:", explicitRawId,
            "\n\tpartitionURI:", partitionURI);
      }
      resourceRawId = explicitRawId;
    }

    targetAction.id = vRef(resourceRawId, undefined, undefined,
        naiveURI.createPartitionURI(partitionURI));
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
    targetAction.id = vRef(explicitRawId || valosUUID());
    /*
    console.log("assignNewPartitionlessResourceId", String(targetAction.id), explicitRawId,
        "\n\ttargetAction:", ...dumpObject(targetAction),
        "\n\ttargetAction.initialState:", ...dumpObject(targetAction.initialState));
    */
    return targetAction.id;
  }

  assignNewPartitionId (targetAction: EventBase, authorityURI: string,
      explicitPartitionRawId?: string) {
    const root = this._transactionState ? this._transactionState.obtainRootEvent() : targetAction;
    if (!tryAspect(root, "command").id) this._assignCommandId(root, this);
    const partitionRawId = explicitPartitionRawId
        || createPartitionId0Dot2(root.aspects.command.id, authorityURI);
    targetAction.id = vRef(partitionRawId, undefined, undefined,
        naiveURI.createPartitionURI(authorityURI, partitionRawId));
    /*
    console.log("assignNewPartitionId", String(targetAction.id), authorityURI,
        explicitPartitionRawId, "\n\ttargetAction:", ...dumpObject(targetAction));
    */
    return targetAction.id;
  }

  /**
   * Returns a new valid transaction discourse which wraps this
   * Discourse as prototype and forks its corpus. The returned
   * discourse thus inherits all of false prophet discourse API, but
   * in addition all chroniclings are intercepted in an internal
   * transaction event log.
   * These events are resolved immediately against the forked corpus,
   * but only claimed forward as commands once the transaction is
   * committed. This happens when the transaction discourse is released
   * usind releaseTransaction.
   *
   * Transaction discourses can be nested by calling acquireTransaction
   * again on an existing transaction discourse. The main transaction
   * is committed only when all nested transactions have been released.
   */
  acquireTransaction (name: string): FalseProphetDiscourse {
    let ret;
    if (!this._transactionState) {
      ret = Object.create(this);
      const transaction = ret._transactionState = new TransactionInfo(ret, name);
      this.logEvent(1, () => [
        "acquired NEW TX", name, ":", {
          discourse: dumpObject(ret), transaction: dumpObject(transaction),
        },
      ]);
      ret.releaseTransaction = function releaseTransaction (
          options: ?{ abort: boolean, reason: Error }) {
        this.logEvent(1, () => [
          "released TX", name, ":", {
            discourse: dumpObject(this), root: dumpObject(ret),
            transaction: dumpObject(transaction),
          },
        ]);
        if (options && options.abort) {
          transaction.markAsAborting((options.reason || {}).message || options.reason);
        }
        if (--this._nonFinalizedTransactions) return false;
        if (this._parentTransaction) {
          return this._parentTransaction.releaseTransaction();
        }
        return transaction.finalize();
      };
      ret._transactionName = `${name}#${++FalseProphetDiscourse.nextIndex}`;
    } else {
      ret = this._transactionState.createNestedTransaction(this, name);
      this.logEvent(1, () => [
        "acquired nested TX", name, ":", {
          discourse: dumpObject(ret), transaction: dumpObject(ret._transactionState),
        },
      ]);
      ret._transactionName = `${this._transactionName}/${this._nonFinalizedTransactions}`;
    }
    ret._nonFinalizedTransactions = 1;
    return ret;
  }
  static nextIndex = 0;

  isActiveTransaction () {
    return !!this._nonFinalizedTransactions;
  }

  pendingTransactionActions () {
    return ((this._transactionState || {}).actions || []).length;
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
