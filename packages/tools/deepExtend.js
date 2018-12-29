// @flow

/**
 * Deep extends the given mutable target with the given immutable source value like a recursive
 * generalization of the es6 spread operation.
 *
 * Additionally deepExtend introduces the *spread operation* and the *spreader properties*.
 * As first class properties (default key "...") these spreader properties can be used to /describe/
 * localized, lazily evaluated, and context-dependent deep extend operations as persistent,
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
 * When myproject.json is deep-extended onto {} (with the contextual configSpread callback)
 * `deepExtend({}, myProjectJSON, { spread: configSpread });`
 * the result equals `{ kind: "project", name: "myproject", plugins: ["basicplugin", "myplugin"] }`.
 *
 * The configSpread callback interprets the "./common.json" spreader value as a file read operation.
 * deepExtend then appends the result of that onto {} followed by the rest of myProjectJSON.
 *
 *
 * Deep extend has two semantics: the universal deep extend semantics and the spread semantics.
 *
 * Deep extend semantics depend only on the source value type:
 * Empty object and undefined source values are no-ops and return the target unchanged.
 * Arrays in-place append and plain old objects in-place update the target value and return the
 * mutated target value. All other source values are returned directly.
 * If target of an in-place operation is not of an appropriate type a new empty object or array is
 * created as the target and returned after sub-operations.
 * Update performs a sub-deep-assign for each enumerable key of the source object. If the return
 * value is not undefined and differs from the corresponding value on the target it is assigned to
 * the target.
 *
 * Examples of deep append:
 *
 * deepExtend({ foo: [1], bar: "a" }, { foo: [2], bar: "b" })          -> { foo: [1, 2], bar: "b" }
 * deepExtend({ foo: [1] }, [{ foo: [2, 3] }, { foo: { 1: 4 } }])      -> { foo: [1, 4, 3] }
 * deepExtend({ foo: [1] }, { foo: null })                             -> { foo: null }
 * deepExtend({ foo: [1] }, [{ foo: null }, { foo: [3] }])             -> { foo: [3] }
 *
 * If a source object of some nested deep append phase has a spreader property (by default "...")
 * then right before it is deep assigned a spread operation is performed:
 * 1. The spread callback is called like so:
 *    const intermediate = spread(source["..."], target, source, key, targetParent,
 *    sourceParent).
 * 2. If the returned intermediate is undefined the subsequent deep assign of the source is skipped
 *    and deep assign returns targetParent[key].
 * 3. Otherwise the intermediate is deep assigned onto the target value, potentially recursively
 *    evaluating further spread operations.
 * 4. Finally the original source object is omitted the spreader property and deep assigned onto
 *    the target value (which has now potentially been much mutated).
 *
 * deepExtend([1, 2, 3], { 1: null })                                  -> [1, null, 3]
 * deepExtend([1, 2, 3], { 1: undefined })                             -> [1, undefined, 3]
 * deepExtend([1, 2, 3], { 1: { "...": null } })                       -> [1, 3]
 *
 *
 * Examples of spreaders:
 *
 * const fooRewriter = { "...": [{ foo: null }, { foo: [3] }] }
 * deepExtend({de:{ep:{ foo: [1] }}}, {de:{ep: fooRewriter }})         -> {de:{ep:{ foo: [3] }}}
 *
 * const arrayRewriter = { "...": [null, [3]] }
 * deepExtend({de:{ep:{ foo: [1] }}}, {de:{ep:{ foo: arrayRewriter }}})-> {de:{ep:{ foo: [3] }}}
 *
 *
 * Elementary extend rules as "target ... source -> result" productions based on source type:
 *
 * source: undefined | {}          -> target
 * source: { "...": spr, ...rest } -> deepExtend(deepExtend(target, spread(spr, ...)), rest)
 * source: Array                   -> asArray(target, (ret =>
 *                                     source.forEach(e => ret.push(deepExtend(null, [e])))))
 * source: Object                  -> asObject(target, (ret => Object.keys(source).forEach(key =>
 *                                     { ret[key] = deepExtend(ret[key], [source[key]]); });
 * source: any                     -> source
 *
 * @export
 * @param {*} target
 * @param {*} spreadee
 * @param {*} stack
 */
