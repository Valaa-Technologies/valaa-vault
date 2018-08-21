import dumpify from "~/tools/dumpify";
import getObjectField from "~/raem/tools/denormalized/getObjectField";

export default function immutableResolver (source, args, context) {
  try {
    // console.log(`Resolving immutable ${parentType.name}.${fieldName}: ${returnType}`);
    const ret = getObjectField(context.rootValue.resolver, source, context.fieldName);
    if (!ret) {
      if (typeof ret === "undefined") {
        context.rootValue.logger.warn(`Expected a defined value, got undefined for field '${
            context.fieldName}' in object: ${
                dumpify(source, { sliceAt: 200, sliceSuffix: "...}" })}`);
      }
      if (context.fieldName === "id") {
        context.rootValue.logger.warn("null id for object: ",
            dumpify(source, { sliceAt: 200, sliceSuffix: "...}" }));
      }
    }
    // console.log("  Got", dumpify(ret));
    return ret;
  } catch (error) {
    const suggestion = error.message.slice(0, 10) !== "source.get" ? "" : `
  Is this a mutation resolver? If so, remember to wrap resolver in mutationResolver.`;
    context.rootValue.logger.error(`During immutableResolver for field ${context.fieldName}
  from source: ${dumpify(source, { sliceAt: 1000, sliceSuffix: "...}" })}
  forwarding exception: ${error.message.slice(0, 140)}...${suggestion}`);
    throw error;
  }
}
