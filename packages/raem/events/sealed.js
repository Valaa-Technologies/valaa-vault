// @flow

import Action, { ActionCollection, validateActionCollectionBase } from "~/raem/events/Action";
import { invariantifyArray, invariantifyNumber, invariantifyString } from "~/tools";

export const SEALED = "SEALED";

export class Sealed extends ActionCollection {
  type: "SEALED";

  invalidAntecedentIndex: number;
  invalidationReason: string;

  frozenPartitions: string[];
}

export default function sealed (action: Action): Sealed {
  action.type = SEALED;
  return validateSealed(action);
}

export function validateSealed (action: Action, validateAction: ?Function): Sealed {
  const { actions, invalidAntecedentIndex, invalidationReason, frozenPartitions, ...rest } = action;
  validateActionCollectionBase(SEALED, action, actions, rest, validateAction);
  invariantifyNumber(invalidAntecedentIndex, "SEALED.invalidAntecedentIndex");
  invariantifyString(invalidationReason, "SEALED.invalidationReason");
  invariantifyArray(frozenPartitions, "SEALED.frozenPartitions");
  return action;
}
