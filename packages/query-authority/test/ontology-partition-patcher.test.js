// @flow

const fs = require("fs");
const Vrapper = require("~/engine/Vrapper").default;
const VALEK = require("~/engine/VALEK").default;
const expectedOntologyPartitionStructure
  = require("./data/expectedOntologyPartitionStructure");
const patchOntologyPartitions = require("../OntologyPartitionPatcher")
  .patchOntologyPartitions;
const engineTestHarness = require("~/engine/test/EngineTestHarness");

const engine = engineTestHarness
  .createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });

const ontologyDir = `${__dirname}/data/ontologies/`;

function readOntologies (ontologies) {
  const parsedOntologies = {};
  for (const ontologyName in ontologies) {
    if (ontologies.hasOwnProperty(ontologyName)) {
      parsedOntologies[ontologyName]
        = { data: JSON.parse(fs.readFileSync(ontologyDir
            + ontologies[ontologyName], "utf8")) };
    }
  }

  return parsedOntologies;
}

function _checkOntologyPartition (ontologyPartition: Vrapper,
    expectedPrototypes: Object, ontologyName: String,
    prototypePropertyMap: Array) {
  expect(ontologyPartition.get(VALEK.toField("name")))
    .toBe(`${ontologyName.toUpperCase()} Partition`);

  const expectedPrototypeKeys = Object.keys(expectedPrototypes);

  const prototypes = ontologyPartition.get(VALEK.toField("unnamedOwnlings"))
    .filter((prototype) => expectedPrototypeKeys
      .indexOf(prototype.get(VALEK.toField("name"))) !== -1);

  expect(prototypes.length).toBe(expectedPrototypeKeys.length);

  prototypes.forEach((prototype) => {
    expect(prototype).toBeInstanceOf(Vrapper);
    const expectedPrototype
      = expectedPrototypes[prototype.get(VALEK.toField("name"))];

    expect(expectedPrototype).not.toBeFalsy();
    expect(prototype.getTypeName()).toBe("Entity");

    const parent = prototype.get(VALEK.toField("prototype"));
    if (expectedPrototype.parent) {
      expect(parent).toBeInstanceOf(Vrapper);
      expect(parent.get(VALEK.toField("name"))).toBe(expectedPrototype.parent);
    } else {
      expect(parent).toBe(null);
    }

    const ownProperties = prototypePropertyMap[prototype.get(VALEK.toField("name"))];
    if (!ownProperties) console.log("prototype", prototype.get(VALEK.toField("name")));
    expect(ownProperties).not.toBeFalsy();
    expect(ownProperties.length)
      .toBe(Object.keys(expectedPrototype.properties).length);

    ownProperties.forEach((property) => {
      const expectedProperty = expectedPrototype.properties[property];
      if (!expectedProperty) console.log("missing property", property);
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
  xit(`creates partition which consists of prototypes of terms from given ontologies`, async () => {
    let ontologyIndexData;

    function getTerms () { return this.data.defines; }

    try {
      const parsedOntologies = readOntologies({
        pot: "pot.jsonld",
        dli: "dli.jsonld"
      });

      parsedOntologies.pot.getTerms = parsedOntologies.dli.getTerms = getTerms;
      ontologyIndexData = await patchOntologyPartitions(parsedOntologies,
        engine, "valaa-memory:");
    } catch (e) {
      console.log("Error with reading ontologies", e);
      expect(false).toBe(true);
    }

    const ontologyIndexPartition = ontologyIndexData.indexPartition;
    expect(ontologyIndexPartition).toBeInstanceOf(Vrapper);
    const ontologies = ontologyIndexPartition.get(VALEK.toField("relations"));
    expect(ontologies.length).toBe(2);

    const potOntologyRelation = ontologies[0];
    expect(potOntologyRelation.get(VALEK.toField("name"))).toBe("ONTOLOGY");
    _checkOntologyPartition(potOntologyRelation.get(VALEK.toField("target")),
      expectedOntologyPartitionStructure.pot, "pot",
      ontologyIndexData.prototypePropertyMap.pot);

    const dliOntologyRelation = ontologies[1];
    expect(dliOntologyRelation.get(VALEK.toField("name"))).toBe("ONTOLOGY");
    _checkOntologyPartition(dliOntologyRelation.get(VALEK.toField("target")),
      expectedOntologyPartitionStructure.dli, "dli",
      ontologyIndexData.prototypePropertyMap.dli);
  });

  it(`creates partition which consists of prototypes of terms from
  given ontologies after which updates created partition with changed
  ontology data`, async () => {
    let ontologyIndexData;

    function getTerms () { return this.data.defines; }

    try {
      let parsedOntologies = readOntologies({
        pot: "pot.jsonld",
      });

      parsedOntologies.pot.getTerms = getTerms;
      ontologyIndexData = await patchOntologyPartitions(parsedOntologies,
        engine, "valaa-memory:");

      parsedOntologies = readOntologies({
        pot: "pot_updated.jsonld"
      });

      parsedOntologies.pot.getTerms = getTerms;
      ontologyIndexData = await patchOntologyPartitions(parsedOntologies,
        engine, "valaa-memory:", ontologyIndexData.indexPartition);
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
      expectedOntologyPartitionStructure.getPotUpdated(), "pot",
      ontologyIndexData.prototypePropertyMap.pot);
  });
});
