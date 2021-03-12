const { disjoinVPlotOutline } = require("~/plot");
const patchWith = require("~/tools/patchWith").default;

const ObjectSchema = Symbol("Object-JSONSchema");
const CollectionSchema = Symbol("Array-JSONSchema");

// const EmailType = { type: "email" };
const NullType = Object.freeze({ type: "null" });
const EmailType = Object.freeze({ type: "string" });
const BooleanType = Object.freeze({ type: "boolean" });
const StringType = Object.freeze({ type: "string" });
const XWWWFormURLEncodedStringType = Object.freeze({ type: "string" });
const NumberType = Object.freeze({ type: "number" });
// const URIReferenceType = { type: "uri-reference" });
const URIReferenceType = Object.freeze({ type: "string" });

const UnixEpochSecondsType = Object.freeze({ type: "number" });
/*
const DateExtendedISO8601Type = Object.freeze({ type: "date" };
const TimeExtendedISO8601Type = { type: "time" };
const ZoneExtendedISO8601Type = { type: "string" };
const DateTimeZoneExtendedISO8601Type = { type: "date-time" };
*/
const DateExtendedISO8601Type = Object.freeze({ type: "string", format: "date" });
const TimeExtendedISO8601Type = Object.freeze({ type: "string" });
const ZoneExtendedISO8601Type = Object.freeze({ type: "string" });
const DateTimeZoneExtendedISO8601Type = Object.freeze({ type: "string", format: "date-time" });

const IdValOSType = Object.freeze({
  type: "string",
  pattern: "^[a-zA-Z0-9\\-_.~]+$",
  valospace: { reflection: ["@.$V.rawId@@"] },
});
// const ReferenceValOSType = { type: "uri" };
const ReferenceValOSType = Object.freeze({ type: "string" });

const $VType = Object.freeze({
  [ObjectSchema]: { valospace: { /* reflection: "" */ } },
  id: IdValOSType,
  // name: StringType, // internal ValOS name
});

const ResourceType = Object.freeze({
  $V: $VType,
});

module.exports = {
  ObjectSchema,
  CollectionSchema,
  EmailType,
  NullType,
  BooleanType,
  StringType,
  XWWWFormURLEncodedStringType,
  NumberType,
  URIReferenceType,
  UnixEpochSecondsType,
  DateExtendedISO8601Type,
  TimeExtendedISO8601Type,
  ZoneExtendedISO8601Type,
  DateTimeZoneExtendedISO8601Type,
  IdValOSType,
  ReferenceValOSType,
  $VType,
  ResourceType,
  extendType,
  namedResourceType,
  mappingToOneOf,
  mappingToManyOf,
  relationToOneOf,
  relationToManyOf,
  getSingularRelationTypeOf,
  enumerateMappingsOf,
  sharedSchemaOf,
  trySchemaNameOf,
  schemaRefOf,
  exportSchemaOf,
  _resolveFunction,
};

function extendType (...allTypes) {
  return patchWith({}, ["..."].concat(...allTypes), {
    spreaderKey: "...", patchSymbols: true, iterableToArray: "overwrite",
  });
}

function namedResourceType (schemaName, baseTypes, schema) {
  if (baseTypes === undefined) throw new Error("namedResourceType baseTypes missing");
  const nonObjectBaseIndex = Array.isArray(baseTypes)
          ? baseTypes.findIndex(v => (typeof v !== "object"))
      : (typeof baseTypes !== "object") ? 0
      : -1;
  if (nonObjectBaseIndex !== -1) {
    throw new Error(`namedResourceType baseType #${nonObjectBaseIndex} is not an object`);
  }
  const ret = extendType(
      { $V: $VType },
      baseTypes,
      { [ObjectSchema]: { schemaName } },
      schema);
  return ret;
}

function mappingToOneOf (mappingName, targetType, relationNameOrProjection,
    options = {}) {
  if (!options[ObjectSchema]) options[ObjectSchema] = {};
  options[ObjectSchema].valospace = {
    ...(options[ObjectSchema].valospace || {}),
    mappingName,
  };
  return relationToOneOf(targetType, relationNameOrProjection, options);
}

function mappingToManyOf (mappingName, targetType, relationNameOrProjection,
    options = {}) {
  if (!options[CollectionSchema]) options[CollectionSchema] = {};
  options[CollectionSchema].valospace = {
    ...(options[CollectionSchema].valospace || {}),
    mappingName,
  };
  return relationToManyOf(targetType, relationNameOrProjection, options);
}

function relationToOneOf (targetType, relationNameOrProjection, options = {}) {
  if (options[CollectionSchema] !== undefined) {
    throw new Error("Must not specify options[CollectionSchema] for a Relation-to-one type");
  }
  return _createRelationTypeTo(targetType, relationNameOrProjection, options);
}

function relationToManyOf (targetType, relationNameOrProjection, options = {}) {
  if (options[CollectionSchema] === undefined) options[CollectionSchema] = {};
  return _createRelationTypeTo(targetType, relationNameOrProjection, options);
}

function getSingularRelationTypeOf (anAnyRelationType, optionalSchema) {
  return extendType(
      _resolveFunction(anAnyRelationType),
      { [CollectionSchema]: null },
      optionalSchema);
}

function enumerateMappingsOf (aResourceType) {
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

function sharedSchemaOf (aType) {
  const schemaName = aType[ObjectSchema].schemaName;
  if (!schemaName) {
    throw new Error("Type[ObjectSchema].schemaName missing when trying to get a shared Type");
  }
  const schema = exportSchemaOf(aType);
  schema.$id = schemaName;
  return schema;
}

function trySchemaNameOf (aType) {
  return ((aType || {})[ObjectSchema] || {}).schemaName;
}

function schemaRefOf (aType) {
  return trySchemaNameOf(aType)
      ? `${aType[ObjectSchema].schemaName}#`
      : exportSchemaOf(aType);
}

function _createRelationTypeTo (targetType, relationNameOrProjection, {
    [CollectionSchema]: collectionSchema,
    [ObjectSchema]: objectSchema = {},
    ...relationProperties
} = {}) {
  if (!targetType) throw new Error("targetType missing");
  const reflection = disjoinVPlotOutline(
      (typeof relationNameOrProjection === "string")
          ? ["@-out", ["@$", relationNameOrProjection]]
          : relationNameOrProjection,
      "@@");
  const ret = {
    [CollectionSchema]: collectionSchema && { ...collectionSchema },
    [ObjectSchema]: { ...objectSchema },
    $V: { [ObjectSchema]: {},
      href: { ...URIReferenceType },
      rel: { ...StringType },
      target: {
        [ObjectSchema]: { valospace: { resourceType: targetType } },
        $V: { [ObjectSchema]: {}, id: IdValOSType },
      }
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

function exportSchemaOf (aType) {
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
    if (ret.valospace.reflection) {
      ret.valospace.reflection = disjoinVPlotOutline(ret.valospace.reflection, "@@");
    }
    if (ret.valospace.gate) {
      ret.valospace.gate = {
        ...ret.valospace.gate,
        projection: disjoinVPlotOutline(ret.valospace.gate.projection, "@@"),
      };
    }
    if (ret.valospace.resourceType) {
      ret.valospace.resourceType = trySchemaNameOf(ret.valospace.resourceType);
    }
  }
  return ret;
}

function _resolveFunction (maybeFunction) {
  return typeof maybeFunction === "function" ? maybeFunction() : maybeFunction;
}
