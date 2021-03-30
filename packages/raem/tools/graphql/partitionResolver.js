// @flow

import { resolveChronicleURI } from "~/raem/tools/denormalized/partitions";

export default function chronicleRootResolver (source: any, args: any,
    { rootValue: { resolver } }: Object) {
  const chronicleURI = resolveChronicleURI(resolver, source.get("id"));
  if (!chronicleURI) return undefined;
  const [, chronicleId] = resolver.splitChronicleURI(chronicleURI);
  return Object.create(resolver)
      .goToTransientOfRawId(chronicleId, "TransientFields");
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
