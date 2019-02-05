import { unthunkRepeat } from "~/inspire/ui/thunk";

const dumpify = require("~/tools/dumpify").default;

// TODO(iridian): A lot of this content should be straight-up moved to UIComponent.

export const skipPresentation = {};

function invariant (presentation, Decoratee, debugInfo) {
  if (presentation === skipPresentation) {
    return null;
  }
  if (!presentation) {
    throw new Error(`defaultPresentation missing for Presentable for class ${Decoratee.name} ${
        dumpify(debugInfo)}`);
  }
  return presentation;
}

const renameClass = name => Class => {
  const NamedClassThunk = new Function(// eslint-disable-line no-new-func
    "Class", `return function ${name}(props, context){ Class.call(this, props, context); };`
  )(Class);
  Reflect.setPrototypeOf(NamedClassThunk, Class);
  NamedClassThunk.prototype = Class.prototype;
  NamedClassThunk.prototype.constructor = NamedClassThunk;
  return NamedClassThunk;
};

export default (defaultPresentation, debugInfo) => Decoratee =>
    invariant(defaultPresentation, Decoratee, debugInfo) &&
@renameClass(`Presentable_${Decoratee.name}`)
class Presentable extends Decoratee {
  // TODO(iridian): Write invariant detection to prevent circular dependencies here.
  static _defaultPresentation = () => unthunkRepeat(defaultPresentation);
};
