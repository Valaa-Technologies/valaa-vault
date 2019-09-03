// @flow

const ownPropertiesSymbol = Symbol("ownProperties");

function patchOntologyPartitions (ontologies: Object, engine: Object,
    authority: String, existingIndexPartition?: Object) {
  const ontologyIndex = {};

  for (const ontologyName in ontologies) {
    if (ontologies.hasOwnProperty(ontologyName)) {
      ontologyIndex[ontologyName]
        = _filterTermData(ontologies[ontologyName]);
    }
  }

  return _patchValosResources(ontologyIndex, engine, authority,
    existingIndexPartition);
}

function _isProperty (term: Object, propertyLookup: Object) {
  return ((term["rdfs:range"] && term["rdfs:domain"])
  || (term.hasOwnProperty(propertyLookup["rdfs:range"])
  && term.hasOwnProperty(propertyLookup["rdfs:domain"]))
  || term["@type"] === "rdf:Property");
}

function _generateContextLookup (context: any) {
  if (!context) return undefined;
  const contextLookup = {};

  for (const key in context) {
    if (context.hasOwnProperty(key)) {
      const definition = context[key];
      if (definition && (definition["@id"] === "rdfs:range" ||
      definition["@id"] === "rdfs:domain"
      || definition["@id"] === "rdfs:subClassOf")) {
        contextLookup[definition["@id"]] = key;
      } else if (definition === "rdfs:range"
        || definition === "rdfs:domain"
        || definition === "rdfs:subClassOf") {
        contextLookup[definition] = key;
      }
    }
  }

  return contextLookup;
}

function _createOntologyMap (terms, contextLookup) {
  const ontologyMap = {
    properties: {},
    classes: []
  };

  terms.forEach((term) => {
    if (!_isProperty(term, contextLookup)) {
      ontologyMap.classes.push(term); return;
    }

    term[contextLookup["rdfs:domain"]].forEach((domain) => {
      if (!ontologyMap.properties[domain]) ontologyMap.properties[domain] = [];
      ontologyMap.properties[domain].push(term);
    });
  });

  return ontologyMap;
}

function _filterTermData (ontology: Array) {
  const contextLookup =
    _generateContextLookup(ontology.data["@context"]);

  const terms = ontology.getTerms();
  const ontologyMap = _createOntologyMap(terms, contextLookup);

  ontologyMap.classes.forEach((ontologyClass) => {
    const properties = ontologyMap.properties[ontologyClass["@id"]];
    ontologyClass[ownPropertiesSymbol] = (properties || []);
  });

  return { classes: ontologyMap.classes, contextLookup };
}

