// @flow
import invariantify, { invariantifyString, invariantifyBoolean, invariantifyObject,
    invariantifyArray, invariantifyTypeName } from "~/tools/invariantify";
import Command, { validateCommandInterface } from "~/raem/command/Command";
import { invariantifyId } from "~/raem/ValaaReference";
import { dumpObject } from "~/tools";

export const MODIFIED = "MODIFIED";
export const FIELDS_SET = "FIELDS_SET";
export const ADDED_TO = "ADDED_TO";
export const REMOVED_FROM = "REMOVED_FROM";
export const REPLACED_WITHIN = "REPLACED_WITHIN";
export const SPLICED = "SPLICED";

export class Modified extends Command {
  type: "MODIFIED" | "FIELDS_SET" | "ADDED_TO" | "REMOVED_FROM" | "REPLACED_WITHIN" | "SPLICED";
  id: mixed;
  typeName: string;
  sets: ?Object;
  splices: ?Object;
  adds: ?Object;
  removes: ?Object;
  dontUpdateCouplings: ?boolean;

  unrecognized: ?void;
}

export default function modified (command: Modified): Command {
  if (!command.type) command.type = MODIFIED;
  return validateModified(command);
}

export function validateModified (command: Modified): Command {
  const {
    type, id, typeName,
    sets, splices, adds, removes, dontUpdateCouplings,
    // eslint-disable-next-line no-unused-vars
    version, commandId, eventId, partitions, parentId, timeStamp,
    ...unrecognized
  } = command;
  invariantifyString(type, "MODIFIED.type", {
    value: [MODIFIED, FIELDS_SET, ADDED_TO, REMOVED_FROM, REPLACED_WITHIN, SPLICED],
  });
  invariantify(!Object.keys(unrecognized).length, `${type}: command contains unrecognized fields`,
      "\n\tunrecognized keys:", Object.keys(unrecognized),
      "\n\tunrecognized fields:", unrecognized,
      "\n\tcommand:", command);

  validateCommandInterface(command);

  invariantifyId(id, `${type}.id`, {}, "\n\tcommand:", command);
  invariantifyTypeName(typeName, `${type}.typeName`, {}, "\n\tcommand:", command);
  const count = (sets ? 1 : 0) + (splices ? 1 : 0) + (adds ? 1 : 0) + (removes ? 1 : 0);
  invariantify(count === (type !== REPLACED_WITHIN ? 1 : 2),
      `${type} has extraneous fields, can have only one of: sets, adds, removes, splices`,
      "\n\tcommand:", command);
  if ((type === FIELDS_SET) || command.sets) validateFieldsSet(command);
  if ((type === ADDED_TO) || (command.adds && (type !== REPLACED_WITHIN))) {
    validateAddedToFields(command);
  }
  if ((type === REMOVED_FROM) || (command.removes && (type !== REPLACED_WITHIN))) {
    validateRemovedFromFields(command);
  }
  if ((type === REPLACED_WITHIN)) validateReplacedWithinFields(command);
  if ((type === SPLICED) || command.splices) validateSplicedFields(command);
  invariantifyBoolean(dontUpdateCouplings, `${type}.dontUpdateCouplings`, { allowUndefined: true },
      "\n\tcommand:", command);
  return command;
}

/**
 * For Map/object type properties
 * sets = { property: value, ... }
 */
export function fieldsSet (command: Modified, sets: Object) {
  command.type = FIELDS_SET;
  command.sets = sets;
  invariantify(sets, "fieldsSet: must specify sets", "\n\tcommand:", command);
  return modified(command);
}

export function validateFieldsSet (command: Modified) {
  invariantifyObject(command.sets, "FIELDS_SET.sets",
      { elementInvariant: (value, key) => key && (typeof key === "string") },
      "\n\tcommand:", command);
  return command;
}

