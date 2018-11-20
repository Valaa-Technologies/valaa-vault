// @flow

import Action, { ActionCollection, validateActionCollectionBase } from "~/raem/events/Action";
import { Duplicated, validateDuplicated } from "~/raem/events/duplicated";

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
  const { actions, ...rest } = action;
  return validateActionCollectionBase(RECOMBINED, action, actions, rest, validateDuplicated);
}
