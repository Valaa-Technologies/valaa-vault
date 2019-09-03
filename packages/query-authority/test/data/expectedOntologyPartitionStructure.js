// @flow

const dliBasicProperties = {
  createdAt: { type: "Property" },
  createdBy: { type: "Property" },
  data: { type: "Entity" },
  metadata: { type: "Entity" },
  updatedAt: { type: "Property" },
  updatedBy: { type: "Property" }
};

const dliProperties = {
  contextName: { type: "Property" },
  domain: { type: "Property" },
  name: { type: "Property" },
  nested: { type: "Property" },
  readonly: { type: "Property" },
  supportedAttribute: { type: "Property" },
  supportedClass: { type: "Property" },
  title: { type: "Property" },
  valueType: { type: "Property" },
  from: { type: "Property" },
  to: { type: "Property" }
};

const potProperties = {
  areaGross: { type: "Property" },
  areaNet: { type: "Property" },
  codeLocal: { type: "Property" },
  colorCode: { type: "Property" },
  colorName: { type: "Property" },
  areaSquareMeterFloorNet: { type: "Property" },
  areaSquareMeterLivingNet: { type: "Property" },
  completionMomentYear: { type: "Property" },
  cultureHistorySignificance: { type: "Property" },
  additionalInformation: { type: "Property" },
  idInstance: { type: "Property" },
  idOfficialPermanent: { type: "Property" },
  idOfficialTemporary: { type: "Property" },
  categorizationLocal: { type: "Property" },
  categorizationOfficial: { type: "Property" },
  inaugurationMomentYear: { type: "Property" },
  inspectionMomentYear: { type: "Property" },
  descriptionGeneral: { type: "Property" },
  governmentPermanent: { type: "Property" },
  electricityCurrent: { type: "Property" },
  industryDomain: { type: "Property" },
  power: { type: "Property" },
  serialNumber: { type: "Property" },
  name: { type: "Property" },
  height: { type: "Property" },
  weight: { type: "Property" },
  width: { type: "Property" },
  length: { type: "Property" },
  thickness: { type: "Property" },
  idOfficial: { type: "Property" },
  idlocal: { type: "Property" },
  ifcGuid: { type: "Property" },
  ifcElementName: { type: "Property" },
  ifcElementType: { type: "Property" },
  sizeAreaFloor: { type: "Property" },
  sizeAreaLiving: { type: "Property" },
  sizeAreaLivingAudited: { type: "Property" },
  status: { type: "Property" },
  usageMain: { type: "Property" },
  volume: { type: "Property" },
  taxVatCode: { type: "Property" }
};

