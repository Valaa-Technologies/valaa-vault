// @flow

import path from "path";
import {
  dumpObject, inProduction, isPromise, request, wrapError, inBrowser, trivialClone,
} from "~/tools";
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
      (template, update) => ((isPromise(template) || isPromise(update))
          ? _markLazy(async () =>
              _keepCalling(_combineRevelation(gateway, await template, await update)))
          : _combineRevelation(gateway, template, update)));
}

function _combineRevelation (gateway: Object, template: Object, update: Object,
    validateeFieldName: ?string, updateName: ?string) {
  let currentKey;
  let ret;
  try {
    if (update === undefined) {
      if (validateeFieldName) {
        throw new Error(`Revelation update '${updateName}' is missing field '${validateeFieldName
            }' required by template ${typeof template} `);
      }
      return (ret = template);
    }

    if ((template === undefined) || (update === null)) {
      return (ret = update);
    }

    if (_isLazy(template) || _isLazy(update)) {
      return (ret = _markLazy(() =>
          _combineRevelationsLazily(gateway, _keepCalling(template), _keepCalling(update))));
    }

    const spreader = (update != null) && (typeof update === "object")
        && update.hasOwnProperty("...") && update["..."];
    if (spreader) {
      return (ret = _spreadAndCombineRevelation(gateway, template, update, spreader));
    }

    // const expandedExtension = _tryExpandExtension(gateway, update, template);
    // if (expandedExtension) return (ret = expandedExtension);

    if (typeof update === "function" && (!validateeFieldName || (typeof template === "function"))) {
      return (ret = _callAndCombineRevelation(gateway, template, update));
    }

    if (template === null) {
      return (ret = update);
    }

    const templateType = Array.isArray(template) ? "array" : typeof template;
    const updateType = Array.isArray(update) ? "array" : typeof update;
    if ((typeof template === "object") && template[Deprecated]) {
      gateway.warnEvent(template[Deprecated], "while extending", template, "with", update);
      if (updateType !== "object") {
        return (ret = update);
      }
    } else if (templateType !== updateType) {
      if (updateType === "object" && Object.keys(update).length === 0) {
        return template;
      }
      throw new Error(`Revelation type mismatch: trying to override an entry of type '${
          templateType}' with a value of type '${updateType}'`);
    } else if (typeof template !== "object") {
      return (ret = update); // non-array, non-object values are always overridden
    }

    if (validateeFieldName) return undefined;

    const valuePrototype = template[EntryTemplate];

    if (!Array.isArray(template)) {
      ret = Object.create(Object.getPrototypeOf(template),
          Object.getOwnPropertyDescriptors(template));
      for (const [key_, value] of Object.entries(update)) {
        currentKey = key_;
        const currentValue = (ret[currentKey] !== undefined) ? ret[currentKey] : valuePrototype;
        if (currentValue === undefined) {
          ret[currentKey] = value;
        } else {
          _setMaybeLazyProperty(ret, currentKey,
              _combineRevelationsLazily(gateway, currentValue, value));
        }
      }
    } else if (!valuePrototype) {
      ret = [].concat(template, update);
    } else {
      ret = [].concat(template);
      for (const entry of [].concat(update)) {
        _setMaybeLazyProperty(ret, ret.length,
            _combineRevelationsLazily(gateway, valuePrototype, entry));
      }
    }
    return ret;
  } catch (error) {
    throw gateway.wrapErrorEvent(error, !updateName
            ? "_combineRevelation()"
            : `validateField '${validateeFieldName}' of extender '${updateName}' call`,
        "\n\ttemplate revelation:", ...dumpObject(template),
        "\n\tupdate revelation:", ...dumpObject(update),
        ...(currentKey ? ["\n\twhile processing update key:", currentKey] : []));
  } /* finally {
    console.log("extended, with:",
        "\n\tbase revelation:", ...dumpObject(template),
        "\n\textension revelation:", ...dumpObject(update),
        "\n\tresult:", ret);
  } */
}

function _spreadAndCombineRevelation (gateway: Object, template: any, update: any, spreader: any) {
  const postUpdate = { ...update };
  delete postUpdate["..."];
  const spreadUpdate = (typeof spreader === "function")
      ? spreader
      : _valk(gateway, null, _pathOpFromSpreader(spreader));
  return _markLazy(() => _combineRevelationsLazily(gateway, template, spreadUpdate, postUpdate));
}

function _pathOpFromSpreader (spreader) {
  return !Array.isArray(spreader) ? ["§get", spreader]
      : (typeof spreader[0] !== "string") || (spreader[0][0] !== "§") ? ["§get", ...spreader]
      : spreader;
}

