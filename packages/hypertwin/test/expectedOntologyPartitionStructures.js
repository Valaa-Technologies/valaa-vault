// @flow

const commonProperty = { type: "Property" };
const dataProperty = { type: "Entity" };
const rootProperty = { type: "Property" };
const loneProperty = { type: "Property" };
const newRootProperty = { type: "Property" };

const defaultStructure = {
    LoneClass: {
      properties: { commonProperty, dataProperty, rootProperty, loneProperty },
    },
    ParentClass: {
      properties: { commonProperty, dataProperty, rootProperty }
    },
    LoneChildClass: {
      properties: { commonProperty, dataProperty, loneProperty },
      parent: "ParentClass"
    },
    ParentChildClass: {
      properties: { commonProperty, dataProperty },
      parent: "ParentClass"
    },
    GrandChildClass: {
      properties: { commonProperty, dataProperty },
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
  LoneChildClass: {
    properties: { commonProperty, loneProperty },
    parent: "NewParentClass"
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
