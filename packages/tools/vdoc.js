module.exports = function vdoc (jsdocVDON) {
  const documentationVDON = _convertIntoVDON(jsdocVDON);
  return function vdocDecorator (target, memberName, descriptor) {
    Object.defineProperty(descriptor ? descriptor.value : target,
        "vdoc",
        { value: documentationVDON, enumerable: false, writable: true, configurable: true });
    return descriptor || target;
  };
};

function _convertIntoVDON (jsdocVDON) {
  if (typeof jsdocVSON === "string") {
    return _convertIntoVDON(jsdocVDON.split(/\s*\n\s*/g));
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