async function _patchValosResources (ontologyIndex: Array, engine: Object,
    authority: String, existingIndexPartition?: Object) {
  let indexPartition = existingIndexPartition;
  if (!indexPartition) {
    indexPartition = await engine.runValoscript(null, `
      (new Entity({
        name: "Ontology Index Partition",
        owner: null,
        partitionAuthorityURI: authority
      }));
    `, { scope: { authority }, awaitResult: (result) => result.getComposedEvent()
    });
  }

  const ontologyNames = Object.keys(ontologyIndex);
  let prototypePropertyMap = {};

  ontologyNames.forEach(async (ontologyName) => {
    prototypePropertyMap[ontologyName] = {};

    prototypePropertyMap = await engine.runValoscript(null, `
      const ontologyData = ontologyIndex[ontologyName];

      const contextLookup = ontologyData.contextLookup;
      const patchedClasses = [];

      if (!indexPartition[ontologyName]) {
        indexPartition[ontologyName] = new Relation({
          owner: indexPartition, name: "ONTOLOGY"
        });
      }

      let ontologyPartition = indexPartition[ontologyName].$V.target;

      if (!ontologyPartition) {
        ontologyPartition = new Entity({
          name: ontologyName.toUpperCase() + " Partition",
          owner: null,
          partitionAuthorityURI: authority
        });

        indexPartition[ontologyName].$V.target = ontologyPartition;
      }

      for (let i = 0; i < ontologyData.classes.length; i++) {
        const ontologyClass = ontologyData.classes[i];
        const prototypeName = createPrototypeName(ontologyClass["@id"]);

        patchInstance(ontologyClass, prototypeName);
      }

      function patchInstance (ontologyClass, prototypeName) {
        let prototype = ontologyPartition[prototypeName];

        const subClassOf = (ontologyClass["rdfs:subClassOf"]
          || ontologyClass[contextLookup["rdfs:subClassOf"]]);

        let parentInstance;

        if (subClassOf) {
          for (let i = 0; i < ontologyData.classes.length; i++) {
            const ontologyParentClass = ontologyData.classes[i];
            const ontologyParentClassId = ontologyParentClass["@id"];
            if (ontologyParentClassId === subClassOf) {
              const parentPrototypeName
                = createPrototypeName(ontologyParentClassId);

              if (prototype && prototype.$V.prototype
                && prototype.$V.prototype.$V.name !== parentPrototypeName) {
                valos.Resource.destroy(prototype);
                prototype = undefined;
              }

              if (ontologyPartition[parentPrototypeName]) {
                parentInstance = ontologyPartition[parentPrototypeName];
              }
              else {
                parentInstance = patchInstance(ontologyParentClass,
                  parentPrototypeName);
              }

              break;
            }
          }
        }

        if (!prototype) {
          if (!parentInstance) parentInstance = Entity;

          prototype = new parentInstance({
            owner: ontologyPartition, name: prototypeName
          });

          ontologyPartition[prototypeName] = prototype;
        }

        patchProperties(prototype, ontologyClass);
        return prototype;
      }

      function patchProperties (prototype, ontologyClass) {
        if (patchedClasses.indexOf(prototype.$V.rawId) !== -1) return;
        patchedClasses.push(prototype.$V.rawId);

        const classProperties = ontologyClass[ownPropertiesSymbol];
        if (!classProperties) return;

        const prototypeName = prototype.$V.name;
        if (!prototypePropertyMap[ontologyName][prototypeName]) {
          prototypePropertyMap[ontologyName][prototypeName] = [];
        }

        for (let i = 0; i < classProperties.length; i++) {
          const classProperty = classProperties[i];
          const prototypePropertyName
            = createPrototypeName(classProperty["@id"]);

          if (prototypePropertyMap[ontologyName][prototypeName]
              .indexOf(prototypePropertyName) == -1) {
            prototypePropertyMap[ontologyName][prototypeName]
              .push(prototypePropertyName);
          }

          const xsdObj = "xsd:object";
          if (classProperty["rdfs:range"] === xsdObj
          || classProperty[contextLookup["rdfs:range"]] === xsdObj
          || (classProperty["xsd:restriction"]
            && classProperty["xsd:restriction"]["xsd:base"] === xsdObj)
          || (classProperty[contextLookup["xsd:restriction"]]
            && classProperty[contextLookup["xsd:restriction"]]["xsd:base"] === xsdObj)
          && (!prototype[prototypePropertyName]
            || prototype[prototypePropertyName].$V.typeName !== "Entity")) {
              prototype[prototypePropertyName] = new Entity({
                owner: prototype, name: prototypePropertyName
              });
          } else if (prototype[prototypePropertyName] !== null) {
            prototype[prototypePropertyName] = null;
          }
        }
      }

      function createPrototypeName(ontologyClassId) {
        const match = ontologyClassId && ontologyClassId
          .match(new RegExp(ontologyName + ":(.*)"));
        return (match) ? match[1] : ontologyClassId;
      }

      const ownlings = ontologyPartition.$V.unnamedOwnlings;
      for (let i = 0; i < ownlings.length; i++) {
        const ownling = ownlings[i];
        if (patchedClasses.indexOf(ownling.$V.rawId) === -1) {
          valos.Resource.destroy(ownling);
        }
      }

      (prototypePropertyMap)
    `, { scope: { ontologyIndex, ownPropertiesSymbol,
        indexPartition, ontologyName, prototypePropertyMap,
        authority, console },
        awaitResult: (result) => result.getComposedEvent()
    });
  });

  return { indexPartition, prototypePropertyMap };
}

Object.defineProperty(exports, "__esModule", { value: true });
module.exports = { patchOntologyPartitions };