function _callAndCombineRevelation (gateway: Object, template: any, update: any) {
  if (typeof template !== "function") {
    let updateCallResult;
    try {
      updateCallResult = gateway.callRevelation(update, template);
      const combined = _combineRevelation(gateway, template, updateCallResult);
      if (typeof updateCallResult !== "object") {
        return combined;
      }
      for (const baseKey of Object.keys(template)) {
        if ((template[baseKey] !== undefined) && !updateCallResult.hasOwnProperty(baseKey)) {
          _combineRevelation(gateway,
              template[baseKey], updateCallResult[baseKey], baseKey, update.name);
        }
      }
      return updateCallResult;
    } catch (error) {
      throw gateway.wrapErrorEvent(error,
              `_combineRevelation via update '${update.name}' call`,
          "\n\tupdate call result:", updateCallResult,
          "\n\tbase:", template);
    }
  }
  if (!inProduction() && (update.name !== template.name)) {
    throw new Error(`Revelation function name mismatch: trying to override function '${
        template.name}' with '${update.name}'`);
  }
  return update;
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

function _setMaybeLazyProperty (target: any, key: any, value: any) {
  if (!_isLazy(value)) {
    target[key] = value;
  } else {
    if (typeof key === "number") target[key] = undefined;
    let _cachedValue;
    Object.defineProperty(target, key, {
      enumerable: true,
      configurable: true,
      get () {
        if (_cachedValue !== undefined) return _cachedValue;
        _cachedValue = _keepCalling(value);
        Object.defineProperty(target, key, { value: _cachedValue, writable: true });
        Promise.resolve(_cachedValue).then(resolvedValue => {
          _cachedValue = resolvedValue;
          Object.defineProperty(target, key, { value: resolvedValue, writable: true });
        });
        return _cachedValue;
      }
    });
  }
}

function _valk (gateway, head, step) {
  const delayed = _delayIfAnyPromise(head, head_ => _valk(gateway, head_, step))
      || _delayIfAnyPromise(step, step_ => this._valk(gateway, head, step_));
  if (delayed !== undefined) return delayed;
  if ((step === null) || (step === undefined)) return head;
  if ((typeof step === "string") || (typeof step === "number")) return head[step];
  if (!Array.isArray(step)) {
    const ret = {};
    const keys = Object.keys(step);
    const values = keys.map(key => (ret[key] = _valk(gateway, head, step[key])));
    return _delayIfAnyPromise(values, resolved => {
      keys.forEach((key, index) => { ret[key] = resolved[index]; });
      return ret;
    }) || ret;
  }
  if ((typeof step[0] !== "string") || (step[0][0] !== "§")) {
    const ret = step.map(substep => _valk(gateway, head, substep));
    return _delayIfAnyPromise(ret, resolved => resolved) || ret;
  }
  const opId = step[0];
  if (opId === "§'") return step[1];
  if (opId === "§->") return step.slice(1).reduce(_valk.bind(null, gateway), head);
  /*
  // Spreader stuff, currently untested.
  if (opId === "§merge") {
    const valked = step.slice(1).map(e => _valk(gateway, head, e));
    return valked.reduce((nextHead, subStep) => _combineRevelation(gateway, nextHead, subStep)),
        head === undefined ? null : head);
  }
  */
  if (opId !== "§get") throw new Error(`Unrecognized revelation op '${opId}'`);

  const getOptions = step[1];

  const isObjectRequest = (typeof getOptions !== "string");
  let resourceLocation = !isObjectRequest ? getOptions
      : (getOptions.url || getOptions.input || getOptions.path);
  const spreadOptions = getOptions.spread || {};
  try {
    if (!getOptions.url) {
      resourceLocation = resolveRevelationSpreaderImport(resourceLocation,
          gateway.siteRoot, gateway.revelationRoot, gateway.domainRoot,
          gateway.currentRevelationPath);
    }
    if (inBrowser() || getOptions.fetch) {
      return _markLazy(async () => _postProcessGetContent(
          gateway, spreadOptions.final, resourceLocation,
          await request({
            input: resourceLocation,
            fetch: getOptions.fetch || {},
          }),
          step.slice(2),
      ));
    }
    return _postProcessGetContent(
        gateway, spreadOptions.final, resourceLocation,
        gateway.require(resourceLocation),
        step.slice(2),
    );
  } catch (error) {
    throw gateway.wrapErrorEvent(error,
        `_tryExpandExtension('${resourceLocation}')`,
        "\n\tgateway.siteRoot:", gateway.siteRoot,
        "\n\tgateway.revelationRoot:", gateway.revelationRoot,
        "\n\tgateway.currentRevelationPath:", gateway.currentRevelationPath,
    );
  }
}

function _delayIfAnyPromise (promiseCandidate, operation) {
  const delay = isPromise(promiseCandidate)
          ? promiseCandidate
      : Array.isArray(promiseCandidate) && promiseCandidate.find(isPromise)
          ? Promise.all(promiseCandidate)
      : undefined;
  if (delay === undefined) return delay;
  return delay.then(operation);
}

function _postProcessGetContent (gateway, isFinal, resourceLocation, content_, pathOp) {
  let content = content_;
  if (!isFinal) {
    content = trivialClone(content, (value, key) => {
      if (key !== "...") return undefined;
      if (isPromise(value)) return value;
      return _markLazy(() => _valk(
          Object.assign(Object.create(gateway), {
            currentRevelationPath: path.dirname(resourceLocation),
          }),
          null,
          _pathOpFromSpreader(value)));
    });
  }
  return !pathOp.length ? content : _valk(gateway, content, ["§->", ...pathOp]);
}
