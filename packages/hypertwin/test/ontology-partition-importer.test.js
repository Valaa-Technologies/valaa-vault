// @flow

const fs = require("fs");
const Vrapper = require("~/engine/Vrapper").default;
const VALEK = require("~/engine/VALEK").default;
const expectedOntologyPartitionStructures
  = require("./expectedOntologyPartitionStructures");
const importOntologyPartitions = require("../OntologyPartitionImporter")
  .importOntologyPartitions;
const createMemoryPartitionURIFromRawId = require("~/raem/ValaaURI")
  .createMemoryPartitionURIFromRawId;
const engineTestHarness = require("~/engine/test/EngineTestHarness");

const testDataDirectory = `${__dirname}/data/`;

function readJsonLdFiles (jsonLdFiles) {
  const parsedFiles = {};
  for (const fileName in jsonLdFiles) {
    if (jsonLdFiles.hasOwnProperty(fileName)) {
      parsedFiles[fileName]
        = { data: JSON.parse(fs.readFileSync(jsonLdFiles[fileName], "utf8")) };
    }
  }

  return parsedFiles;
}

let engine;

beforeEach(() => {
  engine = engineTestHarness
    .createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
});

afterEach(() => {
  engine = null;
});

// Goes throught the ontology partition quite throroughly based
// on the expected structure
function _checkOntologyPartition (ontologyPartition: Vrapper,
    expectedPrototypes: Object, ontologyName: String,
    prototypePropertyMap: Array, expectedTruthCount: Number) {
  expect(ontologyPartition.get(VALEK.toField("name")))
    .toBe(`${ontologyName.toUpperCase()} Partition`);

  const expectedPrototypeKeys = Object.keys(expectedPrototypes);

  const prototypes = ontologyPartition.get(VALEK.toField("unnamedOwnlings"))
    .concat(ontologyPartition.get(VALEK.toField("relations")));
  const expectedPrototypeCount = expectedPrototypeKeys.length;
  expect(prototypes.length).toBe(expectedPrototypeCount);

  const ontologyPartitionConnection = engine.sourcerer
    .acquireConnection(createMemoryPartitionURIFromRawId(
      ontologyPartition.getRawId()));

  const connectionStatus = ontologyPartitionConnection.getStatus();
  expect(connectionStatus).not.toBeFalsy();
  expect(connectionStatus.truths)
    .toBe((expectedTruthCount !== undefined) ? expectedTruthCount
      : expectedPrototypeCount + 1);

  prototypes.forEach((prototype) => {
      expect(prototype).toBeInstanceOf(Vrapper);
      const prototypeName = prototype.get(VALEK.toField("name"));

      const expectedPrototype = expectedPrototypes[prototypeName];

      expect(expectedPrototype).not.toBeFalsy();
      expect(prototype.getTypeName()).toBe(expectedPrototype.type || "Entity");

      const parent = prototype.get(VALEK.toField("prototype"));
      if (expectedPrototype.parent) {
        if (!parent) console.log("parent", expectedPrototype.parent, prototypeName);
        expect(parent).toBeInstanceOf(Vrapper);
        expect(parent.get(VALEK.toField("name"))).toBe(expectedPrototype.parent);
      } else {
        expect(parent).toBe(null);
      }

      const ownProperties = prototypePropertyMap[prototype.get(VALEK.toField("name"))];
      expect(ownProperties).not.toBeFalsy();

      expect(ownProperties.length)
        .toBe(Object.keys(expectedPrototype.properties).length);

      ownProperties.forEach((property) => {
        const expectedProperty = expectedPrototype.properties[property];
        expect(expectedProperty).not.toBeFalsy();

        const propertyValue = prototype.get(VALEK.propertyValue(property));
        if (expectedProperty.type === "Property") {
          expect(propertyValue).toBe(null);
        } else {
          expect(propertyValue).toBeInstanceOf(Vrapper);
          expect(propertyValue.getTypeName()).toBe(expectedProperty.type);
        }
      });
  });
}

describe("Ontology prototype patcher", () => {
  it(`creates partition which consists of prototypes of terms from given ontologies`, async () => {
    const authority = "valaa-memory:";
    let ontologyIndexData;

    function getTerms () { return this.data.terms; }

    try {
      const parsedOntologies = readJsonLdFiles({
        test: `${testDataDirectory}ontology_importer_test.jsonld`,
      });

      parsedOntologies.test.getTerms = getTerms;
      ontologyIndexData = await importOntologyPartitions(parsedOntologies,
        engine, authority);
    } catch (e) {
      console.log("Error with reading ontologies", e);
      expect(false).toBe(true);
    }

    const ontologyIndexPartition = ontologyIndexData.indexPartition;
    expect(ontologyIndexPartition).toBeInstanceOf(Vrapper);
    const ontologies = ontologyIndexPartition.get(VALEK.toField("relations"));
    expect(ontologies.length).toBe(1);

    const potOntologyRelation = ontologies[0];
    expect(potOntologyRelation.get(VALEK.toField("name"))).toBe("ONTOLOGY");
    _checkOntologyPartition(potOntologyRelation.get(VALEK.toField("target")),
      expectedOntologyPartitionStructures.defaultStructure, "test",
      ontologyIndexData.prototypePropertyMap.test, 2);
  });

  it(`creates partition which consists of prototypes of terms from
  given ontologies after which updates created partition with changed
  ontology data`, async () => {
    const authority = "valaa-memory:";
    let ontologyIndexData;

    function getTerms () { return this.data.terms; }

    try {
      let parsedOntologies = readJsonLdFiles({
        test: `${testDataDirectory}ontology_importer_test.jsonld`,
      });

      parsedOntologies.test.getTerms = getTerms;
      ontologyIndexData = await importOntologyPartitions(parsedOntologies,
        engine, authority);

      parsedOntologies = readJsonLdFiles({
        test: `${testDataDirectory}ontology_importer_test_updated.jsonld`,
      });

      parsedOntologies.test.getTerms = getTerms;
      ontologyIndexData = await importOntologyPartitions(parsedOntologies,
        engine, authority, ontologyIndexData.indexPartition);
    } catch (e) {
      console.log("Error with reading ontologies", e);
      expect(false).toBe(true);
    }

    const ontologyIndexPartition = ontologyIndexData.indexPartition;
    expect(ontologyIndexPartition).toBeInstanceOf(Vrapper);
    const ontologies = ontologyIndexPartition.get(VALEK.toField("relations"));
    expect(ontologies.length).toBe(1);

    const potOntologyRelation = ontologies[0];
    expect(potOntologyRelation.get(VALEK.toField("name"))).toBe("ONTOLOGY");
    _checkOntologyPartition(potOntologyRelation.get(VALEK.toField("target")),
      expectedOntologyPartitionStructures.updatedStructure, "test",
      ontologyIndexData.prototypePropertyMap.test, 3);
  });
});
