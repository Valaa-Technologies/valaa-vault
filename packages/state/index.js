const { isImmutateableSet } = require("@valos/tools");

const baseStateContextText = `[{
  "^": "urn:valos:",
  "@base": "urn:valos:chronicle:",
  "@vocab": "vplot:'",

  "V": "https://valospace.org/0#",
  "VLog": "https://valospace.org/log/0#",
  "VState": "https://valospace.org/state/0#",

  "&_": { "@id": "VState:subResources", "@type": "@id", "@container": "@id" },
  "&-": { "@id": "VState:removes", "@container": "@graph" },

  "~P": { "@id": "V:ownsProperty", "@type": "@id", "@container": "@id" },
  "~E": { "@id": "V:ownsEntity", "@type": "@id", "@container": "@id" },
  "~R": { "@id": "V:ownsRelation", "@type": "@id", "@container": "@id" },
  "~M": { "@id": "V:ownsMedia", "@type": "@id", "@container": "@id" },

  ".~": { "@id": "V:owner", "@type": "@id" },

  ".P~": { "@id": "V:scope", "@type": "@id" },
  ".E~": { "@id": "V:parent", "@type": "@id" },
  ".R~": { "@id": "V:graph", "@type": "@id" },
  ".M~": { "@id": "V:folder", "@type": "@id" },

  ".aURI": { "@id": "V:authorityURI", "@type": "@id" },
  ".cURI": { "@id": "V:chronicleURI", "@type": "@id" },
  ".n": { "@id": "V:name" },
  ".c": { "@id": "V:content" },

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

const baseStateContext = Object.freeze(Object.assign(Object.create(null),
    JSON.parse(baseStateContextText)));
}, {
  "state": { "@container": "@id" },
}]`;


const indexFromIRITag = Symbol("VState:indexFromIRI");
const iriLookupTag = Symbol("VState:iriLookup");

module.exports = {
  baseStateContext,
  baseStateContextText,
  createVState,
  mutateVState,
  indexFromIRITag,
  iriLookupTag,
  lookupReference,
  obtainReferenceEntry,
};

function createVState (references = []) {
  const vstate = { "&^": Object.create(null) };
  const _iriLookup = [];
  const _indexFromIRI = {};

  const vstatePrivate = {
    [iriLookupTag]: _iriLookup,
    [indexFromIRITag]: _indexFromIRI,
    toJSON () {
      const json = {
        "@context": [
          baseStateContext,
          Object.fromEntries(_iriLookup.map((value, index) => [index, value])),
        ],
      };
      for (const [key, value] of Object.entries(vstate)) {
        json[key] = _flattenToJSON(value);
      }
      return json;
    }
  };
  for (const privateKey of [
    ...Object.getOwnPropertySymbols(vstatePrivate),
    ...Object.getOwnPropertyNames(vstatePrivate),
  ]) {
    Object.defineProperty(vstate, privateKey, {
      writable: true, configurable: false, enumerable: false,
      value: vstatePrivate[privateKey],
    });
  }

  for (const [indexValue, reference] of Object.entries(references)) {
    const index = parseInt(indexValue, 10);
    if (typeof index !== "number" || String(index) !== String(indexValue) || index < 0) {
      throw new Error(`Invalid reference index: "${indexValue}" is not a non-negative integer`);
    }
    _iriLookup[index] = reference;
    _indexFromIRI[reference] = [index, {}];
  }
  return vstate;
}

function _flattenToJSON (object) {
  if (typeof object !== "object" || (object == null)) return object;
  if (Array.isArray(object) || isImmutateableSet(object)) {
    return object.map(_flattenToJSON);
  }
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
  const subs = ret["&_"];
  const context = ret["@context"];
  if (!subs || !context) return ret;
  // FIXME(iridian, 2021-03): This heuristic does not distinguish
  // between actual resource nodes and literal value objects that
  // happen to contain @context and &_ keys.
  delete ret["&_"];
  delete ret["@context"];
  return [ret, { "@context": context, "&_": subs }];
}

function mutateVState (state) {
  const ret = createVState(state[iriLookupTag]);
  for (const key of Object.keys(state)) {
    if (key === "@context") continue;
    ret[key] = Object.create(state[key]);
  }
  return ret;
}

function lookupReference (state, index) {
  return state[iriLookupTag][index];
}

function obtainReferenceEntry (state, reference) {
  const lookup = state[indexFromIRITag];
  let ret = lookup[reference];
  if (!ret) {
    const array = state[iriLookupTag];
    array.push(reference);
    ret = lookup[reference] = [array.length, reference];
  }
  return ret;
}
