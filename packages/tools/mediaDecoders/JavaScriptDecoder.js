// @flow

import MediaDecoder from "~/tools/MediaDecoder";
import wrapError from "~/tools/wrapError";

export default class JavaScriptDecoder extends MediaDecoder {
  static mediaTypes = [
    { type: "application", subtype: "javascript" },
    { type: "application", subtype: "x-javascript" },
    { type: "application", subtype: "javascript" },
    { type: "application", subtype: "ecmascript" },
  ];

  decode (buffer: ArrayBuffer): Function {
    const source = this.stringFromBuffer(buffer);
    return function _integrateNativeProgram (globalObject: Object) {
      return _importFromString(source, globalObject).exports;
    };
  }
}

// TODO: investigate eval alternatives
export function _importFromString (source: string, explicitModuleGlobal?: Object) {
  try {
    const moduleGlobal = explicitModuleGlobal || createModuleGlobal();
    // Emulate node -style module import system for js files.
    moduleGlobal.exports = {};
    moduleGlobal.module = { exports: moduleGlobal.exports };
    // eslint-disable-next-line
    Function("window",
`with (window) (function () {
${source}
})();`
    )(moduleGlobal);
    const exports = moduleGlobal.module.exports;
    delete moduleGlobal.exports;
    delete moduleGlobal.module;
    return { global: moduleGlobal, exports };
  } catch (error) {
    throw wrapError(error, `During _importFromString(), with:`,
        "\n\tsource:", { source });
  }
}

let sharedGlobalProxy;

export function getSharedGlobal () {
  if (!sharedGlobalProxy) {
    sharedGlobalProxy = _createForwarder(self || global, self || global);
  }
  return sharedGlobalProxy;
}

export function createModuleGlobal (explicitGlobalPrototype?: Object) {
  const ret = Object.create(explicitGlobalPrototype || getSharedGlobal());
  Object.defineProperty(ret, "window", { get: () => ret });
  Object.defineProperty(ret, "self", { value: ret });
  Object.defineProperty(ret, "global", { value: ret });
  return ret;
}

function _createForwarder (object, target) {
  let prototype = Object.getPrototypeOf(object);
  if (prototype !== Object.prototype) prototype = _createForwarder(prototype, target);
  const forwarder = Object.create(prototype);
  Object.entries(Object.getOwnPropertyDescriptors(object)).forEach(([propertyName, descriptor]) => {
    if (propertyName === "window") {
      return;
    }
    const newDescriptor = { ...descriptor };
    if (descriptor.get) {
      newDescriptor.get = function get () { return descriptor.get.call(target); };
    }
    if (descriptor.set) {
      newDescriptor.set = function set (value: any) { return descriptor.set.call(target, value); };
    }
    if ((typeof descriptor.value === "function") && !descriptor.value.prototype) {
      // eslint-disable-next-line prefer-rest-params
      newDescriptor.value = function value () { return descriptor.value.apply(target, arguments); };
    }
    Object.defineProperty(forwarder, propertyName, newDescriptor);
  });
  return forwarder;
}
