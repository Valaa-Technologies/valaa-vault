// @flow

/**
 * # ValOS RAEM Event sourcing system.
 *
 * An `event` represents a `state` change such as a a creation of
 * a new resource or setting its name property. A sequence of events
 * then represents the full change history of some state from its
 * initial empty state.
 * This sequence is called the `event log` of that state.
 *
 * The state is abstract; it fundamentally doesn't exist anywhere
 * except conceptually as a product of the event log itself.
 * For example if some event log contains events which describe the
 * creation a total of ten resources, hundred connections between them
 * and set and override some of their properties then the abstract
 * state of this event log is by definition the state of all those
 * resources, connections and properties after the last event has been
 * applied.
 *
 * This process is called `reduction` and [it has a long history](https://en.wikipedia.org/wiki/Fold_(higher-order_function) )
 * . It is carried out by `reducer` functions which process the events
 * of the event log one by one while applying the changes to a concrete
 * state representation at the same time, starting from an initially
 * empty state before the first event, ending at the final state after
 * the last event.
 * The resources in this concrete, typically in-memory representation
 * can then be accessed by any computation. This computation can
 * finally then create new events to represent new modifications to the
 * state (in addition to any other useful side-effects).
 *
 * ## Event streams and partitions.
 *
 * Because the state essentially exists in the event logs this means
 * that only events need to be `streamed` from place to place. While
 * a completely distributed, symmetrical peer-to-peer sharing of
 * arbitrary events between all users is indeed possible this is often
 * not the most practical solution.
 *
 * ## Authorities - the backend servers and the sources of truths.
 *
 * An event log can be contained in a `partition` which is managed by
 * an `authority`. Each partition also has an identifier URL.
 * An authority then performs the traditional server backend role by
 * providing an API for forming `partition connections` to the
 * partitions it hosts using these partition ids.
 *
 * Each partition connection is a two-directional, asymmetrical event
 * stream to and from the event log of a particular partition.
 *
 * This connection contains `command` events moving `upstream` towards
 * the partition which when authorized by the authority transform
 * into `truth` events and move `dowstream` coming from the partition.
 *
 * ## Gateways - the frontend clients and application hosts.
 *
 * Application gateways are software components which typically run the
 * actual applications by managing the event reductions, performing
 * most of the computation and updating the user interfaces.
 * Thus they serve the traditional frontend, client-side role.
 * Gateways are heavy event consumers, command producers and the most
 * typical originator of partition connections towards authorities.
 *
 * ### Action reduction
 *
 * Events can contain sub-events. Both events and sub-events are called
 * actions: event is thus a synonym for "top-level action".
 *
 * An action is the primitive which is reduced by reducers to alter a
 * particular, concrete in-memory representation of the abstract state.
 *
 * Non-top-level actions are further divided to concrete and virtual
 * actions (top-level actions ie. events are always concrete).
 * Concrete actions are 'primary' actions that are serialized and then
 * either recorded or transmitted via partition connection event
 * streams.
 * Virtual actions are abstract actions which can be dynamically
 * derived from the primary actions. They represent side-effects of the
 * primary actions such as managing referential integrity of
 * back-references and recursive destruction of sub-resources.
 *
 * ### Stories - containers of truths with reduction metadata
 *
 * Bard subsystem introduces a third type of action called Story: this
 * is an internal helper object which contains useful reducer
 * by-product information for the benefit of components further
 * downstream inside a gateway, such as what entries were *actually*
 * added and removed from some list.
 *
 * ### Prophecies - non-universal, multi-partition command stories
 *
 * FalseProphet (in @valos/prophet) component introduces transactions.
 * These allow the grouping of a several resource changes together into
 * a single command. Prophecy is the Story of such a command, an
 * internal helper object which FalseProphet splits into per-partition
 * commands. The prophecy is then either accept or reject depending on
 * whether the transactionality requirements can be guaranteed or not.
 */

import resourceCreated, * as c from "./created";
import resourceDestroyed, * as d from "./destroyed";
import resourceDuplicated, * as dup from "./duplicated";
import * as m from "./modified";
import resourceFrozen, * as f from "./frozen";
import resourceRecombined, * as r from "./recombined";
import resourceTimed, * as td from "./timed";
import resourceTransacted, * as t from "./transacted";

import Action, { Command, Truth, EventBase } from "./Action";

export const VERSION = "0.2";

export { Action, Command, Truth, EventBase };

export const CREATED = c.CREATED;
export const DESTROYED = d.DESTROYED;
export const DUPLICATED = dup.DUPLICATED;
export const FIELDS_SET = m.FIELDS_SET;
export const ADDED_TO = m.ADDED_TO;
export const REMOVED_FROM = m.REMOVED_FROM;
export const REPLACED_WITHIN = m.REPLACED_WITHIN;
export const FROZEN = f.FROZEN;
export const RECOMBINED = r.RECOMBINED;
export const TIMED = td.TIMED;
export const TRANSACTED = t.TRANSACTED;
export const created = resourceCreated;
export const destroyed = resourceDestroyed;
export const duplicated = resourceDuplicated;
export const frozen = resourceFrozen;
export const recombined = resourceRecombined;
export const timed = resourceTimed;
export const transacted = resourceTransacted;
export const fieldsSet = m.fieldsSet;
export const addedTo = m.addedTo;
export const removedFrom = m.removedFrom;
export const replacedWithin = m.replacedWithin;

export function isActionLike (action: Action) {
  return !!actionValidators[VERSION][action.type];
}

export function isCreatedLike (action: Action) {
  return (action.type === CREATED) || (action.type === DUPLICATED);
}

export function isModifiedLike (action: Action) {
  return (action.type === FIELDS_SET) || (action.type === ADDED_TO)
      || (action.type === REMOVED_FROM) || (action.type === REPLACED_WITHIN);
}

export function isTransactedLike (action: Action) {
  return (action.type === TRANSACTED) || (action.type === TIMED) || (action.type === FROZEN)
      || (action.type === RECOMBINED);
}

export const actionValidators = {
  [VERSION]: {
    CREATED: c.validateCreated,
    DESTROYED: d.validateDestroyed,
    DUPLICATED: dup.validateDuplicated,
    FIELDS_SET: m.validateFieldsSet,
    ADDED_TO: m.validateAddedTo,
    REMOVED_FROM: m.validateRemovedFrom,
    REPLACED_WITHIN: m.validateReplacedWithin,
    FROZEN: f.validateFrozen,
    RECOMBINED: r.validateRecombined,
    TIMED: td.validateTimed,
    TRANSACTED: t.validateTransacted,
  }
};

export const validators = {
  [VERSION]: {
    ...actionValidators[VERSION],
  },
};
