// @flow

import path from "path";
import { dumpObject, inProduction, isPromise, request, wrapError, inBrowser } from "~/tools";
import resolveRevelationSpreaderImport from "~/tools/resolveRevelationSpreaderImport";

// Revelation is a JSON configuration file in which all "..." keys and
// their *spreader* string values denote file import requests to other
// revelation JSON files.
//
// The primary purpose of the revelation system is to allow config
// files to extract configuration parameters shared by several
// different config files into a shared JSON file which the other
// config files then spread-import, thus implementing
// https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
//
// When a revelation is interpreted these spread-import requests are
// executed and the returned JSON content is expanded on top of the
// *surrounding object*, similar to the javascript spread syntax.
// All other key/value pairs of the surrounding object are also
// similarily merged on top of spreaded contents.
//
// Unlike the actual javascript spread syntax however, the spreader
// property is an actual dynamic property of a JSON object and is
// resolved only when the revelation gets interpreted. This also means
// there can be only one spreader property per object. The spreader
// property is also always imported and spreaded before all the other
// key/value pairs, even if the spreader property itself appears last
// in the JSON file itself (this is unlike spread syntax which follows
// file order).
//
// Finally, the spreader merge semantics is a deep merge (unlike
// javascript spread which is shallow). Properties with same keys
// are recursively merged. This allows for highly selective but still
// declarative overriding of even deeply nested configuration
// properties.
//
// Revelation import request string has two main variants, each with
// their sub-variants:
// 1. URI reference strings are enclosed between "<" and ">", and are:
//    - *global URI* references if they define an authority
//    - *domain-root* references if they are absolute-path references
//      (ie. have no authority but their path begins with "/")
//    - *revelation-root* references if they are relative-path
//      references (ie. no authority and path doesn't begin with "/"),
// 2. Remaining request strings are either:
//    - *site-root* relative paths if they begin with "/"
//    - *file* relative paths otherwise, (including those beginning
//      with "./" and "../")
//
// Roughly speaking URI references have more semantic, front-facing
// meaning. They are more typically used for resources with some kind
// of API contract, whether it is defined by some internet service (for
// global refs), by a hosting provider (for domain-root refs) or by the
// revealed app itself (for revelation-root refs).
// Conversely, site-root and file relative paths are more used by
// implementation defined, more freely mutable performance details.
// (note: admittedly the distinction between site-root paths and
// revelation-root refs are a bit blurry).
//
// A revelation root is the directory of a single /entry point/
// revelation file, typically called "revela.json". This is usually a
// landing page, an application entry point, user profile page etc. and
// as such the first revelation requested by a user.
// A site root on the other hand is a specific directory which can
// contain several associated revelation files (possibly deeply nested)
// but which nevertheless *must* contain all relative spread-import
// targets inside itself.
//
// The site root can be a web URL, a filesystem path, or any other
// locator with:
// 1. a well-defined file tree structure
// 2. a mechanism for retrieving files (no listing needed)
// 3. a mechanism for combining two path parts into one.
// The site root path is the same for all revelations inside that site.
// This allows the site to provide commonly shared files from the same
// location (using the "/" site-root relative paths) implementing the
// DRY primary revelation purpose.
// In browser environments site root is equal to
// `scheme+host+port+'/'+siteroute` where siteroute is explicitly
// provided by the current document or an empty string. In Node.js
// contexts the site root is by default `process.cwd()`.
//
// Each entry revelation file defines its own parent directory as the
// *revelation root* path. A URI relative-path reference (one which
// has no authority part and doesn't begin with "/") is a revelation
// root relative request. For web contexts this is
// equal to `scheme+host+port+pathname`. For Node.js contexts this is
// equal to `path.dirname(revelationPath)` where revelationPath is the
// path of the revelation used to configure and launch the gateway.
//
// Note that revelation root is the same for all revelation files
// imported (even recursively) by the same entry revelation.
// This serves two secondary purposes.
// Firstly, it acts as revelation-specific absolute path root.
// Implementation detail files can use revelation root based references
// to refer to "revelation global" resources without having to care
// about their own location, reducing coupling.
// Secondly, it allows for site shared files to make backreferencing
// imports to revelation-specific configurations.
// (NOTE(iridian, 2018-12): this is an experimental use case).
//
// The file relative requests are always relative to the file which
// defines them. This makes splitting large configuration files into
// smaller local files smooth.
//
// Splitting files serves three purposes: smaller files are easier
// to manage mentally, they can have nicer metadata associated with
// them (including in version control), and finally: clients can (and
// the inspire gateway Revelation implementation does) implement lazy
// loading of revelations. This allows the delivery of even large
// datasets like event logs via revelation files.
//
// There is an explicit "url" import form which allows making XHR
// requests using standard URI resolution semantics. For relative-ref's
// the current context /revelation/ root path is used as the rfc3986
// *Base URI*.
// This makes it possible to make spread-imports from outside the site
// itself and also to make revelation relative URL requests with query
// and fragment parts.
//
// If the spreader is a flat string it is expanded as if it was a
// the value of spreader.path with no other spreader options.
//
// The consumers of the Revelation will lazily (thus possibly never,
// saving resources and enabling offline functionality) asynchronously
// request spreader expansion when they make async/await property
// accesses to revelation contents.
//
// As an example, the inspire revelation.bvobBuffers might look like:
// ```
// {
//   "somebobcontenthash": { "base64": "v0987c1r1bxa876a8s723f21=" },
//   "otherbvobcontenthash": { "base64": "b7b98q09au2322h3f2j3hf==" },
//   "contenthash3": { "...": "relative/to/thisFile" },
//   "contenthash4": { "...": "./relative/to/thisFile/also" },
//   "contenthash5": { "...": "/relative/to/siteRoot" },
//   "contenthash8": { "...": "<http://global.url.com/to/buffer52>" },
//   "contenthash9": { "...": "<relative/to/revelationRoot>" },
//   "contenthash10": { "...": "<./relative/to/revelationRoot/also>" },
//   "contenthash11": { "...": "</relative/to/domainRoot>" } },
// }
// ```
// And the corresponding buffer template in revelation.template.js:
// ```
//   bvobBuffers: dictionaryOf({ base64: "" }),
// ```
//
// TODO(iridian): Figure if exposed string content could be wrapped
// inside a wrapper, ie. if in above base the http://url.com/to/bvob52
// resolves to string content (not as a JSON object with "base64"
// field), it might be useful if by convention only JSON objects were
// resolved directly, but flat text and any other content was
// automatically wrapped inside an object, possibly also containing
// encoding and other XHR response information.

