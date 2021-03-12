Object.defineProperty(exports, "__esModule", { value: true });

const { dumpObject, wrapError } = require("./wrapError");

/*
 * If *pre|postApplyPatch* returns non-undefined then that value is directly
 * returned skipping the rest of that patch recursion branch,
 * otherwise patch is performed normally.
 * If **spread** returns **undefined** then undefined is returned and the
 * rest of that patch recursion is skipped. Otherwise the return value
 * is patched on target and its result is returned.
 *
 * Any nested patch object with the key "..." is treated as a link to
 * an external resource and is spread before extension.
 *
 * patchWith semantics are defined by callbacks:
 * - options.preApplyPatch can be used to fully replace a patch
 *   operation at some nesting level with the final result value (with
 *   semantics identical to lodash.mergeWith customizer)
 * - options.spreader resolves link location, retrieves the resource
 *   and interprets the resource as a native object
 * - options.postApplyPatch is called after preApplyPatch/patch steps to
 *   finalize the patch at some depth (identical parameters with
 *   preApplyPatch)
 *
 * The default options.spread semantics is to call options.require for
 * the link location.
 * The default options.patch semantics is to treat link parameters as
 * spread patch property data overrides.
 *
 * Additionally patchWith introduces the *spread operation* and the *spreader properties*.
 * As first class properties (default key "...") these spreader properties can be used to /describe/
 * localized, lazily evaluated, and context-dependent deep patch operations as persistent,
 * fully JSON-compatible data.
 *
 * The idiomatic example is shared JSON configurations (similar to babel presets or eslint extends):
 *
 * Given two JSON files:
 * // common.json
 * `{ kind: "project", name: "unnamed", plugins: ["basicplugin"] }`
 * // myproject.json
 * `{ "...": "./common.json", name: "myproject", plugins: ["myplugin"] }`
 *
 * When myproject.json is deep-patched onto {} (with the contextual configSpread callback)
 * `patchWith({}, myProjectJSON, { spread: configSpread });`
 * the result equals `{ kind: "project", name: "myproject", plugins: ["basicplugin", "myplugin"] }`.
 *
 * The configSpread callback interprets the "./common.json" spreader value as a file read operation.
 * patchWith then appends the result of that onto {} followed by the rest of myProjectJSON.
 *
 *
 * Deep patch has two semantics: the universal deep patch semantics and the spread semantics.
 *
 * Deep patch semantics depend only on the patch value type:
 * Empty object and undefined patch values are no-ops and return the target unchanged.
 * Arrays in-place append and plain old objects in-place update the target value and return the
 * mutated target value. All other patch values are returned directly.
 * If target of an in-place operation is not of an appropriate type a new empty object or array is
 * created as the target and returned after sub-operations.
 * Update performs a sub-deep-assign for each enumerable key of the patch object. If the return
 * value is not undefined and differs from the corresponding value on the target it is assigned to
 * the target.
 *
 * Examples of deep append:
 *
 * patchWith({ foo: [1], bar: "a" }, { foo: [2], bar: "b" })          -> { foo: [1, 2], bar: "b" }
 * patchWith({ foo: [1] }, [{ foo: [2, 3] }, { foo: { 1: 4 } }])      -> { foo: [1, 4, 3] }
 * patchWith({ foo: [1] }, { foo: null })                             -> { foo: null }
 * patchWith({ foo: [1] }, [{ foo: null }, { foo: [3] }])             -> { foo: [3] }
 *
 * If a patch object of some nested deep append phase has a spreader property (by default "...")
 * then right before it is deep assigned a spread operation is performed:
 * 1. The spread callback is called like so:
 *    const intermediate = spread(patch["..."], target, patch, key, parentTarget,
 *    parentPatch).
 * 2. If the returned intermediate is undefined the subsequent deep assign of the patch is skipped
 *    and deep assign returns parentTarget[key].
 * 3. Otherwise the intermediate is deep assigned onto the target value, potentially recursively
 *    evaluating further spread operations.
 * 4. Finally the original patch object is omitted the spreader property and deep assigned onto
 *    the target value (which has now potentially been much mutated).
 *
 * patchWith([1, 2, 3], { 1: null })                                  -> [1, null, 3]
 * patchWith([1, 2, 3], { 1: undefined })                             -> [1, undefined, 3]
 * patchWith([1, 2, 3], { 1: { "...": null } })                       -> [1, 3]
 *
 *
 * Examples of spreaders:
 *
 * const fooRewriter = { "...": [{ foo: null }, { foo: [3] }] }
 * patchWith({de:{ep:{ foo: [1] }}}, {de:{ep: fooRewriter }})         -> {de:{ep:{ foo: [3] }}}
 *
 * const arrayRewriter = { "...": [null, [3]] }
 * patchWith({de:{ep:{ foo: [1] }}}, {de:{ep:{ foo: arrayRewriter }}})-> {de:{ep:{ foo: [3] }}}
 *
 *
 * Elementary patch rules as "target ... patch -> result" productions based on patch type:
 *
 * patch: undefined | {}          -> target
 * patch: { "...": spr, ...rest } -> patchWith(patchWith(target, spread(spr, ...)), rest)
 * patch: Array                   -> asArray(target, (ret =>
 *                                     patch.forEach(e => ret.push(patchWith(null, [e])))))
 * patch: Object                  -> asObject(target, (ret => Object.keys(patch).forEach(key =>
 *                                     { ret[key] = patchWith(ret[key], [patch[key]]); });
 * patch: any                     -> patch
 */

 /**
 *
 *
 * @callback patchCallback
 * @param {*} target                  Target object to modify or replace
 * @param {*} patch                   The immutable modification value to apply to target
 * @param {string|number} targetKey   The key of target in parentTarget
 * @param {*} parentTarget            The mutable parent object of the target
 * @param {string|number} patchKey    The key of patch in parentPatch
 * @param {*} parentPatch             The immutable parent object of the patch
 */

 /**
 * Recursively updates the *target* with the changes described in
 * *patch* using customized rules and callbacks of *options*: {
 *   spreaderKey: string = "...",
 *   preApplyPatch: (tgt, patch, key, tgtObj, patchObj) => any,
 *   spread (spreader, tgt, patch, key, tgtObj, patchObj) => any,
 *   postApplyPatch: (tgt, patch, key, tgtObj, patchObj) => any,
 *   keyPath: string[] = [],
 *   iterableToArray: ?("overwrite", "patch", "concat") = "concat",
 *   patchSymbols: boolean = false,
 *   complexToAny: ?("overwrite", "onlySetIfUndefined", "reject") = "reject",
 * }
 * @export
 * @param {*} target
 * @param {*[]} patch
 * @param {Object} options
 * @param {string} options.spreaderKey
 * @param {patchCallback} options.preApplyPatch
 * @param {patchCallback} options.patch
 * @param {patchCallback} options.postApplyPatch
 * @param {*} options.spread
 * @param {string[]} options.keyPath
 * @param {"overwrite"|"reduce"|"concat"|"merge"|patchCallback}
 *    [options.iterableToArray="overwrite"]
 * @param {"overwrite"|"reduce"|patchCallback} [options.iterableToOther="overwrite"]
 * @param {boolean} options.patchSymbols
 * @param {boolean} options.deleteUndefined
 * @param {"reject"|"onlySetIfUndefined"|"overwrite"|patchCallback} [options.complexToAny="reject"]
 */
