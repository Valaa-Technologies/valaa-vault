// @flow

import { Action, Command, created, duplicated, destroyed, EventBase } from "~/raem/events";
import { StoryIndexTag, PassageIndexTag } from "~/raem/redux/Bard";
import { ValaaURI, naiveURI, hasScheme } from "~/raem/ValaaURI";
import { vRef } from "~/raem/VRL";
import { dumpObject } from "~/raem/VALK";
import { getHostRef } from "~/raem/VALK/hostReference";
import { formVPath, validateVRID, validateVerbs } from "~/raem/VPath";
import { addConnectToChronicleToError } from "~/raem/tools/denormalized/partitions";

import Discourse from "~/sourcerer/api/Discourse";
import type Connection from "~/sourcerer/api/Connection";
import type { ChronicleOptions, ChroniclePropheciesRequest, ConnectOptions, ProphecyEventResult }
    from "~/sourcerer/api/types";

import EVENT_VERSION from "~/sourcerer/tools/EVENT_VERSION";

import { initializeAspects, obtainAspect, tryAspect } from "~/sourcerer/tools/EventAspects";
import createVRID0Dot3, { upgradeVRIDTo0Dot3, createChronicleRootVRID0Dot3 }
    from "~/sourcerer/tools/event-version-0.3/createVRID0Dot3";

import FalseProphet from "~/sourcerer/FalseProphet";
import TransactionState, { fabricatorOps } from "~/sourcerer/FalseProphet/TransactionState";

import { invariantify, invariantifyObject, thenChainEagerly, trivialClone } from "~/tools";
import valosUUID from "~/tools/id/valosUUID";

export default class FalseProphetDiscourse extends Discourse {
  _falseProphet: FalseProphet;
  _transactorState: ?TransactionState = null;
  _assignCommandId: (command: Command, discourse: FalseProphetDiscourse) => string;

