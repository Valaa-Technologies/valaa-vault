// @flow

import { Action, ActionCollection, validateActionCollectionBase } from "~/raem/command/Command";

export const TRANSACTED = "TRANSACTED";

export class Transacted extends ActionCollection {
  type: "TRANSACTED";
}

export default function transacted (action: Action): Transacted {
  action.type = TRANSACTED;
  return validateTransacted(action);
}

export function validateTransacted (action: Action, validateAction: ?Function): ?Transacted {
  const { type, local, actions, ...unrecognized } = action;
  return validateActionCollectionBase(TRANSACTED, action, type, local, actions, unrecognized,
      validateAction);
}