// As of now if multiple siblings exists, tests only one
const pot = {
  thoroughPrototypes: {
    AirConditioningDevice: {
      properties: _addPrefix(dliBasicProperties, "dli"), parent: "Device"
    },
    Zone: {
      properties: _addPrefix(dliBasicProperties, "dli"), parent: "Space"
    },
    Space: {
      properties: Object.assign(_addPrefix(dliBasicProperties, "dli"), _getFromObject(potProperties,
        ["additionalInformation", "categorizationLocal", "categorizationOfficial",
        "descriptionGeneral", "height", "idOfficial", "idlocal", "ifcGuid", "sizeAreaFloor",
        "sizeAreaLiving", "sizeAreaLivingAudited", "status", "usageMain", "volume"]))
    },
    Class: {
      properties: _addPrefix(dliBasicProperties, "dli")
    },
    Building: {
      properties: Object.assign(_addPrefix(dliBasicProperties, "dli"), _getFromObject(potProperties,
        ["areaSquareMeterFloorNet", "areaSquareMeterLivingNet", "completionMomentYear",
        "cultureHistorySignificance", "descriptionGeneral", "height",
        "idOfficialPermanent", "idOfficialTemporary", "ifcGuid",
        "inaugurationMomentYear", "inspectionMomentYear",
        "name", "status", "volume"]))
    },
    Organization: {
      properties: Object.assign(_addPrefix(dliBasicProperties, "dli"), _getFromObject(potProperties,
        ["categorizationOfficial", "descriptionGeneral", "governmentPermanent",
        "ifcGuid", "name", "status", "taxVatCode"]))
    },
    LimitedCompany: {
      properties: _addPrefix(dliBasicProperties, "dli"), parent: "Organization"
    },
    HousingCooperative: {
      properties: _addPrefix(dliBasicProperties, "dli"), parent: "LimitedCompany"
    },
    BelongsTo: {
      properties: Object.assign(_addPrefix(dliBasicProperties, "dli"),
        _addPrefix({ from: dliProperties.from, to: dliProperties.to }, "dli"))
    },
    BuildingSystems: {
      properties: _addPrefix(dliBasicProperties, "dli")
    },
    AirConditioningSystem: {
      properties: _addPrefix(dliBasicProperties, "dli"), parent: "BuildingSystems"
    },
    BuildingElement: {
      properties: Object.assign(_addPrefix(dliBasicProperties, "dli"), _getFromObject(potProperties,
        ["areaGross", "areaNet", "categorizationLocal", "codeLocal",
        "colorCode", "colorName", "descriptionGeneral", "height",
        "idInstance", "ifcElementName", "ifcElementType", "ifcGuid",
        "length", "name", "status", "thickness", "volume", "weight", "width"]))
    },
    Beam: {
      properties: _addPrefix(dliBasicProperties, "dli"), parent: "BuildingElement"
    },
    Radiator: {
      properties: _addPrefix(dliBasicProperties, "dli"), parent: "HeatingDevice"
    },
    CarbonDioxideSensor: {
      properties: _addPrefix(dliBasicProperties, "dli"), parent: "Sensor"
    },
    Faucet: {
      properties: _addPrefix(dliBasicProperties, "dli"), parent: "WaterDevice"
    },
    Device: {
      properties: Object.assign(_addPrefix(dliBasicProperties, "dli"), _getFromObject(potProperties,
        ["areaGross", "areaNet", "categorizationLocal", "codeLocal",
        "colorCode", "colorName", "descriptionGeneral", "electricityCurrent",
        "height", "ifcElementName", "ifcElementType", "ifcGuid",
        "industryDomain", "length", "name", "power", "serialNumber",
        "status", "thickness", "volume", "weight", "width"]))
    }
  },
  additionalPrototypes: ["Room", "Story", "LocatedAt", "ManagerAt",
  "ManagerOf", "OwnerAt", "OwnerOf", "TenantAt", "BuildingAutomationSystem",
  "HeatingSystem", "LightingSystem", "PowerSystem", "SecuritySystem",
  "SewageSystem", "VentilationSystem", "VideoSurveillanceSystem",
  "Column", "CurtainWall", "Door", "Floor", "Roof", "Slab", "Stair",
  "Wall", "Window", "AirFilteringDevice", "HeatingDevice", "PowerDevice",
  "SecurityDevice", "Sensor", "PresenceSensor", "QuantitySensor",
  "TemperatureSensor", "VentilationDevice", "WaterDevice", "Case",
  "Apartment", "RealEstate", "dli:SupportedAttribute", "dli:SupportedClass"]
};

const dli = {
  thoroughPrototypes: {},
  additionalPrototypes: []
};

const getPotUpdated = () => {
  console.log("getUpdated");
  const potUpdated = { thoroughPrototypes: {},
    additionalPrototypes: pot.additionalPrototypes };
  for (const key in pot.thoroughPrototypes) {
    if (pot.thoroughPrototypes.hasOwnProperty(key) && key !== "BelongsTo") {
      potUpdated.thoroughPrototypes[(key === "Space")
        ? "NewSpace" : key] = pot.thoroughPrototypes[key];
    }
  }

  potUpdated.thoroughPrototypes.Zone.parent = "NewSpace";
  return potUpdated;
};

function _getFromObject (object, keys) {
  const resultObj = {};
  keys.forEach((key) => resultObj[key] = object[key]);
  return resultObj;
}

function _addPrefix (properties: Object, suffix: String) {
  const prefixedProperties = {};
  for (const key in properties) {
    if (properties.hasOwnProperty(key)) {
      prefixedProperties[`${suffix}:${key}`] = properties[key];
    }
  }

  return prefixedProperties;
}

Object.defineProperty(exports, "__esModule", { value: true });
module.exports = { dli, pot, getPotUpdated };
