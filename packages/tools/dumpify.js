const isSymbol = require("@valos/tools/isSymbol").default;

/**
 *  Returns debug dump of a value as a string, including its type.
 *
 *  The output is not intended to be machine readable: sliceAt will clip it at surprising locations
 *  and decircularization will replace duplicate/circular sub-sections with tags.
 *
 *  @param value the string to dumpify
 *  @param options.indent                forwarded JSON.stringify third parameter
 *  @param options.sliceAt               the max length of the dump string
 *  @param options.sliceSuffix           the suffix appended to the dump if it got sliced
 *  @param options.cache                 the cache object for decircularization/deduplication
 *  @param options.expandComplexObjects  if true will expand non-array, non-plain objects as well
 *  @param options.expandDuplicates      if true will expand duplicate objects. Only useful if the
 *                                       object is a directed graph, so that dumpification doesn't
 *                                       result in circular recursion
 */
export default function dumpify (value, options: Object = {}) {
  if (!options.cache) options.cache = new Map();
  try {
    const ret = JSON.stringify(value, replacer, options.indent);
    if (!options.sliceAt || !ret || !(options.sliceAt < ret.length)) return ret;
    return `${ret.slice(0, options.sliceAt)}${options.sliceSuffix || ""}`;
  } catch (error) {
    console.error("Error forwarded during dumpify:", value);
    throw error;
  }
  function replacer (key, value_) {
    if (value_ === undefined) return `<undefined>`;
    if (value_ === null) return `<null>`;
    if (typeof value_ === "function") return `<function ${value_.name}()>`;
    if (isSymbol(value_)) return `<Symbol ${value_.toString()}>`;
    if (typeof value_ !== "object") return value_;

    const proto = Object.getPrototypeOf(value_);
    const isPlain = Array.isArray(value_) || (proto === Object.prototype);
    let objectIndex = options.cache.get(value_);
    const isNew = (objectIndex === undefined);
    if (isNew) options.cache.set(value_, (objectIndex = options.cache.size + 1));
    if ((options.expandDuplicates !== true) && !isNew) {
      return `<${((value_ != null) && (value_.constructor || {}).name) || (typeof value_)
          } seen #${objectIndex}>`;
    }
    if (value_.toDumpify) return value_.toDumpify(options);
    if (value_ instanceof Date) return value_.toString();
    if ((options.expandComplexObjects !== true) && !isPlain) {
      return `<${(value_.constructor || {}).name || "ComplexObject"} #${objectIndex}>`;
    }
    return value_;
  }
}
