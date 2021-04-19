const ImmutateableSetSentinelTag = Symbol("ImmutateableSetSentinelTag");
const ImmutateableSetLengthTag = Symbol("ImmutateableSetLengthTag");

module.exports = {
  createImmutateableSet,
  isImmutateableSet,
};

const _setArrayPrototype = Object.assign(Object.create(null), {
  [ImmutateableSetSentinelTag]: Object.freeze(
      [ImmutateableSetSentinelTag, ImmutateableSetSentinelTag]
  ),
  [ImmutateableSetLengthTag]: 0,
  [Symbol.iterator]: iterateImmutateableSet,
  getSize: lengthOfImmutateableSet,
  flatten: flattenImmutateableSet,
  add: addToImmutateableSet,
  clear: clearImmutateableSet,
  delete: deleteFromImmutateableSet,
  entries: entriesOfImmutateableSet,
  forEach: forEachInImmutateableSet,
  map: mapImmutateableSet,
  has: isValueInImmutateableSet,
  keys: iterateImmutateableSet,
  predecessor: predecessorOfImmutateableSetValue,
  successor: successorOfImmutateableSetValue,
  toJSON: setArrayToJSON,
  values: iterateImmutateableSet,
});

function createImmutateableSet (prototype = _setArrayPrototype) {
  return Object.create(prototype);
}

function isImmutateableSet (candidate) {
  return !!candidate[ImmutateableSetSentinelTag];
}

function lengthOfImmutateableSet () { return this[ImmutateableSetLengthTag]; }

function clearImmutateableSet () {
  for (const key of Object.keys(this)) delete this[key];
  Object.setPrototypeOf(this, _setArrayPrototype);
}

function flattenImmutateableSet (setArray) {
  if (Object.getPrototypeOf(setArray) === _setArrayPrototype) return;
  let cur = ImmutateableSetSentinelTag;
  do {
    const entry = setArray[cur];
    if (!Object.hasOwnProperty.call(setArray, cur)) setArray[cur] = entry;
    cur = entry[1];
  } while (cur !== ImmutateableSetSentinelTag);
  setArray[ImmutateableSetLengthTag] = setArray[ImmutateableSetLengthTag];
  Object.setPrototypeOf(setArray, _setArrayPrototype);
}

function iterateImmutateableSet () {
  return {
    _this: this,
    _cur: this[ImmutateableSetSentinelTag][1],
    next () {
      const value = this._cur;
      if (value === ImmutateableSetSentinelTag) return { done: true };
      this._cur = this._this[value][1];
      return { value, done: false };
    }
  };
}

function forEachInImmutateableSet (callback, thisArg) {
  for (const value of this) {
    callback.call(thisArg, value, value, this);
  }
}

function mapImmutateableSet (callback, thisArg) {
  const ret = new Array(this[ImmutateableSetLengthTag]);
  let i = 0;
  for (const value of this) ret[i++] = callback.call(thisArg, value, value, this);
  return ret;
}

function entriesOfImmutateableSet () {
  let cur = this[ImmutateableSetSentinelTag][1];
  return {
    done: () => cur === ImmutateableSetSentinelTag,
    next: () => {
      const ret = cur;
      cur = this[cur][1];
      return [ret, ret];
    }
  };
}

function isValueInImmutateableSet (value) {
  const entry = this[value];
  return typeof entry === "object";
}

function addToImmutateableSet (value, nextValue = ImmutateableSetSentinelTag) {
  if (typeof this[value] === "object") return this;

  const nextEntry = this[nextValue];
  const prevValue = nextEntry[0];
  this[value] = [prevValue, nextValue];

  if (Object.hasOwnProperty.call(this, nextValue)) {
    nextEntry[0] = value;
  } else {
    this[nextValue] = [value, nextEntry[1]];
  }

  const prevEntry = this[prevValue];
  if (Object.hasOwnProperty.call(this, prevValue)) {
    prevEntry[1] = value;
  } else {
    this[prevValue] = [prevEntry[0], value];
  }
  ++this[ImmutateableSetLengthTag];
  return this;
}

function deleteFromImmutateableSet (value) {
  const entry = this[value];
  if (typeof entry !== "object") return false;
  this[value] = undefined; // Not delete.

  const nextValue = entry[1];
  const prevValue = entry[0];

  const nextEntry = this[nextValue];
  if (Object.hasOwnProperty.call(this, nextValue)) {
    nextEntry[0] = prevValue;
  } else {
    this[nextValue] = [prevValue, nextEntry[1]];
  }

  const prevEntry = this[prevValue];
  if (Object.hasOwnProperty.call(this, prevValue)) {
    prevEntry[1] = nextValue;
  } else {
    this[prevValue] = [prevEntry[0], nextValue];
  }
  --this[ImmutateableSetLengthTag];
  return true;
}

function predecessorOfImmutateableSetValue (value) {
  const entry = this[value];
  const ret = entry && entry[0];
  return typeof ret === "string" ? ret : undefined;
}

function successorOfImmutateableSetValue (value) {
  const entry = this[value];
  const ret = entry && entry[1];
  return typeof ret === "string" ? ret : undefined;
}

function setArrayToJSON () {
  const ret = new Array(this[ImmutateableSetLengthTag]);
  let i = 0;
  for (const entry of this) ret[i++] = entry;
  return ret;
}
