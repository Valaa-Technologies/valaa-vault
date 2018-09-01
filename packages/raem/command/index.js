import resourceCreated, * as c from "./created";
import resourceDestroyed, * as d from "./destroyed";
import resourceDuplicated, * as dup from "./duplicated";
import resourceModified, * as m from "./modified";
import resourceFrozen, * as f from "./frozen";
import resourceRecombined, * as r from "./recombined";
import resourceTimed, * as td from "./timed";
import resourceTransacted, * as t from "./transacted";

import Command from "./Command";
import type { UniversalEvent } from "./UniversalEvent";

/**
 * Command subsystem.
 * Command's go upstream, AuthorizedEvent's or 'events' come back downstream.
 * Commands and events are together known as Action's: these can be reduced by the reducer
 * subsystems.
 *
 * Bard subsystem introduces a third type of Action, called Story: this is an auxiliary object
 * which contains reduction by-product information for the benefit of components further downstream.
 */

export { Command };
export type { UniversalEvent };
export type Action = Command | UniversalEvent;

export const CREATED = c.CREATED;
export const DESTROYED = d.DESTROYED;
export const DUPLICATED = dup.DUPLICATED;
export const MODIFIED = m.MODIFIED;
export const FIELDS_SET = m.FIELDS_SET;
export const ADDED_TO = m.ADDED_TO;
export const REMOVED_FROM = m.REMOVED_FROM;
export const REPLACED_WITHIN = m.REPLACED_WITHIN;
export const SPLICED = m.SPLICED;
export const FROZEN = f.FROZEN;
export const RECOMBINED = r.RECOMBINED;
export const TIMED = td.TIMED;
export const TRANSACTED = t.TRANSACTED;
export const created = resourceCreated;
export const destroyed = resourceDestroyed;
export const modified = resourceModified;
export const duplicated = resourceDuplicated;
export const frozen = resourceFrozen;
export const recombined = resourceRecombined;
export const timed = resourceTimed;
export const transacted = resourceTransacted;
export const fieldsSet = m.fieldsSet;
export const addedToFields = m.addedToFields;
export const removedFromFields = m.removedFromFields;
export const replacedWithinFields = m.replacedWithinFields;
export const spliceList = m.spliceList;
export const splicedFields = m.splicedFields;


export function isCreatedLike (command) {
  return (command.type === CREATED) || (command.type === DUPLICATED);
}

export function isTransactedLike (command) {
  return (command.type === TRANSACTED) || (command.type === TIMED) || (command.type === FROZEN)
      || (command.type === RECOMBINED);
}

export const validators = {
  CREATED: c.validateCreated,
  DESTROYED: d.validateDestroyed,
  DUPLICATED: dup.validateDuplicated,
  MODIFIED: m.validateModified,
  FIELDS_SET: m.validateModified,
  ADDED_TO: m.validateModified,
  REMOVED_FROM: m.validateModified,
  REPLACED_WITHIN: m.validateModified,
  SPLICED: m.validateModified,
  FROZEN: f.validateFrozen,
  RECOMBINED: r.validateRecombined,
  TIMED: td.validateTimed,
  TRANSACTED: t.validateTransacted,
};
