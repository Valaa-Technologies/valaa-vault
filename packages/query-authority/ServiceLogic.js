// @flow

const querySources = require("./QuerySources.js");
const hashV240 = require("~/sourcerer/tools/hashV240.js").default;
const dataTypes = require("~/query-authority/CorpusQuadSource.js").dataTypes;

async function createQueryAuthorityPartition
  (query: String, source: any, engine: Object) {
    if (!query || !source || !engine) {
      throw new Error("All necessary parameters we not passed");
    }

    const queryResult = await querySources(query, source);
    if (!queryResult || queryResult.length === 0) return [];

    for (let i = 0; i < queryResult.length; i++) _parseQuad(queryResult[i]);

    const quarPartitionId = _createQuarPartitionId(query);
    const quarPartitionData = await engine.runValoscript(null, `
      function createResource(owner, type) {
        const options = { owner };
        let resourceType = Entity;
        if (type === "media") {
          resourceType = Media;
          options.name = "New Media";
        }
        else if (type === "relation") {
          resourceType = Relation;
          options.name = "New Relation";
        }

        options.name = "New " + resourceType.name;
        return new resourceType(options);
      }

      function getObjectValue (object) {
        if (object.termType === "Literal" && object.datatype) {
          if (object.datatype.value === dataTypes.null) {
            return null;
          }
          else if (object.datatype.value === dataTypes.object) {
            return (typeof object.value === "string")
            ? JSON.parse(object.value) : "";
          }
          else return object.value;
        } else if (object.termType === "NamedNode") {
          return object.value;
        }
      }

      const quarPartition = new Entity({
        id: quarPartitionId,
        name: "Root: Query Authority Partition",
        owner: null,
        partitionAuthorityURI: "valaa-memory:"
      });

      const idMap = new Map();

      for (let i = 0; i < queryResult.length; i++) {
        const quad = queryResult[i];

        let subject = idMap.get(quad.subject.id);
        if (!subject) {
          subject = createResource(quarPartition, quad);
          idMap.set(quad.subject.id, subject);
        }

        if (quad.predicate.type != "property" && quad.object) {
          createResource(subject, quad.predicate.type);
        } else if (quad.object){
          const propertyCount = subject.$V.properties.length;
          const propName = (quad.predicate.id) ? (quad.predicate.id)
          : "newProperty" + (subject.$V.properties.length + 1).toString();

          subject[propName] = getObjectValue(quad.object);
        }
      }

      idMap.forEach((value, key) => {
        idMap.set(key, value.$V.rawId);
      });

      ({ quarPartition, idMap });
    `, { scope: { queryResult, quarPartitionId, dataTypes, console },
        awaitResult: (result) => result.getComposedEvent()
    });

    return quarPartitionData;
}

function _createQuarPartitionId (query: String) {
  return hashV240(query.replace(/[\r\n\s\t]+/g, " ").normalize());
}

function _parseQuad (quad) {
  for (const key in quad) {
    if (quad.hasOwnProperty(key)) _parseTerm(quad[key]);
  }
}

function _parseTerm (term: Object) {
  const iriMatch = term && term.value
    && typeof term.value === "string"
    && (term.value.match(/http:\/\/valospace.org\/(.*)/)
    || term.value.match(/<valos:id:(.*)>/));

  if (iriMatch) {
    const suffix = iriMatch[1].split("/");
    if (suffix[1]) term.id = suffix[1];

    switch (suffix[0]) {
      case "namedProperty":
      case "namedPropertyValue":
      case "property":
        term.type = "property"; break;
      case "namedRelation":
      case "namedRelationTarget":
      case "relation":
        term.type = "relation"; break;
      case "media":
          term.type = "media"; break;
      case "entity":
          term.type = "entity"; break;
      default:
        delete term.id; break;
    }
  }
}

Object.defineProperty(exports, "__esModule", { value: true });
module.exports = {
  createQueryAuthorityPartition
};