exports.default = function patchWith (target_, patch_, options) {
  let _cache;
  const stack = options || {};
  stack.returnUndefined = _returnUndefined;
  stack.patch = _patch;
  stack.applyPatch = _applyPatch;
  stack._getPatchTargetFromCacheOrInit = _getPatchTargetFromCacheOrInit;

  const objectToAny = !stack.patchSymbols
      ? (stack.deleteUndefined
          ? _objectToAny.objectNoSymbolsDeleteUndefined
          : _objectToAny.objectNoSymbolsKeepUndefined)
      : (stack.deleteUndefined
          ? _objectToAny.objectWithSymbolsDeleteUndefined
          : _objectToAny.objectWithSymbolsKeepUndefined);

  return stack.patch(target_, patch_);

  /* eslint-disable prefer-rest-params */

  function _applyPatch (target, patch, targetKey, parentTarget, patchKey, parentPatch, skipSpread) {
    if (patch === undefined) return target;
    if (typeof patch !== "object" || patch === null) return patch;
    let ret;
    let patcher;
    try {
      if (patch === target) throw new Error("Cannot apply patch to self");

      // Patch with iterable
      if (patch[Symbol.iterator]) {
        const isSpreader = !skipSpread && (patch[0] === this.spreaderKey) && this.spreaderKey;
        if (isSpreader /* || ((ret !== undefined) && !Array.isArray(ret)) */) {
          ret = target;
          for (let i = 1; i !== patch.length; ++i) ret = this.patch(ret, patch[i], targetKey);
          return ret;
        }
        if (Array.isArray(target)) {
          patcher = this.iterableToArray;
          if (typeof patcher !== "function") patcher = _obtainPatcher(this, "iterableToArray");
        } else {
          patcher = this.iterableToOther;
          if (typeof patcher !== "function") patcher = _obtainPatcher(this, "iterableToOther");
        }
      } else if ((Object.getPrototypeOf(patch) || Object.prototype) !== Object.prototype) {
        patcher = this.complexToAny;
        if (typeof patcher !== "function") patcher = _obtainPatcher(this, "complexToAny");
      } else if (!skipSpread && this.spreaderKey
          && patch[this.spreaderKey] && patch.hasOwnProperty(this.spreaderKey)) {
        patcher = _applySpreader;
      } else {
        patcher = objectToAny;
      }
    } catch (error) {
      throw _formulateError(this, error, new Error("applyPatch.prepare"), ...arguments);
    }

    try {
      return patcher.call(this, target, patch, targetKey, parentTarget, patchKey, parentPatch);
    } catch (error) {
      throw _formulateError(this, error, new Error(`applyPatch=${patcher.name}`), ...arguments);
    }
  }

  // Returns true on cache hit for synchronous return: current patch
  // has already been used to create a new target value.
  // Reuse the previously created value as the 'ret'.
  // Note: this facility solves infinite recursion on cyclic patches
  // and thus is not just a performance optimization.
  function _getPatchTargetFromCacheOrInit (patch, createArray) {
    if (!_cache) _cache = new Map();
    let value = _cache.get(patch);
    if (value) return { hit: true, value };
    value = createArray ? [] : {};
    _cache.set(patch, value);
    return { value };
  }
};

