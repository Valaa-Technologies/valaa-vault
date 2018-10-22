// @flow
import invariantify, { invariantifyTypeName, invariantifyString, invariantifyObject }
    from "~/tools/invariantify";
import Command, { validateCommandInterface } from "~/raem/command/Command";
import { invariantifyId } from "~/raem/ValaaReference";

export const DUPLICATED = "DUPLICATED";

export class Duplicated extends Command {
  type: "DUPLICATED";
  id: ?mixed;
  duplicateOf: string;
  preOverrides: ?Object;
  initialState: ?Object;

  owner: void; // deprecated: this is here to facilitate explicit validation
  instancePrototype: void; // deprecated: this is here to facilitate explicit validation
  ghostPrototype: void; // deprecated: this is here to facilitate explicit validation
  unrecognized: void;
}

export default function duplicated (command: Duplicated): Command {
  command.type = DUPLICATED;
  return validateDuplicated(command);
}

export function validateDuplicated (command: Duplicated): Command {
  const {
    type, id, duplicateOf, preOverrides, initialState,
    // eslint-disable-next-line no-unused-vars
    version, commandId, eventId, partitions, parentId, timeStamp,
    // deprecateds,
    owner, instancePrototype, ghostPrototype,
    ...unrecognized
  } = command;
  invariantifyString(type, "DUPLICATED.type", { value: DUPLICATED });
  invariantify(!Object.keys(unrecognized).length,
      "DUPLICATED: command contains unrecognized fields",
      "\n\tunrecognized keys:", Object.keys(unrecognized),
      "\n\tunrecognized fields:", unrecognized,
      "\n\tcommand:", command);

  validateCommandInterface(command);

  invariantifyId(id, "DUPLICATED.id", { allowUndefined: true, allowNull: true },
      "\n\tcommand:", command);
  invariantifyId(duplicateOf, "DUPLICATED.duplicateOf", {},
      "\n\tcommand:", command);

  // TODO(iridian): Add more investigative sourceState/initialState validation
  invariantifyObject(preOverrides, "DUPLICATED.preOverrides", { allowUndefined: true },
      "\n\tcommand:", command);
  invariantifyObject(initialState, "DUPLICATED.initialState", { allowUndefined: true },
      "\n\tcommand:", command);

  // deprecated but accepted
  if (owner) {
    invariantifyObject(owner, "DUPLICATED.owner", {}, "\n\tcommand:", command);
    invariantifyId(owner.id, "DUPLICATED.owner.id", {}, "\n\tcommand:", command);
    invariantifyTypeName(owner.typeName, "DUPLICATED.owner.typeName", {},
        "\n\tcommand:", command);
    invariantifyString(owner.property, "DUPLICATED.owner.property", {},
        "\n\tcommand:", command);
  }
  // deprecated but accepted
  invariantifyId(instancePrototype, "DUPLICATED.instancePrototype", { allowUndefined: true },
      "\n\tcommand:", command);
  // deprecated but accepted
  invariantifyId(ghostPrototype, "DUPLICATED.ghostPrototype", { allowUndefined: true },
      "\n\tcommand:", command);
  return command;
}
