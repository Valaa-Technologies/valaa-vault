// @flow

import path from "path";
import { dumpObject, inProduction, isPromise, request, wrapError, inBrowser } from "~/tools";

// Revelation is a JSON object for which any expected sub-object can be replaced with an XHR
// reqwest option object, identified by the presence of key 'url': { url: "..." }.
// The consumers of the Revelation will lazily (or never) asynchronously request such an object
// via awaiting on the corresponding property.
//
// Only properties which have a template value set can be deferred this way.
//
// As an example, the inspire revelation.blobBuffers looks like:
// ```
// {
//   "somebobcontenthash": { "base64": "v0987c1r1bxa876a8s723f21=" },
//   "otherblobcontenthash": { "base64": "b7b98q09au2322h3f2j3hf==" },
//   "thirdcontenthash": { "url": http://url.com/to/buffer52" },
// }
// ```
// And the corresponding buffer template in revelation.template.js:
// ```
//   blobBuffers: dictionaryOf({ base64: "" }),
// ```
//
// TODO(iridian): Figure if exposed string content could be wrapped inside a wrapper, ie. if in
// above base the http://url.com/to/blob52 resolves to string content (not as a JSON object with
// "base64" field), it might be useful if by convention only JSON objects were resolved directly,
// but flat text and any other content was automatically wrapped inside an object, possibly also
// containing encoding and other XHR response information.

export type Revelation = any;

// If given object is a string uses it as the URL for an XHR request and returns the response,
// otherwise returns the given object itself.
export function expose (object: Revelation) {
  return typeof object === "function" ? object()
      : ((typeof object === "object") && (Object.keys(object).length === 1) && object[""])
          ? request({ url: object })
      : object;
}

export const EntryTemplate = Symbol("EntryTemplate");
export const Deprecated = Symbol("Deprecated revelation option");

export function dictionaryOf (valueTemplate: any) {
  const ret = {};
  ret[EntryTemplate] = valueTemplate;
  return ret;
}

export function arrayOf (entryTemplate: any) {
  const ret = [];
  ret[EntryTemplate] = entryTemplate;
  return ret;
}

export function deprecated (template: any, deprecationMessage: string) {
  template[Deprecated] = deprecationMessage;
  return template;
}

/**
 * Combines several revelations together, performing a lazy deep merge which resolves promises,
 * merges objects, concatenates arrays and replaces functions with their result values.
 *
 * @export
 * @param {*} revelation
 * @param {...any} extensionSets
 * @returns
 */
export function combineRevelationsLazily (gateway: Object, ...revelations: any) {
  return _keepCalling(_combineRevelationsLazily(gateway, ...revelations));
}

function _combineRevelationsLazily (gateway: Object, ...revelations: any) {
  return revelations.reduce(
      (current, extension) => ((isPromise(current) || isPromise(extension))
          ? _markLazy(async () =>
              _keepCalling(_extendRevelation(gateway, await current, await extension)))
          : _extendRevelation(gateway, current, extension)));
}

function _keepCalling (callMeMaybe: Function | any): any {
  try {
    return _isLazy(callMeMaybe) ? _keepCalling(callMeMaybe())
        : isPromise(callMeMaybe) ? callMeMaybe.then(_keepCalling)
        : callMeMaybe;
  } catch (error) {
    throw wrapError(error, "During _keepCalling", { callMeMaybe });
  }
}

function _markLazy (func: Function) {
  func._isLazy = true;
  return func;
}

function _isLazy (candidate: Function | any) {
  return (typeof candidate === "function") && candidate._isLazy;
}

function _tryExpandExtension (gateway: Object, candidate: any, base: any) {
  if ((typeof candidate !== "object") || !candidate.hasOwnProperty("...")) return undefined;
  const expandee = candidate["..."];
  const rest = { ...candidate };
  delete rest["..."];
  const isObjectExpandee = (typeof expandee !== "string");
  const expandeePath = path.join(gateway.revelationRootPath || ".",
      isObjectExpandee ? expandee.url : expandee);
  let retrievedContent;
  if (inBrowser()) {
    const requestOptions = { ...(isObjectExpandee ? expandee : {}), url: expandeePath };
    retrievedContent = _markLazy(() => request(requestOptions));
  } else if (typeof expandee !== "string") {
    throw new Error("Non-string expandees are not supported in non-browser Revelation contexts");
  } else {
    try {
      retrievedContent = require(expandeePath);
    } catch (error) {
      throw gateway.wrapErrorEvent(error, `_tryExpandExtension('${expandee.url || expandee}')`,
          "\n\texpandeePath:", expandeePath);
    }
  }
  const subGateway = Object.assign(Object.create(gateway), {
    revelationRootPath: path.dirname(expandeePath),
  });
  return _markLazy(() => _combineRevelationsLazily(subGateway, base, retrievedContent, rest));
}