const _returnUndefined = Symbol("returnUndefined");

function _patch (target, patch, targetKey, parentTarget, patchKey, parentPatch, skipSpread) {
  let ret;
  if (this.keyPath && (patchKey !== undefined)) this.keyPath.push(patchKey);
  try {
    if (this.preApplyPatch) {
      try {
        ret = this.preApplyPatch(target, patch, targetKey, parentTarget, patchKey, parentPatch);
      } catch (error) {
        throw _formulateError(this, error,
            new Error(`preApplyPatch=${this.preApplyPatch.name || ""}`), ...arguments);
      }
    }
    if (ret === undefined) {
      ret = this.applyPatch(
          target, patch, targetKey, parentTarget, patchKey, parentPatch, skipSpread);
    }
    if (this.postApplyPatch) {
      try {
        ret = this.postApplyPatch(ret, patch, targetKey, parentTarget, patchKey, parentPatch);
      } catch (error) {
        throw _formulateError(this, error,
            new Error(`postApplyPatch=${this.postApplyPatch.name || ""}`), ...arguments);
      }
    }
  } finally {
    if (this.keyPath && (patchKey !== undefined)) this.keyPath.pop();
  }
  return (ret === _returnUndefined) ? undefined : ret;
}

function _formulateError (stack, error,
    name, target, patch, targetKey, parentTarget, patchKey, parentPatch) {
  name.message = `patchWith.${name.message}(keyPath: [${(stack.keyPath || []).join("][")}])`;
  return wrapError(error, name,
      "\n\ttarget:", ...dumpObject(targetKey), ":", ...dumpObject(target),
      "\n\tpatch:", ...dumpObject(patchKey), ":", ...dumpObject(patch),
      "\n\tparentTarget:", ...dumpObject(parentTarget),
      "\n\tparentPatch:", ...dumpObject(parentPatch),
  );
}

