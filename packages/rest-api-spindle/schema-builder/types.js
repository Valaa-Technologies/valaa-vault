// @flow

import { mintVerb, expandVPath } from "~/raem";
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
  valospace: { reflection: [".$V:rawId"] },
};
// export const ReferenceValOSType = { type: "uri" };
export const ReferenceValOSType = { type: "string" };

export const $VType = {
  [ObjectSchema]: { valospace: { /* reflection: "" */ } },
  id: IdValOSType,
  // name: StringType, // internal ValOS name
};

export const ResourceType = {
  $V: $VType,
};

export function extendType (baseTypes, schema) {
  return patchWith({}, [].concat(baseTypes || [], schema || []),
      { patchSymbols: true, concatArrays: false });
}

export function namedResourceType (schemaName, baseTypes, schema) {
  return extendType(
      [].concat(baseTypes || [], { [ObjectSchema]: { schemaName }, $V: $VType }),
      schema);
}

export function mappingToOneOf (mappingName, targetType, relationNameOrProjection,
    options = {}) {
  if (!options[ObjectSchema]) options[ObjectSchema] = {};
  options[ObjectSchema].valospace = {
    ...(options[ObjectSchema].valospace || {}),
    mappingName,
  };
  return relationToOneOf(targetType, relationNameOrProjection, options);
}

export function mappingToManyOf (mappingName, targetType, relationNameOrProjection,
    options = {}) {
  if (!options[CollectionSchema]) options[CollectionSchema] = {};
  options[CollectionSchema].valospace = {
    ...(options[CollectionSchema].valospace || {}),
    mappingName,
  };
  return relationToManyOf(targetType, relationNameOrProjection, options);
}

export function relationToOneOf (targetType, relationNameOrProjection, options = {}) {
  if (options[CollectionSchema] !== undefined) {
    throw new Error("Must not specify options[CollectionSchema] for a Relation-to-one type");
  }
  return _createRelationTypeTo(targetType, relationNameOrProjection, options);
}

export function relationToManyOf (targetType, relationNameOrProjection, options = {}) {
  if (options[CollectionSchema] === undefined) options[CollectionSchema] = {};
  return _createRelationTypeTo(targetType, relationNameOrProjection, options);
}

export function getBaseRelationTypeOf (anAnyRelationType, optionalSchema) {
  return extendType(
      [_resolveFunction(anAnyRelationType), { [CollectionSchema]: null }],
      optionalSchema);
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
  const schema = exportSchemaOf(aType);
  schema.$id = schemaName;
  return schema;
}

export function trySchemaNameOf (aType) {
  return ((aType || {})[ObjectSchema] || {}).schemaName;
}

export function schemaRefOf (aType) {
  return trySchemaNameOf(aType)
      ? `${aType[ObjectSchema].schemaName}#`
      : exportSchemaOf(aType);
}

function _createRelationTypeTo (targetType, relationNameOrProjection, {
    [CollectionSchema]: collectionSchema,
    [ObjectSchema]: objectSchema = {},
    ...relationProperties
} = {}) {
  const reflection = (typeof relationNameOrProjection === "string")
      ? mintVerb("*out", ["$", "", relationNameOrProjection])
      : expandVPath(relationNameOrProjection);
  const ret = {
    [CollectionSchema]: collectionSchema && { ...collectionSchema },
    [ObjectSchema]: { ...objectSchema },
    $V: {
      [ObjectSchema]: {
        valospace: { targetType },
      },
      href: {
        ...URIReferenceType,
        // valospace: { reflection: "" }, // not yet
      },
      rel: {
        ...StringType,
        // valospace: { reflection: "" }, // not yet
      },
    },
    ...relationProperties,
  };
  const outermost = ret[CollectionSchema] || ret[ObjectSchema];
  outermost.valospace = {
    ...(outermost.valospace || {}),
    reflection,
  };
  return ret;
}

export function exportSchemaOf (aType) {
  if (typeof aType === "function") return exportSchemaOf(aType());
  if ((aType == null) || (typeof aType !== "object") || (Array.isArray(aType))) return aType;
  const ret = {};
  let current = ret;
  if (aType[CollectionSchema]) {
    Object.assign(current, aType[CollectionSchema]);
    delete current.targetType;
    current.type = "array";
    current.items = {};
    current = current.items;
  }
  if (aType[ObjectSchema]) {
    Object.assign(current, aType[ObjectSchema]);
    current.type = "object";
    current = current.properties = {};
  }
  for (const [key, value] of Object.entries(aType)) {
    current[key] = schemaRefOf(value);
  }
  if (ret.valospace) {
    ret.valospace = { ...ret.valospace };
    if (ret.valospace.targetType) {
      ret.valospace.targetType = schemaRefOf(ret.valospace.targetType);
    }
    if (ret.valospace.reflection) {
      ret.valospace.reflection = expandVPath(ret.valospace.reflection);
    }
    if (ret.valospace.gate) {
      ret.valospace.gate = {
        ...ret.valospace.gate,
        projection: expandVPath(ret.valospace.gate.projection),
      };
    }
  }
  return ret;
}

export function _resolveFunction (maybeFunction) {
  return typeof maybeFunction === "function" ? maybeFunction() : maybeFunction;
}
