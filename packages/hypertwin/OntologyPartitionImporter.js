// @flow

const ownPropertiesSymbol = Symbol("ownProperties");
const lookupKeys = ["rdfs:domain", "rdfs:range", "rdfs:subClassOf"];

async function importOntologyPartitions (ontologies: Object, engine: Object,
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

// Currently does not create the lookup from whole context
// only the specified keys as they are the only relevant information
// needed from the context, for now
function _generateContextLookup (context: any) {
  if (!context) return undefined;
  const contextLookup = {};

  for (const key in context) {
    if (!context.hasOwnProperty(key)) continue;

    const definition = context[key];
    if (definition && lookupKeys.indexOf(definition["@id"]) !== -1) {
      contextLookup[definition["@id"]] = key;
    } else if (lookupKeys.indexOf(definition) !== -1) {
      contextLookup[definition] = key;
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

    const domains
      = (term["rdfs:domain"] || term[contextLookup["rdfs:domain"]] || []);

    domains.forEach((domain) => {
      if (!ontologyMap.properties[domain]) ontologyMap.properties[domain] = [];
      ontologyMap.properties[domain].push(Object.create(term));
    });
  });

  return ontologyMap;
}

// As of now, getTerms is implemented by the caller that passes
// ontology, it should return array of the terms in the ontology
function _filterTermData (ontology: Array) {
  const contextLookup =
    _generateContextLookup(ontology.data["@context"]);

  if (!ontology.getTerms) throw new Error("getTerms() needs to be implemented for ontology");
  const terms = ontology.getTerms();
  if (!terms) throw new Error("Could not find ontology terms");

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
  const prototypePropertyMap = {};

  for (const ontologyName in ontologyIndex) {
    if (!ontologyIndex.hasOwnProperty(ontologyName)) continue;
    prototypePropertyMap[ontologyName] = {};

    // Adds all actions to array which is iterated through promises
    // to batch actions into less events
    await engine.runValoscript(null, `
      (new Promise((baseResolve, baseReject) => {
        const metadataSymbol = Symbol("metadata");
        const actions = [];
        const ontologyData = ontologyIndex[ontologyName];
        const contextLookup = ontologyData.contextLookup;
        const patchedClasses = [];
        const nameRegex = new RegExp(ontologyName + ":(.*)");
        const eventActionLimit = 50; // Can be moved to config file or similiar

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

          createAction(ontologyClass, prototypeName);
        }

        const ownlings = ontologyPartition.$V.unnamedOwnlings;
        for (let i = 0; i < ownlings.length; i++) {
          const ownling = ownlings[i];
          if (patchedClasses.indexOf(ownling.$V.name) === -1) {
            actions.push({ action: "DESTROY", prototype: ownling });
          }
        }

        let startIndex = 0;
        const classContext = {};

        function iterateActions () {
          return new Promise((resolve, reject) => {
            if (startIndex >= actions.length) { resolve(); return; }
            const executableActions = actions.slice(startIndex, startIndex + eventActionLimit);

            Promise.resolve().then(() => {
              for (let i = 0; i < executableActions.length; i++) {
                const executableAction = executableActions[i];
                if (executableAction.action === "CREATE") {
                  const ownerPrototype = (executableAction.ownerPrototype
                    || classContext[executableAction.ownerPrototypeName]);

                  if (executableAction.type === "Property") {
                    ownerPrototype[executableAction.name] = null;
                    continue;
                  }

                  const owner = (executableAction.isProperty) ?
                    ownerPrototype : ontologyPartition;

                  let resourceType = (executableAction.type === "Relation")
                    ? Relation : (executableAction.type === "Media")
                    ? Media : Entity;

                  const groupedProperties = groupProperties(executableAction.properties);

                  const prototype = new ((executableAction.isProperty && resourceType)
                  || ownerPrototype || resourceType)({
                    name: executableAction.name, owner,
                    properties: groupedProperties.properties
                  });

                  createChildEntitites(groupedProperties.entities, prototype);

                  owner[executableAction.name] = prototype;
                  classContext[executableAction.name] = prototype;
                }
                else if (executableAction.action === "DESTROY") {
                  const destroyableName = (executableAction.name
                    || (!!executableAction.prototype && executableAction.prototype.$V.name));
                  const owner = (executableAction.owner || ontologyPartition);

                  if (executableAction.prototype && owner[destroyableName]) {
                    valos.Resource.destroy(executableAction.prototype);
                  }

                  delete owner[destroyableName];
                }
              }

              startIndex += eventActionLimit;
              iterateActions().then(() => resolve());
            });
          });
        }

        iterateActions().then(() => baseResolve());

        // Recursively adds CREATE actions for prototypes if they have not yet
        // been created and do not exist

        // If parent prototype has DESTROY action or if current
        // parent prototype does not match the one in ontology,
        // adds DESTROY actions also

        function createAction (ontologyClass, prototypeName) {
          let action = {
            name: prototypeName,
            action: "CREATE",
            type: (ontologyClass.valosType || "Entity")
          };

          let prototype = ontologyPartition[prototypeName];
          let isPrototypeDestroyed = false;

          const subClassOf = (ontologyClass["rdfs:subClassOf"]
            || ontologyClass[contextLookup["rdfs:subClassOf"]]);

          if (subClassOf) {
            for (let i = 0; i < ontologyData.classes.length; i++) {
              const ontologyParentClass = ontologyData.classes[i];
              const ontologyParentClassId = ontologyParentClass["@id"];
              if (ontologyParentClassId === subClassOf) {
                const ownerPrototypeName
                  = createPrototypeName(ontologyParentClassId);

                let hasOwnerActionCreate = false;
                let hasOwnerActionDestroy = false;
                for (let n = 0; n < actions.length; n++) {
                  const actionIteration = actions[n];
                  if (actionIteration.name === ownerPrototypeName
                  || (prototype && prototype.$V.prototype === actionIteration.prototype)) {
                    if (actionIteration.action === "CREATE") hasOwnerActionCreate = true;
                    if (actionIteration.action === "DESTROY") hasOwnerActionDestroy = true;
                  }
                }

                if (!hasOwnerActionCreate
                && patchedClasses.indexOf(prototypeName) === -1) {
                  const result = createAction(ontologyParentClass, ownerPrototypeName);
                  if (result.isPrototypeDestroyed) hasOwnerActionDestroy = true;
                }

                if (prototype && prototype.$V.prototype
                && (prototype.$V.prototype.$V.name !== ownerPrototypeName || hasOwnerActionDestroy)) {
                  actions.push({ prototype, name: prototypeName, action: "DESTROY" });
                  isPrototypeDestroyed = true;
                  prototype = undefined;
                }

                if (ontologyPartition[ownerPrototypeName] && !hasOwnerActionDestroy) {
                  action.ownerPrototype = ontologyPartition[ownerPrototypeName];
                }
                else {
                  action.ownerPrototypeName = ownerPrototypeName;
                }

                break;
              }
            }
          }

          if (patchedClasses.indexOf(prototypeName) === -1) {
            patchedClasses.push(prototypeName);

            createPropertyActions(prototypeName, ontologyClass, prototype, action);
            if (!prototype) actions.push(action);
          };

          return { isPrototypeDestroyed };
        }

        // For now if range or restriction for term is "xsd:object"
        // type of the property to be created is Entity

        function createPropertyActions (prototypeName, ontologyClass, prototype, prototypeAction) {
          const classProperties = ontologyClass[ownPropertiesSymbol];
          const classContext = ontologyClass["@context"];
          if (!classProperties) return;

          if (!prototypePropertyMap[ontologyName][prototypeName]) {
            prototypePropertyMap[ontologyName][prototypeName] = {};
          }

          const propertyNestingScope = {
            classProperties, constructPropertyNesting
          };

          propertyNestingScope.constructPropertyNesting(classProperties, classContext);

          let ontologyProperties = [];
          for (let i = 0; i < classProperties.length; i++) {
            const classProperty = classProperties[i];
            const propertyId = classProperty["@id"];
            const propertyValue = ((classProperty[metadataSymbol]
              && classProperty[metadataSymbol].propertyValue) || null);

            const prototypePropertyName
              = createPrototypeName(classProperty["@id"]);

            ontologyProperties.push(prototypePropertyName);

            const propertyMap = prototypePropertyMap[ontologyName][prototypeName];

            if (!propertyMap.hasOwnProperty(prototypePropertyName)
            && (!classContext
            || (classContext[propertyId] &&
            !classContext[propertyId].hasOwnProperty("@nest")))) {
              propertyMap[prototypePropertyName] = propertyValue;
            }

            if (!prototype) {
              if (!prototypeAction.properties) prototypeAction.properties = {};

              prototypeAction.properties[prototypePropertyName] = propertyValue;
            } else if (prototype && !prototype.hasOwnProperty(prototypePropertyName)) {
              const propertyAction = {
                action: "CREATE", type: (isObject) ? "Entity" : "Property",
                 name: prototypePropertyName
              };

              if (isObject) {
                propertyAction.properties = propertyValue;
                propertyAction.isProperty = true;
              }

              if (prototype) propertyAction.ownerPrototype = prototype;
              else propertyAction.ownerPrototypeName = prototypeName

              actions.push(propertyAction);
            }
          }

          if (prototype) {
            const ownPropertyNames = Object.getOwnPropertyNames(prototype);
            for (let i = 0; i < ownPropertyNames.length; i++) {
              const ownPropertyName = ownPropertyNames[i];
              if (ontologyProperties.indexOf(ownPropertyName) === -1) {
                actions.push({
                  action: "DESTROY",
                  name: ownPropertyName,
                  owner: prototype,
                  prototype: valos.Resource.tryActiveResource(prototype[ownPropertyName])
                });
              }
            }
          }
        }

        function createPrototypeName (ontologyClassId) {
          const match = ontologyClassId && ontologyClassId.match(nameRegex);
          return (match) ? match[1] : ontologyClassId;
        }

        function isPropertyObject (property) {
          const xsdObj = "xsd:object";

          return (property["rdfs:range"] === xsdObj
            || property[contextLookup["rdfs:range"]] === xsdObj
            || (!!property["xsd:restriction"]
              && property["xsd:restriction"]["xsd:base"] === xsdObj)
            || (!!property[contextLookup["xsd:restriction"]]
              && property[contextLookup["xsd:restriction"]]["xsd:base"] === xsdObj));
        }

        function groupProperties (properties) {
          return Object.entries(properties)
            .reduce((acc, value) => {
              if (value[1] && typeof value[1] === "object") acc.entities[value[0]] = value[1];
              else acc.properties[value[0]] = value[1];
              return acc;
          }, { entities: {}, properties: {}});
        }

        function createChildEntitites (entities, owner) {
          Object.entries(entities).forEach((entity) => {
            const name = entity[0];
            const groupedProperties = groupProperties(entity[1]);

            const childEntity = new Entity({
              name, owner, properties: groupedProperties.properties
            });

            createChildEntitites(groupedProperties.entities, childEntity);

            owner[name] = childEntity;
          });
        }

        function constructPropertyNesting (properties, classContext, parentPropertyValue) {
          for (let i = 0; i < properties.length; i++) {
            const classProperty = properties[i];
            const propertyId = classProperty["@id"];

            if (!classProperty[metadataSymbol]) {
              const isObject = isPropertyObject(classProperty)
              const propertyMetadata = classProperty[metadataSymbol] = {
                isObject, propertyValue: null
              };

              if (isObject) {
                propertyMetadata.propertyValue = {};
                const nestedProps = Object.entries(classContext)
                  .reduce((arr, val) => {
                    if (val[1] && val[1]["@nest"] === propertyId) arr.push(val[0]);
                    return arr;
                }, []);

                const filteredProperties
                  = this.classProperties.filter((prop) => nestedProps.indexOf(prop["@id"]) !== -1);

                this.constructPropertyNesting(filteredProperties, classContext,
                  propertyMetadata.propertyValue);
              }
            }

            if (parentPropertyValue) {
              parentPropertyValue[createPrototypeName(propertyId)]
                = classProperty[metadataSymbol].propertyValue;
            }
          }
        }
      }));
    `, { scope: { ontologyIndex, ownPropertiesSymbol,
        indexPartition, ontologyName, prototypePropertyMap,
        authority, console },
        awaitResult: (result) => result.getComposedEvent()
    });
  }

  return { indexPartition, prototypePropertyMap };
}

Object.defineProperty(exports, "__esModule", { value: true });
module.exports = { importOntologyPartitions };
