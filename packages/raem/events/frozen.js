// @flow

import Action, { ActionCollection, validateActionCollectionBase } from "~/raem/events/Action";

export const FROZEN = "FROZEN";

export class Frozen extends ActionCollection {
  type: "FROZEN";
}

export default function frozen (action: Action): Frozen {
  action.type = FROZEN;
  return validateFrozen(action);
}

export function validateFrozen (action: Action, validateAction: ?Function): Frozen {
  const { type, local, actions, ...unrecognized } = action;
  return validateActionCollectionBase(FROZEN, action, type, local, actions, unrecognized,
      validateAction);
}
