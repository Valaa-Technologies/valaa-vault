// @flow

export default function inBrowser () {
  return ((typeof global === "undefined")
          || Object.prototype.toString.call(global.process) !== "[object process]")
      && !inJest();
}

export function inJest () {
  return (typeof window !== "undefined") && window.afterAll;
}
