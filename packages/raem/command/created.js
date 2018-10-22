// @flow
import invariantify, { invariantifyBoolean, invariantifyTypeName, invariantifyString,
      invariantifyObject } from "~/tools/invariantify";
import Command, { validateCommandInterface } from "~/raem/command/Command";
import { invariantifyId } from "~/raem/ValaaReference";

export const CREATED = "CREATED";

export class Created extends Command {
  type: "CREATED";
  id: ?mixed;
  typeName: string;
  initialState: ?Object;
  files: ?Object;
  data: ?Object;

  noSubMaterialize: ?boolean;

  owner: void; // deprecated: this is here to facilitate explicit validation
  instancePrototype: void; // deprecated: this is here to facilitate explicit validation
  ghostPrototype: void; // deprecated: this is here to facilitate explicit validation
  unrecognized: void;
}

export default function created (command: Created): Command {
  command.type = CREATED;
  if (command.files) command.data = { files: command.files };
  delete command.files;
  return validateCreated(command);
}

export function validateCreated (command: Created): Command {
  const {
    type, id, typeName, initialState, files, data,
    // eslint-disable-next-line no-unused-vars
    version, commandId, eventId, partitions, parentId, timeStamp,
    noSubMaterialize,
    // deprecateds
    owner, instancePrototype, ghostPrototype,
    ...unrecognized
  }: Created = command;
  invariantifyString(type, "CREATED.type", { value: CREATED });
  invariantify(!Object.keys(unrecognized).length, "CREATED: command contains unrecognized fields",
      "\n\tunrecognized keys:", Object.keys(unrecognized),
      "\n\tunrecognized fields:", unrecognized,
      "\n\tcommand:", command);

  validateCommandInterface(command);

  invariantifyId(id, "CREATED.id", { allowUndefined: true }, "\n\tcommand:", command);
  invariantifyTypeName(typeName, "CREATED.typeName", {}, "\n\tcommand:", command);

  // TODO(iridian): Add more investigative initialState validation
  invariantifyObject(initialState, "CREATED.initialState",
      { allowUndefined: true, allowEmpty: true }, "\n\tcommand:", command);

  // TODO(iridian): Validate files properly
  invariantifyObject(files, "CREATED.files", { allowUndefined: true }, "\n\tcommand:", command);
  invariantifyObject(data, "CREATED.data", { allowUndefined: true, allowEmpty: true },
      "\n\tcommand:", command);

  invariantifyBoolean(noSubMaterialize, "CREATED.noSubMaterialize", { allowUndefined: true },
      "\n\tcommand:", command);

  // deprecated but accepted
  if (owner) {
    invariantifyObject(owner, "CREATED.owner", {}, "\n\tcommand:", command);
    invariantifyId(owner.id, "CREATED.owner.id", {}, "\n\tcommand:", command);
    invariantifyTypeName(owner.typeName, "CREATED.owner.typeName", {},
        "\n\tcommand:", command);
    invariantifyString(owner.property, "CREATED.owner.property", {}, "\n\tcommand:", command);
  }
  // deprecated but accepted
  invariantifyId(instancePrototype, "CREATED.instancePrototype", { allowUndefined: true },
      "\n\tcommand:", command);
  // deprecated but accepted
  invariantifyId(ghostPrototype, "CREATED.ghostPrototype", { allowUndefined: true },
      "\n\tcommand:", command);
  return command;
}
