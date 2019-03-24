// @flow

import { Seq, Iterable } from "immutable";

import VRL from "~/raem/VRL";

export default function denormalizedFromJS (data) {
  if ((typeof data !== "object") || (data === null) || (data instanceof VRL)) {
    return data;
  }
  if (Array.isArray(data)) return Seq(data).map(denormalizedFromJS).toList();
  if (data instanceof Set) return Seq(data).map(denormalizedFromJS).toOrderedSet();
  if (data instanceof Map) return Seq(data).map(denormalizedFromJS).toOrderedMap();
  if (Iterable.isIterable(data)) return data;
  return Seq(data).map(denormalizedFromJS).toOrderedMap();
}
