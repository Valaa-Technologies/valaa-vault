// @flow
import invariantify, { invariantifyString, invariantifyArray } from "~/tools/invariantify";
import Command, { validateCommandInterface } from "~/raem/command/Command";

export const TRANSACTED = "TRANSACTED";

export interface TransactedLike extends Command {
  +actions: ?Command[]; // alias name for sub-command
  unrecognized: ?void;
}

export class Transacted extends Command {
  type: "TRANSACTED";
  actions: ?Command[]; // alias name for sub-command

  unrecognized: ?void;
}

export default function transacted (command: Transacted): Command {
  command.type = TRANSACTED;
  return validateTransacted(command);
}

export function validateTransacted (command: Transacted,
    recursiveActionValidator: ?Function): Command {
  return validateTransactedLike(command, TRANSACTED, recursiveActionValidator);
}

export function validateTransactedLike (command: TransactedLike, typeValue: string,
    recursiveActionValidator: ?Function): Command {
  const {
    type, actions,
    // eslint-disable-next-line no-unused-vars
    version, commandId, eventId, partitions, parentId, timeStamp,
    ...unrecognized
  } = command;

  invariantifyString(type, `${type}.type`, { value: typeValue });
  invariantify(!Object.keys(unrecognized).length,
      "TRANSACTED: command contains unrecognized fields",
      "\n\tunrecognized keys:", Object.keys(unrecognized),
      "\n\tunrecognized fields:", unrecognized,
      "\n\tcommand:", command);

  validateCommandInterface(command);

  invariantifyArray(actions, `${type}.actions`, {
    elementInvariant: recursiveActionValidator ||
        (action => action && (typeof action === "object") && action.type),
    suffix: " of command objects",
  }, "\n\tcommand:", command);
  return command;
}
