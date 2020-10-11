// @flow

import { Command, EventBase, Truth } from "~/raem/events";

import { FabricEventTarget } from "~/tools/FabricEvent";

import type { ProclaimOptions, Proclamation, ProclaimEventResult } from "./types";

/**
 * Interface for events flowing downstream
 */
export default class Follower extends FabricEventTarget {
  /**
   * receiveTruths - receive truth events coming from the upstream
   *
   * @param  {type} truthEvent   earlier command confirmed as truth ie. part of knowledge
   * @returns {type}             description
   */
  receiveTruths (truth: Truth[]): Promise<(Promise<EventBase> | EventBase)[]> { // eslint-disable-line
    throw new Error(`receiveTruths not implemented by ${this.constructor.name}`);
  }

  /**
   * receiveCommands - receive commands ie. possible future truth events.
   *
   * @param  {type} commands       list of uncertain future truth event
   * @returns {type}               if these commands originates from a local proclaimEvent call,
   *                               any return values are returned back to it, possibly as promises.
   *                               This is to facilitate more complex interactive logic (such as UI
   *                               interactions) in a straightforward async/await fashion.
   */
  receiveCommands (commands: Command[], purgedRecital: Object): // eslint-disable-line
      Promise<(Promise<EventBase> | EventBase)[]> {
    throw new Error(`receiveCommands not implemented by ${this.constructor.name}`);
  }

  /**
   * Record events into the upstream.
   * Takes ownership of the *events* (ie. can mutate them).
   *
   * @param {ProclaimOptions} [options={}]
   * @returns {Promise<Object>}
   * @memberof Connection
   */
  proclaimEvents (events: EventBase[], options: ProclaimOptions = {}): Proclamation { // eslint-disable-line
    throw new Error(`proclaimEvents not implemented by ${this.constructor.name}`);
  }

  proclaimEvent (event: EventBase, options: ProclaimOptions = {}): ProclaimEventResult {
    return this.proclaimEvents([event], options).eventResults[0];
  }

  getIdentityManager () { return null; }
}
