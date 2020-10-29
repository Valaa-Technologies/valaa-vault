// @flow

import Action, { validateActionBase } from "~/raem/events/Action";

import { invariantifyString } from "~/tools/invariantify";

export const INVALIDATED = "INVALIDATED";

export class Invalidated extends Action {
  type: "INVALIDATED";

  invalidationReason: string;
  invalidEvent: Object;
}

export default function destroyed (action: Action): Invalidated {
  action.type = INVALIDATED;
  return validateInvalidated(action);
}

export function validateInvalidated (action: Action): Invalidated {
  const { id, invalidationReason, invalidEvent, ...rest }: Invalidated = action;

  validateActionBase(INVALIDATED, action, rest);
  invariantifyString(invalidationReason, "INVALIDATED.invalidationReason");
  // specifically no invalidation for invalidEvent

  return action;
}
