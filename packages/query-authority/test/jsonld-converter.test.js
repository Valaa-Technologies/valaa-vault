// @flow

const fs = require("fs");
const Vrapper = require("~/engine/Vrapper").default;
const VALEK = require("~/engine/VALEK").default;
const HostRef = require("~/raem/VALK/hostReference").HostRef;
const vRef = require("~/raem/VRL").vRef;
const naiveURI = require("~/raem/ValaaURI").naiveURI;
const createQuarPartitionFromData
  = require("../JsonLdConverter.js").createQuarPartitionFromData;
const engineTestHarness = require("~/engine/test/EngineTestHarness");

const engine = engineTestHarness
  .createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });

function readJson (file) {
  const dirPath = "/home/rasmusronkko/local/personal/";
  return JSON.parse(fs.readFileSync(dirPath + file, "utf8"));
};

function _checkProperties (container, properties) {
  for (const key in properties) {
    if (properties.hasOwnProperty(key)) {
      expect(container.get(VALEK.propertyValue(key)))
        .toBe(properties[key]);
    }
  }
}

function _checkLink (link, targetName, targetPartitionId) {
  expect(link).toBeInstanceOf(Vrapper);
  expect(link.get(VALEK.toField("name"))).toBe(targetName);
  expect(link.getTypeName()).toBe("Relation");
  expect(link.get(VALEK.propertyValue("from"))).toBe(undefined);
  expect(link.get(VALEK.propertyValue("to"))).toBe(undefined);

  expect(naiveURI.getPartitionRawId(link[HostRef].getPartitionURI()))
    .toBe(targetPartitionId);
}

describe("JSONLD conversion to valos", () => {
  it("Creates quar partition from the identity jsonld data", async () => {
    const expectedValues = readJson("expectedValues.json");

    let resultPartition;
    try {
      resultPartition = await createQuarPartitionFromData(
        readJson("singleIdentityTestData.jsonld"), engine);
    } catch (e) {
      expect(true).toBe(false);
    }

    expect(resultPartition).toBeInstanceOf(Vrapper);
    expect(resultPartition.get(VALEK.toField("name"))).toBe("User");
    expect(resultPartition.get(VALEK.propertyValue("@context"))).toBe(undefined);

    _checkProperties(resultPartition, expectedValues.resultPartition.properties);

    expect(resultPartition.get(VALEK.propertyValue("dli:createdBy")).getRawId())
      .toBe(expectedValues.resultPartition.properties.tsId);

    const dataEntity = resultPartition.get(VALEK.toField("unnamedOwnlings")
      .find(VALEK.hasName("dli:data")));
    expect(dataEntity).toBeInstanceOf(Vrapper);
    expect(dataEntity.getTypeName()).toBe("Entity");

    _checkProperties(dataEntity, expectedValues.resultPartition.data);

    const outLink = resultPartition.get(VALEK.toField("relations")
      .find(VALEK.hasName("Authorized")));
    expect(outLink).toBeInstanceOf(Vrapper);
    expect(outLink.getTypeName()).toBe("Relation");

    _checkProperties(outLink, expectedValues.resultPartition.outLink);

    const linkTarget = outLink.get(VALEK.toField("target"));
    _checkLink(linkTarget, "inLinks", expectedValues.targetPartitionId);
    _checkLink(outLink, "Authorized",
      expectedValues.resultPartition.properties.tsId);
  });

  it("creates partitions from multiple identities", async () => {
    const expectedValues = readJson("multiIdentityExpectedValues.json");

    let resultPartition;
    try {
      resultPartition = await createQuarPartitionFromData(
        readJson("multiIdentityTestData.jsonld"), engine);
    } catch (e) {
      expect(true).toBe(false);
    }

    expect(resultPartition).toBeInstanceOf(Vrapper);

    const quarPartitions = resultPartition.get(VALEK
      .toField("relations").filter(VALEK.hasName("Result")));

    expect(quarPartitions.length).toBe(3);
    quarPartitions.forEach(result => {
      expect(result).toBeInstanceOf(Vrapper);
    });

    const buildingPartition = quarPartitions[0].get(VALEK.toField("target"));
    const floorPartition = quarPartitions[1].get(VALEK.toField("target"));
    const groupPartition = quarPartitions[2].get(VALEK.toField("target"));

    expect(buildingPartition.getRawId()).toBe(expectedValues.buildingPartitionId);
    expect(floorPartition.getRawId()).toBe(expectedValues.floorPartitionId);
    expect(groupPartition.getRawId()).toBe(expectedValues.groupPartitionId);

    const buildingDataEntity = buildingPartition.get(VALEK
      .toField("unnamedOwnlings").find(VALEK.hasName("dli:data")));
    expect(buildingDataEntity).toBeInstanceOf(Vrapper);
    expect(buildingDataEntity.getTypeName()).toBe("Entity");

    _checkProperties(buildingDataEntity, expectedValues.buildingPartitionData);

    const floorPartitionInLinks = floorPartition
      .get(VALEK.toField("relations").filter(VALEK.hasName("inLinks")));
    expect(floorPartitionInLinks.length).toBe(1);
    _checkLink(floorPartitionInLinks[0], "inLinks", expectedValues.floorPartitionId);
    _checkLink(floorPartitionInLinks[0].get(VALEK.toField("target")),
      "Link", expectedValues.buildingPartitionId);

    const floorPartitionOutLinks = floorPartition
      .get(VALEK.toField("relations").filter(VALEK.hasName("Link")));

    expect(floorPartitionOutLinks.length).toBe(2);
    _checkLink(floorPartitionOutLinks[0], "Link", expectedValues.floorPartitionId);
    _checkLink(floorPartitionOutLinks[0].get(VALEK.toField("target")),
      "inLinks", expectedValues.floorPartitionTargetId1);

    _checkLink(floorPartitionOutLinks[1], "Link", expectedValues.floorPartitionId);
    _checkLink(floorPartitionOutLinks[1].get(VALEK.toField("target")),
      "inLinks", expectedValues.floorPartitionTargetId2);

  });
});
