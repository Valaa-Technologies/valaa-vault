// @flow

/**
 * Performs a deep clone with a customizer using the trivial clone algorithm described below.
 *
 * IMPORTANT: trivialClone does not perform special "object" handling. Javascript native objects
 * like "URL" and "Date" have quirky custom behaviour and WILL NOT get cloned appropriately; custom
 * customizer needs to be provided for them. trivialClone is geared to be minimalistic but
 * sufficient for cloning (deals with cyclic structures etc.). Ergo why it's called trivial.
 *
 * 1. if value has an existing cached clone:
 *    returns the clone
 *
 * 2, else if result of `customizer(value, keyIndexOrSymbol, object, descriptor, trivialClone)`
 *    is not undefined:
 *    caches and returns the call result as the clone
 *
 * 3. else if typeof value is not "object" or value is null:
 *    returns the value directly (without caching) as the clone
 *
 * 4. else if the value is an array, maps this clone algorithm on its entries and then:
 *    caches and returns the resulting array as the clone
 *
 * 5. else creates a perfect shallow clone of the value via first getting all value property
 *    descriptors with `Object.getOwnPropertyDescriptors(value)` then mapping the trivial clone
 *    algorithm on all descriptor.value (even for those with no value set, setting the value if the
 *    clone algo returns a defined value) and finally calling
 *    `Object.create(Object.getPrototypeOf(value), descriptors)`. Then:
 *    caches and returns the shallow clone.
 *
 * For steps 3. and 4. the keyIndexOrSymbol and object arguments for the customizer are
 * appropriately set.
 * Additionally for step 4. the field descriptor is given for the customizer before it has been
 * applied to the new clone.
 *
 * Cloned values are cached by the value itself as key in a standard Map at the earliest possible
 * moment (even for primitive value clones which get their values from the customizer).
 *
 *
 * Does not clone prototypes.
 *
 * @export
 * @param {*} value
 * @param {Function} customizer
 * @returns
 */
export default function trivialClone (value_: any, customizer: ?Function) {
  const existingClones = new Map();
  return _trivialClone(value_);

  function _trivialClone (value: any, indexKeyOrSymbol?: any, object?: Object,
      fieldDescriptor?: Object) {
    let clone = existingClones.get(value);
    if (clone !== undefined) return clone;
    clone = customizer
        && customizer(value, indexKeyOrSymbol, object, fieldDescriptor, _trivialClone);
    if (clone !== undefined) {
      existingClones.set(value, clone);
      return clone;
    } else if ((typeof value !== "object") || (value === null)) {
      return value;
    } else if (Array.isArray(value)) {
      clone = new Array(value.length);
      existingClones.set(value, clone);
      for (let i = 0; i !== value.length; ++i) {
        clone[i] = _trivialClone(value[i], i, value);
      }
      return clone;
    }
    clone = Object.create(Object.getPrototypeOf(value));
    existingClones.set(value, clone);
    for (const keysOrSymbols of
        [Object.getOwnPropertyNames(value), Object.getOwnPropertySymbols(value)]) {
      for (const keyOrSymbol of keysOrSymbols) {
        const descriptor = Object.getOwnPropertyDescriptor(value, keyOrSymbol);
        const clonedValue = _trivialClone(descriptor.value, keyOrSymbol, value, descriptor);
        if (clonedValue !== undefined) descriptor.value = clonedValue;
        if (!descriptor.skip) Object.defineProperty(clone, keyOrSymbol, descriptor);
      }
    }
    return clone;
  }
}
