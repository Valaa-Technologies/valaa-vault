// @flow

const fs = require("fs");
const promisify = require("util").promisify;

const fsReadFile = promisify(fs.readFile);

async function crawlOntologies (ontologies: Object) {
  const crawledOntologies = {};
  try {
    for (const key in ontologies) {
      if (ontologies.hasOwnProperty(key)) {
        crawledOntologies[key] = {};
        _crawlObject(JSON.parse(await fsReadFile(ontologies[key], "utf8")),
          crawledOntologies[key]);
      }
    }
  } catch (e) {
    console.log("Error with context crawling:", e);
    throw new Error(`Error with context crawling:`, e);
  }

  return crawledOntologies;
}

function _crawlObject (object: Object, container: Object) {
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      if (key === "@context") continue;

      const value = object[key];
      if (typeof (value) === "object"
      && Array.isArray(value) && value.length !== 0) {
        for (let i = 0; i < value.length; i++) {
          _checkObject(value[i], container);
        }
      } else _checkObject(value, container);
    }
  }
}

function _checkObject (object: Object, container: Object) {
  if (typeof (object) === "object" && object !== null) {
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
}

Object.defineProperty(exports, "__esModule", { value: true });
module.exports = { crawlOntologies };
