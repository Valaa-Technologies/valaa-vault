
import dataFieldValue from "~/raem/tools/denormalized/dataFieldValue";

import valaaHash from "~/tools/id/valaaHash";
import { wrapError } from "~/tools/wrapError";

const dumpify = require("~/tools/dumpify").default;

export default function literalResolver (source, args, context) {
  try {
    const type = dataFieldValue(source, "type");
    const data = JSON.stringify(dataFieldValue(source, "value"));
    const specificSuffix = type === "String" ? `/${encodeURIComponent(data)}` :
        type === "Number" ? `:Number/${encodeURIComponent(data)}` :
        type === "Boolean" ? `:Boolean/${encodeURIComponent(data)}` :
        type === "Object" ? `:JSON/${encodeURIComponent(data)}` :
        type === "null" ? ":null" : null;
    if (!specificSuffix) {
      throw new Error(`Malformed Literal URI of type '${type}': ${data}`);
    }
    return `tag://valaa.com,2017:Literal${specificSuffix}`;
  } catch (error) {
    const suggestion = error.message.slice(0, 10) !== "source.get" ? "" : `
  Is this a mutation resolver? If so, remember to wrap resolver in mutationResolver.`;
    context.rootValue.logger.error(`During literalResolver from source: ${
      dumpify(source, { sliceAt: 1000, sliceSuffix: "...}" })}...
  forwarding exception: ${error.message.slice(0, 140)}...${suggestion}`);
    throw wrapError(error, `During literalResolver from source:`, source);
  }
}

/**
 * Returns a denormalized Literal representation of value
 */
export function literalFromValue (value) {
  // TODO(iridian): In a wrong place, Literal is defined in @valos/script, this is @valos/raem
  // TODO(iridian): Literal's currently only support String, Number and Boolean, everything else
  // goes to null silently. This might be surprising.
  const type = byValueType(value, {
    whenString: "String",
    whenNumber: "Number",
    whenBoolean: "Boolean",
    whenJSON: "JSON",
    whenNull: "null",
  });
  const ret = {
    typeName: "Literal",
    type,
    value: type === "null" ? null : value,
  };
  ret.id = valaaHash(ret);
  return ret;
}

export function byValueType (value, { whenString, whenNumber, whenBoolean, whenJSON, whenNull }) {
  switch (typeof value) {
    case "string": return whenString;
    case "number": return whenNumber;
    case "boolean": return whenBoolean;
    case "object": if (value) return whenJSON; // esling-disable-line no-fallthrough
    default: return whenNull;
  }
}
