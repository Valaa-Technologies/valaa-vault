// @flow

/*
  #####   #   #  #####   ######   ####
    #      # #   #    #  #       #
    #       #    #    #  #####    ####
    #       #    #####   #            #
    #       #    #       #       #    #
    #       #    #       ######   ####
*/

export const ObjectJSONSchema = Symbol("Object-JSONSchema");
export const ArrayJSONSchema = Symbol("Array-JSONSchema");

// export const EmailType = { type: "email" };
export const EmailType = { type: "string" };
export const BooleanType = { type: "boolean" };
export const StringType = { type: "string" };
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


export const IdValOSType = { type: "string", pattern: "^[a-zA-Z0-9\\-_.~]+$" };
// export const ReferenceValOSType = { type: "uri" };
export const ReferenceValOSType = { type: "string" };

export const $VType = {
  [ObjectJSONSchema]: {},
  id: IdValOSType,
  name: StringType, // internal ValOS name
};

export function createRelationTypeToOne (TargetType, relationNameOrPredicate, options) {
  if (options[ArrayJSONSchema] !== undefined) {
    throw new Error("Must not specify options[ArrayJSONSchema] for a Relation-to-one type");
  }
  return _createRelationTypeTo(TargetType, relationNameOrPredicate, options);
}

export function createRelationTypeToMany (TargetType, relationNameOrPredicate, options) {
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
    const objectSchema = (actualProperty != null) && actualProperty[ObjectJSONSchema];
    if (!objectSchema) return [];
    const mappingName = (objectSchema.valos || {}).mappingName;
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


/*
 #####    ####   #    #   #####  ######   ####
 #    #  #    #  #    #     #    #       #
 #    #  #    #  #    #     #    #####    ####
 #####   #    #  #    #     #    #            #
 #   #   #    #  #    #     #    #       #    #
 #    #   ####    ####      #    ######   ####
*/

export function listingGETRoute (valos, Type,
    { url, querystring }) {
  return {
    method: "GET",
    category: "listing",
    url,
    schema: {
      description: `List all listable ${trySharedSchemaName(Type) || "<Type>"} resources`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(Type),
        ..._resourceSequenceQueryStringSchema(Type),
        ...(querystring || {}),
      },
      response: {
        200: {
          type: "array",
          items: trySharedSchemaName(Type) || _convertTypeToSchema(Type),
        },
      },
    },
    config: { valos },
  };
}

export function resourcePOSTRoute (valos, Type,
    { url, querystring }) {
  const typeSchema = trySharedSchemaName(Type) || _convertTypeToSchema(Type);
  return {
    method: "POST",
    category: "resource",
    url,
    schema: {
      description:
          `Create a new ${trySharedSchemaName(Type) || "<Type>"} resource`,
      querystring: querystring ? { ...querystring } : undefined,
      body: typeSchema,
      response: {
        200: typeSchema,
        403: { type: "string" },
      },
    },
    config: { valos },
  };
}

export function resourceGETRoute (valos, Type,
    { url, querystring, idRouteParam }) {
  return {
    method: "GET",
    category: "resource",
    url,
    schema: {
      description:
          `Get the contents of a ${trySharedSchemaName(Type) || "<Type>"} route resource`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(Type),
        ...(querystring || {}),
      },
      response: {
        200: trySharedSchemaName(Type) || _convertTypeToSchema(Type),
        404: { type: "string" },
      },
    },
    config: { valos, idRouteParam },
  };
}

export function resourcePATCHRoute (valos, Type,
    { url, querystring, idRouteParam }) {
  return {
    method: "PATCH",
    category: "resource",
    url,
    schema: {
      description: `Update parts of a ${trySharedSchemaName(Type) || "<Type>"} route resource`,
      querystring: querystring ? { ...querystring } : undefined,
      body: trySharedSchemaName(Type) || _convertTypeToSchema(Type),
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    },
    config: { valos, idRouteParam },
  };
}

export function resourceDELETERoute (valos, Type,
    { url, querystring, idRouteParam }) {
  return {
    method: "DELETE",
    category: "resource",
    url,
    schema: {
      description: `Destroy a ${trySharedSchemaName(Type) || "<Type>"} route resource`,
      querystring: querystring ? { ...querystring } : undefined,
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    },
    config: { valos, idRouteParam },
  };
}

export function relationsGETRoute (valos, SourceType, RelationType,
    { url, querystring, sourceIdRouteParam }) {
  const { mappingName: relationName, TargetType } = _getMappingParams(RelationType);
  const BaseRelationType = getBaseRelationTypeOf(RelationType);
  return {
    method: "GET",
    category: "relations",
    url,
    schema: {
      description: `List all '${relationName}' relations from the source ${
        trySharedSchemaName(SourceType) || "<SourceType>"} route resource to all target ${
        trySharedSchemaName(TargetType) || "<TargetType>"} resources`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(RelationType),
        ..._resourceSequenceQueryStringSchema(RelationType),
        ...(querystring || {}),
      },
      response: {
        200: {
          type: "array",
          items: trySharedSchemaName(BaseRelationType) || _convertTypeToSchema(BaseRelationType),
        },
      },
    },
    config: { valos, relationName, sourceIdRouteParam },
  };
}

/*
Note: while a mapping and its corresponding relation are the same
the identity of a mapping is the triplet (sourceId, relationName, targetId)
whereas the identify of a Relation is an explicit id. The identity of
mapping is thus implicitly inferred from the route.
*/

