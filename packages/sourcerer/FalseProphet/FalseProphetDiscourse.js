// @flow

import { Action, Command, created, duplicated, destroyed, EventBase } from "~/raem/events";
import { StoryIndexTag, PassageIndexTag } from "~/raem/redux/Bard";
import { ValaaURI, naiveURI, hasScheme } from "~/raem/ValaaURI";
import { vRef } from "~/raem/VRL";
import { dumpObject } from "~/raem/VALK";
import { getHostRef } from "~/raem/VALK/hostReference";
import { formVPath, validateVRID, validateVerbs } from "~/raem/VPath";
import { addConnectToPartitionToError } from "~/raem/tools/denormalized/partitions";

import Discourse from "~/sourcerer/api/Discourse";
import Follower from "~/sourcerer/api/Follower";
import Sourcerer from "~/sourcerer/api/Sourcerer";
import type Connection from "~/sourcerer/api/Connection";
import type { ChronicleOptions, ChroniclePropheciesRequest, ConnectOptions, ProphecyEventResult }
    from "~/sourcerer/api/types";

import EVENT_VERSION from "~/sourcerer/tools/EVENT_VERSION";

import { initializeAspects, obtainAspect, tryAspect } from "~/sourcerer/tools/EventAspects";
import createVRID0Dot3, { upgradeVRIDTo0Dot3, createChronicleRootVRID0Dot3 }
    from "~/sourcerer/tools/event-version-0.3/createVRID0Dot3";

import TransactionState, { fabricatorOps } from "~/sourcerer/FalseProphet/TransactionState";
import IdentityManager from "~/sourcerer/FalseProphet/IdentityManager";

import { invariantify, invariantifyObject, thenChainEagerly, trivialClone } from "~/tools";
import valosUUID from "~/tools/id/valosUUID";

export default class FalseProphetDiscourse extends Discourse {
  _follower: Follower;
  _sourcerer: Sourcerer;
  _transactorState: ?TransactionState = null;
  _assignCommandId: (command: Command, discourse: FalseProphetDiscourse) => string;

  constructor ({
    follower, sourcerer, verbosity, logger, packFromHost, unpackToHost, steppers,
    assignCommandId,
  }: Object) {
    // goes to Valker
    super(sourcerer.corpus.schema, verbosity, logger, packFromHost, unpackToHost, steppers);
    invariantifyObject(follower, "FalseProphetDiscourse.constructor.follower");
    this.setDeserializeReference(sourcerer.deserializeReference);
    this.corpus = sourcerer.corpus;
    this._rootDiscourse = this;
    this._follower = follower;
    this._sourcerer = sourcerer;
    this._implicitlySyncingConnections = {};
    this._identityManager = new IdentityManager(sourcerer);
    this.setState(this._sourcerer.getState());
    invariantify(this.state, "FalseProphetDiscourse.state");
    this._assignCommandId = assignCommandId || (command => {
      obtainAspect(command, "command").id = valosUUID();
    });
  }

  debugId (): string {
    return `${this.constructor.name}(${this._transactorState
            ? (this._fabricatorName || "stub-transactional") : "non-transactional"
        }: #${this.state[StoryIndexTag]}/${this.state[PassageIndexTag]})`;
  }

  getRootDiscourse () { return this._rootDiscourse; }
  getTransactor () { return this._transactorState && this._transactorState._transactor; }
  getIdentityManager () { return this._identityManager; }

  setAssignCommandId (assignCommandId) {
    this._assignCommandId = assignCommandId;
  }

  run (head: any, kuery: any, options: Object = {}): any {
    try {
      if (options && options.discourse && (this !== options.discourse)) {
        return options.discourse.run(head, kuery, options);
      }
      return super.run(head, kuery,
          !options ? { discourse: this }
          : !options.discourse ? { ...options, discourse: this }
          : options);
    } catch (error) {
      addConnectToPartitionToError(error, this.connectToMissingPartition);
      throw error;
    }
  }

