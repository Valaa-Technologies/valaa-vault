// @flow

const quadSource = require("../CorpusQuadSource.js");
const createQueryAuthorityPartition = require("../ServiceLogic.js")
  .createQueryAuthorityPartition;
const engineTestHarness = require("~/engine/test/EngineTestHarness");
const queryTestResources = require("./data/queryTestResources").default;
const VALEK = require("~/engine/VALEK").default;

const harness = engineTestHarness
  .createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });

harness.chronicleEvents(queryTestResources(engineTestHarness.testPartitionURI));
let source;

beforeEach(async () => {
  source = [{
    type: "rdfValosSource",
    value: new quadSource.CorpusQuadSource(harness)
  }];
});

afterEach(() => { source = undefined; });

function _getResourceById (owner: Object, field: String, resourceRawId: String) {
  return owner.get(VALEK.toField(field)
    .find(VALEK.equalTo(VALEK.toField("rawId"), resourceRawId)));
}

function _getPropertyValue (owner: Object, propertyName: String) {
  return owner.get(VALEK.propertyValue(propertyName));
}

function _addPrefixes (query: String) {
  return `BASE <http://valospace.org/> ${query}`;
}

describe("Entity creation", () => {
  it(`creates an entity with single property string`, async () => {
    const query = `CONSTRUCT {
      <entity/query-test-entity>
      <namedPropertyValue/test_string>
      ?o
    }
    WHERE {
      <entity/query-test-entity>
      <namedPropertyValue/test_string>
      ?o
    }`;

    const { quarPartition, idMap } = await createQueryAuthorityPartition(
      _addPrefixes(query), source, harness
    );

    const subject = _getResourceById(quarPartition,
      "unnamedOwnlings", idMap.get("query-test-entity"));
    expect(subject.getRawId()).toBe(idMap.get("query-test-entity"));
    expect(_getPropertyValue(subject, "test_string")).toBe("hello world");
  });

  it(`creates an entity with multiple properties`, async () => {
    const query = `CONSTRUCT {
      <entity/query-test-entity>
      <property>
      ?o
    }
    WHERE {
      <entity/query-test-entity>
      <property> [<value> ?o]
    }`;

    const { quarPartition, idMap } = await createQueryAuthorityPartition(
      _addPrefixes(query), source, harness
    );

    const subject = _getResourceById(quarPartition,
      "unnamedOwnlings", idMap.get("query-test-entity"));
    expect(subject.getRawId()).toBe(idMap.get("query-test-entity"));
    expect(subject.get(VALEK.toField("properties")).length).toBe(7);

    expect(_getPropertyValue(subject, "newProperty1")).toBe("hello world");
    expect(_getPropertyValue(subject, "newProperty2")).toBe("hello world");
    expect(_getPropertyValue(subject, "newProperty3")).toBe(42);
    expect(_getPropertyValue(subject, "newProperty4")).toBe(true);
    expect(_getPropertyValue(subject, "newProperty5")).toBe(null);
    expect(_getPropertyValue(subject, "newProperty6")).toEqual({ hello: "world" });
    expect(_getPropertyValue(subject, "newProperty7"))
      .toEqual("<valos:id:test-ownling>");
  });
});
