// @flow

import invariantify, { invariantifyArray, invariantifyObject, invariantifyString, }
    from "~/tools/invariantify";

export default class Action {
  +type: string;
  meta: ?Object;
  aspects: ?Object;

  unrecognized: ?void;
}

export class ActionCollection extends Action {
  +actions: ?Action[];
}

export class EventBase extends Action {}

export class Command extends EventBase {}
export class Truth extends EventBase {}

export function validateActionBase (expectedType: string, action: Action, rest: Object) {
  const { type, meta, aspects, ...unrecognized } = rest;
  invariantifyString(type, `${expectedType}.type`, { value: expectedType });
  invariantifyObject(meta, `${type}.meta`, { allowUndefined: true, allowEmpty: true });
  invariantifyObject(aspects, `${type}.aspects`, { allowUndefined: true, allowEmpty: true });
  if (Object.keys(unrecognized).length) {
    invariantify(false,
      `${expectedType} action contains unrecognized fields`,
      "\n\tunrecognized keys:", Object.keys(unrecognized),
      "\n\tunrecognized fields:", unrecognized);
  }
}

export function validateActionCollectionBase (expectedType: string, action: ActionCollection,
    actions, rest, validateAction: ?Function,
): ?ActionCollection {
  validateActionBase(expectedType, action, rest);

  invariantifyArray(actions, `${expectedType}.actions`, {
    elementInvariant: validateAction ||
        (subAction => subAction && (typeof subAction === "object") && subAction.type),
    suffix: " of sub-action objects",
  }, "\n\taction:", action);

  return action;
}
