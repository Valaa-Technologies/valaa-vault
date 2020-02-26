// @flow

import type Connection from "./Connection";
import type Transactor from "./Transactor";

import FabricEvent, { FabricEventTypesTag } from "~/tools/FabricEvent";

/**
 * Fabricator is a nestable sub-component of a Transactor. Each
 * fabricator is responsible for fabricating a TRANSACTED action and
 * its sub-actions. The root fabricator of a transactor is responsible
 * for the root TRANSACTED command.
 *
 * Fabricator implements the HTML5 EventTarget interface and receives
 * a number of events which relate to
 * 1. command and action fabrication in general,
 * 2. chronicle behaviors in specific,
 * 3. the command to truth lifecycle.
 * These events are granular to particular fabricator and its specific
 * action.
 * Specifically; a new, nested script 'frame' fabricator is created for
 * each script call instance which has a potential needs to fabricate
 * new actions. Event listeners attached to this frame can react to
 * events that arise from these specific actions.
 *
 * @export
 * @class Fabricator
 */
export type Fabricator = Transactor & EventTarget & {
  releaseFabricator: () => void,
};

export class FabricatorEvent extends FabricEvent {
  // TransactorEvent fields
  command: Object;
  prophecy: Object;

  // FabricatorEvent fields
  action: ?Object;

  preConditions: ?Function[];
  postConditions: ?Function[];

  errorOrigin: string;
  instigatorConnection: Connection;

  // reformation fields
  schismaticCommand: Connection;

  isSchismatic: ?boolean; // If not set to false the prophecy will undergo reformation.
                          // If true at the end of the reformation the prophecy will be extracted
                          // from the primary recital as heresy.
  isRevisable: ?boolean; // If set to false, schism cannot by synchronously revised
  isReformable: ?boolean; // If set to false, a heresy cannot be reformed even asynchronously
  isRefabricateable: ?boolean; // If set to false, the command cannot be refabricated

  proceedWhenTruthy (...maybeAsyncConditions) {
    (this._proceedWhenTruthy || (this._proceedWhenTruthy = [])).push(...maybeAsyncConditions);
    this.isRevisable = false;
  }

  reformWhenTruthy (...maybeAsyncConditions) {
    this.proceedWhenTruthy(...maybeAsyncConditions);
    this.isReformable = true;
  }

  refabricateWhenTruthy (...maybeAsyncConditions) {
    this.proceedWhenTruthy(...maybeAsyncConditions);
    this.isReformable = false;
    this.isRefabricateable = true;
  }
}

export const fabricatorEventTypes = {
  error: {
    name: "error",
    interface: "FabricatorEvent",
    target: "Fabricator",
    description: `Fired at a fabricator frame when a script, fabrication or behavior error occurs${
        ""} inside the fabrication context.`,
    bubbles: true,
    cancelable: true,
    defaultAction: {
      setIfUndefined: {
        isSchismatic: true,
        isRevisable: false,
        isReformable: true,
      },
    },
  },
  precondition: {
    name: "precondition",
    interface: "FabricatorEvent",
    target: "Fabricator",
    description: `Fired at all fabricator frames in depth-first pre-order during initial${
      ""} fabrication as well as during later reformations and refabrications.${
      ""} TODO: specify the pure-kuery validator API and implement`,
    bubbles: false,
    cancelable: false,
    defaultAction: {
      call: ["validatePreConditions"],
    },
  },
  postcondition: {
    name: "postcondition",
    interface: "FabricatorEvent",
    target: "Fabricator",
    description: `Fired at fabricator frames  in depth-first post-order during initial${
      ""} fabrication as well as during later reformations and refabrications.${
      ""} TODO: specify the pure-kuery validator API and implement`,
    bubbles: false,
    cancelable: false,
    defaultAction: {
      call: ["validatePostConditions"],
    },
  },
  beforecompose: {
    name: "beforecompose",
    interface: "FabricatorEvent",
    target: "Transactor",
    description: `Fired at transactor when its command is about to be composed into a prophecy${
      ""} and made part of a recital, both during initial chronicle and later reformations.`,
    bubbles: true,
    cancelable: true,
  },
  aftercompose: {
    name: "aftercompose",
    interface: "FabricatorEvent",
    target: "Transactor",
    description: `Fired at transactor when its command has been successfully composed into${
      ""} a prophecy as part of a recital, both during initial chronicle and later reformations.`,
    bubbles: true,
    cancelable: true,
  },
  schism: {
    name: "schism",
    interface: "FabricatorEvent",
    target: "Fabricator",
    description: `Fired at all fabricator frames of a command prophecy which is established to ${
      ""} be schismatic and which is subsequently going to be subject to a reformation.`,
    bubbles: false,
    cancelable: true,
    defaultAction: {
      setIfUndefined: {
        isRevisable: true,
      }
    },
  },
  review: {
    name: "review",
    interface: "FabricatorEvent",
    target: "Fabricator",
    description: `Fired at fabricator frames during reformation of a schismatic prophecy in${
      ""} depth-first post-order, immediately after the corresponding frame postcondition event.`,
    bubbles: true,
    cancelable: true,
    defaultAction: {
      setAlways: {
        isSchismatic: false,
      },
    },
  },
  reform: {
    name: "reform",
    interface: "FabricatorEvent",
    target: "Fabricator",
    description: "Fired at all fabricator frames in depth-first post-order",
    bubbles: true,
    cancelable: true,
    defaultAction: {
      setAlways: {
        isSchismatic: false,
      },
    },
  },
  purge: {
    name: "purge",
    interface: "FabricatorEvent",
    target: "Transactor",
    description: `Fired at transactor when a prophecy is purged from the recital${
      ""} in the synchronous phase of the reformation`,
    bubbles: true,
    cancelable: false,
  },
  persist: {
    name: "persist",
    interface: "FabricatorEvent",
    target: "Transactor",
    description: `Fired at transactor when its command has been locally persisted.`,
    bubbles: true,
    cancelable: false,
  },
  truth: {
    name: "persist",
    interface: "FabricatorEvent",
    target: "Transactor",
    description: `Fired at transactor when its command has been established as truth.`,
    bubbles: true,
    cancelable: false,
  },
};

export const fabricatorMixinOps = {
  addPreCondition (name: String, validator: Function) {
    throw new Error(`addPrediction(${name}, ${validator.name}) not implemented`);
  },

  addPostCondition (name: String, validator: Function) {
    throw new Error(`addPrediction(${name}, ${validator.name}) not implemented`);
  },

  validatePreConditions (/* event: Event */) {},
  validatePostConditions (/* event: Event */) {},

  [FabricEventTypesTag]: fabricatorEventTypes,
};
