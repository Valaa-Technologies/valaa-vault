// @flow

import { Command, EventBase, Truth } from "~/raem/events";

import { LogEventGenerator } from "~/tools/Logger";

import type { ChronicleOptions, ChronicleRequest, ChronicleEventResult } from "./types";

/**
 * Interface for events flowing downstream
 */
export default class Follower extends LogEventGenerator {
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
   * @returns {type}               if these commands originates from a local chronicleEvent call,
   *                               any return values are returned back to it, possibly as promises.
   *                               This is to facilitate more complex interactive logic (such as UI
   *                               interactions) in a straightforward async/await fashion.
   */
  receiveCommands (commands: Command[]): Promise<(Promise<EventBase> | EventBase)[]> { // eslint-disable-line
    throw new Error(`receiveCommands not implemented by ${this.constructor.name}`);
  }

  /**
   * rejectHeresy - reject an earlier command as false, resetting the corpus to state before it.
   *
   * @param  {type} hereticEvent  earlier command rejected as heresy ie. not part of knowledge
   * @param  {type} purgedCorpus  state of knowledge before the heresy
   * @param  {type} revisedEvents list of earlier events whose changes were purged from the corpus
   *                              and which are going to be revised ie. revealed again.
   * @returns {type}              description
   */
  rejectHeresy (hereticEvent, purgedCorpus, revisedEvents) { // eslint-disable-line
    throw new Error(`rejectHeresy not implemented by ${this.constructor.name}`);
  }

  /**
   * Record events into the upstream.
   *
   * @param {ChronicleOptions} [options={}]
   * @returns {Promise<Object>}
   * @memberof PartitionConnection
   */
  chronicleEvents (events: EventBase[], options: ChronicleOptions = {}): ChronicleRequest { // eslint-disable-line
    throw new Error(`chronicleEvents not implemented by ${this.constructor.name}`);
  }

  chronicleEvent (event: EventBase, options: ChronicleOptions = {}): ChronicleEventResult {
    return this.chronicleEvents([event], options).eventResults[0];
  }
}
