// @flow

import { mintVerb, validateVerbs } from "~/raem";
import patchWith from "~/tools/patchWith";

export const ObjectSchema = Symbol("Object-JSONSchema");
export const CollectionSchema = Symbol("Array-JSONSchema");

// export const EmailType = { type: "email" };
export const EmailType = { type: "string" };
export const BooleanType = { type: "boolean" };
export const StringType = { type: "string" };
export const XWWWFormURLEncodedStringType = { type: "string" };
export const NumberType = { type: "number" };
// export const URIReferenceType = { type: "uri-reference" };
export const URIReferenceType = { type: "string" };

export const UnixEpochSecondsType = { type: "number" };
/*
export const DateExtendedISO8601Type = { type: "date" };
export const TimeExtendedISO8601Type = { type: "time" };
export const ZoneExtendedISO8601Type = { type: "string" };
export const DateTimeZoneExtendedISO8601Type = { type: "date-time" };
*/
export const DateExtendedISO8601Type = { type: "string", format: "date" };
export const TimeExtendedISO8601Type = { type: "string" };
export const ZoneExtendedISO8601Type = { type: "string" };
export const DateTimeZoneExtendedISO8601Type = { type: "string", format: "date-time" };

export const IdValOSType = {
  type: "string",
  pattern: "^[a-zA-Z0-9\\-_.~]+$",
  valospace: { toValue: [".$V:rawId"] },
};
// export const ReferenceValOSType = { type: "uri" };
export const ReferenceValOSType = { type: "string" };

export const $VType = {
  [ObjectSchema]: { valospace: { /* toValue: "" */ } },
  id: IdValOSType,
  // name: StringType, // internal ValOS name
};

export const ResourceType = {
  $V: $VType,
};

export function schemaType (schemaName, baseTypes, schema) {
  return patchWith({},
      [].concat({
        [ObjectSchema]: { valospace: { schemaName } },
        $V: $VType,
      },
      baseTypes || [],
      schema));
}

export function extendType (baseTypes, schema) {
  return patchWith({}, [].concat(baseTypes || [], schema));
}

export function createMappingToOne (mappingName, ofTargetType, relationNameOrToValue,
    options = {}) {
  if (!options[ObjectSchema]) options[ObjectSchema] = {};
  options[ObjectSchema].valospace = {
    ...(options[ObjectSchema].valospace || {}),
    mappingName,
  };
  return createRelationTypeToOne(ofTargetType, relationNameOrToValue, options);
}

export function createMappingToMany (mappingName, ofTargetType, relationNameOrToValue,
    options = {}) {
  if (!options[CollectionSchema]) options[CollectionSchema] = {};
  options[CollectionSchema].valospace = {
    ...(options[CollectionSchema].valospace || {}),
    mappingName,
  };
  return createRelationTypeToMany(ofTargetType, relationNameOrToValue, options);
}

export function createRelationTypeToOne (ofTargetType, relationNameOrToValue, options = {}) {
  if (options[CollectionSchema] !== undefined) {
    throw new Error("Must not specify options[CollectionSchema] for a Relation-to-one type");
  }
  return _createRelationTypeTo(ofTargetType, relationNameOrToValue, options);
}

export function createRelationTypeToMany (ofTargetType, relationNameOrToValue, options = {}) {
  if (options[CollectionSchema] === undefined) options[CollectionSchema] = {};
  return _createRelationTypeTo(ofTargetType, relationNameOrToValue, options);
}

export function getBaseRelationTypeOf (anAnyRelationType, schemaPatch) {
  const actualRelationType = (typeof anAnyRelationType === "function")
      ? anAnyRelationType()
      : anAnyRelationType;
  return patchWith({
    ...actualRelationType,
    [ObjectSchema]: actualRelationType[ObjectSchema],
    [CollectionSchema]: undefined,
  }, schemaPatch || []);
}

export function enumerateMappingsOf (aResourceType) {
  return [].concat(...Object.values(aResourceType).map(property => {
    const actualProperty = (typeof property !== "function") ? property : property();
    const outermostSchema = (actualProperty != null)
        && (actualProperty[CollectionSchema] || actualProperty[ObjectSchema]);
    if (!outermostSchema) return [];
    const mappingName = (outermostSchema.valospace || {}).mappingName;
    if (mappingName) return [[mappingName, actualProperty]];
    return enumerateMappingsOf(actualProperty);
  }));
}

export function sharedSchemaOf (aType) {
  const schemaName = aType[ObjectSchema].schemaName;
  if (!schemaName) {
    throw new Error("Type[ObjectSchema].schemaName missing when trying to get a shared Type");
  }
  const schema = _convertSchemaOf(aType);
  schema.$id = schemaName;
  return schema;
}

export function trySchemaNameOf (aType) {
  return ((aType || {})[ObjectSchema] || {}).schemaName
      && `${aType[ObjectSchema].schemaName}#`;
}

export function schemaRefOf (aType) {
  return trySchemaNameOf(aType) || _convertSchemaOf(aType);
}

function _createRelationTypeTo (aTargetType, relationNameOrToValue, {
    [CollectionSchema]: collectionSchema,
    [ObjectSchema]: objectSchema = {},
    ...relationProperties
} = {}) {
  const ret = {
    [CollectionSchema]: collectionSchema && { ...collectionSchema },
    [ObjectSchema]: { ...objectSchema },
    $V: {
      [ObjectSchema]: {
        valospace: {
          TargetType: aTargetType,
          route: aTargetType[ObjectSchema].valospace.route,
        },
      },
      href: {
        ...URIReferenceType,
        // valospace: { toValue: "" }, // not yet
      },
      rel: {
        ...StringType,
        // valospace: { toValue: "" }, // not yet
      },
    },
    ...relationProperties,
  };
  const outermost = ret[CollectionSchema] || ret[ObjectSchema];
  outermost.valospace = {
    ...(outermost.valospace || {}),
    predicate: (relationNameOrPredicate.slice(0, 6) !== "valos:")
        ? `valos:Relation:${relationNameOrPredicate}`
        : relationNameOrPredicate,
  };
  return ret;
}

function _convertSchemaOf (aType) {
  if (typeof aType === "function") return _convertSchemaOf(aType());
  if ((aType == null) || (typeof aType !== "object")) return aType;
  const ret = {};
  let current = ret;
  if (aType[CollectionSchema]) {
    Object.assign(current, aType[CollectionSchema]);
    delete current.TargetType;
    current.type = "array";
    current.items = {};
    current = current.items;
  }
  if (aType[ObjectSchema]) {
    Object.assign(current, aType[ObjectSchema]);
    current.type = "object";
    current.properties = {};
    if (current.$V) { // Also a collection.
      current.$V = {
        ...current.$V,
        TargetType: trySchemaNameOf(current.$V.TargetType) || null,
      };
    }
    current = current.properties;
  }
  for (const [key, value] of Object.entries(aType)) current[key] = _convertSchemaOf(value);
  return ret;
}
