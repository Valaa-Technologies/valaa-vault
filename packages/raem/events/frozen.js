// @flow

import Action, { ActionCollection, validateActionCollectionBase } from "~/raem/events/Action";

export const FROZEN = "FROZEN";

export class Frozen extends ActionCollection {
  type: "FROZEN";
  frozenPartitions: string[];
}

export default function frozen (action: Action): Frozen {
  action.type = FROZEN;
  return validateFrozen(action);
}

export function validateFrozen (action: Action, validateAction: ?Function): Frozen {
  const { actions, frozenPartitions, ...rest } = action;
  validateActionCollectionBase(FROZEN, action, actions, rest, validateAction);
  return action;
}
