// @flow

const fs = require("fs");
const parseOntologies = require("../ParseOntologies");

// eslint-disable-next-line
function readJsonFile (filePath: String) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.log("Error with reading and parsing json file", e);
  }
}

function checkParsedOntologyData (parsedOntologyData: Object,
    ontologyName: String, expectedData: Object) {
  let expectedDataLength = 0;

  for (const type in expectedData) {
    if (!expectedData.hasOwnProperty(type)) continue;
    const expectedDataTerms = expectedData[type];
    expectedDataLength += expectedDataTerms.length;

    expectedDataTerms.forEach((expectedTerm) => {
      const parsedDataTerm = parsedOntologyData[expectedTerm];
      expect(parsedDataTerm).not.toBeFalsy();
      expect(parsedDataTerm.namespace).toBe(ontologyName);
      expect(parsedDataTerm.fullName)
        .toBe(`${ontologyName}:${expectedTerm}`);
      expect(parsedDataTerm.type).toBe(`rdf:${type}`);
    });
  }

  expect(Object.keys(parsedOntologyData).length).toBe(expectedDataLength);
}

describe(`Ontology crawler`, () => {
  it(`parses ontology data`, () => {
    const parsedData = parseOntologies({
      test: readJsonFile(`${__dirname}/data/ontology_importer_test.jsonld`)
    });

    expect(parsedData).not.toBeFalsy();
    const parsedTestData = parsedData.test;
    expect(parsedTestData).not.toBeFalsy();
    checkParsedOntologyData(parsedTestData, "test", {
      Class: ["LoneClass", "ParentClass", "LoneChildClass",
        "ParentChildClass", "GrandChildClass"],
      Property: ["commonProperty", "dataProperty", "rootProperty",
        "loneProperty"]
    });
  });
});
