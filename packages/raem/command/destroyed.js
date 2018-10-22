// @flow
import invariantify, { invariantifyString, invariantifyTypeName, invariantifyBoolean }
    from "~/tools/invariantify";
import Command, { validateCommandInterface } from "~/raem/command/Command";
import { invariantifyId } from "~/raem/ValaaReference";

export const DESTROYED = "DESTROYED";

export class Destroyed extends Command {
  type: "DESTROYED";
  id: mixed;
  dontUpdateCouplings: ?boolean;

  typeName: ?string; // deprecated but not denied, defaults to "Resource" in resolvers.
  owner: void; // deprecated: this is here to facilitate explicit validation
  unrecognized: void;
}

export default function destroyed (command: Destroyed): Command {
  command.type = DESTROYED;
  return validateDestroyed(command);
}

export function validateDestroyed (command: Destroyed): Command {
  const {
    type, id, typeName, dontUpdateCouplings,
    // eslint-disable-next-line no-unused-vars
    version, commandId, eventId, partitions, parentId, timeStamp,
    // deprecateds
    owner,
    ...unrecognized
  } = command;
  invariantifyString(type, "DESTROYED.type", { value: DESTROYED });
  invariantify(!Object.keys(unrecognized).length, "DESTROYED: command contains unrecognized fields",
      "\n\tunrecognized keys:", Object.keys(unrecognized),
      "\n\tunrecognized fields:", unrecognized,
      "\n\tcommand:", command);

  validateCommandInterface(command);

  invariantifyId(id, "DESTROYED.id", {}, "\n\tcommand:", command);
  invariantifyBoolean(dontUpdateCouplings, "DESTROYED.dontUpdateCouplings", { allowUndefined: true },
      "\n\tcommand:", command);

  // deprecated and denied, this shouldn't exist in the wild
  invariantifyTypeName(typeName, "DEPRECATED: DESTROYED.typeName", { allowUndefined: true },
      "\n\tcommand:", command);
  invariantify(typeof owner === "undefined", "DEPRECATED: DESTROYED.owner",
      "\n\tprefer: omit owner altogether",
      "\n\tcommand:", command);
  return command;
}
