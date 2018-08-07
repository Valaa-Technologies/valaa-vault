module.exports = vdocorate;

module.exports.toVDoc = toVDoc;
module.exports.vdocorate = vdocorate;

/**
 * Decorates the target with the given jsdoc-VDON.
 *
 * @param {*} jsdocVDON
 * @returns
 */
function vdocorate (jsdocVDON) {
  const vdoc = toVDoc(jsdocVDON);
  return function vdocDecorator (target, memberName, descriptor) {
    Object.defineProperty(descriptor ? descriptor.value : target,
        "vdoc",
        { value: vdoc, enumerable: false, writable: true, configurable: true });
    return descriptor || target;
  };
}

/**
 * Converts the given jsdoc-VDON into VDoc.
 *
 * @param {*} jsdocVDON
 * @returns
 */
function toVDoc (jsdocVDON) {
  if (typeof jsdocVSON === "string") {
    return toVDoc(jsdocVDON.split(/\s*\n\s*/g));
  }
  if (Array.isArray(jsdocVDON)) {
    return jsdocVDON.map(entry_ => {
      const entry = (typeof entry_ === "string" && entry_[0] === "@") ? entry_.split(" ") : entry_;
      if (Array.isArray(entry) && ((entry[0] || "")[0] === "@")) {
        return { [entry[0]]: entry };
      }
      return entry;
    });
  }
  return jsdocVDON;
}
