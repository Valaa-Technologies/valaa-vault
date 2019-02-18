exports.default = function inBrowser () {
  return ((typeof global === "undefined")
          || Object.prototype.toString.call(global.process) !== "[object process]")
      && !_inJest();
}

function _inJest () {
  return (typeof window !== "undefined") && window.afterAll;
}