function _obtainPatcher (stack, patcherName) {
  const ret = _patchers[patcherName][stack[patcherName] || _patcherDefaults[patcherName]];
  if (!ret) {
    throw new Error(`Unrecognized ${patcherName} option "${stack[patcherName]}"`);
  }
  return (stack[patcherName] = ret);
}

const _patcherDefaults = {
  iterableToArray: "overwrite",
  iterableToOther: "overwrite",
  complexToAny: "reject",
};

const _patchers = {
  iterableToArray: {
    overwrite,
    reduce,
    concat (target, patch) {
      return _applyIterablePatchEntries(this, target, patch, target.length);
    },
    merge (target, patch) {
      return _applyIterablePatchEntries(this, target, patch, 0);
    },
  },
  iterableToOther: {
    overwrite,
    reduce,
  },
  complexToAny: {
    overwrite (target, patch) { return patch; },
    onlySetIfUndefined (target, patch) {
      if (target !== undefined) {
        throw new Error(`Invalid complex value patch: target is not undefined ${
            ""}with options.complexToAny="onlySetIfUndefined"`);
      }
      return patch;
    },
    reject () {
      throw new Error(`Invalid complex value patch: (prototype is not equal to {
        ""}Object.prototype) with options.complexToAny="reject"`);
    },
  },
};

function overwrite (target, patch) {
  const cached = this._getPatchTargetFromCacheOrInit(patch, true);
  return cached.hit || _applyIterablePatchEntries(this, cached.value, patch, 0);
}

function reduce (target, patch, targetKey, parentTarget) {
  let ret = target;
  let i = 0;
  for (const entry of patch) ret = this.patch(ret, entry, targetKey, parentTarget, i++, patch);
  return ret;
}

function _applyIterablePatchEntries (stack, ret, patch, initialKey) {
  let key = initialKey;
  const shouldKeepUndefined = (stack.undefinedEntry === "keep");
  let i = 0;
  for (const entry of patch) {
    const newEntry = stack.patch(ret[key], entry, key, ret, i++, patch);
    if (shouldKeepUndefined || (newEntry !== undefined)) {
      ret[key++] = newEntry;
    } else if (key < ret.length) {
      ret.splice(key, 1);
    }
  }
  return ret;
}

