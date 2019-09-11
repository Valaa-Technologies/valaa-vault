// @flow

// As of now fairly specific for a single use case though
// can be expanded to be more generic if more use cases appear

function parseOntologies (ontologies: Object) {
  const parsedOntologies = {};
  try {
    for (const key in ontologies) {
      if (ontologies.hasOwnProperty(key)) {
        parsedOntologies[key] = {};
        _crawlObject(ontologies[key], parsedOntologies[key]);
      }
    }
  } catch (e) {
    console.log("Error with context crawling:", e);
    throw new Error(`Error with context crawling:`, e);
  }

  return parsedOntologies;
}

function _crawlObject (object: Object, container: Object) {
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      if (key === "@context") continue;

      const value = object[key];
      if (Array.isArray(value) && value.length !== 0) {
        for (let i = 0; i < value.length; i++) {
          _checkObject(value[i], container);
        }
      } else {
        _checkObject(value, container);
      }
    }
  }
}

function _checkObject (object: Object, container: Object) {
  if (typeof (object) !== "object" || object === null) return;

  if (object.hasOwnProperty("@id")) {
    const id = object["@id"];
    const suffix = id && id.match(/(.*):(.*)/);
    if (suffix && suffix[1] && suffix[2]) {
      container[suffix[2]] = {
        namespace: suffix[1],
        fullName: id,
        ...(object["@type"] && { type: object["@type"] }),
        ...(object.range && { range: object.range })
      };
    }
  } else {
    _crawlObject(object, container);
  }
}

Object.defineProperty(exports, "__esModule", { value: true });
module.exports = parseOntologies;
