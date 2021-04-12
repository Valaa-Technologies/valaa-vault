const baseContextText = `{
  "^": "urn:valos:",
  "@base": "urn:valos:chronicle:",
  "@vocab": "vplot:'",

  "V": "https://valospace.org/0#",
  "VLog": "https://valospace.org/log/0#",
  "VState": "https://valospace.org/state/0#",

  "&~": { "@id": "VState:globalResources", "@type": "@id", "@container": "@id" },
  "&+": { "@id": "VState:subResources", "@type": "@id", "@container": "@id" },
  "&-": { "@id": "VState:subRemovals", "@container": "@graph" },

  "~P": { "@id": "V:ownsProperty", "@type": "@id", "@container": "@id" },
  "~E": { "@id": "V:ownsEntity", "@type": "@id", "@container": "@id" },
  "~R": { "@id": "V:ownsRelation", "@type": "@id", "@container": "@id" },
  "~M": { "@id": "V:ownsMedia", "@type": "@id", "@container": "@id" },

  ".~": { "@id": "V:owner", "@type": "@id" },

  ".P~": { "@id": "V:scope", "@type": "@id" },
  ".E~": { "@id": "V:parent", "@type": "@id" },
  ".R~": { "@id": "V:graph", "@type": "@id" },
  ".M~": { "@id": "V:folder", "@type": "@id" },

  ".n": { "@id": "V:name" },

  ".iOf": { "@id": "V:instanceOf", "@type": "@id" },
  "-hasI": { "@id": "V:hasInstance", "@type": "@id", "@container": "@id" },

  ".gOf": { "@id": "V:ghostOf", "@type": "@id" },
  "-hasG": { "@id": "V:hasGhost", "@type": "@id", "@container": "@id" },

  ".src": { "@id": "V:source", "@type": "@id" },
  "-out": { "@id": "V:hasOutRelation", "@type": "@id", "@container": "@list" },

  ".tgt": { "@id": "V:target", "@type": "@id" },
  "-in": { "@id": "V:hasInRelation", "@type": "@id", "@container": "@list" },

  ".src-": { "@id": "V:linkedSource", "@type": "@id" },
  ".tgt-": { "@id": "V:linkedTarget", "@type": "@id" },

  ".src~": { "@id": "V:ownerSource", "@type": "@id" },
  ".tgt~": { "@id": "V:ownerTarget", "@type": "@id" },

  "VSourcerer": "https://valospace.org/sourcerer/0#",

  "~u4": "urn:valos:u4:"
}`;

const baseContext = Object.freeze(Object.assign(Object.create(null), JSON.parse(baseContextText)));

const referenceLookupTag = Symbol("VLog:referenceLookup");
const referenceArrayTag = Symbol("VLog:referenceArray");

module.exports = {
  baseContext,
  baseContextText,
  createVState,
  mutateVState,
  referenceLookupTag,
  referenceArrayTag,
  lookupReference,
  obtainReferenceEntry,
};

function createVState (references = []) {
  const _referenceArray = [];
  const _referenceLookup = {};

  const vstate = { "&~": Object.create(null) };
  Object.defineProperty(vstate, referenceArrayTag, {
    writable: true, configurable: false, enumerable: false,
    value: _referenceArray,
  });
  Object.defineProperty(vstate, referenceLookupTag, {
    writable: true, configurable: false, enumerable: false,
    value: _referenceLookup,
  });
  Object.defineProperty(vstate, "toJSON", {
    writable: true, configurable: false, enumerable: false,
    value () {
      const json = {
        "@context": [
          baseContext,
          Object.fromEntries(_referenceArray.map((value, index) => [index, value])),
        ],
      };
      for (const [key, value] of Object.entries(vstate)) {
        json[key] = _flattenToJSON(value);
      }
      return json;
    },
  });

  for (const [indexValue, reference] of Object.entries(references)) {
    const index = parseInt(indexValue, 10);
    if (typeof index !== "number" || String(index) !== String(indexValue) || index < 0) {
      throw new Error(`Invalid reference index: "${indexValue}" is not a non-negative integer`);
    }
    _referenceArray[index] = reference;
    _referenceLookup[reference] = [index, {}];
  }
  return vstate;
}

function _flattenToJSON (object) {
  if (typeof object !== "object" || (object == null)) return object;
  if (Array.isArray(object)) return object.map(_flattenToJSON);
  const ret = {};
  let removals;
  // eslint-disable-next-line guard-for-in
  for (const key in object) {
    const value = object[key];
    if (typeof value === "function") continue;
    if (value !== undefined) {
      ret[key] = _flattenToJSON(value);
    } else if (!(object["&-"] || {})[key]) {
      (removals || (removals = ret["&-"] = {}))[key] = null;
    }
  }
  const subs = ret["&+"];
  const context = ret["@context"];
  if (!subs || !context) return ret;
  // FIXME(iridian, 2021-03): This heuristic does not distinguish
  // between actual resource nodes and literal value objects that
  // happen to contain @context and &+ keys.
  delete ret["&+"];
  delete ret["@context"];
  return [ret, { "@context": context, "&+": subs }];
}

function mutateVState (state) {
  const ret = createVState(state[referenceArrayTag]);
  for (const key of Object.keys(state)) {
    if (key === "@context") continue;
    ret[key] = Object.create(state[key]);
  }
  return ret;
}

function lookupReference (state, index) {
  return state[referenceArrayTag][index];
}

function obtainReferenceEntry (state, reference) {
  const lookup = state[referenceLookupTag];
  let ret = lookup[reference];
  if (!ret) {
    const array = state[referenceArrayTag];
    array.push(reference);
    ret = lookup[reference] = [array.length, reference];
  }
  return ret;
}
