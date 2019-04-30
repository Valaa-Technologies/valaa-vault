// @flow

export const ObjectJSONSchema = Symbol("Object-JSONSchema");
export const ArrayJSONSchema = Symbol("Array-JSONSchema");

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
  valos: { predicate: "valos:field:rawId" },
};
// export const ReferenceValOSType = { type: "uri" };
export const ReferenceValOSType = { type: "string" };

export const $VType = {
  [ObjectJSONSchema]: { valos: { predicate: "" } },
  id: IdValOSType,
  // name: StringType, // internal ValOS name
};

export function createMappingToOne (mappingName, TargetType, relationNameOrPredicate,
    options = {}) {
  if (!options[ObjectJSONSchema]) options[ObjectJSONSchema] = {};
  options[ObjectJSONSchema].valos = { ...(options[ObjectJSONSchema].valos || {}), mappingName };
  return createRelationTypeToOne(TargetType, relationNameOrPredicate, options);
}

export function createMappingToMany (mappingName, TargetType, relationNameOrPredicate,
    options = {}) {
  if (!options[ArrayJSONSchema]) options[ArrayJSONSchema] = {};
  options[ArrayJSONSchema].valos = { ...(options[ArrayJSONSchema].valos || {}), mappingName };
  return createRelationTypeToMany(TargetType, relationNameOrPredicate, options);
}

export function createRelationTypeToOne (TargetType, relationNameOrPredicate, options = {}) {
  if (options[ArrayJSONSchema] !== undefined) {
    throw new Error("Must not specify options[ArrayJSONSchema] for a Relation-to-one type");
  }
  return _createRelationTypeTo(TargetType, relationNameOrPredicate, options);
}

export function createRelationTypeToMany (TargetType, relationNameOrPredicate, options = {}) {
  if (options[ArrayJSONSchema] === undefined) options[ArrayJSONSchema] = {};
  return _createRelationTypeTo(TargetType, relationNameOrPredicate, options);
}

export function getBaseRelationTypeOf (RelationTypeManyOrOne) {
  const actualRelationType = (typeof RelationTypeManyOrOne === "function")
      ? RelationTypeManyOrOne()
      : RelationTypeManyOrOne;
  return {
    ...actualRelationType,
    [ObjectJSONSchema]: actualRelationType[ObjectJSONSchema],
    [ArrayJSONSchema]: undefined,
  };
}

export function enumerateMappingsOf (ResourceType) {
  return [].concat(...Object.values(ResourceType).map(property => {
    const actualProperty = (typeof property !== "function") ? property : property();
    const outermostSchema = (actualProperty != null)
        && (actualProperty[ArrayJSONSchema] || actualProperty[ObjectJSONSchema]);
    if (!outermostSchema) return [];
    const mappingName = (outermostSchema.valos || {}).mappingName;
    if (mappingName) return [[mappingName, actualProperty]];
    return enumerateMappingsOf(actualProperty);
  }));
}

export function sharedSchema (name, Type) {
  const schemaName = Type[ObjectJSONSchema].schemaName;
  if (!schemaName) {
    throw new Error("Type[ObjectJSONSchema].schemaName missing when trying to add shared Type");
  }
  const schema = _convertTypeToSchema(Type);
  schema.$id = schemaName;
  return schema;
}

export function trySharedSchemaName (Type) {
  return ((Type || {})[ObjectJSONSchema] || {}).schemaName
      && `${Type[ObjectJSONSchema].schemaName}#`;
}

export function schemaReference (Type, schema) {
  return trySharedSchemaName(Type) || schema || _convertTypeToSchema(Type);
}

function _createRelationTypeTo (TargetType, relationNameOrPredicate, {
    [ArrayJSONSchema]: arraySchema,
    [ObjectJSONSchema]: objectSchema = {},
    ...relationProperties
} = {}) {
  const ret = {
    [ArrayJSONSchema]: arraySchema && { ...arraySchema },
    [ObjectJSONSchema]: { ...objectSchema },
    $V: {
      [ObjectJSONSchema]: {
        valos: { TargetType, route: TargetType[ObjectJSONSchema].valos.route },
      },
      href: {
        ...URIReferenceType,
        // valos: { predicate: "" }, // not yet
      },
      rel: {
        ...StringType,
        // valos: { predicate: "" }, // not yet
      },
    },
    ...relationProperties,
  };
  const outermost = ret[ArrayJSONSchema] || ret[ObjectJSONSchema];
  outermost.valos = {
    ...(outermost.valos || {}),
    predicate: (relationNameOrPredicate.slice(0, 6) !== "valos:")
        ? `valos:Relation:${relationNameOrPredicate}`
        : relationNameOrPredicate,
  };
  return ret;
}

function _convertTypeToSchema (Type) {
  if (typeof Type === "function") return _convertTypeToSchema(Type());
  if (Type == null || (typeof Type !== "object")) return Type;
  const ret = {};
  let current = ret;
  if (Type[ArrayJSONSchema]) {
    Object.assign(current, Type[ArrayJSONSchema]);
    delete current.TargetType;
    current.type = "array";
    current.items = {};
    current = current.items;
  }
  if (Type[ObjectJSONSchema]) {
    Object.assign(current, Type[ObjectJSONSchema]);
    current.type = "object";
    current.properties = {};
    if (current.$V) {
      current.$V = {
        ...current.$V,
        TargetType: trySharedSchemaName(current.$V.TargetType) || null,
      };
    }
    current = current.properties;
  }
  for (const [key, value] of Object.entries(Type)) current[key] = _convertTypeToSchema(value);
  return ret;
}
