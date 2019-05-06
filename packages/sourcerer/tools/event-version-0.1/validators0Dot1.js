// @flow

import invariantify, {
  invariantifyArray, invariantifyBoolean, invariantifyNumber, invariantifyString,
  invariantifyObject,
} from "~/tools/invariantify";
import { invariantifyId, invariantifyTypeName } from "~/raem/VRL";

import { dumpObject } from "~/tools";

export default {
  CREATED: validateCreated,
  DESTROYED: validateDestroyed,
  DUPLICATED: validateDuplicated,
  MODIFIED: validateModified,
  FIELDS_SET: validateModified,
  ADDED_TO: validateModified,
  REMOVED_FROM: validateModified,
  REPLACED_WITHIN: validateModified,
  SPLICED: validateModified,
  FROZEN: validateFrozen,
  RECOMBINED: validateRecombined,
  TIMED: validateTimed,
  TRANSACTED: validateTransacted,
};

function validateCommandInterface (command: Object) {
  const { type, version, commandId, eventId, partitions, parentId, timeStamp } = command;

  invariantifyString(version, `${type}.version`, { allowUndefined: true, value: "0.1" },
      "\n\tcommand:", command);
  invariantifyId(commandId, `${type}.commandId`, { allowUndefined: true },
      "\n\tcommand:", command);
  invariantifyNumber(eventId, `${type}.eventId`, { allowUndefined: true },
      "\n\tcommand:", command);
  invariantifyObject(partitions, `${type}.partitions`, { allowUndefined: true, allowEmpty: true },
      "\n\tcommand:", command);
  invariantifyId(parentId, `${type}.parentId`, { allowUndefined: true },
      "\n\tcommand:", command);
  invariantifyNumber(timeStamp, `${type}.timeStamp`, { allowUndefined: true },
      "\n\tcommand:", command);
}

function validateCreated (command: Object): Object {
  const {
    type, id, typeName, initialState, files, data,
    // eslint-disable-next-line no-unused-vars
    version, commandId, eventId, partitions, timeStamp,
    noSubMaterialize,
    // deprecateds
    // owner, instancePrototype, ghostPrototype,
    ...unrecognized
  }: Object = command;
  invariantifyString(type, "CREATED.type", { value: "CREATED" });
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
  /*
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
  */
  return command;
}

