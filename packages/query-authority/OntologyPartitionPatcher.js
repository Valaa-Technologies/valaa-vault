// @flow

const ownPropertiesSymbol = Symbol("ownProperties");

async function patchOntologyPartitions (ontologies: Object, engine: Object,
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
  const isUpdating = (existingIndexPartition !== undefined);
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
  const prototypePropertyMap = {};

  for (const ontologyName in ontologyIndex) {
    if (!ontologyIndex.hasOwnProperty(ontologyName)) continue;
    prototypePropertyMap[ontologyName] = {};

    await engine.runValoscript(null, `
      (new Promise((baseResolve, baseReject) => {
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

        let i = 0;
        function iterateClasses () {
          return new Promise((resolve, reject) => {
            if (i >= ontologyData.classes.length) resolve();

            const ontologyClass = ontologyData.classes[i];
            const prototypeName = createPrototypeName(ontologyClass["@id"]);

            getInstance(ontologyClass, prototypeName)
            .then((resolvedData) => {
              createInstance(resolvedData.prototype, prototypeName,
                resolvedData.parentInstance, ontologyClass);
              i++;
              iterateClasses().then(() => resolve());
            });
          });
        }

        iterateClasses().then(() => {
          const ownlings = ontologyPartition.$V.unnamedOwnlings;
          for (let i = 0; i < ownlings.length; i++) {
            const ownling = ownlings[i];
            if (patchedClasses.indexOf(ownling.$V.rawId) === -1) {
              console.log("nonexistent destroy", ownling.$V.name);
              valos.Resource.destroy(ownling);
            }
          }

          baseResolve();
        });

        function createInstance (existingPrototype, prototypeName, instanceType, ontologyClass) {
          let prototype = existingPrototype;
          if (!prototype) {
            //if (isUpdating)
            //  console.log("create new instance while updating", prototypeName);

            let parentInstance = (!instanceType) ? Entity : instanceType;

            prototype = new parentInstance({
              owner: ontologyPartition, name: prototypeName
            });

            ontologyPartition[prototypeName] = prototype;
          }

          if (patchedClasses.indexOf(prototype.$V.rawId) === -1) {
            patchedClasses.push(prototype.$V.rawId);
            patchProperties(prototype, ontologyClass);
          };

          return prototype;
        }

        function getInstance (ontologyClass, prototypeName) {
          return new Promise((resolve, reject) => {
            let isCreatingParent = false;
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
                    isCreatingParent = true;
                    getInstance(ontologyParentClass,
                        parentPrototypeName).then((resolvedData) => {
                      parentInstance = createInstance(resolvedData.prototype,
                        parentPrototypeName, resolvedData.parentInstance,
                        ontologyParentClass);

                      resolve({ prototype, parentInstance });
                    });
                  }

                  break;
                }
              }
            }

            if (!isCreatingParent) resolve({ prototype, parentInstance });
          });
        }

        function patchProperties (prototype, ontologyClass) {
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
              //if (isUpdating) console.log("setprop", prototype.$V.name);
              prototype[prototypePropertyName] = null;
            }
          }
        }

        function createPrototypeName (ontologyClassId) {
          const match = ontologyClassId && ontologyClassId
              .match(new RegExp(ontologyName + ":(.*)"));
          return (match) ? match[1] : ontologyClassId;
        }
      }));
    `, { scope: { ontologyIndex, ownPropertiesSymbol,
        indexPartition, ontologyName, prototypePropertyMap,
        authority, isUpdating, console },
        awaitResult: (result) => result.getComposedEvent()
    });
  }

  return { indexPartition, prototypePropertyMap };
}

Object.defineProperty(exports, "__esModule", { value: true });
module.exports = { patchOntologyPartitions };
