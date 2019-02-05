// @flow

// import { getNullableType } from "graphql/type";

import type { Transient } from "~/raem/state/Transient";

const dumpify = require("~/tools/dumpify").default;

// context { rootValue, returnType, parentType, fieldName, operation, fragments, fieldASTs, schema }
export default function ghostHostResolver (source: Transient, args: any[], context: Object) {
  try {
    // console.log(`Resolving link ${context.parentType.name}.${context.fieldName}: ${
    //    returnType.name}`);
    const ghostPath = source.get("id").tryGhostPath();
    if (!ghostPath || !ghostPath.isGhost()) return null;
    const ghostHostRawId = ghostPath.headHostRawId();
    if (!ghostHostRawId) return null;
    const resolver = context.rootValue.resolver.fork();
    return resolver.goToTransientOfRawId(ghostHostRawId, "Resource");
  } catch (error) {
    const suggestion = error.message.slice(0, 10) !== "source.get" ? "" : `
  Is this a mutation resolver? If so, remember to wrap resolver in mutationResolver.`;
    context.rootValue.resolver.error(`During ghostHostResolver
  from source: ${dumpify(source, { sliceAt: 1000, sliceSuffix: "...}" })}
  forwarding exception: ${error.message.slice(0, 140)}...${suggestion}`);
    throw error;
  }
}