  acquireConnection (chronicleURI: ValaaURI,
      options: ConnectOptions = {}): ?Connection {
    options.discourse = this;
    return this._sourcerer.acquireConnection(chronicleURI, options);
  }

  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}):
      ChroniclePropheciesRequest {
    this.logEvent(1, () => ["chronicling", events.length, "events:", events]);
    if (this._transactorState) return this._transactorState.chronicleEvents(events, options);
    try {
      options.discourse = this;
      const ret = this._sourcerer.chronicleEvents(
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
    if (!tryAspect(ret, "command").id) this._assignCommandId(ret, this);
    obtainAspect(ret, "command").timeStamp = Date.now();
    return ret;
  }

  _universalizeAction (action: Action): Action {
    return trivialClone(action);
  }

  _implicitlySyncingConnections: Object;

  connectToMissingPartition = async (missingChronicleURI: ValaaURI) => {
    const chronicleURIString = String(missingChronicleURI);
    if (!this._implicitlySyncingConnections[chronicleURIString]) {
      this._implicitlySyncingConnections[chronicleURIString] = this
          .acquireConnection(missingChronicleURI)
          .asActiveConnection();
    }
    return (this._implicitlySyncingConnections[chronicleURIString] =
        await this._implicitlySyncingConnections[chronicleURIString]);
  }

  receiveCommands (commands: Command[], purgedRecital: ?Object): ?Command[] {
    if (commands.length) {
      this.setState(commands[commands.length - 1].state);
    } else if (purgedRecital) {
      this.setState(purgedRecital.getFirst().previousState);
    } else {
      return undefined;
    }
    return this._follower.receiveCommands(commands, purgedRecital);
  }

  receiveTruths (truthEvents: EventBase[]) {
    return this._follower.receiveTruths(truthEvents);
  }

  create ({ typeName, initialState, id }: Object): ProphecyEventResult {
    const command = created({ id, typeName, initialState });
    if (!command.id) command.id = this.assignNewVRID(command);
    return this.chronicleEvent(command, {});
  }

  duplicate ({
    duplicateOf, initialState, id,
  }: Object): ProphecyEventResult {
    const command = duplicated({ id, duplicateOf, initialState });
    if (!command.id) command.id = this.assignNewVRID(command);
    return this.chronicleEvent(command, {});
  }

  destroy ({ id }: Object): ProphecyEventResult {
    return this.chronicleEvent(destroyed({ id }), {});
  }

  assignNewVRID (targetAction: EventBase, chronicleURI: string,
      explicitRawId?: string, explicitSubPath?: string | Array) {
    try {
      if (!chronicleURI) throw new Error("assignNewVRID.chronicleURI missing");
      const root = this._transactorState ? this._transactorState.obtainRootEvent() : targetAction;
      if (!tryAspect(root, "command").id) this._assignCommandId(root, this);
      const chronicles = (root.meta || (root.meta = {})).partitions || (root.meta.partitions = {});
      const chronicle = chronicles[chronicleURI] || (chronicles[chronicleURI] = {});
      if (!chronicle.createIndex) chronicle.createIndex = 0;

      let subPath = explicitSubPath;
      if (subPath) { // case a -> 9, e -> d
        if (Array.isArray(subPath)) subPath = formVPath(...subPath);
        else validateVerbs(subPath);
        if (subPath[1] === "$") {
          throw new Error("explicit subPath must not have a GRId as first step");
        }
      } else if (!explicitRawId) {
        if (targetAction.typeName === "Property") {
          const propertyName = targetAction.initialState.name;
          if (!propertyName) {
            throw new Error(`${targetAction.type
                }.Property.initialState.name required for Property id secondary part`);
          }
          subPath = `@.:${encodeURIComponent(propertyName)}@@`;
        }
      }

      let resourceVRID;
      if (subPath) {
        let parentVRID = getHostRef(
            targetAction.initialState.owner || targetAction.initialState.source,
            `${targetAction.type}.Property.initialState.owner`).rawId();
        if (parentVRID[0] !== "@") parentVRID = upgradeVRIDTo0Dot3(parentVRID);
        resourceVRId = `${parentVRId.slice(0, -2)}${subPath}`;
        /*
        resourceRawId = ((ownerRawId[0] !== "@") || (ownerRawId.slice(-2) !== "@@"))
            ? `${ownerRawId}/.:${encodeURIComponent(propertyName)}`
            : `${ownerRawId.slice(0, -1)}.:${encodeURIComponent(propertyName)}@@`;
        */
      } else if (!explicitRawId) {
        resourceVRID =
            createVRID0Dot3(root.aspects.command.id, chronicleURI, chronicle.createIndex++);
      } else if (explicitRawId[0] === "@") {
        resourceVRID = validateVRID(explicitRawId);
      } else {
        if (!hasScheme(chronicleURI, "valaa-memory")) {
          this.errorEvent(`a non-VPath assignNewVRID.explicitRawId was explicitly provided${
              ""} for a regular chronicle resource in a non-'valaa-memory:' chronicle: this will${
              ""} be deprecated Very Soon(tm) in favor of VPath resource identifiers.`,
              "\n\texplicitRawId:", explicitRawId,
              "\n\tchronicleURI:", chronicleURI);
        }
        return (targetAction.id = vRef(explicitRawId, undefined, undefined,
            naiveURI.createPartitionURI(chronicleURI)));
      }
      targetAction.id = vRef(resourceVRID, undefined, undefined, chronicleURI);
      /*
      console.log("assignNewVRID", tryAspect(root, "command").id, chronicleURI, explicitRawId,
          "\n\tresourceRawId:", resourceRawId,
          "\n\tresults:", String(targetAction.id), targetAction.id,
          "\n\ttargetAction:", ...dumpObject(targetAction),
          "\n\ttargetAction.initialState:", ...dumpObject(targetAction.initialState));
      // */
      return targetAction.id;
    } catch (error) {
      throw this.wrapErrorEvent(error, "assignNewVRID()",
          "\n\ttargetAction:", ...dumpObject(targetAction),
          "\n\tchronicleURI:", ...dumpObject(chronicleURI),
          "\n\texplicitRawId:", ...dumpObject(explicitRawId),
          "\n\texplicitSubPath:", ...dumpObject(explicitSubPath),
      );
    }
  }

  assignNewUnchronicledVRID (targetAction: EventBase, explicitRawId?: string) {
    if (targetAction.typeName === "Property") {
      throw new Error(
          "Cannot create a resource id for a structural type 'Property' which is missing an owner");
    }
    targetAction.id = vRef(explicitRawId || `@$~u4:${valosUUID()}`);
    /*
    console.log("assignNewUnchronicledVRID", String(targetAction.id), explicitRawId,
        "\n\ttargetAction:", ...dumpObject(targetAction),
        "\n\ttargetAction.initialState:", ...dumpObject(targetAction.initialState));
    */
    return targetAction.id;
  }

  assignNewChronicleRootId (targetAction: EventBase, authorityURI: string,
      explicitChronicleRootVRID?: string) {
    const root = this._transactorState ? this._transactorState.obtainRootEvent() : targetAction;
    if (!tryAspect(root, "command").id) this._assignCommandId(root, this);
    const chronicleRootVRID = explicitChronicleRootVRID
        || createChronicleRootVRID0Dot3(root.aspects.command.id, authorityURI);
    targetAction.id = vRef(chronicleRootVRID, undefined, undefined,
        naiveURI.createChronicleURI(authorityURI, chronicleRootVRID));
    /*
    console.log("assignNewChronicleRootId", String(targetAction.id), authorityURI,
        explicitChronicleRootVRID, "\n\ttargetAction:", ...dumpObject(targetAction));
    */
    return targetAction.id;
  }
}

Object.assign(FalseProphetDiscourse.prototype, fabricatorOps);