const _objectToAny = {
  objectNoSymbolsDeleteUndefined (target, patch) {
    const targetIsArray = Array.isArray(target);
    let ret = target;
    for (const key of Object.keys(patch)) {
      if (key === this.spreaderKey) continue;
      if ((ret === null) || (typeof ret !== "object")) {
        const cached = this._getPatchTargetFromCacheOrInit(patch);
        if (cached.hit) return cached.hit;
        ret = cached.value;
      }
      const newValue = this.patch(ret[key], patch[key], key, ret, key, patch);
      if (newValue !== undefined) ret[key] = newValue;
      else if (!targetIsArray) delete ret[key];
    }
    if (targetIsArray) {
      for (let i = 0; i !== ret.length; ++i) if (ret[i] === undefined) ret.splice(i--, 1);
    } else if (ret === undefined) {
      return this._getPatchTargetFromCacheOrInit(patch).value;
    }
    return ret;
  },
  objectNoSymbolsKeepUndefined (target, patch) {
    let ret = target;
    for (const key of Object.keys(patch)) {
      if (key === this.spreaderKey) continue;
      if ((ret === null) || (typeof ret !== "object")) {
        const cached = this._getPatchTargetFromCacheOrInit(patch);
        if (cached.hit) return cached.hit;
        ret = cached.value;
      }
      ret[key] = this.patch(ret[key], patch[key], key, ret, key, patch);
    }
    if (ret === undefined) {
      return this._getPatchTargetFromCacheOrInit(patch).value;
    }
    return ret;
  },
  objectWithSymbolsDeleteUndefined (target, patch) {
    const targetIsArray = Array.isArray(target);
    const keys = Object.keys(patch);
    if (this.patchSymbols) {
      keys.push(...Object.getOwnPropertySymbols(patch));
    }
    let ret = target;
    for (const key of keys) {
      if (key === this.spreaderKey) continue;
      if ((ret === null) || (typeof ret !== "object")) {
        const cached = this._getPatchTargetFromCacheOrInit(patch);
        if (cached.hit) return cached.hit;
        ret = cached.value;
      }
      const newValue = this.patch(ret[key], patch[key], key, ret, key, patch);
      if (newValue !== undefined) ret[key] = newValue;
      else if (!targetIsArray) delete ret[key];
    }
    if (targetIsArray) {
      for (let i = 0; i !== ret.length; ++i) if (ret[i] === undefined) ret.splice(i--, 1);
    } else if (ret === undefined) {
      return this._getPatchTargetFromCacheOrInit(patch).value;
    }
    return ret;
  },
  objectWithSymbolsKeepUndefined (target, patch) {
    const keys = Object.keys(patch);
    if (this.patchSymbols) {
      keys.push(...Object.getOwnPropertySymbols(patch));
    }
    let ret = target;
    for (const key of keys) {
      if (key === this.spreaderKey) continue;
      if ((ret === null) || (typeof ret !== "object")) {
        const cached = this._getPatchTargetFromCacheOrInit(patch);
        if (cached.hit) return cached.hit;
        ret = cached.value;
      }
      ret[key] = this.patch(ret[key], patch[key], key, ret, patch);
    }
    if (ret === undefined) {
      return this._getPatchTargetFromCacheOrInit(patch).value;
    }
    return ret;
  },
};

function _applySpreader (target, patch, targetKey, parentTarget, patchKey, parentPatch) {
  const spreaderValue = patch[this.spreaderKey];
  let spread = this.spread;
  if (typeof spread !== "function") spread = this.spread = _patchSpread;
  const spreadee = spread.call(
      this, spreaderValue, target, patch, targetKey, parentTarget, patchKey, parentPatch);
  let ret;
  if (spreadee === undefined) {
    // spread callback has handled the whole remaining process and
    // has possibly replaced 'target' in its parentTarget[targetKey]
    // update ret to refer to this new object accordingly.
    ret = parentTarget && parentTarget[targetKey];
    return ret;
  }
  ret = this.patch(ret, spreadee, targetKey, parentTarget, patchKey, parentPatch);
  if (Object.keys(patch).length > 1) {
    const src = !this.preApplyPatch ? patch : { ...patch };
    if (this.preApplyPatch) delete src[this.spreaderKey];
    ret = this.patch(ret, src, targetKey, parentTarget, patchKey, parentPatch, true);
  }
  return ret;
}

function _patchSpread (
    spreadee, target, patch, targetKey, parentTarget /* , patchKey, parentPatch */) {
  if ((spreadee === null) || (spreadee === undefined)) return undefined;
  if (typeof spreadee === "function") {
    return (parentTarget[targetKey] = spreadee(target));
  }
  if (typeof spreadee === "string") {
    if (!this.require) {
      throw new Error(`No patchWith.options.require specified (needed by default spread ${
          ""} for spreadee '${spreadee}')`);
    }
    return this.require(spreadee);
  }
  if (!Array.isArray(spreadee)) return spreadee;
  let ret = target;
  for (const entry of spreadee) {
    ret = this.patch(ret, entry);
  }
  parentTarget[targetKey] = ret;
  return undefined;
}