exports.default = function deepExtend (target /* : Object */, source /* : Array<any> */,
    options /* : {
  spread?: Function,
  spreaderKey?: string,
  customizer?: Function,
  keyPath?: Array<any>,
} */) {
  const stack = options || {};
  stack.extend = extend;
  if (stack.spreaderKey === undefined) stack.spreaderKey = "...";
  if (stack.spreaderKey && !stack.spread) {
    stack.spread = function spread (spreadee_, target_, source_, targetKey,
        targetParent, sourceParent /* , stack_ */) {
      if ((spreadee_ === null) || (spreadee_ === undefined)) return undefined;
      if (typeof spreadee_ === "function") return spreadee_(target_);
      if (typeof spreadee_ === "string") {
        if (!this.require) {
          throw new Error(`No deepExtend.options.require specified (needed by default spread ${
              ""} for spreadee '${spreadee_}')`);
        }
        return this.require(spreadee_);
      }
      if (!Array.isArray(spreadee_)) {
        return this.extend(target_, spreadee_, targetKey, targetParent, sourceParent);
      }
      let ret = target_;
      for (const entry of spreadee_) {
        ret = this.extend(ret, entry);
      }
      return ret;
    };
  }
  return stack.extend(target, source);

  function extend (target_, source_, targetKey, targetParent, sourceParent, skipSpread = false) {
    let ret = this.customizer
        && this.customizer(target_, source_, targetKey, targetParent, sourceParent, this);
    if (ret === undefined) {
      ret = target_;
      if (typeof source_ !== "object") ret = (source_ === undefined ? target_ : source_);
      else if (source_ === null) ret = null;
      else if (source_ === target_) throw new Error("Cannot extend to self");
      else if (Array.isArray(source_)) {
        if (!skipSpread && this.spreaderKey && (source_[0] === this.spreaderKey)) {
          for (let i = 1; i !== source_.length; ++i) {
            if (_setRetFromSpreadAndMaybeBail(this, source_[i])) break;
          }
        } else if (Array.isArray(ret) || !_setRetFromCacheAndMaybeBail()) {
          const newKeyPath = this.keyPath && [...this.keyPath, 0];
          for (const entry of source_) {
            if (newKeyPath) (this.keyPath = newKeyPath)[newKeyPath.length - 1] = ret.length;
            const newEntry = this.extend(undefined, entry, ret.length, ret, source_);
            if (newEntry !== undefined) ret.push(newEntry);
          }
        }
      } else if (!skipSpread && this.spreaderKey && source_.hasOwnProperty(this.spreaderKey)) {
        if (!_setRetFromSpreadAndMaybeBail(this, source_[this.spreaderKey])) {
          const src = !this.customizer ? source_ : { ...source_ };
          if (this.customizer) delete src[this.spreaderKey];
          ret = this.extend(ret, src, targetKey, targetParent, sourceParent, true);
        }
      } else {
        const targetIsArray = Array.isArray(ret);
        const updateOpKeyPath = this.keyPath && [...this.keyPath, ""];
        for (const key of Object.keys(source_)) {
          if (key === this.spreaderKey) continue;
          if (((ret === null) || (typeof ret !== "object")) && _setRetFromCacheAndMaybeBail()) break;
          if (updateOpKeyPath) (this.keyPath = updateOpKeyPath)[updateOpKeyPath.length - 1] = key;
          const newValue = this.extend(ret[key], source_[key], key, ret, source_);
          if (newValue !== undefined) ret[key] = newValue;
          else if (!targetIsArray) delete ret[key];
        }
        if (targetIsArray) {
          for (let i = 0; i !== ret.length; ++i) if (ret[i] === undefined) ret.splice(i--, 1);
        }
      }
    }
    const post = this.postProcessor
        && this.postProcessor(ret, source_, targetKey, targetParent, sourceParent, this);
    return (post !== undefined) ? post : ret;

    function _setRetFromSpreadAndMaybeBail (stack_, spreaderValue) {
      const spreadee = stack_.spread(
          spreaderValue, ret, source_, targetKey, targetParent, sourceParent, stack_);
      if (spreadee === undefined) {
        ret = targetParent && targetParent[targetKey];
        return true;
      }
      ret = stack_.extend(ret, spreadee, targetKey, targetParent, sourceParent);
      return false;
    }
    // Returns true on cache hit for synchronous return: source has already extended the target
    function _setRetFromCacheAndMaybeBail () {
      const cache = stack.cache || (stack.cache = new Map());
      const cacheHit = cache.get(source_);
      if (cacheHit) {
        ret = cacheHit;
        return true;
      }
      cache.set(source_, (ret = (Array.isArray(source_) ? [] : {})));
      return false;
    }
  }
};
