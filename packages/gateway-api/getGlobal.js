Object.defineProperty(exports, "__esModule", { value: true });

exports.default = function getGlobal () {
  return (typeof global !== "undefined") ? global
    : (typeof window !== "undefined") ? window
    : (typeof self !== "undefined") ? self
    : ((() => { throw new Error("Cannot determine global object"); })());
};
