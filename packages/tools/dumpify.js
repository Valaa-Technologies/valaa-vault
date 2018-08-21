import isSymbol from "~/tools/isSymbol";

/**
 *  Returns debug dump of a value as a string, including its type.
 *
 *  The output is not intended to be machine readable: sliceAt will clip it at surprising locations
 *  and decircularization will replace duplicate/circular sub-sections with tags.
 *
 *  @param value the string to dumpify
 *  @param options.indent      forwarded JSON.stringify third parameter
 *  @param options.sliceAt the max length of the dump string
 *  @param options.sliceSuffix the suffix appended to the dump if it got sliced
 *  @param options.cache       the cache object for decircularization
 */
export default function dumpify (value, options: Object) {
  let ret;
  const cache = (options && options.cache) || new Map();
  try {
    if (value === undefined) ret = `<undefined>`;
    else if (value === null) ret = `<null>`;
    else if (typeof value === "function") ret = `<function ${value.name}()>`;
    else if (isSymbol(value)) ret = `<Symbol ${value.toString()}>`;
    else if (typeof value === "object") {
      const cacheIndex = cache.get(value);
      if (typeof cacheIndex !== "undefined") return `<circular ref #${cacheIndex}>`;
      if (value.toDumpify) return value.toDumpify(cache);
      if (value instanceof Date) return value.toString();
      ret = `${value.constructor ? `${value.constructor.name} ` : ""}${
          JSON.stringify(value, decirculator)}`;
      const proto = Object.getPrototypeOf(value);
      if (proto) {
        const suffix = proto.constructor
            ? `:${proto.constructor.name}`
            : `->${dumpify(proto, { cache })}`;
        ret += suffix;
      }
    } else if (typeof value === "string") ret = value;
    else ret = JSON.stringify(value, decirculator, options.indent);

    if (options.sliceAt && ret && (options.sliceAt < ret.length)) {
      return `${ret.slice(0, options.sliceAt)}${options.sliceSuffix || ""}`;
    }
    return ret;
  } catch (error) {
    console.error("Error forwarded during dumpify:", value);
    throw error;
  }
  function decirculator (key, innerValue) {
    if (typeof innerValue === "object" && innerValue !== null) {
      const cacheIndex = cache.get(innerValue);
      if (typeof cacheIndex !== "undefined") {
        // Circular reference found, discard key
        return `<circular ref #${cacheIndex}>`;
      }
      // Store value in our collection
      cache.set(innerValue, cache.size + 1);
      if (innerValue.toDumpify) return innerValue.toDumpify(cache);
    }
    if (typeof innerValue === "function") return innerValue.toString();
    return innerValue;
  }
}
