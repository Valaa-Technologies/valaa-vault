// @flow

import { GraphQLObjectType, GraphQLSchema, isInputType, isOutputType, isLeafType, isCompositeType,
  isAbstractType,
} from "graphql/type";

import commonFieldInfos from "~/raem/tools/graphql/commonFieldInfos";

import { invariantify, invariantifyString, invariantifyObject } from "~/tools";

function contentAPIField (targetFieldName, type, description,
    additionalDescriptors = {}) {
  invariantify(type, "contentAPIField.type");
  const common = commonFieldInfos(targetFieldName, type, description);
  const ret = {
    [targetFieldName]: {
      ...common,
      isContentAPIField: true,
      ...additionalDescriptors,
    },
  };
  return ret;
}

/**
 *  Creates the public ValOS API for a module.
 *
 * @export
 * @param {any} name            name of the exported module
 * @param {type | [name, type]} exposes       list of component access points to expose
 *                              either as an entry, in which case Query access point name is the
 *                              name of the type itself, or an explicit name-type access point.
 * @param {any} mutations       list of mutation access points to expose
 * @param {any} validators      lookup of validators for mutation types
 * @param {any} reducers        list of lookups of reducers
 * @returns { [APIName]: { compositeType, schema, validators, reducers } }, where
 *              compositeType   a graphql object type with name APIName which contains
 *                              references to all exposed types and can thus be used as a dependency
 *              schema          GraphQLSchema for direct endpoint access through this schema
 *              validators      incoming mutation validators (fallthrough from the param validators)
 *              reducers        incoming mutation reducers (fallthrough from the param reducers)
 */
export default function createContentAPI ({ name, inherits = [], exposes, mutations, validators,
  reducers, absentType, destroyedType,
}) {
  const exposedAccessPoints = exposes.reduce((accessPoints, exposedTypeEntry) => {
    const typeName = !Array.isArray(exposedTypeEntry) ? exposedTypeEntry.name : exposedTypeEntry[0];
    const type = !Array.isArray(exposedTypeEntry) ? exposedTypeEntry : exposedTypeEntry[1];
    return Object.assign(accessPoints,
        contentAPIField(typeName, type, `${name} access point for '${typeName}'`, {
          resolve (root) { root.store.getState().getIn([type.name, root.rootId]); }
        }));
  }, {});
  const subAPIs = {};
  const actualMutations = {};
  const actualValidators = {};
  const actualReducers = new Set(reducers || []);
  function tryToAddSubAPI (subAPI) {
    if (subAPIs[subAPI.name]) {
      // FIXME(iridian): Implement version mismatch resolution. Requires versioning first, obv.
      return;
    }
    subAPIs[subAPI.name] = subAPI;
    exposedAccessPoints[subAPI.name] = subAPI.subAPIDependencyField;
    // FIXME: recurse validators: now extending content API overrides
    // all validators of the extended API's if they express matching
    // version numbers
    _assign(actualValidators, subAPI.validators || {});
    _assign(actualMutations, subAPI.mutations || {});
    subAPI.reducers.forEach(reducer => reducer && actualReducers.add(reducer));
  }

  let inheritedAbsentType, inheritedDestroyedType;

  for (const inheritedContentAPI of (inherits || [])) {
    Object.values(inheritedContentAPI.subAPIs).forEach(tryToAddSubAPI);
    tryToAddSubAPI(inheritedContentAPI);

    const subAbsentType = inheritedContentAPI.schema.absentType;
    if (!absentType && subAbsentType) {
      if (inheritedAbsentType && (inheritedAbsentType !== subAbsentType)) {
        throw new Error(`Mismatching ${name} inherited absentType ${
            inheritedAbsentType.name} !== ${subAbsentType
                } (from ${inheritedContentAPI.name}) and no explicit absentType was provided`);
      }
      inheritedAbsentType = subAbsentType;
    }
    const subDestroyedType = inheritedContentAPI.schema.destroyedType;
    if (!destroyedType && subDestroyedType) {
      if (inheritedDestroyedType && (inheritedDestroyedType !== subDestroyedType)) {
        throw new Error(`Mismatching ${name} inherited destroyedType ${
          inheritedDestroyedType.name} !== ${subDestroyedType
                } (from ${inheritedContentAPI.name}) and no explicit destroyedType was provided`);
      }
      inheritedDestroyedType = subDestroyedType;
    }
  }
  Object.freeze(subAPIs);
  Object.freeze(exposedAccessPoints);

  _assign(actualValidators, validators || {});
  _assign(actualMutations, mutations || {});

  const schema = _validateSchema(new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: () => exposedAccessPoints,
    }),
    mutation: new GraphQLObjectType({
      name: "Mutation",
      fields: () => actualMutations,
    }),
  }));
  schema.absentType = absentType || inheritedAbsentType;
  if (!schema.absentType) throw new Error(`ContentAPI ${name} is missing .absentType`);
  schema.destroyedType = destroyedType || inheritedDestroyedType;
  if (!schema.destroyedType) throw new Error(`ContentAPI ${name} is missing .destroyedType`);

  schema.tryAffiliatedTypeOfField = (couplingName) => {
    const ret = schema._couplingToType[couplingName];
    if (!Array.isArray(ret)) return ret;
    throw new Error(`Can't determine affiliated type for '${couplingName
        }' with multiple candidates: ${ret.join(",")}`);
  };

  return Object.freeze(Object.assign(Object.create(complexBase), {
    name,
    schema,
    mutations: Object.freeze(actualMutations),
    validators: Object.freeze(actualValidators),
    reducers: Object.freeze([...actualReducers]),
    ...contentAPIField(
        "subAPIDependencyField",
        new GraphQLObjectType({ name, fields: () => exposedAccessPoints }),
        `'${name}' Sub-API dependency injector`, {
          resolve () {
            throw new Error(`Sub-API '${name}'.subAPIDependencyField is inaccessible by design`);
          }
        }
    ),
    absentType,
    destroyedType,
    subAPIs,
  }));
}

const complexBase = {};

function _assign (target: Object, ...sources: Object) {
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      target[key] = value;
    }
  }
}

function _validateSchema (schema: GraphQLSchema) {
  schema._couplingToType = {};
  for (const [typeName, type] of Object.entries(schema.getTypeMap())) {
    const shouldSkip = (typeName.slice(0, 2) === "__")
        || !type.getFields
        || !(isInputType(type) || isOutputType(type) || isLeafType(type) || isCompositeType(type)
            || isAbstractType(type));
    if (shouldSkip) continue;
    for (const [fieldName, fieldIntro] of Object.entries(type.getFields())) {
      const actualFieldIntro = (typeof fieldIntro === "function")
          ? fieldIntro(type)
          : fieldIntro;
      invariantifyString(actualFieldIntro.fieldName, `${typeName}.${fieldName}.fieldName`);
      invariantifyObject(actualFieldIntro.namedType, `${typeName}.${fieldName}.namedType`);
      if (actualFieldIntro.affiliatedType === typeName) {
        _registerDefaultCouplingType(schema, fieldName, type);
      }
    }
  }
  return schema;
}

function _registerDefaultCouplingType (schema: GraphQLSchema, fieldName: string, type: Object) {
  let conflicted = schema._couplingToType[fieldName];
  if (!conflicted) {
    schema._couplingToType[fieldName] = type;
    return;
  }
  if (!Array.isArray(conflicted)) {
    conflicted = schema._couplingToType[fieldName] = [conflicted.name];
  }
  conflicted.push(type.name);
}
