import fs from "fs";
import path from "path";
import { Readable } from "stream";

import { JsonLdProcessor, promises, registerRDFParser, fromRDF, compact } from "jsonld";
import  ttl_read from "@graphy/content.ttl.read";

beforeAll(() => {
  registerRDFParser("text/turtle", input => new Promise(done => {
    const result = [];
    const handlers = {
      data: Array.prototype.push.bind(result),
      eof: done.bind(null, result),
    };
    if (typeof input === "string") {
      ttl_read(input, handlers);
    }
    if (input instanceof Readable) {
      input.pipe(ttl_read()).on("data", handlers.data).on("eof", handlers.eof);
    }
  }));
});

const _idTerms = {
  b: "https://brickschema.org/schema/1.0.3/Brick#",
  bf: "https://brickschema.org/schema/1.0.3/BrickFrame#",
  bt: "https://brickschema.org/schema/1.0.3/BrickTag#",
  bu: "https://brickschema.org/schema/1.0.3/BrickUse#",
};

const _brickContext = {
  "@vocab": "https://brickschema.org/schema/1.0.3/Brick#",
  "@language": "en",
  a: "@type",
  ..._idTerms,
  dcterms: "http://purl.org/dc/terms/",
  owl: "http://www.w3.org/2002/07/owl#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  skos: "http://www.w3.org/2004/02/skos/core#",
  xml: "http://www.w3.org/XML/1998/namespace",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  $V: "https://valospace.org/#",
  "@=>": { "@id": "rdfs:subClassOf", "@type": "@id" },
  "@==": { "@id": "owl:equivalentClass", "@type": "@id" },
  "@*": { "@id": "$V:entities", "@type": "@id", "@container": "@id" },
  label: { "@id": "rdfs:label" },
  definition: { "@id": "skos:definition" },
};

const _brickPropertiesContext = {
  controls: { "@id": "bf:controls", "@type": "@id" },
  equivalentTagSet: { "@id": "bf:equivalentTagSet", "@type": "@id" },
  feeds: { "@id": "bf:feeds", "@type": "@id" },
  hasInput: { "@id": "bf:hasInput", "@type": "@id" },
  hasLocation: { "@id": "bf:hasLocation", "@type": "@id" },
  hasMeasurement: { "@id": "bf:hasMeasurement", "@type": "@id" },
  hasOutput: { "@id": "bf:hasOutput", "@type": "@id" },
  hasPart: { "@id": "bf:hasPart", "@type": "@id" },
  hasPoint: { "@id": "bf:hasPoint", "@type": "@id" },
  hasSubAsset: { "@id": "bf:hasSubAsset", "@type": "@id" },
  hasTag: { "@id": "bf:hasTag", "@type": "@id" },
  hasTagSet: { "@id": "bf:hasTagSet", "@type": "@id" },
  hasToken: { "@id": "bf:hasToken", "@type": "@id" },
  isControlledBy: { "@id": "bf:isControlledBy", "@type": "@id" },
  isFedBy: { "@id": "bf:isFedBy", "@type": "@id" },
  isHierarchical: { "@id": "bf:isHierarchical" },
  isInputOf: { "@id": "bf:isInputOf", "@type": "@id" },
  isLocationOf: { "@id": "bf:isLocationOf", "@type": "@id" },
  isMeasuredBy: { "@id": "bf:isMeasuredBy", "@type": "@id" },
  isOutputOf: { "@id": "bf:isOutputOf", "@type": "@id" },
  isPartOf: { "@id": "bf:isPartOf", "@type": "@id" },
  isPointOf: { "@id": "bf:isPointOf", "@type": "@id" },
  isTagOf: { "@id": "bf:isTagOf", "@type": "@id" },
  isTagSetOf: { "@id": "bf:isTagSetOf", "@type": "@id" },
  isTokenOf: { "@id": "bf:isTokenOf", "@type": "@id" },
  similarTagSet: { "@id": "bf:similarTagSet", "@type": "@id" },
  usedBy: { "@id": "bf:usedBy", "@type": "@id" },
  usedByDimension: { "@id": "bf:usedByDimension", "@type": "@id" },
  usedByPoint: { "@id": "bf:usedByPoint", "@type": "@id" },
  usesDimension: { "@id": "bf:usesDimension", "@type": "@id" },
  usesEquipment: { "@id": "bf:usesEquipment", "@type": "@id" },
  usesLocation: { "@id": "bf:usesLocation", "@type": "@id" },
  usesMeasurement: { "@id": "bf:usesMeasurement", "@type": "@id" },
  usesPoint: { "@id": "bf:usesPoint", "@type": "@id" },
  usesTag: { "@id": "bf:usesTag", "@type": "@id" },
};