function validateDestroyed (command: Object): Object {
  const {
    type, id, typeName, dontUpdateCouplings,
    // eslint-disable-next-line no-unused-vars
    version, commandId, eventId, partitions, parentId, timeStamp,
    // deprecateds
    owner,
    ...unrecognized
  } = command;
  invariantifyString(type, "DESTROYED.type", { value: "DESTROYED" });
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

function validateDuplicated (command: Object): Object {
  const {
    type, id, duplicateOf, preOverrides, initialState,
    // eslint-disable-next-line no-unused-vars
    version, commandId, eventId, partitions, parentId, timeStamp,
    // deprecateds,
    owner, instancePrototype, ghostPrototype,
    ...unrecognized
  } = command;
  invariantifyString(type, "DUPLICATED.type", { value: "DUPLICATED" });
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

function validateFrozen (command: Object, recursiveActionValidator: ?Function): Object {
  return validateActionCollectionBase(command, "FROZEN", recursiveActionValidator);
}

function validateModified (command: Object): Object {
  const {
    type, id, typeName,
    sets, splices, adds, removes, dontUpdateCouplings,
    // eslint-disable-next-line no-unused-vars
    version, commandId, eventId, partitions, parentId, timeStamp,
    ...unrecognized
  } = command;
  invariantifyString(type, "MODIFIED.type", {
    value: ["MODIFIED", "FIELDS_SET", "ADDED_TO", "REMOVED_FROM", "REPLACED_WITHIN", "SPLICED"],
  });
  invariantify(!Object.keys(unrecognized).length, `${type}: command contains unrecognized fields`,
      "\n\tunrecognized keys:", Object.keys(unrecognized),
      "\n\tunrecognized fields:", unrecognized,
      "\n\tcommand:", command);

  validateCommandInterface(command);

  invariantifyId(id, `${type}.id`, {}, "\n\tcommand:", command);
  invariantifyTypeName(typeName, `${type}.typeName`, {}, "\n\tcommand:", command);
  const count = (sets ? 1 : 0) + (splices ? 1 : 0) + (adds ? 1 : 0) + (removes ? 1 : 0);
  invariantify(count === (type !== "REPLACED_WITHIN" ? 1 : 2),
      `${type} has extraneous fields, can have only one of: sets, adds, removes, splices`,
      "\n\tcommand:", command);
  if ((type === "FIELDS_SET") || command.sets) validateFieldsSet(command);
  if ((type === "ADDED_TO") || (command.adds && (type !== "REPLACED_WITHIN"))) {
    validateAddedToFields(command);
  }
  if ((type === "REMOVED_FROM") || (command.removes && (type !== "REPLACED_WITHIN"))) {
    validateRemovedFromFields(command);
  }
  if ((type === "REPLACED_WITHIN")) validateReplacedWithinFields(command);
  if ((type === "SPLICED") || command.splices) validateSplicedFields(command);
  invariantifyBoolean(dontUpdateCouplings, `${type}.dontUpdateCouplings`, { allowUndefined: true },
      "\n\tcommand:", command);
  return command;
}

function validateFieldsSet (command: Object) {
  invariantifyObject(command.sets, "FIELDS_SET.sets",
      { elementInvariant: (value, key) => key && (typeof key === "string") },
      "\n\tcommand:", command);
  return command;
}

function validateAddedToFields (command: Object, type: string = "ADDED_TO") {
  invariantifyObject(command.adds, `${type}.removes`, {
    elementInvariant: (value, key) => key
        && (typeof key === "string")
        && invariantifyArray(value, `${type}.adds['${key}'], with:`,
            {},
            "\n\tcommand.adds:", command.adds,
            "\n\tcommand:", command)
  }, "\n\tcommand:", command);
  return command;
}

function validateRemovedFromFields (command: Object, type: string = "REMOVED_FROM") {
  invariantifyObject(command.removes, `${type}.removes`, {
    elementInvariant: (value, key) => key
        && (typeof key === "string")
        && invariantifyArray(value, `${type}.removes['${key}'], with:`,
            { allowNull: true },
            "\n\tcommand.removes:", command.removes,
            "\n\tcommand:", command)
  }, "\n\tcommand:", command);
  return command;
}

function validateReplacedWithinFields (command: Object) {
  validateRemovedFromFields(command, "REPLACED_WITHIN");
  validateAddedToFields(command, "REPLACED_WITHIN");
  return command;
}

function validateSplicedFields (command: Object) {
  console.error("DEPRECATED: SPLICED\n\tprefer: REPLACE_WITHIN",
      "\n\tcommand:", ...dumpObject(command));
  invariantifyObject(command.splices, "SPLICED.splices", {
    elementInvariant: (value, key) => key && (typeof key === "string")
        && (value.values || value.captureIndex || value.removeNum),
  }, "\n\tcommand:", command);
  return command;
}

function validateRecombined (command: Object): Object {
  return validateActionCollectionBase(command, "RECOMBINED", validateDuplicated);
}

function validateTimed (command: Object, recursiveActionValidator: ?Function): Object {
  const {
    type, actions,
    primaryPartition, time, startTime, interpolation, extrapolation,
    // eslint-disable-next-line no-unused-vars
    version, commandId, eventId, partitions, parentId, timeStamp,
    ...unrecognized
  } = command;
  invariantifyString(type, "TIMED.type", { value: "TIMED" });
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

function validateTransacted (command: Object, recursiveActionValidator: ?Function): Object {
  return validateActionCollectionBase(command, "TRANSACTED", recursiveActionValidator);
}

function validateActionCollectionBase (command: Object, typeValue: string,
    recursiveActionValidator: ?Function): Object {
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
