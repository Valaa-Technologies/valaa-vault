// @flow

import Action, { validateActionBase } from "~/raem/events/Action";
import { invariantifyId } from "~/raem/VRL";

export const DESTROYED = "DESTROYED";

export class Destroyed extends Action {
  type: "DESTROYED";

  id: mixed;
}

export default function destroyed (action: Action): Destroyed {
  action.type = DESTROYED;
  return validateDestroyed(action);
}

export function validateDestroyed (action: Action): Destroyed {
  const { id, ...rest }: Destroyed = action;

  validateActionBase(DESTROYED, action, rest);

  invariantifyId(id, "DESTROYED.id", {}, "\n\taction:", action);
  return action;
}
