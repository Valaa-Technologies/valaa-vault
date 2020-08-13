const { disjoinVPath, cementVPath } = require("@valos/raem/VPath");

const inProduction = require("@valos/tools/inProduction").default;
const isPromise = require("@valos/tools/isPromise").default;
const patchWith = require("@valos/tools/patchWith").default;
const { mapEagerly, thenChainEagerly } = require("@valos/tools/thenChainEagerly");

const { dumpObject, wrapError } = require("@valos/tools/wrapError");

// Revelation is a JSON configuration file in which all "!!!" keys and
// their *spreader* string values denote require requests to other
// revelation JSON files and packages.
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
//   "contenthash3": { "!!!": "package-name/require" },
//   "contenthash4": { "!!!": "./relative/to/thisFile/also" },
//   "contenthash5": { "!!!": "/relative/to/siteRoot" },
//   "contenthash8": { "!!!": "<http://global.url.com/to/buffer52>" },
//   "contenthash9": { "!!!": "<relative/to/revelationRoot>" },
//   "contenthash10": { "!!!": "<./relative/to/revelationRoot/also>" },
//   "contenthash11": { "!!!": "</relative/to/domainRoot>" } },
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

// type Revelation = any;

const EntryTemplate = Symbol("EntryTemplate");
const Deprecated = Symbol("Deprecated revelation option");

module.exports = {
  EntryTemplate,
  Deprecated,
  dictionaryOf,
  arrayOf,
  deprecated,
  lazyPatchRevelations,
  reveal,
  expose,
};

function dictionaryOf (valueTemplate) {
  const ret = {};
  ret[EntryTemplate] = valueTemplate;
  return ret;
}

function arrayOf (entryTemplate) {
  const ret = [];
  ret[EntryTemplate] = entryTemplate;
  return ret;
}

function deprecated (template, deprecationMessage) {
  template[Deprecated] = deprecationMessage;
  return template;
}

function reveal (mystery) {
  try {
    return _isDelayed(mystery) ? reveal(mystery())
        : isPromise(mystery) ? mystery.then(reveal)
        : mystery;
  } catch (error) {
    throw wrapError(error, "During reveal", { mystery });
  }
}

