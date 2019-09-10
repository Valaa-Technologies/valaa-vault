// @flow
const lsdComunica = "https://linkedsoftwaredependencies.org/bundles/npm/@comunica/";
const ais100ConfigSets = `${lsdComunica}actor-init-sparql/^1.0.0/config/sets/`;
const queryOpJson = `${ais100ConfigSets}sparql-queryoperators.json`;

const lsdValos = "https://linkedsoftwaredependencies.org/bundles/npm/@valos/";
const quar = `${lsdValos}query-authority/^0.35.0-prerelease.4/`;
const varrqpvsConfig = `${quar}actor-rdf-resolve-quad-pattern-valos-source/^1.0.0/config`;

// Logger
const __b15bnode125 = new (require("@comunica/logger-void").LoggerVoid)({});

// Buses
const busInit = new (require("@comunica/core").Bus)({
  name: `${lsdComunica}bus-init/Bus/Init`
});
const busOptimizeQueryOperation = new (require("@comunica/core").Bus)({
  name: `${lsdComunica}bus-optimize-query-operation/Bus/OptimizeQueryOperation`
});
const busQueryOperation = new (require("@comunica/core").Bus)({
  name: `${lsdComunica}bus-query-operation/Bus/QueryOperation`
});
const busSparqlParse = new (require("@comunica/core").Bus)({
  name: `${lsdComunica}bus-sparql-parse/Bus/SparqlParse`
});
const busContextPreprocess = new (require("@comunica/core").Bus)({
  name: `${lsdComunica}bus-context-preprocess/Bus/ContextPreprocess"`
});
const busRdfResolveQuadPattern = new (require("@comunica/core").Bus)({
  name: `${lsdComunica}bus-rdf-resolve-quad-pattern/Bus/RdfResolveQuadPattern`
});
const busRdfJoin = new (require("@comunica/core").Bus)({
  name: `${lsdComunica}bus-rdf-join/Bus/RdfJoin`
});

// Mediators
const mediatorOptimizeQueryOperation
  = new (require("@comunica/mediator-combine-pipeline").MediatorCombinePipeline)({
    name: `${ais100ConfigSets}sparql-init.json#mediatorOptimizeQueryOperation`,
    bus: busOptimizeQueryOperation
});

const mediatorQueryOperation = new (require("@comunica/mediator-number").MediatorNumber)({
  field: "httpRequests",
  type: `${lsdComunica}mediator-number/Mediator/Number/type/TypeMin`,
  ignoreErrors: true,
  name: `${queryOpJson}#mediatorQueryOperation`,
  bus: busQueryOperation
});
const mediatorSparqlParse = new (require("@comunica/mediator-race").MediatorRace)({
  name: `${ais100ConfigSets}sparql-init.json#mediatorSparqlParse`,
  bus: busSparqlParse
});
const mediatorContextPreprocess
  = new (require("@comunica/mediator-combine-pipeline").MediatorCombinePipeline)({
    name: `${ais100ConfigSets}sparql-init.json#mediatorContextPreprocess`,
    bus: busContextPreprocess
});
const mediatorResolveQuadPattern = new (require("@comunica/mediator-race").MediatorRace)({
  name: `${queryOpJson}#mediatorResolveQuadPattern`,
  bus: busRdfResolveQuadPattern
});
const mediatorJoin = new (require("@comunica/mediator-race").MediatorRace)({
  name: `${queryOpJson}#mediatorRdfJoin`,
  bus: busRdfJoin
});

