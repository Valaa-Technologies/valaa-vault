// @flow

function newSparqlEngine () {
  return require("./config/query-authority-sparql-engine.js")
    .urnComunicaSparqlInit;
}

Object.defineProperty(exports, "__esModule", { value: true });
exports.newSparqlEngine = newSparqlEngine;
