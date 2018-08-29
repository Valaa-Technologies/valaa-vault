// @flow

import { getPartitionRawIdFrom } from "~/raem/ValaaURI";
import { resolvePartitionURI } from "~/raem/tools/denormalized/partitions";

export default function partitionResolver (source: any, args: any,
    { rootValue: { resolver } }: Object) {
  const partitionURI = resolvePartitionURI(resolver, source.get("id"));
  return partitionURI && Object.create(resolver)
      .goToTransientOfRawId(getPartitionRawIdFrom(partitionURI), "ResourceStub");
}

export function partitionURIResolver (source: any, args: any,
    { rootValue: { resolver } }: Object) {
  const partitionURI = resolvePartitionURI(resolver, source.get("id"));
  return partitionURI && partitionURI.toString();
}

export function partitionHeadEventIdResolver (/* source, args, {
    parentType, returnType, fieldName, rootValue, } */) {
  // FIXME(iridian): Implement partitions.
  throw new Error("partitionHeadEventIdResolver not implemented");
}

export function partitionSnapshotResolver (/* source, args, {
    parentType, returnType, fieldName, rootValue, } */) {
  // FIXME(iridian): Implement partitions.
  throw new Error("partitionSnapshotResolver not implemented");
}

export function partitionDeepSnapshotResolver (/* source, args, {
    parentType, returnType, fieldName, rootValue, } */) {
  // FIXME(iridian): Implement partitions.
  throw new Error("partitionDeepSnapshotResolver not implemented");
}
