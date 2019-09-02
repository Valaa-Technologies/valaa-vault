// @flow

const quadSource = require("../CorpusQuadSource.js");
const engineTestHarness = require("~/engine/test/EngineTestHarness");
const queryTestResources = require("./data/queryTestResources").default;
const Datafactory = require("../CorpusQuadDatafactory.js").default;
const querySource = require("../QuerySource.js").querySource;

const dataTypes = quadSource.dataTypes;
const harness = engineTestHarness
  .createEngineTestHarness({ verbosity: 0, claimBaseBlock: true })
harness.chronicleEvents(queryTestResources(engineTestHarness.testPartitionURI));

let source;

beforeEach(async () => {
  source = new quadSource.CorpusQuadSource(harness);
});

afterEach(() => { source = undefined; });

function _checkResultData (data: any, variables: any) {
  expect(data).not.toBeFalsy();
  expect(Array.isArray(data)).toBe(true);

  if (Array.isArray(variables)) {
    expect(data.length).toBe(variables.length);
    for (let i = 0; i < variables.length; i++) {
      let doesExistInData = false;
      for (let n = 0; n < data.length; n++) {
        if (_isTriple(data[n], variables[i])) {
          doesExistInData = true; break;
        }
      }
      expect(doesExistInData).toBe(true);
    }
  } else {
    expect(_isTriple(data[0], variables)).toBe(true);
  }
}

function _isTriple (solution: Object, variableTriple: Object) {
  for (const key in variableTriple) {
    if (variableTriple.hasOwnProperty(key)) {
      if ((!variableTriple[key] && solution[key])
        || (variableTriple[key] &&
            solution && !variableTriple[key].equals(solution[key]))) return false;
    }
  }

  return (variableTriple !== undefined && variableTriple !== null);
}

function _addPrefixes (query: String) {
  return `BASE <http://valospace.org/> ${query}`;
}

