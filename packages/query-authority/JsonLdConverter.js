// @flow

const crawlOntologies = require("./CrawlOntologies").crawlOntologies;

const ontologyDir = `${__dirname}/test/data/ontologies/`;

async function createQuarPartitionFromData (data: Object, engine: Object) {
  try {
    const ontologies = {
      pot: `${ontologyDir}pot.jsonld`,
      dli: `${ontologyDir}dli.jsonld`
    };

    const crawledOntologies = await crawlOntologies(ontologies);

    const resultPartition = await engine.runValoscript(null, `
      // FOR TESTING PURPOSES
      const partitionMap = {};
      let resultPartition;

      const keysToIgnore = ["@context"];
      const genericLookup = {
        "@id": (key, data, owner) => { owner.tsId = data; },
        "@type": (key, data, owner) => { owner.$V.name = data; },
        "rdf:Property": (key, data, owner) => { owner[key] = data; }
      };

      const potLookup = {
        "dli:data": (key, data, owner) => {
          owner[key] = new Entity({ owner, name: key });
          createResourcesFromObject(data, owner[key]);
        },
        "dli:name": genericLookup["rdf:Property"],
        "dli:createdBy": createPointerProperty,
        "dli:updatedBy": createPointerProperty,
        "inLinks": createLinks,
        "outLinks": createLinks
      };

      function generationMethodLookup(key, data, owner) {
        let context;
        let lookupKey = key;
        const contextKeys = Object.keys(crawledOntologies);
        for (let i = 0; i < contextKeys.length; i++) {
          context = crawledOntologies[contextKeys[i]][key];
          if (context) { lookupKey = context.fullName; break; }
        }

        let generationMethod = (potLookup.hasOwnProperty(lookupKey))
          ? potLookup[lookupKey] : genericLookup[lookupKey];

        if (!generationMethod) {
          generationMethod = genericLookup[(context)
            ? context.type : "rdf:Property"];
        }

        generationMethod(lookupKey, data, owner);
      }

      // For now also creates the target partition
      function createPointerProperty (key, id, owner) {
        if (!id) { owner[key] = null; return; }
        owner[key] = createQuarPartition(id);
      }

      function createLinks(key, data, owner) {
        const isOutLink = (key === "outLinks");
        for (let i = 0; i < data.length; i++) {
          const link = data[i];
          const relationName = (isOutLink && link["@type"])
            ? link["@type"] : key;

          const existingRelations = owner.$V.getRelations();

          let linkRelation;
          for (let n = 0; n < existingRelations.length; n++) {
            const existingRelation = existingRelations[n];
            const targetOwnerId = existingRelation.$V.target.$V.owner.$V.rawId;
            if (((link.from === targetOwnerId
              && link.to === owner.$V.rawId) ||
              (link.to === targetOwnerId
              && link.from === owner.$V.rawId))
              && link["@type"] === link["@type"]) {
                linkRelation = existingRelation; break;
              }
          }

          if (!linkRelation) {
            linkRelation = new Relation({ owner, name: relationName });

            linkRelation.$V.target
              = getRelationTarget(link, linkRelation, isOutLink);
          }

          if (isOutLink) createResourcesFromObject(link, linkRelation, ["from", "to"]);
        }
      }

      // For now also creates the target
      function getRelationTarget (link, target, isOutLink) {
        const targetQuarPartition
          = createQuarPartition((isOutLink) ? link.to : link.from);

        const linkRelationName = (isOutLink) ? "inLinks" : link["@type"];
        targetQuarPartition[linkRelationName] = new Relation({
            name: linkRelationName,
            owner: targetQuarPartition,
            target: target
        });

        return targetQuarPartition[linkRelationName];
      }

      function createQuarPartition(id, rootResultsLength) {
        let newQuarPartition;

        if (id && partitionMap[id]) newQuarPartition = partitionMap[id];
        else {
          const options = {
            name: "Query Authority Partition",
            owner: null,
            partitionAuthorityURI: "valaa-memory:"
          };

          if (id) options.id = id;

          newQuarPartition = new Entity(options);
          partitionMap[newQuarPartition.$V.rawId] = newQuarPartition;
        }

        if (rootResultsLength > 1) {
          if (!resultPartition) {
            resultPartition = new Entity({
              name: "Result Partition",
              owner: null,
              partitionAuthorityURI: "valaa-memory:"
            });
          }

          new Relation({
            name: "Result", owner: resultPartition,
            target: newQuarPartition
          });
        } else if (rootResultsLength) resultPartition = newQuarPartition;

        return newQuarPartition;
      }

      createResourcesFromArray(data);

      function createResourcesFromArray (resourceArray, owner) {
        for(let i = 0; i < resourceArray.length; i++) {
          const resource = resourceArray[i];
          createResourcesFromObject(resource, (owner)
            ? owner : createQuarPartition(resource["@id"], resourceArray.length));
        }
      }

      function createResourcesFromObject (object, owner, additionalKeysToIgnore) {
        const keys = Object.keys(object);
        for(let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const ignoredKeys = (additionalKeysToIgnore)
            ? keysToIgnore.concat(additionalKeysToIgnore)
            : keysToIgnore;

          if (ignoredKeys.indexOf(key) != -1) continue;

          generationMethodLookup(key, object[key], owner);
        }
      }

      (resultPartition);
    `, { scope: { data, crawledOntologies, console },
        awaitResult: (result) => result.getComposedEvent()
    });

    return resultPartition;
  } catch (e) {
    console.log(`Error with quar partition creation:`, e);
    throw new Error(`Error with quar partition creation:`, e);
  }
}

Object.defineProperty(exports, "__esModule", { value: true });
module.exports = { createQuarPartitionFromData };
