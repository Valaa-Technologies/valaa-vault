// @flow

import type Connection from "./Connection";
import type Transactor from "./Transactor";

import FabricEvent, { FabricEventTypesTag } from "~/tools/FabricEvent";

import { declarations } from "~/sourcerer/On";

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
 * 3. the command-into-truth lifecycle.
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

  proceedAfterAll (...maybeAsyncConditions) {
    for (let condition of maybeAsyncConditions) {
      if (typeof condition === "function") condition = new Promise(condition);
      (this._proceedAfterAll || (this._proceedAfterAll = [])).push(condition);
    }
    this.isRevisable = false;
  }

  reformAfterAll (...maybeAsyncConditions) {
    this.proceedAfterAll(...maybeAsyncConditions);
    this.isReformable = true;
  }

  refabricateAfterAll (...maybeAsyncConditions) {
    this.proceedAfterAll(...maybeAsyncConditions);
    this.isReformable = false;
    this.isRefabricateable = true;
  }
}

export const fabricatorEventTypes = Object.fromEntries(Object
    .entries(declarations)
    .filter(([, declaration]) => declaration.tags.includes("FabricEvent"))
    .map(([name, declaration]) => ([name, { name, ...declaration }])));

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
