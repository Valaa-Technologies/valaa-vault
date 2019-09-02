// @flow
const newSparqlEngine = require("./index.js").newSparqlEngine;

function querySource (query: String, source: any) {
  return new Promise((resolve, reject) => {
    newSparqlEngine().query(query, {
      sources: [{ type: "rdfValosSource", value: source }]
    }).then(async (result) => {
      let resultStream, parseMethod;
      const resultSet = [];
      //console.log("result", result);

      if (result && result.bindingsStream) {
        resultStream = result.bindingsStream;
        parseMethod = (data) => {
          const triple = {};
          data.forEach((value, key) => { triple[key] = value; });
          resultSet.push(triple);
        }
      } else if (result && result.quadStream) {
        resultStream = result.quadStream;
        parseMethod = (quad) => {
          resultSet.push(quad);
        }
      }

      if (result && resultStream) {
        resultStream.on("data", parseMethod).on("end", () => {
          resolve(resultSet);
        }).on("error", (e) => {
          console.log("Error with matching: ", e);
          throw new Error("Error with matching: ", e);
        });
      } else if (result && result.booleanResult) {
        resolve(await result.booleanResult);
      } else {
        resolve(undefined);
      }
    }).catch((err) => {
      console.log("Error with SPARQL query engine", err);
      reject(new Error("Error with SPARQL query engine", err));
    });
  });
}

Object.defineProperty(exports, "__esModule", { value: true });
module.exports = {
  querySource
};
