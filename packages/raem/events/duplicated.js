// @flow

import Action, { validateActionBase } from "~/raem/events/Action";
import { invariantifyId } from "~/raem/ValaaReference";

import { invariantifyObject } from "~/tools/invariantify";

export const DUPLICATED = "DUPLICATED";

export class Duplicated extends Action {
  type: "DUPLICATED";

  id: ?mixed;
  duplicateOf: string;
  preOverrides: ?Object;
  initialState: ?Object;
}

export default function duplicated (action: Action): Duplicated {
  action.type = DUPLICATED;
  return validateDuplicated(action);
}

export function validateDuplicated (action: Action): Duplicated {
  const { id, duplicateOf, preOverrides, initialState, ...rest } = action;

  validateActionBase(DUPLICATED, action, rest);

  invariantifyId(id, "DUPLICATED.id", { allowUndefined: true, allowNull: true });
  invariantifyId(duplicateOf, "DUPLICATED.duplicateOf", {});

  // TODO(iridian): Add more investigative preOverrides/initialState validation
  invariantifyObject(preOverrides, "DUPLICATED.preOverrides", { allowUndefined: true });
  invariantifyObject(initialState, "DUPLICATED.initialState", { allowUndefined: true });

  return action;
}
