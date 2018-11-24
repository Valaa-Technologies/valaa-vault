// @flow

import { Seq, Iterable } from "immutable";

import ValaaReference from "~/raem/ValaaReference";

export default function denormalizedFromJS (data) {
  if ((typeof data !== "object") || (data === null) || data instanceof ValaaReference) return data;
  if (Array.isArray(data)) return Seq(data).map(denormalizedFromJS).toList();
  if (data instanceof Set) return Seq(data).map(denormalizedFromJS).toOrderedSet();
  if (data instanceof Map) return Seq(data).map(denormalizedFromJS).toOrderedMap();
  if (Iterable.isIterable(data)) return data;
  return Seq(data).map(denormalizedFromJS).toOrderedMap();
}
