// @flow


/**
 * Returns given value as an array.
 * If the value is undefined, the returned array is empty.
 * If the value is an iterable, the returned array contains all iterated values.
 * Otherwise the returned array contains the given value as a single entry.
 *
 * Note: this means that null will produce [null]. A convenient pattern to discard falsy values
 * is arrayFromAny(myValue || undefined).
 *
 * @export
 * @param {(void | any[] | any)} value
 * @returns array
 */
export function arrayFromAny (value: void | any[] | any) {
  if (typeof value === "undefined") return [];
  if (Array.isArray(value)) return value;
  if ((typeof value === "object") && value && value[Symbol.iterator]) return [...value];
  return [value];
}

/**
 * Like arrayFromAny but if the given value is an iterable returns it directly, thus making use of
 * infinite generators/iterables possible for short-circuiting iterator contexts (and being a bit
 * more performant for plain iteration as no intermediate array is created).
 *
 * @export
 * @param {(void | any[] | any)} value
 * @returns iterable
 */
export function iterableFromAny (value: void | any[] | any) {
  if (typeof value === "undefined") return [];
  if (Array.isArray(value) || ((typeof value === "object") && value[Symbol.iterator])) return value;
  return [value];
}