function expose (mystery) {
  // in-place deep reveal and replace object properties
  let revealedTrivialObject_;
  return thenChainEagerly(mystery, [
    reveal,
    function _exposeRevealedValue (revealed) {
      if ((revealed == null) || (typeof revealed !== "object")) return revealed;
      if (!Array.isArray(revealed)) {
        if (Object.getPrototypeOf(revealed) !== Object.prototype) return revealed;
        revealedTrivialObject_ = revealed;
      }
      return mapEagerly(
          revealedTrivialObject_ ? Object.entries(revealedTrivialObject_) : revealed,
          function _revealEntryValues (entry) {
            const revealedValue = revealedTrivialObject_ ? entry[1] : entry;
            return thenChainEagerly(revealedValue, [
              expose,
              function _setParentPropertyToExposedValue (exposedValue) {
                if (revealedTrivialObject_ && (revealedValue !== exposedValue)) {
                  revealedTrivialObject_[entry[0]] = exposedValue;
                }
                return exposedValue;
              },
            ]);
          },
      );
    },
    function _maybeReturnTrivialExposedObject (exposed) {
      return revealedTrivialObject_ || exposed;
    },
  ]);
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
function lazyPatchRevelations (gateway, targetRevelation, ...patchRevelations) {
  return reveal(_lazyPatchRevelations(gateway, targetRevelation, ...patchRevelations));
}

function _lazyPatchRevelations (gateway, targetRevelation, ...patchRevelations) {
  return patchRevelations.reduce(
      (target, patch) => ((isPromise(target) || isPromise(patch))
          ? _markDelayed(async function _delayedPatchRevelations () {
            return reveal(_patchRevelation(gateway, await target, await patch));
          })
          : _patchRevelation(gateway, target, patch)),
      targetRevelation);
}

function _patchRevelation (gateway, targetRevelation, patchRevelation) {
  try {
    return patchWith(targetRevelation, patchRevelation, {
      spreaderKey: "!!!",
      keyPath: [],
      concatArrays: true,
      patchSymbols: true,
      complexPatch: "overwrite",
      preExtend (target, patch, key, targetParent, patchParent) {
        if (target === undefined) {
          if (patch && (typeof patch === "object") && !Array.isArray(patch)
              && Object.getPrototypeOf(patch) !== Object.prototype) {
            return patch;
          }
        }
        if ((target == null) || (patch == null) || (key === EntryTemplate)) return undefined;

        const delayed = _delayIfAnyObscured([target, patch], [
          ([revealedTarget, revealedPatch]) =>
              this.extend(revealedTarget, revealedPatch, key, targetParent, patchParent),
          function _setParentPropertyAfterExtend (extendResult) {
            if (targetParent) targetParent[key] = extendResult;
            return extendResult;
          },
        ]);
        if (delayed) return delayed;

        try {
          if (typeof patch === "function") {
            if (typeof target === "function") {
              if (!inProduction() && (patch.name !== target.name)) {
                throw new Error(`Revelation function name mismatch: trying to override function '${
                    target.name}' with '${patch.name}'`);
              }
              return patch;
            }
            let revelationPatch;
            try {
              revelationPatch = gateway.callRevelation(patch);
              const combined = this.extend(target, revelationPatch);
              if (typeof revelationPatch !== "object") return combined;
              for (const baseKey of Object.keys(target)) {
                if ((target[baseKey] !== undefined) && !revelationPatch.hasOwnProperty(baseKey)) {
                  throw new Error(`Revelation update '${patch.name}' is missing field '${
                    baseKey}' required by target ${typeof target[baseKey]}`);
                }
              }
              return revelationPatch;
            } catch (error) {
              throw gateway.wrapErrorEvent(error, 1,
                  `_patchRevelation via patch '${patch.name}' call`,
                  "\n\trevelationPatch:", revelationPatch,
                  "\n\ttarget:", target);
            }
          }

          const targetType = Array.isArray(target) ? "array" : typeof target;
          const patchType = Array.isArray(patch) ? "array" : typeof patch;
          if (((patchType === "array") && (patch[0] === "!!!"))
              || ((patchType === "object") && patch["!!!"])) return undefined;
          if ((typeof target === "object") && target[Deprecated]) {
            gateway.debugEvent(target[Deprecated], "while patching", target, "with", patch);
            if (patchType !== "object") return patch;
          } else if (targetType !== patchType) {
            if ((patchType === "object") && Object.keys(patch).length === 0) {
              return target;
            }
            throw new Error(`Revelation type mismatch: trying to override target of type '${
                targetType}' with a patch of type '${patchType}'`);
          } else if (typeof target !== "object") {
            return undefined;
          } else if (targetType === "object") {
            if (Object.getPrototypeOf(target) !== Object.prototype) {
              if (target.constructor === patch.constructor) {
                return patch;
              }
              throw new Error(`Cannot patch complex target: ${target.constructor.name}`);
            }
            if (Object.getPrototypeOf(patch) !== Object.prototype) {
              for (const targetKey of Object.keys(target)) {
                if ((target[targetKey] !== undefined) && !patch.hasOwnProperty(targetKey)) {
                  throw new Error(`Complex revelation patch '${patch.name}' is missing field '${
                      targetKey}' specified in its target: ${typeof target[targetKey]}`);
                }
              }
              return patch;
            }
          }
          const entryTemplate = target[EntryTemplate];
          if (entryTemplate) {
            if (Array.isArray(patch)) {
              target.push(...patch.map(patchEntry => this.extend(
                  this.extend({}, entryTemplate), patchEntry, key, targetParent, patchParent)));
              return target;
            }
            const ret = Object.create(
                Object.getPrototypeOf(target),
                Object.getOwnPropertyDescriptors(target));
            Object.entries(patch).forEach(([subKey, subValue]) => {
              ret[subKey] = this.extend(
                  this.extend({}, entryTemplate), subValue, subKey, ret, patch);
            });
            return ret;
          }
          return undefined;
        } catch (error) {
          throw gateway.wrapErrorEvent(error, 1,
              new Error(`patchRevelation.preExtend(key: ${key})`),
              "\n\ttarget:", ...dumpObject(target),
              "\n\tpatch:", ...dumpObject(patch),
              "\n\ttargetParent:", ...dumpObject(targetParent),
              "\n\tpatchParent:", ...dumpObject(patchParent));
        }
      },
      spread (spreader /* , outerRet */) {
        if (typeof spreader === "string") return _spreadValk(spreader);
        if ((spreader === null) || (typeof spreader !== "object")) return spreader;
        // Expand inner spreaders.
        const extendedSpreader = expose(this.extend(undefined, spreader));
        if (isPromise(extendedSpreader)) return extendedSpreader.then(_spreadValk);
        if (!Array.isArray(spreader)) return extendedSpreader || spreader;
        return _spreadValk(extendedSpreader);
        function _spreadValk (spreadedSpreader) {
          const pathOp = _cementSpreaderPath(spreadedSpreader);
          // console.log("pre-spreaderSpreader:", JSON.stringify(spreadedSpreader, null, 2));
          const ret = _valk(gateway, null, pathOp);
          /*
          console.log("post-spreaderSpreader:", JSON.stringify(spreadedSpreader, null, 2),
              "\n\tpathOp:", JSON.stringify(pathOp, null, 2),
              "\n\tret:", JSON.stringify(ret, null, 2),
              "\n\touter ret:", JSON.stringify(outerRet, null, 2));
          */
          return ret;
        }
      },
    });
  } catch (error) {
    throw gateway.wrapErrorEvent(error, 1, new Error("_patchRevelation()"),
        "\n\ttargetRevelation:", ...dumpObject(targetRevelation),
        "\n\tpatchRevelation:", ...dumpObject(patchRevelation));
  }
}

const revelationContext = {
  valk: {
    stepsFor: {
      invoke: ["§invoke"],
    },
  },
  http: _importURI,
  https: _importURI,
  V: {
    steps: ["§."],
  },
};

function _importURI (state, suffix, prefix) { return `<${prefix}://${suffix}>`; }

function _cementSpreaderPath (spreader) {
  const vpath = (Array.isArray(spreader) && ((spreader[0] || "")[0] === "@"))
       ? spreader
       : ["@!", spreader];
  const sections = disjoinVPath(vpath);
  const track = cementVPath(sections, { context: revelationContext });
  /*
  console.log("cementSpreaderPath, vpath:", ...dumpObject(vpath),
      "\n\tsections:", ...dumpObject(sections),
      "\n\ttrack:", ...dumpObject(track));
  */
  return track;
}

function _markDelayed (func) {
  func._isDelayed = true;
  return func;
}

function _isDelayed (candidate) {
  return (typeof candidate === "function") && candidate._isDelayed;
}

function _isObscured (candidate) {
  return isPromise(candidate) || _isDelayed(candidate);
}

function _valk (gateway, head, step) {
  const delayed = _delayIfAnyObscured(head,
          function _revealHead (revealedHead) { return _valk(gateway, revealedHead, step); })
      || _delayIfAnyObscured(step,
          function _revealStep (revealedStep) { this._valk(gateway, head, revealedStep); });
  try {
    if (delayed !== undefined) return delayed;
    if ((step === null) || (step === undefined)) return head;
    if ((typeof step === "string") || (typeof step === "number")) return head[step];
    if (!Array.isArray(step)) {
      const ret = {};
      const keys = Object.keys(step);
      const values = keys.map(key => (ret[key] = _valk(gateway, head, step[key])));
      return _delayIfAnyObscured(
          values,
          function _revealPropertyValues (revealed) {
            keys.forEach((key, index) => { ret[key] = revealed[index]; });
            return ret;
          },
      ) || ret;
    }
    if ((typeof step[0] !== "string") || (step[0][0] !== "§")) {
      const ret = step.map(substep => _valk(gateway, head, substep));
      return _delayIfAnyObscured(ret,
          function _revealArrayValues (revealed) { return revealed; },
      ) || ret;
    }
    const opId = step[0];
    if (opId === "§'") return step[1];
    if (opId === "§..") return head[step[1]];
    if (opId === "§->") return step.slice(1).reduce(_valk.bind(null, gateway), head);
    if (opId === "§[]") return step.slice(1).map(_tryLiteralOrValk);
    if ((opId === "§reveal") || (opId === "§$")) return _reveal(gateway, step);
    if (opId === "§{}") {
      const ret = {};
      const values = step.slice(1).map(([key, value]) => (ret[key] = _tryLiteralOrValk(value)));
      return _delayIfAnyObscured(values,
          function _revealObjectConstructor (revealed) {
            for (let i = 1; i !== step.length; ++i) ret[step[i][0]] = revealed[i - 1];
            return ret;
          },
      ) || ret;
    }
    if (opId === "§invoke") {
      return head[_tryLiteralOrValk(step[1])]
          .call(head, ...step.slice(2)
              .map(arg => ((typeof arg !== "object") ? arg : _valk(gateway, head, arg))));
    }
    /*
    // Spreader stuff, currently untested.
    if (opId === "§merge") {
      const valked = step.slice(1).map(e => _valk(gateway, head, e));
      return valked.reduce((nextHead, subStep) => _combineRevelation(gateway, nextHead, subStep)),
          head === undefined ? null : head);
    }
    */
    throw new Error(`Unrecognized revelation op '${opId}'`);
  } catch (error) {
    const errorName = new Error(`_valk(${step && step[0]})`);
    throw gateway.wrapErrorEvent(error, 0, () => [errorName,
      "\n\thead:", ...dumpObject(head),
      "\n\tstep:", ...dumpObject(step),
    ]);
  }
  function _tryLiteralOrValk (candidate) {
    if ((candidate === null) || (typeof candidate !== "object")) return candidate;
    return _valk(gateway, head, candidate);
  }
}

function _reveal (gateway, step) {
  return /* !inBrowser() ? _eagerReveal(gateway, step) : */ _markDelayed(
      function _delayedReveal () { return _eagerReveal(gateway, step); });
}

function _eagerReveal (gateway, step) {
  let origin = step[1];
  let options = step[2] || {};
  let pathOp = step.slice(3);
  if (typeof step[1] === "object") {
    options = step[1];
    origin = options.url || options.input || options.path;
    pathOp = step.slice(2);
  }
  const relativeGateway = Object.create(gateway);
  const revealOptions = { currentDir: gateway.evaluationDir, fetch: options.fetch };
  return thenChainEagerly(origin, [
    function _revealOrigin (origin_) {
      return gateway.reveal(origin_, revealOptions);
    },
    function _patchOriginRevelation (result) {
      relativeGateway.evaluationDir = revealOptions.revealedDir;
      return _patchRevelation(relativeGateway, undefined, result);
    },
    function _valkOriginRevelationPathRemainder (revelation) {
      return (!pathOp.length
          ? revelation
          : _valk(relativeGateway, revelation, ["§->", ...pathOp]));
    },
  ], function _errorOnOriginRevealPatchValk (error) {
    throw gateway.wrapErrorEvent(error, 1,
        new Error(`_reveal("${origin}" from "${gateway.currentDir}")`),
        "\n\trevealOptions:", ...dumpObject(revealOptions),
    );
  });
}

function _delayIfAnyObscured (mystery, operations) {
  if (!_isObscured(mystery) && (!Array.isArray(mystery) || !mystery.find(_isObscured))) {
    return undefined;
  }
  return _markDelayed(function _revealAnyDelayed () {
    return thenChainEagerly(mystery, [
      reveal,
      function revealEntries (revealedMystery) {
        return !Array.isArray(revealedMystery) || !revealedMystery.find(_isObscured)
            ? revealedMystery
            : mapEagerly(revealedMystery, reveal);
      },
    ].concat(operations));
  });
}
