// @flow

import { Command, created, duplicated, destroyed, EventBase } from "~/raem/events";
import type { Corpus } from "~/raem/Corpus";
import ValaaURI, { createValaaURI, createPartitionURI } from "~/raem/ValaaURI";
import { vRef } from "~/raem/ValaaReference";
import { dumpObject } from "~/raem/VALK";
import { getHostRef } from "~/raem/VALK/hostReference";
import { addConnectToPartitionToError } from "~/raem/tools/denormalized/partitions";

import Discourse from "~/prophet/api/Discourse";
import Follower from "~/prophet/api/Follower";
import Prophet from "~/prophet/api/Prophet";
import type { ChronicleOptions, ChroniclePropheciesRequest, ProphecyEventResult }
    from "~/prophet/api/types";

import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";
import createResourceId0Dot2, { createPartitionId0Dot2 }
    from "~/prophet/tools/event-version-0.2/createResourceId0Dot2";
import { tryAspect } from "~/prophet/tools/EventAspects";

import { invariantify, invariantifyObject } from "~/tools";
import valaaUUID from "~/tools/id/valaaUUID";

export default class FalseProphetDiscourse extends Discourse {
  _follower: Follower;
  _prophet: Prophet;
  _transactionInfo: ?TransactionInfo = null;

  constructor ({
    follower, prophet, verbosity, logger, packFromHost, unpackToHost, builtinSteppers,
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
  }

  getProphet () { return this._prophet; }

  debugId (options: ?Object): string {
    return `${this.constructor.name}(${this._transactionInfo
            ? (this._transactionInfo.name || "stub-transaction") : "non-transactional"}: ${
        this._follower.getName(options)} <-> ${this._prophet.debugId(options)})`;
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

  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}):
      ChroniclePropheciesRequest {
    if (this._transactionInfo) return this._transactionInfo.chronicleEvents(events, options);
    try {
      options.discourse = this;
      const ret = this._prophet.chronicleEvents(events, options);
      ret.eventResults.forEach(eventResult => {
        eventResult.waitOwnReactions = (() => eventResult.getFollowerReactions(this._follower));
        eventResult.getPremiereStory = (async () => {
          await eventResult.waitOwnReactions();
          return eventResult.getTruthStory();
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
    const root = this._transactionInfo ? this._transactionInfo.obtainRootEvent() : targetAction;
    if (!tryAspect(root, "command").id) this._prophet._assignCommandId(root, this);
    const partitions = (root.local || (root.local = {})).partitions || (root.local.partitions = {});
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
    const root = this._transactionInfo ? this._transactionInfo.obtainRootEvent() : targetAction;
    if (!tryAspect(root, "command").id) this._prophet._assignCommandId(root, this);
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
    if (this._transactionInfo) return this._transactionInfo.createNestedTransaction(this, name);
    const transactionRoot = Object.create(this);
    transactionRoot._transactionInfo = new TransactionInfo(transactionRoot, name);
    return transactionRoot;
  }

  isActiveTransaction () {
    return this._transactionInfo && this._transactionInfo.isActiveTransaction();
  }

  releaseTransaction () {
    return this._transactionInfo && this._transactionInfo.releaseTransaction();
  }

  abort () {
    if (!this._transactionInfo) throw new Error("Cannot call abort on a non-transaction discourse");
    this._transactionInfo.abort();
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