export function mappingPOSTRoute (valos, SourceType, RelationType,
    { url, querystring, sourceIdRouteParam }) {
  const { mappingName, TargetType } = _getMappingParams(RelationType);
  const body = getBaseRelationTypeOf(RelationType);
  body.$V = {
    target: trySharedSchemaName(TargetType) || _convertTypeToSchema(TargetType),
  };
  const responseBody = getBaseRelationTypeOf(RelationType);
  responseBody.$V.target = body.$V.target;
  return {
    method: "POST",
    category: "mapping",
    url,
    schema: {
      description: `Create a new ${trySharedSchemaName(SourceType) || "<SourceType>"
        } resource *using **body.$V.target** as content* and then a new '${mappingName
        }' mapping to it from the source ${trySharedSchemaName(SourceType) || "<SourceType>"
        } route resource. The remaining fields of the body are set as the mapping content.\n${
        ""} Similarily the response will contain the newly created target resource content${
        ""} in *response.$V.target* with the rest of the response containing the mapping.`,
      querystring: querystring ? { ...querystring } : undefined,
      body,
      response: {
        200: responseBody,
        403: { type: "string" },
      },
    },
    config: { valos, mappingName, sourceIdRouteParam },
  };
}

export function mappingGETRoute (valos, SourceType, RelationType,
    { url, querystring, sourceIdRouteParam, targetIdRouteParam }) {
  const { mappingName, TargetType } = _getMappingParams(RelationType);
  const BaseRelationType = getBaseRelationTypeOf(RelationType);
  return {
    method: "GET",
    category: "mapping",
    url,
    schema: {
      description: `Get the contents of a '${mappingName}' relation from the source ${
        trySharedSchemaName(SourceType) || "<SourceType>"} route resource to the target ${
        trySharedSchemaName(TargetType) || "<TargetType>"} route resource`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(BaseRelationType),
        ...(querystring || {}),
      },
      response: {
        200: trySharedSchemaName(BaseRelationType) || _convertTypeToSchema(BaseRelationType),
        404: { type: "string" },
      },
    },
    config: { valos, mappingName, sourceIdRouteParam, targetIdRouteParam },
  };
}

export function mappingPATCHRoute (valos, SourceType, RelationType,
    { url, querystring, sourceIdRouteParam, targetIdRouteParam }) {
  const { mappingName, TargetType } = _getMappingParams(RelationType);
  const BaseRelationType = getBaseRelationTypeOf(RelationType);
  return {
    method: "PATCH",
    category: "mapping",
    url,
    schema: {
      description: `Update the contents of a '${mappingName}' mapping from the source ${
        trySharedSchemaName(SourceType) || "<SourceType>"} route resource to the target ${
        trySharedSchemaName(TargetType) || "<TargetType>"} route resource`,
      querystring: querystring ? { ...querystring } : undefined,
      body: trySharedSchemaName(BaseRelationType) || _convertTypeToSchema(BaseRelationType),
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    },
    config: { valos, mappingName, sourceIdRouteParam, targetIdRouteParam },
  };
}

export function mappingDELETERoute (valos, SourceType, RelationType,
    { url, querystring, sourceIdRouteParam, targetIdRouteParam }) {
  const { mappingName, TargetType } = _getMappingParams(RelationType);
  return {
    method: "DELETE",
    category: "mapping",
    url,
    schema: {
      description: `Delete a '${mappingName}' mapping from the source ${
        trySharedSchemaName(SourceType) || "<SourceType>"} route resource to the target ${
        trySharedSchemaName(TargetType) || "<TargetType>"} route resource.`,
      querystring: querystring ? { ...querystring } : undefined,
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    },
    config: { valos, mappingName, sourceIdRouteParam, targetIdRouteParam },
  };
}

/*
 #####   ######   #####    ##       #    #
 #    #  #          #     #  #      #    #
 #    #  #####      #    #    #     #    #
 #    #  #          #    ######     #    #
 #    #  #          #    #    #     #    #
 #####   ######     #    #    #     #    ######
*/

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
      href: URIReferenceType,
      rel: StringType,
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

const _unreservedWordListPattern = "^([a-zA-Z0-9\\-_.~]*(\\,([a-zA-Z0-9\\-_.~])*)*)?$";
const _unreservedSortListPattern = "^(\\-?[a-zA-Z0-9_.~]*(\\,\\-?([a-zA-Z0-9_.~])*)*)?$";

function _genericGETResourceQueryStringSchema (/* Type */) {
  return {
    fields: { ...StringType,
      pattern: _unreservedWordListPattern,
    },
  };
}

function _resourceSequenceQueryStringSchema (ResourceType) {
  const ret = {
    offset: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 0 },
    sort: { ...StringType, pattern: _unreservedSortListPattern },
    ids: { ...StringType, pattern: _unreservedWordListPattern },
  };
  for (const [key, schema] of Object.entries(ResourceType)) {
    if (((schema[ObjectJSONSchema] || {}).valos || {}).filterable) {
      ret[`require-${key}`] = IdValOSType;
    }
  }
  return ret;
}

function _getMappingParams (RelationType) {
  const mappingName = RelationType[ObjectJSONSchema].mappingName;
  const TargetType = RelationType.$V[ObjectJSONSchema].valos.TargetType;
  if (!mappingName) throw new Error("RelationType[ObjectJSONSchema].mappingName missing");
  if (!TargetType) throw new Error("RelationType.$V[ObjectJSONSchema].valos.TargetType missing");
  return { mappingName, TargetType };
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