// Actors
const actorQuadPatternQueryOperator
  = new (require("@comunica/actor-query-operation-quadpattern").ActorQueryOperationQuadpattern)({
    mediatorResolveQuadPattern,
    name: `${queryOpJson}#myQuadPatternQueryOperator`,
    bus: busQueryOperation
});
const actorProjectQueryOperator
  = new (require("@comunica/actor-query-operation-project").ActorQueryOperationProject)({
    mediatorQueryOperation,
    name: `${queryOpJson}#myProjectQueryOperator`,
    bus: busQueryOperation
});
const actorSingleBGPQueryOperator
  = new (require("@comunica/actor-query-operation-bgp-single").ActorQueryOperationBgpSingle)({
    mediatorQueryOperation,
    name: `${queryOpJson}#mySingleBgpQueryOperator`,
    bus: busQueryOperation
});
const actorLeftDeepSmallestBGPQueryOperator
  = new (require("@comunica/actor-query-operation-bgp-left-deep-smallest")
    .ActorQueryOperationBgpLeftDeepSmallest)({
      mediatorQueryOperation,
      name: `${queryOpJson}#myLeftDeepSmallestBgpQueryOperator`,
      bus: busQueryOperation
});
const actorEmptyBGPQueryOperator
  = new (require("@comunica/actor-query-operation-bgp-empty").ActorQueryOperationBgpEmpty)({
    name: `${queryOpJson}#myEmptyBgpQueryOperator`,
    bus: busQueryOperation
});
const actorUnionQueryOperator
  = new (require("@comunica/actor-query-operation-union").ActorQueryOperationUnion)({
    mediatorQueryOperation,
    name: `${queryOpJson}#myUnionQueryOperator`,
    bus: busQueryOperation
});
const actorJoinQueryOperator = new (require("@comunica/actor-query-operation-join")
  .ActorQueryOperationJoin)({
    mediatorJoin, mediatorQueryOperation,
    name: `${queryOpJson}#myJoinQueryOperator`,
    bus: busQueryOperation
});
const actorLeftJoinNestedLoopQueryOperator
  = new (require("@comunica/actor-query-operation-leftjoin-nestedloop").ActorQueryOperationLeftJoinNestedLoop)({
    mediatorQueryOperation,
    name: `${queryOpJson}#myLeftJoinQueryOperator`,
    bus: busQueryOperation
});
const actorFilterSparqleeQueryOperator
  = new (require("@comunica/actor-query-operation-filter-sparqlee").ActorQueryOperationFilterSparqlee)({
    mediatorQueryOperation,
    name: `${queryOpJson}#myFilterQueryOperator`,
    bus: busQueryOperation
});
const actorAskQueryOperator = new (require("@comunica/actor-query-operation-ask").ActorQueryOperationAsk)({
  mediatorQueryOperation,
  name: `${queryOpJson}#myAskQueryOperator`,
  bus: busQueryOperation
});
const actorConstructQueryOperator
  = new (require("@comunica/actor-query-operation-construct").ActorQueryOperationConstruct)({
  mediatorQueryOperation,
  name: `${queryOpJson}#myConstructQueryOperator`,
  bus: busQueryOperation
});
const actorDescribeSubjectQueryOperator
  = new (require("@comunica/actor-query-operation-describe-subject")
  .ActorQueryOperationDescribeSubject)({
    mediatorQueryOperation,
    name: `${queryOpJson}#myDescribeQueryOperator`,
    bus: busQueryOperation
});
const actorRdfJoinNestedLoop = new (require("@comunica/actor-rdf-join-nestedloop")
  .ActorRdfJoinNestedLoop)({
    name: `${ais100ConfigSets}join.json#myRdfJoinActor`,
    bus: busRdfJoin
});
const actorResolveValosSource
  = new (require("@valos/query-authority/actor-rdf-resolve-quad-pattern-valos-source")
    .ActorRdfResolveQuadPatternValosSource)({
      name: `${varrqpvsConfig}resolve-valos-source.json#myValosSourceQuadPatternResolver`,
      bus: busRdfResolveQuadPattern,
      mediatorResolveQuadPattern
});
const sparqlParser
  = new (require("@comunica/actor-sparql-parse-algebra").ActorSparqlParseAlgebra)({
    prefixes: {
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      owl: "http://www.w3.org/2002/07/owl#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
      dc: "http://purl.org/dc/terms/",
      dcterms: "http://purl.org/dc/terms/",
      dc11: "http://purl.org/dc/elements/1.1/",
      foaf: "http://xmlns.com/foaf/0.1/",
      geo: "http://www.w3.org/2003/01/geo/wgs84_pos#",
      dbpedia: "http://dbpedia.org/resource/",
      "dbpedia-owl": "http://dbpedia.org/ontology/",
      dbpprop: "http://dbpedia.org/property/",
      schema: "http://schema.org/",
      skos: "http://www.w3.org/2008/05/skos#"
    },
    name: `${ais100ConfigSets}sparql-parsers.json#mySparqlParser`,
    bus: busSparqlParse
});

// Init module
const urnComunicaSparqlInit
  = new (require("@comunica/actor-init-sparql").ActorInitSparql)({
    mediatorOptimizeQueryOperation, mediatorQueryOperation,
    mediatorSparqlParse,
    mediatorContextPreprocess,
    logger: __b15bnode125,
    contextKeyShortcuts: {
      source: "@comunica/bus-rdf-resolve-quad-pattern:source",
      sources: "@comunica/bus-rdf-resolve-quad-pattern:sources",
      initialBindings: "@comunica/actor-init-sparql:initialBindings",
      queryFormat: "@comunica/actor-init-sparql:queryFormat",
      baseIRI: "@comunica/actor-init-sparql:baseIRI",
      log: "@comunica/core:log",
      datetime: "@comunica/actor-http-memento:datetime",
      queryTimestamp: "@comunica/actor-init-sparql:queryTimestamp"
    },
    name: "urn:comunica:sparqlinit",
    bus: busInit
});

const urnComunicaMy = ({
  busInit, actors: [
    urnComunicaSparqlInit, sparqlParser, actorQuadPatternQueryOperator,
    actorProjectQueryOperator, actorSingleBGPQueryOperator,
    actorLeftDeepSmallestBGPQueryOperator, actorEmptyBGPQueryOperator,
    actorResolveValosSource, actorUnionQueryOperator, actorJoinQueryOperator,
    actorLeftJoinNestedLoopQueryOperator, actorFilterSparqleeQueryOperator,
    actorAskQueryOperator, actorConstructQueryOperator,
    actorDescribeSubjectQueryOperator, actorRdfJoinNestedLoop
  ]
});

module.exports = { urnComunicaSparqlInit, urnComunicaMy };
