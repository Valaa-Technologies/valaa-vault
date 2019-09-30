// @flow

const commonProperty = { type: "Property" };
const rootProperty = { type: "Property" };
const loneProperty = { type: "Property" };
const deepNestedProperty = { type: "Property" };
const nestedDataProperty = { type: "Entity", properties: { deepNestedProperty } };
const dataProperty = { type: "Entity", properties: { commonProperty, loneProperty } };

const newRootProperty = { type: "Property" };

const defaultStructure = {
    LoneClass: {
      properties: { rootProperty, dataProperty: {
        type: "Entity",
        properties: {
          commonProperty,
          loneProperty,
          nestedDataProperty
        }
      } },
      type: "Relation"
    },
    ParentClass: {
      properties: { dataProperty, rootProperty }
    },
    LoneChildRelation: {
      properties: { dataProperty },
      parent: "ParentClass"
    },
    ParentChildClass: {
      properties: { dataProperty },
      parent: "ParentClass"
    },
    GrandChildClass: {
      properties: { dataProperty },
      parent: "ParentChildClass"
    }
};

const updatedStructure = {
  LoneClass: {
    properties: { commonProperty, newRootProperty, loneProperty },
  },
  NewParentClass: {
    properties: { commonProperty, newRootProperty }
  },
  LoneChildRelation: {
    properties: { commonProperty, loneProperty },
    parent: "NewParentClass", type: "Relation"
  },
  ParentChildClass: {
    properties: { commonProperty },
    parent: "NewParentClass"
  },
  GrandChildClass: {
    properties: { commonProperty },
    parent: "ParentChildClass"
  }
};


Object.defineProperty(exports, "__esModule", { value: true });
module.exports = { updatedStructure, defaultStructure };