xdescribe("Property queries", () => {
  it(`should return rawId for named property`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity>
      <namedProperty/test_string>
      ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, { "?o":
      Datafactory.namedNode("<valos:id:query-test-string>") });
  });

  it(`queries for value of single entity's property
    where value is pointer`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity>
      <namedPropertyValue/pointer_to_test_ownling>
      ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, { "?o":
      Datafactory.namedNode("<valos:id:test-ownling>") });
  });

  it(`queries for values of single entity's
    multiple properties where one UNION graph queries for list`, async () => {
    const query = `SELECT ?so ?io ?lo WHERE {
      { <entity/query-test-entity>
      <namedPropertyValue/test_string>
      ?so } UNION
      { <entity/query-test-entity>
      <namedPropertyValue/test_int>
      ?io } UNION
      { <entity/query-test-entity>
        <property>
      ?lo }
    }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, [
      { "?so": Datafactory.literal("hello world") },
      { "?io": Datafactory.literal(42,
        Datafactory.namedNode(dataTypes.number)) },
      { "?lo": Datafactory.namedNode("<valos:id:query-test-string>") },
      { "?lo": Datafactory.namedNode("<valos:id:query-test-anotherstring>") },
      { "?lo": Datafactory.namedNode("<valos:id:query-test-int>") },
      { "?lo": Datafactory.namedNode("<valos:id:query-test-boolean>") },
      { "?lo": Datafactory.namedNode("<valos:id:query-test-nullable>") },
      { "?lo": Datafactory.namedNode("<valos:id:query-test-object>") },
      { "?lo": Datafactory.namedNode("<valos:id:query-test-ownling>") }
    ]);
  });

  it(`queries for values of single entity's
    multiple properties where value is same (JOIN)`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity>
      <namedPropertyValue/test_string>
      ?o .
      <entity/query-test-entity>
      <namedPropertyValue/test_anotherstring>
      ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, { "?o": Datafactory.literal("hello world") });
  });

  it(`query for entity's all properties
    where result is list of triples`, async () => {
    const query = `SELECT ?o WHERE
      { <entity/query-test-entity> <property> ?o }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, [
      { "?o": Datafactory.namedNode("<valos:id:query-test-string>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-anotherstring>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-int>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-boolean>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-nullable>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-object>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling>") }
    ]);
  });

  it(`query for entity's all property values`, async () => {
    const query = `SELECT ?o WHERE
      { <entity/query-test-entity> <property> [<value> ?o] }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, [
      { "?o": Datafactory.literal("hello world") },
      { "?o": Datafactory.literal("hello world") },
      { "?o": Datafactory.literal(42, Datafactory.namedNode(dataTypes.number)) },
      { "?o": Datafactory.literal(true, Datafactory.namedNode(dataTypes.boolean)) },
      { "?o": Datafactory.literal("", Datafactory.namedNode(dataTypes.null)) },
      { "?o": Datafactory.literal(
        `{"hello":"world"}`,
        Datafactory.namedNode(dataTypes.object))
      },
      { "?o": Datafactory.namedNode("<valos:id:test-ownling>") }
    ]);
  });
});

xdescribe("Propery literal value types", () => {
  it(`queries for value of single entity's property
    where value is string literal`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity>
      <namedPropertyValue/test_string>
      ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, { "?o": Datafactory.literal("hello world") });
  });

  it(`queries for value of single entity's property
    where value is int literal`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity>
      <namedPropertyValue/test_int>
      ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, { "?o": Datafactory.literal(42,
        Datafactory.namedNode(dataTypes.number)) });
  });

  it(`queries for value of single entity's property
    where value is boolean literal`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity>
      <namedPropertyValue/test_boolean>
      ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, { "?o": Datafactory.literal(true,
      Datafactory.namedNode(dataTypes.boolean)) });
  });

  it(`queries for value of single entity's property
    where value is nullable`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity>
      <namedPropertyValue/test_nullable>
      ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, { "?o": Datafactory.literal("",
      Datafactory.namedNode(dataTypes.null)) });
  });

  it(`queries for value of single entity's property
    where value is object`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity>
      <namedPropertyValue/test_object>
      ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, { "?o": Datafactory.literal(
      `{"hello":"world"}`,
      Datafactory.namedNode(dataTypes.object))
    });
  });
});

xdescribe("Unnamedownlings queries", () => {
  it(`query for entity's ownling entitites`, async () => {
    const query = `SELECT ?o WHERE
      { <entity/query-test-entity> <entity> ?o }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, [
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-entity>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-anotherentity>") }
    ]);
  });

  it(`query for entity's ownling medias`, async () => {
    const query = `SELECT ?p ?o WHERE
      { <entity/query-test-entity> <media> ?o }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, [
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-media>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-anothermedia>") }
    ]);
  });

  it(`query for entity's ownlings`, async () => {
    const query = `SELECT ?o WHERE
      { <entity/query-test-entity> <ownling> ?o }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, [
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-entity>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-anotherentity>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-media>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-anothermedia>") },
    ]);
  });
});

xdescribe("Relation queries", () => {
  it(`query for named relation`, async () => {
    const query = `SELECT ?o WHERE
      { <entity/query-test-entity> <namedRelation/query_test_ownling_relation> ?o }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data,
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-relation>") });
  });

  it(`query for named relation target`, async () => {
    const query = `SELECT ?o WHERE
      { <entity/query-test-entity>
        <namedRelationTarget/query_test_ownling_anotherrelation> ?o }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data,
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-anotherentity>") });
  });

  it(`query for all of entity's relations`, async () => {
    const query = `SELECT ?o WHERE
      { <entity/query-test-entity> <relation> ?o }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, [
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-relation>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-anotherrelation>") },
    ]);
  });

  it(`query for entity's all relation targets`, async () => {
    const query = `SELECT ?o WHERE
      { <entity/query-test-entity> <relation> [<target> ?o] }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, [
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-entity>") },
      { "?o": Datafactory.namedNode("<valos:id:query-test-ownling-anotherentity>") }
    ]);
  });
});

xdescribe("Error handling", () => {
  it(`queries with nonexistent suffix`, async () => {
    const query = `SELECT ?o WHERE {
      <nonexistent_suffix>
      <namedPropertyValue/nonexistent_property>
      ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    expect(data).toEqual([]);
  });

  it(`queries with nonexistent predicate`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity>
      <non_existent_predicate>
      ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    expect(data).toEqual([]);
  });

  it(`queries for entity's nonexistent property's value`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity>
      <namedPropertyValue/nonexistent_property>
      ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    expect(data).toEqual([]);
  });
});

xdescribe("OPTIONAL queries", () => {
  it(`queries with optional pattern`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity>
      <namedPropertyValue/test_string>
      ?o . OPTIONAL {
        <entity/query-test-entity>
        <namedPropertyValue/test_int>
        ?o
      }
    }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, { "?o": Datafactory.literal("hello world") });
  });
});

xdescribe("FILTER queries", () => {
  it(`queries with filter`, async () => {
    const query = `SELECT ?o WHERE {
      <entity/query-test-entity> <property> [<value> ?o] .
      FILTER regex(?o, "(hello world)", "i")
    }`;

    const data = await querySource(_addPrefixes(query), source);
    _checkResultData(data, [
      { "?o": Datafactory.literal("hello world") },
      { "?o": Datafactory.literal("hello world") }
    ]);
  });
});

xdescribe("ASK queries", () => {
  it(`queries with ASK where solution to query is found`, async () => {
    const query = `ASK {
      <entity/query-test-entity> <namedPropertyValue/test_string> ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    expect(data).toBe(true);
  });

  it(`queries with ASK where solution to query is not found`, async () => {
    const query = `ASK {
      <entity/query-test-entity> <property> [<value> ?o] .
      FILTER regex(?o, "(nonexistent_word)", "i")
    }`;

    const data = await querySource(_addPrefixes(query), source);
    expect(data).toBe(false);
  });
});

describe("DESCRIBE queries", () => {
  it(`describes all ownlings of an entity`, async () => {
    const query = `DESCRIBE ?o WHERE {
      <entity/query-test-entity> <entity> ?o
    }`;

    const data = await querySource(_addPrefixes(query), source);
    console.log("Data", data);
  });
});
