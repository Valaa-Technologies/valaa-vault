// @flow

import getObjectField from "~/raem/state/getObjectField";

const dumpify = require("~/tools/dumpify").default;

function listLinkResolver (source: any, args: any, context: Object) {
  try {
    // console.log(`Resolving list link ${context.parentType.name}.${context.fieldName}: ${
    //    returnType.name}`);
    const ret = getObjectField(context.rootValue.resolver, source, context.fieldName);
    if (!ret) {
      if (ret === null) return null;
      context.rootValue.logger.warn(`Expected link id sequence or null, got ${
          dumpify(ret, { sliceAt: 100 })} for field '${context.fieldName}' in object: ${
          dumpify(source, { sliceAt: 200, sliceSuffix: "...}" })}`);
      return null;
    }
    if (!Array.isArray(ret)) {
      context.rootValue.logger.warn(`Expected proper link id sequence, got ${
          dumpify(ret, { sliceAt: 100 })} for field '${context.fieldName}' in object: ${
          dumpify(source, { sliceAt: 200, sliceSuffix: "...}" })}`);
      return null;
    }
    return ret.map(entry => context.rootValue.resolver.goToTransient(entry));
  } catch (error) {
    const suggestion = error.message.slice(0, 10) !== "source.get" ? "" : `
  Is this a mutation resolver? If so, remember to wrap resolver in mutationResolver.`;
    context.rootValue.logger.error(`During listLinkResolver for field ${context.fieldName}
  from source: ${dumpify(source, { sliceAt: 1000, sliceSuffix: "...}" })}
  forwarding exception: ${error.message.slice(0, 140)}...${suggestion}`);
    throw error;
  }
}

export default listLinkResolver;
