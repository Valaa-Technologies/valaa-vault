// @flow

/**
 * A queue of entries where each entry is associated with a Promise
 * that represents the return value of a future operation result entry
 * on a corresponding location.
 *
 * Useful for grouping several separate individual operations which
 * take an input value and return a promise, such as:
 *
 * ```
 * const resultPromise1 = doThisThingOnValue(myValue1);
 * const resultPromise2 = doThisThingOnValue(myValue2);
 * ```
 *
 * into a singular operation which takes multiple values and returns
 * a promise to multiple values without needing restructuring the code:
 *
 * ```
 * const delayedQueue = new DelayedQueue();
 * const resultPromise1 = delayedQueue.push(myValue1);
 * const resultPromise2 = delayedQueue.push(myValue2);
 * delayedQueue.resolve(doThisThingOnValues([...delayedQueue]));
 * ```
 *
 * When the queue is resolved with an array of values those values are
 * used to resolve corresponding result promises at the front of the
 * queue. The entries which are resolved in this way are spliced from
 * the queue, shifting remaining entries forward.
 *
 * @export
 * @param {Object} operation
 * @param {*} entry
 * @returns
 */
export default class DelayedQueue {
  _entries: Array<any> = [];
  _promises: Array<{ resolve: Function, reject: Function }> = [];

  [Symbol.iterator] () { return this._entries[Symbol.iterator](); }
  forEach (callback: Function) { return this._entries.forEach(callback); }
  map (callback: Function) { return this._entries.map(callback); }

  push (...entries) { return entries.map(entry => this.set(this._entries.length, entry)); }
  get (index) { return this._entries[index]; }
  set (index, entry) {
    this._entries[index] = entry;
    return new Promise((resolve, reject) => { this._promises[index] = { resolve, reject }; });
  }
  splice (start: number = 0, deleteCount?: number = this._entries.length - start,
      rejectReason = new Error("DelayedQueue.splice")) {
    const ret = this._entries.splice(start, deleteCount);
    this._promises.splice(start, deleteCount).forEach(
        promise => promise && promise.reject(rejectReason));
    return ret;
  }
  resolve (values: Promise<Array<any> > | Array<any>, start: number = 0) {
    if (!values) throw new Error("DelayedQueue.values must be an array or promise to one");
    if (!Array.isArray(values)) {
      return Promise.resolve(values).then(values_ => this.resolve(values_, start));
    }
    if (!values.length) return [];
    const ret = this._entries.splice(start, values.length);
    this._promises.splice(start, values.length).forEach(
        (promise, index) => promise && promise.resolve(values[index]));
    return ret;
  }
}

Object.defineProperty(DelayedQueue.prototype, "length", {
  get () { return this._entries.length; },
});