describe("CREATED/DUPLICATED", () => {
  beforeEach(() => {});
  it("shits bricks", async () => {
    const brickLD = await _processBrickTurtle("Brick", "b");
    expect(Object.keys(brickLD["@*"]).length).toEqual(2028);
  });
  it("shits brick frames", async () => {
    const brickLD = await _processBrickTurtle("BrickFrame", "bf");
    expect(Object.keys(brickLD["@*"]).length).toEqual(51);
  });
  it("shits brick tags", async () => {
    const brickLD = await _processBrickTurtle("BrickTag", "bt");
    expect(Object.keys(brickLD["@*"]).length).toEqual(2200);
  });
  it("shits brick uses", async () => {
    const brickLD = await _processBrickTurtle("BrickUse", "bu");
    expect(Object.keys(brickLD["@*"]).length).toEqual(1246);
  });
});

async function _processBrickTurtle (name, selfTerm) {
  const brickExpandedLD = await fromRDF(
    fs.createReadStream(path.join(__dirname, `./${name}.ttl`)),
    { format: "text/turtle" });
  fs.writeFileSync(
      path.join(__dirname, `./${name}.expanded.json`),
      _stringifyToDepth(brickExpandedLD, "  ", 2));
  const docuContext = {
    ..._brickContext,
    ..._brickPropertiesContext,
  };
  const idLookup = {};
  _gatherLocalIdentifiers(brickExpandedLD, selfTerm, idLookup, docuContext);
  _mutateLocalIdentifiers(brickExpandedLD, _idTerms, idLookup, docuContext);
  const brickLD = await compact(brickExpandedLD, docuContext);
  _objectifyRootResources(brickLD);
  fs.writeFileSync(
      path.join(__dirname, `./${name}.json`),
      _stringifyToDepth(brickLD, "  ", 2));
  return brickLD;
}

function _gatherLocalIdentifiers (expandedLD, selfTerm, idLookup, context) {
  let baseIRI = context[selfTerm];
  if ((typeof baseIRI === "object") && baseIRI["@id"]) baseIRI = baseIRI["@id"];
  if (typeof baseIRI !== "string") {
    throw new Error(`Can't resolve self term '${selfTerm}' definition @id string from context`);
  }
  let localCounter = 0;
  for (const entry of expandedLD) {
    const id = entry["@id"];
    if (!(id || "").startsWith(baseIRI)) continue;
    let localId = idLookup[id];
    if (localId === undefined) {
      localId = idLookup[id] = `^${base64Ify(localCounter++)}`;
      context[localId] = `${selfTerm}:${id.slice(baseIRI.length)}`;
    }
    entry["@id"] = localId;
  }
}

function _mutateLocalIdentifiers (root, idTerms, idLookup, context) {
  const prefixes = Object.entries(idTerms);
  let externalCounter = 0;
  _recurse(root);
  function _recurse (value) {
    if ((value == null) || (typeof value !== "object")) return;
    if (Array.isArray(value)) {
      for (const entry of value) _recurse(entry);
      return;
    }
    for (const [key, property] of Object.entries(value)) {
      if (key === "@id") {
        let localizedId = idLookup[property];
        if (localizedId === undefined) {
          for (const [term, id] of prefixes) {
            if (property.startsWith(id)) {
              localizedId = idLookup[property] = `>${base64Ify(externalCounter++)}`;
              context[localizedId] = `${term}:${property.slice(id.length)}`;
              break;
            }
          }
        }
        if (localizedId !== undefined) value[key] = localizedId;
      } else {
        _recurse(property);
      }
    }
  }
}

function _objectifyRootResources (compacted) {
  const object = compacted["@*"] = {};
  for (const entry of compacted["@graph"]) {
    object[entry["@id"]] = entry;
    delete entry["@id"];
  }
  delete compacted["@graph"];
}

function _stringifyToDepth (value, indentChars, maxDepth = 0, depth = 0) {
  if (typeof value !== "object" || (depth >= maxDepth)) return JSON.stringify(value);
  const newIndentChars = `\n${indentChars.repeat(depth + 1)}`;
  const entries = Array.isArray(value)
      ? value.map(entry => _stringifyToDepth(entry, indentChars, maxDepth, depth + 1))
      : Object.entries(value).map(([key, entry]) =>
          `${JSON.stringify(key)}: ${_stringifyToDepth(entry, indentChars, maxDepth, depth + 1)}`);
  const body = entries.length <= 1 ? entries.join("")
      : `${newIndentChars}${entries.join(`,${newIndentChars}`)}\n${indentChars.repeat(depth)}`;
  return Array.isArray(value) ? `[${body}]` : `{${body}}`;
}

/* eslint-disable no-bitwise */
function base64Ify (integer) {
  let str = "";
  let remainder = integer;
  do {
    str = _lookup[remainder & 63] + str;
    remainder >>= 6;
  } while (remainder);
  return str;
}

const _lookup = [];
for (let i = 0; i < 26; ++i) _lookup.push(String.fromCodePoint(65 + i));
for (let i = 0; i < 26; ++i) _lookup.push(String.fromCodePoint(97 + i));
for (let i = 0; i < 10; ++i) _lookup.push(String.fromCodePoint(48 + i));
_lookup.push("-", "_");