/**
 * For Set type properties.
 * If an added entry already exists in the target set it is implicitly removed before adding it
 * back. Because the sets are ordered by their insertion this has the
 * intended effect of moving the added entry to the end of the sequence. Thus the iteration of the
 * target field will contain the adds as a strict sub-sequence. An existing entry which is in this
 * way only reordered will not cause coupling updates and will not otherwise be visible as a new
 * addition.
 * This means that ADDED_TO can be used to reorder sequences by adding the whole sequence in the
 * newly desired order. This does not allow removal of entries however; see REPLACED_WITHIN for
 * the fully generic replacement as combination of REMOVED_FROM and ADDED_TO.
 * adds: { property: value, ... } or { property: [ value1, value2, ...], ... }
 */
export function addedToFields (command: Modified, adds: Object) {
  command.type = ADDED_TO;
  command.adds = adds;
  invariantify(adds, "addedToFields: must specify adds", "\n\tcommand:", command);
  return modified(command);
}

export function validateAddedToFields (command: Modified, type: string = "ADDED_TO") {
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

// TODO(iridian): This API is horrible. Fix it.
/**
 * For Set type properties
 * adds: { property: value, ... } or { property: [ value1, value2, ...], ... }
 */
export function removedFromFields (command: Modified, removes: Object) {
  command.type = REMOVED_FROM;
  command.removes = removes;
  invariantify(removes, "removedFromFields: must specify removes", "\n\tcommand:", command);
  return modified(command);
}

export function validateRemovedFromFields (command: Modified, type: string = "REMOVED_FROM") {
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

/**
 * REPLACED_WITHIN is semantically an alias for a REMOVED_FROM followed by an ADDED_TO.
 * This combination allows the replacement of any arbitrary subset of values with an arbitrary
 * ordered set.
 * The removes and adds sequences must be disjoint; all entries in the adds are considered
 * implicitly removed as per ADDED_TO semantics.
 */
export function replacedWithinFields (command: Modified, removes: Object, adds: Object) {
  command.type = REPLACED_WITHIN;
  command.removes = removes;
  command.adds = adds;
  invariantify(removes, "replacedWithinFields: must specify removes", "\n\tcommand:", command);
  invariantify(adds, "replacedWithinFields: must specify adds", "\n\tcommand:", command);
  return modified(command);
}

export function validateReplacedWithinFields (command: Modified) {
  validateRemovedFromFields(command, "REPLACED_WITHIN");
  validateAddedToFields(command, "REPLACED_WITHIN");
  return command;
}

/**
 * Create a new splice for splicedFields below. Starting from index, first removeNum number of
 * entries are removed, after which the entries in values list are inserted at the same location.
 * @captureIndex {number}: If specified, values are ignored and the added entries are instead
 *   retrieved from an earlier spliceList performed on the same _property_, specified by this index.
  */
export function spliceList (/* { index = 0, removeNum, values, captureIndex }: Object */) {
  throw new Error("DEPRECATED: SPLICED\n\tprefer: REPLACE_WITHIN");
  // return { index, removeNum, values, captureIndex };
}

// TODO(iridian): This API is horrible. Fix it.
/**
 * For List type properties.
 * splices = { property: spliceList, ... } or { property: [ spliceList1, spliceList2, ...] }
 */
export function splicedFields (/* command: Modified, splices: Object */) {
  throw new Error("DEPRECATED: SPLICED\n\tprefer: REPLACE_WITHIN");
  /*
  command.type = SPLICED;
  command.splices = splices;
  invariantify(splices, "splicedFields: must specify splices", "\n\tcommand:", command);
  return modified(command);
  */
}

export function validateSplicedFields (command: Modified) {
  console.error("DEPRECATED: SPLICED\n\tprefer: REPLACE_WITHIN",
      "\n\tcommand:", ...dumpObject(command));
  invariantifyObject(command.splices, "SPLICED.splices", {
    elementInvariant: (value, key) => key && (typeof key === "string")
        && (value.values || value.captureIndex || value.removeNum),
  }, "\n\tcommand:", command);
  return command;
}
