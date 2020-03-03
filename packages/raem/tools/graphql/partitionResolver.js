// @flow

import { naiveURI } from "~/raem/ValaaURI";
import { resolveChronicleURI } from "~/raem/tools/denormalized/partitions";

export default function chronicleRootResolver (source: any, args: any,
    { rootValue: { resolver } }: Object) {
  const chronicleURI = resolveChronicleURI(resolver, source.get("id"));
  return chronicleURI && Object.create(resolver)
      .goToTransientOfRawId(naiveURI.getChronicleId(chronicleURI), "TransientFields");
}

export function chronicleURIResolver (source: any, args: any,
    { rootValue: { resolver } }: Object) {
  return resolveChronicleURI(resolver, source.get("id"));
}

export function partitionHeadEventIdResolver (/* source, args, {
    parentType, returnType, fieldName, rootValue, } */) {
  // FIXME(iridian): Implement chronicles.
  throw new Error("partitionHeadEventIdResolver not implemented");
}

export function partitionSnapshotResolver (/* source, args, {
    parentType, returnType, fieldName, rootValue, } */) {
  // FIXME(iridian): Implement chronicles.
  throw new Error("partitionSnapshotResolver not implemented");
}

export function partitionDeepSnapshotResolver (/* source, args, {
    parentType, returnType, fieldName, rootValue, } */) {
  // FIXME(iridian): Implement chronicles.
  throw new Error("partitionDeepSnapshotResolver not implemented");
}