  constructor (options: {
    parent: Object, verbosity: ?number, name: ?string,
    packFromHost: ?Function, unpackToHost: ?Function, steppers: Object,
    sourcerer: Object, assignCommandId: ?Function,
  }) {
    // goes to Valker
    super(options);
    invariantifyObject(parent, "FalseProphetDiscourse.constructor.parent");
    this._falseProphet = options.sourcerer;
    this._corpus = this._falseProphet._corpus; // This will be shadowed by transactor._corpus
    this._rootDiscourse = this;
    this._implicitlySyncingConnections = {};
    this.setDeserializeReference(this._falseProphet.deserializeReference);
    this.setState(this._falseProphet.getState());
    invariantify(this.state, "FalseProphetDiscourse.state");
    this._assignCommandId = options.assignCommandId || (command => {
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
  getIdentityManager () { return this.getFollower().getIdentityManager(); }

  setAssignCommandId (assignCommandId) {
    this._assignCommandId = assignCommandId;
  }

  run (head: any, kuery: any, options: Object): any {
    try {
      let actualOptions = options;
      if (!options) actualOptions = { discourse: this };
      else if (!options.discourse) {
        actualOptions = Object.create(options);
        actualOptions.discourse = this;
      } else if (this !== options.discourse) {
        return options.discourse.run(head, kuery, options);
      }
      return super.run(head, kuery, actualOptions);
    } catch (error) {
      addConnectToChronicleToError(error, this.connectToAbsentChronicle);
      throw error;
    }
  }

  acquireConnection (chronicleURI: ValaaURI,
      options: ConnectOptions = {}): ?Connection {
    options.discourse = this;
    return this._falseProphet.acquireConnection(chronicleURI, options);
  }

  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}):
      ChroniclePropheciesRequest {
    this.logEvent(1, () => ["chronicling", events.length, "events:", events]);
    if (this._transactorState) return this._transactorState.chronicleEvents(events, options);
    try {
      options.discourse = this;
      const ret = this._falseProphet.chronicleEvents(
          events.map(event => this._universalizeEvent(event)), options);

      ret.eventResults.forEach(eventResult => {
        const getPremiereStory = eventResult.getPremiereStory;
        eventResult.waitOwnReactions = (() => eventResult.getFollowerReactions(this.getFollower()));
        eventResult.getPremiereStory = () => thenChainEagerly(
            eventResult.waitOwnReactions(),
            () => getPremiereStory.call(eventResult));
      });

      return ret;
    } catch (error) {
      addConnectToChronicleToError(error, this.connectToAbsentChronicle);
      throw this.wrapErrorEvent(error, 1, `chronicleEvents()`,
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

  connectToAbsentChronicle = async (missingChronicleURI: ValaaURI) => {
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
    return this.getFollower().receiveCommands(commands, purgedRecital);
  }

  receiveTruths (truthEvents: EventBase[]) {
    return this.getFollower().receiveTruths(truthEvents);
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
      explicitRawId?: string, explicitSubResource?: string | Array) {
    try {
      if (!chronicleURI) throw new Error("assignNewVRID.chronicleURI missing");
      const root = this._transactorState ? this._transactorState.obtainRootEvent() : targetAction;
      if (!tryAspect(root, "command").id) this._assignCommandId(root, this);
      const chronicles = (root.meta || (root.meta = {})).chronicles || (root.meta.chronicles = {});
      const chronicle = chronicles[chronicleURI] || (chronicles[chronicleURI] = {});
      if (!chronicle.createIndex) chronicle.createIndex = 0;

      let subResource = explicitSubResource;
      if (subResource) { // case a -> 9, e -> d
        if (Array.isArray(subResource)) subResource = formVPath(...subResource);
        else validateVerbs(subResource);
        if (subResource[1] === "$") {
          throw new Error("explicit subResource must not have a GRId as first step");
        }
      } else if (!explicitRawId) {
        if (targetAction.typeName === "Property") {
          const propertyName = targetAction.initialState.name;
          if (!propertyName) {
            throw new Error(`${targetAction.type
                }.Property.initialState.name required for Property id secondary part`);
          }
          subResource = `@.$.${encodeURIComponent(propertyName)}@@`;
        }
      }

      let resourceVRID;
      if (subResource) {
        let parentVRID = getHostRef(
            targetAction.initialState.owner || targetAction.initialState.source,
            `${targetAction.type}.Property.initialState.owner`).rawId();
        if (parentVRID[0] !== "@") parentVRID = upgradeVRIDTo0Dot3(parentVRID);
        resourceVRID = `${parentVRID.slice(0, -2)}${subResource}`;
        /*
        resourceRawId = ((ownerRawId[0] !== "@") || (ownerRawId.slice(-2) !== "@@"))
            ? `${ownerRawId}@.$.${encodeURIComponent(propertyName)}`
            : `${ownerRawId.slice(0, -1)}.$.${encodeURIComponent(propertyName)}@@`;
        */
      } else if (!explicitRawId) {
        resourceVRID = createVRID0Dot3(
            root.aspects.command.id, chronicleURI, chronicle.createIndex++);
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
            naiveURI.validateChronicleURI(chronicleURI)));
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
      throw this.wrapErrorEvent(error, 1, "assignNewVRID()",
          "\n\ttargetAction:", ...dumpObject(targetAction),
          "\n\tchronicleURI:", ...dumpObject(chronicleURI),
          "\n\texplicitRawId:", ...dumpObject(explicitRawId),
          "\n\texplicitSubResource:", ...dumpObject(explicitSubResource),
      );
    }
  }

  assignNewUnchronicledVRID (targetAction: EventBase, explicitRawId?: string) {
    if (targetAction.typeName === "Property") {
      throw new Error(
          "Cannot create a resource id for a structural type 'Property' which is missing an owner");
    }
    targetAction.id = vRef(explicitRawId || `@$~u4.${valosUUID()}@@`);
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
