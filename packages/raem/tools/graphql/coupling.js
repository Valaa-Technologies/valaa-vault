import { addedTo, destroyed, fieldsSet, removedFrom } from "~/raem/events";
import invariantify from "~/tools/invariantify";

// There are two categories for boths side of the coupling separately: plurality and specifity.
//
// Plurality is the standard coupling One/Many distinction: One-to-Many would mean one near object
// is associated with multiple far objects: thus the near object has a list field of far objects,
// where far objects have a singular field for the near object.
//
// Specifity governs whether the near side must be a specific type/field combination or whether
// any compatible type/field can participate. Prime example of a non-specific
// coupling is the ownership coupling: all Resource's have an owner and an associated field in it.
//
// "One": 'One' entity with a specific coupledField can participate as near side.
//        Far side has singular reference to the near side object and the uniquely specified near
//        field is the only possible part of the coupling.
//
// "Any": 'Any' entity with any compatible field can participate as near side.
//        Far side still has singular reference, but any compatible near field can be used; far side
//        has to store this information.
//
// "Many": 'Many' entities with a specific coupledField can participate to the far side.
//        Far side has list of references to near side objects; a uniquely specified near field is
//        the only possible part of the coupling for each near object.
//
// "All": 'All' can participate to the far side.
//        Far side has list of references to near side objects and any compatible near field can be
//        used; far side has to store this field name for each near reference entry individually.

export function toNone () { return "none"; }

export function toOne ({ coupledField, defaultCoupledField, alias, isOwning, whenUnmatched,
    preventsDestroy, ...rest } = {}) {
  invariantify(!Object.keys(rest).length, `toOne: Unrecognized coupling options: ${
      Object.keys(rest).join(", ")}`);
  invariantify(!(coupledField && defaultCoupledField),
      "Can only specify either coupledField or defaultCoupledField");
  return coupledField ? {
    coupledField, alias, isOwning, whenUnmatched, preventsDestroy,
    createCoupleToRemoteAction: (id, typeName, coupledFieldName, localId) =>
        fieldsSet({ id, typeName, meta: { updateCouplings: false },
          sets: { [coupledFieldName]: localId },
        }),
    createUncoupleFromRemoteAction: (id, typeName, coupledFieldName) =>
        fieldsSet({ id, typeName, meta: { updateCouplings: false },
          sets: { [coupledFieldName]: null },
        }),
  } : {
    defaultCoupledField, alias, isOwning, whenUnmatched, preventsDestroy,
    createCoupleToRemoteAction: (id, typeName, coupledFieldName, localId, localFieldName) =>
        fieldsSet({ id, typeName, meta: { updateCouplings: false },
          sets: { [coupledFieldName]: localId.coupleWith(localFieldName) },
        }),
    createUncoupleFromRemoteAction: (id, typeName, coupledFieldName) =>
        fieldsSet({ id, typeName, meta: { updateCouplings: false },
          sets: { [coupledFieldName]: null },
        }),
  };
}

export function toMany ({ coupledField, defaultCoupledField, alias, isOwning, whenUnmatched,
    preventsDestroy, ...rest } = {}) {
  invariantify(!Object.keys(rest).length, `toMany: Unrecognized coupling options: ${
      Object.keys(rest).join(", ")}`);
  invariantify(!(coupledField && defaultCoupledField),
      "Can't specify both coupledField and defaultCoupledField");
  return coupledField ? {
    coupledField, alias, isOwning, whenUnmatched, preventsDestroy,
    createCoupleToRemoteAction: (id, typeName, coupledFieldName, localId) =>
        addedTo({ id, typeName, meta: { updateCouplings: false },
          adds: { [coupledFieldName]: [localId] },
        }),
    createUncoupleFromRemoteAction: (id, typeName, coupledFieldName, localId) =>
        removedFrom({ id, typeName, meta: { updateCouplings: false },
          removes: { [coupledFieldName]: [localId] },
        }),
  } : {
    defaultCoupledField, alias, isOwning, whenUnmatched, preventsDestroy,
    createCoupleToRemoteAction: (id, typeName, coupledFieldName, localId, localFieldName) =>
        addedTo({ id, typeName, meta: { updateCouplings: false },
          adds: { [coupledFieldName]: [localId.coupleWith(localFieldName)] },
        }),
    createUncoupleFromRemoteAction: (id, typeName, coupledFieldName, localId, localFieldName) =>
        removedFrom({ id, typeName, meta: { updateCouplings: false },
          removes: { [coupledFieldName]: [localId.coupleWith(localFieldName)] },
        }),
  };
}

export function toOneOwnling (fields = {}) {
  return toOne({ coupledField: "owner", isOwning: true, ...fields });
}

export function toManyOwnlings (fields = {}) {
  return toMany({ coupledField: "owner", isOwning: true, ...fields });
}

export function toOwner ({ coupledField, defaultCoupledField, ...rest }) {
  invariantify(!Object.keys(rest).length, `toOwner: Unrecognized coupling options: ${
      Object.keys(rest).join(", ")}`);
  return {
    coupledField, defaultCoupledField, isOwned: true,
    createCoupleToRemoteAction: (id, typeName, coupledFieldName, localId, localFieldName) =>
        fieldsSet({ id, typeName, meta: { updateCouplings: false },
          sets: { [coupledFieldName]: localId.coupleWith(localFieldName) },
        }),
    createUncoupleFromRemoteAction: (id) =>
        destroyed({ id, meta: { updateCouplings: false } }),
  };
}

export function unspecifiedSingular (fields = {}) {
  return toOne({ coupledField: "unnamedCouplings", ...fields });
}

export function unspecifiedPlural (fields = {}) {
  return toMany({ coupledField: "unnamedCouplings", ...fields });
}