function _extendRevelation (gateway: Object, base: Object, extension: Object,
    validateeFieldName: ?string, extenderName: ?string) {
  let key;
  let ret;
  try {
    if (typeof extension === "undefined") {
      if (validateeFieldName) {
        throw new Error(`Revelation extension '${extenderName}' is missing required base ${
            typeof base} field '${validateeFieldName}'`);
      }
      return (ret = base);
    }

    if ((typeof base === "undefined") || (extension === null)) {
      return (ret = extension);
    }

    if (_isLazy(base) || _isLazy(extension)) {
      return (ret = _markLazy(() =>
          _combineRevelationsLazily(gateway, _keepCalling(base), _keepCalling(extension))));
    }

    const expandedExtension = _tryExpandExtension(gateway, extension, base);
    if (expandedExtension) return (ret = expandedExtension);

    if (typeof extension === "function" && (!validateeFieldName || (typeof base === "function"))) {
      if (typeof base !== "function") {
        let result;
        try {
          result = gateway.callRevelation(extension, base);
          ret = _extendRevelation(gateway, base, result);
          if (typeof result !== "object") {
            return ret;
          }
          for (const baseKey of Object.keys(base)) {
            if ((typeof base[baseKey] !== "undefined") && !result.hasOwnProperty(baseKey)) {
              _extendRevelation(gateway, base[baseKey], result[baseKey], baseKey, extension.name);
            }
          }
          return (ret = result);
        } catch (error) {
          throw gateway.wrapErrorEvent(error,
                  `_extendRevelation via extension '${extension.name}' call`,
              "\n\tcall result:", result,
              "\n\tbase:", base);
        }
      }
      if (!inProduction() && (extension.name !== base.name)) {
        throw new Error(`Revelation function name mismatch: trying to override function '${
            base.name}' with '${extension.name}'`);
      }
      return (ret = extension);
    }

    if (base === null) {
      return (ret = extension);
    }

    const baseType = Array.isArray(base) ? "array" : typeof base;
    const extensionType = Array.isArray(extension) ? "array" : typeof extension;
    if ((typeof base === "object") && base[Deprecated]) {
      gateway.warnEvent(base[Deprecated], "while extending", base, "with", extension);
      if (extensionType !== "object") {
        return (ret = extension);
      }
    } else if (baseType !== extensionType) {
      throw new Error(`Revelation type mismatch: trying to override an entry of type '${
          baseType}' with a value of type '${extensionType}'`);
    } else if (typeof base !== "object") {
      return (ret = extension); // non-array, non-object values are always overridden
    }

    if (validateeFieldName) return undefined;

    const valuePrototype = base[EntryTemplate];

    if (!Array.isArray(base)) {
      ret = Object.create(Object.getPrototypeOf(base), Object.getOwnPropertyDescriptors(base));
      for (const [key_, value] of Object.entries(extension)) {
        key = key_;
        const currentValue = (typeof ret[key] !== "undefined") ? ret[key] : valuePrototype;
        if (typeof currentValue === "undefined") {
          ret[key] = value;
        } else {
          ret[key] = _combineRevelationsLazily(gateway, currentValue, value);
          if (_isLazy(ret[key])) {
            _setPropertyToGetter(ret, key, ret[key]);
          }
        }
      }
    } else if (!valuePrototype) {
      ret = [].concat(base, extension);
    } else {
      ret = [].concat(base);
      for (const entry of [].concat(extension)) {
        key = ret.length;
        ret.push(_combineRevelationsLazily(gateway, valuePrototype, entry));
        if (_isLazy(ret[key])) {
          _setPropertyToGetter(ret, key, ret[key]);
        }
      }
    }
    return ret;
  } catch (error) {
    throw gateway.wrapErrorEvent(error, !extenderName
            ? "_extendRevelation()"
            : `validateField '${validateeFieldName}' of extender '${extenderName}' call`,
        "\n\tbase revelation:", ...dumpObject(base),
        "\n\textension revelation:", ...dumpObject(extension),
        ...(key ? ["\n\tresult key:", key] : []));
  } /* finally {
    console.log("extended, with:",
        "\n\tbase revelation:", ...dumpObject(base),
        "\n\textension revelation:", ...dumpObject(extension),
        "\n\tresult:", ret);
  }*/
}

function _setPropertyToGetter (target: any, key: number | string, getter: Function) {
  let value;
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get () {
      if (typeof value !== "undefined") return value;
      value = _keepCalling(getter);
      Object.defineProperty(target, key, { value, writable: true });
      Promise.resolve(value).then(resolvedValue => {
        value = resolvedValue;
        Object.defineProperty(target, key, { value, writable: true });
      });
      return value;
    }
  });
}
