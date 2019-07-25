// @flow

import { newEngine } from "@comunica/actor-init-sparql-rdfjs";
import { CorpusQuadSource, dataTypes } from "./CorpusQuadSource.js";
import { createEngineTestHarness } from "~/engine/test/EngineTestHarness";
import queryTestResources from "./queryTestResources";

const harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, queryTestResources);
const source = new CorpusQuadSource(harness);
const SPARQLEngine = newEngine();

function engineQuery (query: String, done: Function, callBack: Function) {
  SPARQLEngine.query(query,
    { sources: [{ type: "rdfjsSource", value: source }] })
    .then((result) => {
      result.bindingsStream.on("data", (data) => {
        // console.log("data", data._root.entries);
        callBack(data);
      });

      result.bindingsStream.on("end", () => { console.log("done"); done(); });
      result.bindingsStream.on("error", (e) => {
        console.log("Error with matching: ", e);
        throw new Error("Error with matching: ", e);
      });
    }).catch((err) => {
      console.log("Error with SPARQL query engine", err);
      throw new Error("Error with SPARQL query engine", err);
    });
}

function _checkVariables (data: any, variables: Object) {
  expect(data).not.toBeFalsy();

  for (const key in variables) {
    if (variables.hasOwnProperty(key)) {
      const variableData = data.get(key);
      expect(variableData).not.toBeFalsy();

      expect(variableData.termType).not.toBeFalsy();
      expect(variableData.value).toEqual(
        (typeof variables[key] === "object" && variables[key] !== null)
          ? variables[key].value : variables[key]
      );

      if (variableData.termType === "Literal") {
        const datatype = variableData.datatype;

        expect(datatype).not.toBeFalsy();
        expect(datatype.termType).toEqual("NamedNode");
        expect(datatype.value).toEqual(dataTypes[
          (typeof variables[key] === "object" && variables[key] !== null)
            ? variables[key].valosType : typeof variables[key]
        ]);
      }
    }
  }
}


describe("Property queries", () => {
  it(`queries for value of single entity's property
    where value is string literal`, (done) => {
    const query = `SELECT ?o WHERE {
      <http://valospace.org/Entity#query-test-entity>
      <http://valospace.org/Property#test_string>
      ?o .
    }`;

    engineQuery(query, done, (data) => {
      _checkVariables(data, { "?o": "hello world" });
    });
  });

  it(`queries for value of single entity's property
    where value is int literal`, async (done) => {
    const query = `SELECT ?o WHERE {
      <http://valospace.org/Entity#query-test-entity>
      <http://valospace.org/Property#test_int>
      ?o .
    }`;

    engineQuery(query, done, (data) => {
      _checkVariables(data, { "?o": 42 });
    });
  });

  it(`queries for value of single entity's property
    where value is boolean literal`, async (done) => {
    const query = `SELECT ?o WHERE {
      <http://valospace.org/Entity#query-test-entity>
      <http://valospace.org/Property#test_boolean>
      ?o .
    }`;

    engineQuery(query, done, (data) => {
      _checkVariables(data, { "?o": true });
    });
  });

  it(`queries for value of single entity's property
    where value is null`, async (done) => {
    const query = `SELECT ?o WHERE {
      <http://valospace.org/Entity#query-test-entity>
      <http://valospace.org/Property#test_null>
      ?o .
    }`;

    engineQuery(query, done, (data) => {
      _checkVariables(data, { "?o": { value: "", valosType: "null" } });
    });
  });

  it(`queries for value of single entity's property
    where value is string literal`, async (done) => {
    const query = `SELECT ?o WHERE {
      <http://valospace.org/Entity#query-test-entity>
      <http://valospace.org/Property#test_object>
      ?o .
    }`;

    engineQuery(query, done, (data) => {
      _checkVariables(data, { "?o": { value: `{"hello":"world"}`, valosType: "object" } });
    });
  });

  it(`queries for value of single entity's property
    where value is pointer`, async (done) => {
    const query = `SELECT ?o WHERE {
      <http://valospace.org/Entity#query-test-entity>
      <http://valospace.org/Property#pointer_to_test_ownling>
      ?o .
    }`;

    engineQuery(query, done, (data) => {
      _checkVariables(data, { "?o": { value: "<valos:id:test-ownling>" } });
    });
  });

  xit(`queries for values of single entity's
    multiple properties`, async (done) => {
    const query = `SELECT ?o WHERE {
      { <http://valospace.org/Entity#query-test-entity>
      <http://valospace.org/Property#string>
      ?o } UNION
      { <http://valospace.org/Entity#query-test-entity>
      <http://valospace.org/Property#int>
      ?o } UNION
      { <http://valospace.org/Entity#query-test-entity>
        <http://valospace.org/Property#boolean>
      ?o }
    }`;

    engineQuery(query, done, (data) => {
      console.log(data);
    });
  });

  it(`queries for values of single entity's
    multiple properties where value is same`, async (done) => {
    const query = `SELECT ?o WHERE {
      <http://valospace.org/Entity#query-test-entity>
      <http://valospace.org/Property#test_string>
      ?o .
      <http://valospace.org/Entity#query-test-entity>
      <http://valospace.org/Property#test_anotherstring>
      ?o
    }`;

    engineQuery(query, done, (data) => {
      _checkVariables(data, { "?o": "hello world" });
    });
  });
});
