import { Iterable } from "immutable";

import ValaaReference from "~/raem/ValaaReference";

import type { FieldInfo } from "~/raem/state/FieldInfo";

import dumpify from "~/tools/dumpify";
import { invariantifyString } from "~/tools/invariantify";

import { PackedHostValue, HostRef, tryHostRef } from "~/raem/VALK/hostReference";

// PackedField is a packed, datatype for accessing reference fields lazily. Potentially expensive
// operations like value elevations and sequence completions will only be performed when needed.

// TODO(iridian): Evaluate the whole concept of PackedField's. Before partially materialized
// sequence properties were a thing this lazy structure was properly defensible due to sequence
// indexing accesses: the internally stored raw sequence could be indexed and then only the indexed
// value could be elevated instead of having to elevate all entries of the sequence field. But now
// with partially materialized sequences the whole sequence needs to be elevated anyway.
// Optimization solutions will most likely rely on caching and reusing these elevated sequences.
// This means that discarding the packed field system is a potential option and it would allow
// simplifying the packed valaa object reference values to be strictly limited to direct and
// native-array-contained VRef's (for singular and sequence packed values respectively).

export type PackedField = {
  _singular?: any,
  _sequence?: any,
  _type: string,
  _fieldInfo: FieldInfo,
  toDumpify: Function
};

export function isPackedField (candidate: any) {
  return typeof candidate._type !== "undefined";
}

export function tryPackedField (value: any, fieldInfo: FieldInfo) {
  if (!fieldInfo.intro || !fieldInfo.intro.isPackable || (typeof value !== "object")
      || (value === null)) {
    return value;
  }
  return fieldInfo.intro.isSequence
      ? packedSequence(value, fieldInfo.intro.namedType.name, fieldInfo)
      : packedSingular(value, fieldInfo.intro.namedType.name, fieldInfo);
}


export function packedSingular (value, typeName, fieldInfo) {
  invariantifyString(typeName, "packed.typeName");
  return {
    [HostRef]: tryHostRef(value)
        || ((typeof value === "string") && new ValaaReference(value))
        || null,
    [PackedHostValue]: value,
    _singular: value,
    _type: typeName,
    _fieldInfo: fieldInfo,
    toDumpify: _dumpifyPackedSingular,
    toString () { return _dumpifyPackedSingular.call(this); }
  };
}
function _dumpifyPackedSingular (options?: any) {
  return `packed(${Iterable.isKeyed(this._singular)
        ? this._singular.get("id")
            ? `tr.id:'${this._singular.get("id")}'`
            : dumpify(this._singular, options)
        : `id:'${String(this._singular)}'`
      }:${this._type}<-${((this._fieldInfo || {}).sourceTransient
          && (this._fieldInfo || {}).sourceTransient.get("id")) || ""}@${
        (this._fieldInfo && this._fieldInfo.elevationInstanceId) || ""})`;
}

export function packedSequence (denormalizedSequence, entryTypeName, fieldInfo) {
  invariantifyString(entryTypeName, "packedSeq.entryTypeName");
  return {
    [HostRef]: null,
    [PackedHostValue]: denormalizedSequence,
    _sequence: denormalizedSequence,
    _type: entryTypeName,
    _fieldInfo: fieldInfo,
    toDumpify: _dumpifyPackedSequence,
    toString () { return _dumpifyPackedSequence.call(this); }
  };
}

function _dumpifyPackedSequence (options?: any) {
  return `packedSeq([${dumpify(this._sequence, options)}]:${this._type}<-${
      (this._fieldInfo && this._fieldInfo.sourceTransient.get("id")) || ""}@${
        (this._fieldInfo && this._fieldInfo.elevationInstanceId) || ""})`;
}
