const { isImmutateableSet } = require("@valos/tools");

const baseStateContextText = `[{
  "^": "urn:valos:",
  "@base": "urn:valos:chronicle:",
  "@vocab": "vplot:'",

  "&": "@id",
  "&/": { "@id": "@graph", "@container": "@id" },
  "&t": "@type",
  "V": "https://valospace.org/0#",
  "VLog": "https://valospace.org/log/0#",
  "VState": "https://valospace.org/state/0#",

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

  ".ng": { "@id": "VState:subGraphName", "@type": "@id" },
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


  "~u4": "urn:valos:u4:",
  "~raw": "urn:valos:raw:"
}, {
  "state": { "@container": "@id" },
}]`;

const baseStateContext = Object.freeze(JSON.parse(baseStateContextText));

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
  const _iriLookup = [];
  const _indexFromIRI = {};

  const vstate = { state: Object.create(null) };
  const vstatePrivate = {
    [iriLookupTag]: _iriLookup,
    [indexFromIRITag]: _indexFromIRI,
    toJSON () {
      const json = {
        "@context": [
          ...baseStateContext,
          Object.fromEntries(_iriLookup.map((value, index) => [index, value])),
        ],
      };
      for (const [key, value] of Object.entries(vstate)) {
        json[key] = _flattenToJSON(value, 0);
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

function _flattenToJSON (object, graphDepth) {
  if (typeof object !== "object" || (object == null)) return object;
  if (Array.isArray(object) || isImmutateableSet(object)) {
    return object.map(o => _flattenToJSON(o, graphDepth));
  }
  const ret = {};
  const sourceRemovals = object["&-"] || {};
  let removals;
  // eslint-disable-next-line guard-for-in
  for (const key in object) {
    const value = object[key];
    if (typeof value === "function") continue;
    if (value !== undefined) {
      let retKey = key, newDepth = graphDepth;
      if (key[0] === "@") {
        if (key === "@id") {
          ret["@id"] = _idFromPlot(value);
          continue;
        }
        if (key === "@context") {
          newDepth = undefined;
        }
      } else if (graphDepth !== undefined) {
        if (key === "&/") {
          newDepth = graphDepth + 1;
        } else if (key.match(/^[0-9]+$/)) {
          retKey = `${key}:`;
        }
      }
      ret[retKey] = _flattenToJSON(value, newDepth);
    } else if (!sourceRemovals[key]) {
      (removals || (removals = ret["&-"] = {}))[key] = null;
    }
  }
  return ret;
}

function _idFromPlot (plot) {
  if (typeof plot === "number") return `${plot}:`;
  if (!Array.isArray(plot)) return plot;
  return `${plot.join("/")}/`;
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
