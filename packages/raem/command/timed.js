// @flow
import invariantify, { invariantifyString, invariantifyArray, invariantifyNumber,
    invariantifyObject } from "~/tools/invariantify";
import Command, { validateCommandInterface } from "~/raem/command/Command";
import { invariantifyId } from "~/raem/ValaaReference";

export const TIMED = "TIMED";

export class Timed extends Command {
  type: "TIMED";
  actions: ?Command[]; // action is an alias for sub-command.
  primaryPartition: ?string;
  time: number;
  startTime: ?number;
  interpolation: ?Object;
  extrapolation: ?Object;

  unrecognized: void;
}

/**
 * A delayed, command-ownership-transferring command.
 * TIMED will be expanded by appropriate partition service time-engine(s) at specified time into
 * concrete sub-commands.
 * These sub-commands are non-authoritative suggestions for the time-engine(s) to invoke.
 * The time-engine(s) is completely free to fully modify or ignore the sub-commands before
 * invokation, including their invokation time, command and resource ids and any sub-sub-commands.
 *
 * The 'time' argument is a context dependent timestamp suggestion, its meaning interpreted by the
 * authoritative time-engine(s).
 *
 * TIMED command is always associated with a primary partition, just like TRANSACTED is.
 * The authority of this partition, which usually is a time-engine, then accepts, rejects or
 * rewrites the command as usual.
 * The only guarantee for an accepted or rewritten TIMED command is that its sub-commands have been
 * form-, and schema-validated. Their sub-commands are still considered only suggestions and can be
 * fully rewritten or ignored.
 * This said, a well-behaving authoritative time-engine can also perform best-effort predictive
 * content validation and reports known rewrites already before accept/reject/rewrite -response,
 * and makes best effort to stick to these promises, even it can't guarantee them.
 *
 * Like other commands, TIMED command itself is considered resolved upon the accept/reject/rewrite
 * response but definitively before sub-command evaluation starts, even if the time specifies Now,
 * ie. the current instant.
 *
 * TODO(iridian): Create a suggested systematic but optional mechanism for time-engine(s) to report
 * rewrites that happen later: perhaps always execute TIMED contents in a TRANSACTED and make it
 * have sourceTimed pointing to the id of the source TIME command, with its contents being the
 * rewritten ones? There is no generic way to maintain sub-command correspondence to resolved
 * final sub-event correspondence because time-engine(s) can fully rewrite them. Nevertheless an
 * opt-in principle could be that the resolved TRANSACTED event contains same number of sub-commands
 * with rejected sub-commands being null commands.
 *
 * @export
 * @param {any} { commands, time, startTime = time, interpolation, extrapolation, }
 * @returns
 */
export default function timed (command: Timed): Command {
  command.type = TIMED;
  return validateTimed(command);
}

export function validateTimed (command: Timed, recursiveActionValidator: ?Function): Command {
  const {
    type, actions,
    primaryPartition, time, startTime, interpolation, extrapolation,
    // eslint-disable-next-line no-unused-vars
    version, commandId, eventId, partitions, parentId, timeStamp,
    ...unrecognized
  } = command;
  invariantifyString(type, "TIMED.type", { value: TIMED });
  invariantify(!Object.keys(unrecognized).length, "TIMED: command contains unrecognized fields",
      "\n\tunrecognized keys:", Object.keys(unrecognized),
      "\n\tunrecognized fields:", unrecognized,
      "\n\tcommand:", command);

  validateCommandInterface(command);

  invariantifyArray(actions, "TIMED.actions", {
    elementInvariant: recursiveActionValidator ||
        (action => action && (typeof action === "object") && action.type),
    suffix: " of command objects",
  }, "\n\tcommand:", command);
  invariantifyId(primaryPartition, "TIMED.primaryPartition",
      { allowUndefined: true }, "\n\tcommand:", command);
  invariantifyNumber(time, "TIMED.startTime",
      { allowUndefined: true }, "\n\tcommand:", command);
  invariantifyNumber(startTime, "TIMED.startTime",
      { allowUndefined: true }, "\n\tcommand:", command);
  invariantifyObject(interpolation, "TIMED.interpolation",
      { allowUndefined: true }, "\n\tcommand:", command);
  invariantifyObject(extrapolation, "TIMED.extrapolation",
      { allowUndefined: true }, "\n\tcommand:", command);

  return command;
}
