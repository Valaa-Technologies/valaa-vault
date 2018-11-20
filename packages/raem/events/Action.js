// @flow

import invariantify, {
  invariantifyArray, invariantifyNumber, invariantifyObject, invariantifyString,
} from "~/tools/invariantify";

export default class Action {
  +type: string;
  local: ?Object;

  unrecognized: ?void;
}

export class ActionCollection extends Action {
  +actions: ?Action[];
}

export class EventBase extends Action {
  commandId: string;
}

export class EventEnvelope extends EventBase {
  event: {
    hash: string;
    text: string;
  };
  logIndex: number;
  timeStamp: ?number;
  prevCommandId: string;
}

export class Command extends EventEnvelope {
  type: "COMMAND";
}

export class Truth extends EventEnvelope {
  type: "TRUTH";
  chainHash: string;
}

export function validateActionBase (expectedType: string, action: Action, rest: Object) {
  const { type, local, aspects, ...unrecognized } = rest;
  invariantifyString(type, `${expectedType}.type`, { value: expectedType });
  invariantifyObject(local, `${type}.local`, { allowUndefined: true, allowEmpty: true });
  if (Object.keys(unrecognized).length) {
    // migration code - these are being removed from Action
    const { version, commandId, timeStamp, logIndex, ...rest } = unrecognized;
    if (Object.keys(rest).length) {
      invariantify(false,
        `${expectedType} action contains unrecognized fields`,
        "\n\tmigratee keys:", Object.keys(unrecognized),
        "\n\tmigratee fields:", unrecognized,
        "\n\tunrecognized keys:", Object.keys(rest),
        "\n\tunrecognized fields:", rest);
    }
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

export function validateEvent (command: EventBase) {
  const { type, version, commandId, eventId, timeStamp } = command;

  invariantifyString(version, `${type}.version`, { allowUndefined: true },
      "\n\taction:", command);
  invariantifyString(commandId, `${type}.commandId`, { allowUndefined: true },
      "\n\taction:", command);
  invariantifyNumber(eventId, `${type}.eventId`, { allowUndefined: true },
      "\n\taction:", command);
  invariantifyNumber(timeStamp, `${type}.timeStamp`, { allowUndefined: true },
      "\n\taction:", command);
}

export function validateTruth (truth: Truth) {

}
