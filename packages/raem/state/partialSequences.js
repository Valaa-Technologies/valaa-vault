// @flow

import { OrderedSet } from "immutable";

// If a sequence field has this field specified, the field value is a sequence-diff field on top of
// the prototype field(s). The entries in the field value are additions, and the entries in the
// RemoveDiffs are removals to the prototype entries. Removes are done before the adds.
// This allows for reordering even inherited entries by having the same entry appear in both remove
// and add diff sequences.
export const PartialRemovesTag = Symbol("RemoveDiffs");
const _emptyRemovesSet = OrderedSet();

export function shouldAddAsPartialRemove (/* entry: any */) {
  // TODO(iridian): Implement: Only add inherited values to removediffs. Adding all values there
  // will not be a semantic issue, but will leak memory (as removed entries will never get garbage
  // collected, including their id's and any cache lookups which depend on those).
  return true;
}

export function separatePartialSequence (value: any) {
  if (!value) return { valueAsSet: OrderedSet(), removeDiffs: _emptyRemovesSet };
  return {
    valueAsSet: value.toOrderedSet(),
    removeDiffs: value[PartialRemovesTag],
  };
}

export function combineAsPartialSequence (value: any, removeDiffs: any) {
  if (!value || (typeof removeDiffs === "undefined")) return value;
  const ret = Object.create(value);
  ret[PartialRemovesTag] = removeDiffs;
  return ret;
}

