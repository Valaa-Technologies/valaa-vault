// @flow

import Action, { ActionCollection, validateActionCollectionBase } from "~/raem/events/Action";

export const TRANSACTED = "TRANSACTED";

export class Transacted extends ActionCollection {
  type: "TRANSACTED";
}

export default function transacted (action: Action): Transacted {
  action.type = TRANSACTED;
  return validateTransacted(action);
}

export function validateTransacted (action: Action, validateAction: ?Function): ?Transacted {
  const { actions, ...rest } = action;
  return validateActionCollectionBase(TRANSACTED, action, actions, rest, validateAction);
}
