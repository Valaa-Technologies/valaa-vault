// @flow

import Action, { validateActionBase } from "~/raem/events/Action";
import { invariantifyId, invariantifyTypeName } from "~/raem/ValaaReference";

import { invariantifyObject } from "~/tools/invariantify";

export const CREATED = "CREATED";

export class Created extends Action {
  type: "CREATED";

  id: ?mixed;
  typeName: string;
  initialState: ?Object;
}

export default function created (action: Action): Created {
  action.type = CREATED;
  return validateCreated(action);
}

export function validateCreated (action: Action): Created {
  const { type, local, id, typeName, initialState, ...unrecognized }: Created = action;

  validateActionBase(CREATED, action, type, local, unrecognized);

  invariantifyId(id, "CREATED.id", { allowUndefined: true }, "\n\taction:", action);
  invariantifyTypeName(typeName, "CREATED.typeName", {}, "\n\taction:", action);

  // TODO(iridian): Add more investigative initialState validation
  invariantifyObject(initialState, "CREATED.initialState",
      { allowUndefined: true, allowEmpty: true }, "\n\taction:", action);

  return action;
}