export type Revelation = any;

// If given object is a string uses it as the URL for a Window.fetch
// and returns the response, otherwise returns the given object itself.
export function expose (object: Revelation) {
  return typeof object === "function" ? object()
      : ((typeof object === "object") && (Object.keys(object).length === 1) && object[""])
          ? request({ input: object })
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
 * Combines several revelations together, performing a lazy deep merge
 * which resolves promises, merges objects, concatenates arrays and
 * replaces functions with their result values.
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
  let expandeePath = isObjectExpandee
      ? (expandee.url || expandee.input || expandee.path) : expandee;
  if (!(expandee.url || expandee.input)) {
    expandeePath = resolveRevelationSpreaderImport(
        expandeePath, gateway.siteRoot, gateway.revelationRoot, gateway.currentRevelationPath);
  }
  let retrievedContent;
  if (inBrowser()) {
    const requestOptions = { ...(isObjectExpandee ? expandee : {}), input: expandeePath };
    delete requestOptions.path;
    retrievedContent = _markLazy(() => request(requestOptions));
  } else if (typeof expandee !== "string") {
    throw new Error("Non-string expandees are not supported in non-browser Revelation contexts");
  } else {
    try {
      retrievedContent = gateway.require(expandeePath);
    } catch (error) {
      throw gateway.wrapErrorEvent(error,
          `_tryExpandExtension('${expandee.url || expandee.input || expandee}')`,
          "\n\texpandeePath:", expandeePath,
          "\n\tgateway.siteRoot:", gateway.siteRoot,
          "\n\tgateway.revelationRoot:", gateway.revelationRoot,
          "\n\tgateway.currentRevelationPath:", gateway.currentRevelationPath,
      );
    }
  }
  const subGateway = Object.assign(Object.create(gateway), {
    currentRevelationPath: path.dirname(expandeePath),
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
  } */
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
