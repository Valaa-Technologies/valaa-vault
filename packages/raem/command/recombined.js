// @flow

import { Action, ActionCollection, validateActionCollectionBase } from "~/raem/command/Command";
import { Duplicated, validateDuplicated } from "~/raem/command/duplicated";

export const RECOMBINED = "RECOMBINED";

export class Recombined extends ActionCollection {
  type: "RECOMBINED";
  actions: Duplicated[];
}

export default function recombined (action: Action): Recombined {
  action.type = RECOMBINED;
  return validateRecombined(action);
}

export function validateRecombined (action: Recombined): Recombined {
  const { type, local, actions, ...unrecognized } = action;
  return validateActionCollectionBase(RECOMBINED, action, type, local, actions, unrecognized,
      validateDuplicated);
}
