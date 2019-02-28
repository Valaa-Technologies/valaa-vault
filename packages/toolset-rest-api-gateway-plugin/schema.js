// @flow

import { wrapError, dumpify, dumpObject } from "~/tools";

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
  try {
    const resourceTypeName = trySharedSchemaName(Type) || "<Type>";
    return {
      method: "GET",
      category: "listing",
      url,
      schema: {
        description: `List all listable ${resourceTypeName} resources`,
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
      config: { valos, resourceTypeName },
    };
  } catch (error) {
    throw wrapError(error, new Error(`listingGETRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tType:", ...dumpObject(Type),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function resourcePOSTRoute (valos, Type,
    { url, querystring }) {
  try {
    const typeSchema = trySharedSchemaName(Type) || _convertTypeToSchema(Type);
    const resourceTypeName = trySharedSchemaName(Type) || "<Type>";
    return {
      method: "POST",
      category: "resource",
      url,
      schema: {
        description: `Create a new ${resourceTypeName} resource`,
        querystring: querystring ? { ...querystring } : undefined,
        body: typeSchema,
        response: {
          200: typeSchema,
          403: { type: "string" },
        },
      },
      config: { valos, resourceTypeName },
    };
  } catch (error) {
    throw wrapError(error, new Error(`resourcePOSTRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tType:", ...dumpObject(Type),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function resourceGETRoute (valos, Type,
    { url, querystring, idRouteParam }) {
  try {
    const resourceTypeName = trySharedSchemaName(Type) || "<Type>";
    return {
      method: "GET",
      category: "resource",
      url,
      schema: {
        description:
            `Get the contents of a ${resourceTypeName} route resource`,
        querystring: {
          ..._genericGETResourceQueryStringSchema(Type),
          ...(querystring || {}),
        },
        response: {
          200: trySharedSchemaName(Type) || _convertTypeToSchema(Type),
          404: { type: "string", resourceTypeName },
        },
      },
      config: { valos, idRouteParam },
    };
  } catch (error) {
    throw wrapError(error, new Error(`resourceGETRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tType:", ...dumpObject(Type),
        "\n\tquerystring:", dumpify(querystring),
        "\n\tidRouteParam:", idRouteParam,
    );
  }
}

export function resourcePATCHRoute (valos, Type,
    { url, querystring, idRouteParam }) {
  try {
    const resourceTypeName = trySharedSchemaName(Type) || "<Type>";
    return {
      method: "PATCH",
      category: "resource",
      url,
      schema: {
        description: `Update parts of a ${resourceTypeName} route resource`,
        querystring: querystring ? { ...querystring } : undefined,
        body: trySharedSchemaName(Type) || _convertTypeToSchema(Type),
        response: {
          200: { type: "string" },
          403: { type: "string" },
          404: { type: "string" },
        },
      },
      config: { valos, resourceTypeName, idRouteParam },
    };
  } catch (error) {
    throw wrapError(error, new Error(`resourcePATCHRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tType:", ...dumpObject(Type),
        "\n\tquerystring:", dumpify(querystring),
        "\n\tidRouteParam:", idRouteParam,
    );
  }
}

export function resourceDELETERoute (valos, Type,
    { url, querystring, idRouteParam }) {
  try {
    const resourceTypeName = trySharedSchemaName(Type) || "<Type>";
    return {
      method: "DELETE",
      category: "resource",
      url,
      schema: {
        description: `Destroy a ${resourceTypeName} route resource`,
        querystring: querystring ? { ...querystring } : undefined,
        response: {
          200: { type: "string" },
          403: { type: "string" },
          404: { type: "string" },
        },
      },
      config: { valos, resourceTypeName, idRouteParam },
    };
  } catch (error) {
    throw wrapError(error, new Error(`resourceDELETERoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tType:", ...dumpObject(Type),
        "\n\tquerystring:", dumpify(querystring),
        "\n\tidRouteParam:", idRouteParam,
    );
  }
}

export function relationsGETRoute (valos, SourceType, RelationType,
    { url, querystring, sourceIdRouteParam }) {
  try {
    const { mappingName: relationName, TargetType } = _getMappingParams(RelationType);
    // const BaseRelationType = getBaseRelationTypeOf(RelationType);
    const sourceTypeName = trySharedSchemaName(SourceType) || "<SourceType>";
    const targetTypeName = trySharedSchemaName(TargetType) || "<TargetType>";
    return {
      method: "GET",
      category: "relations",
      url,
      schema: {
        description: `List all '${relationName}' relations from the source ${
          sourceTypeName} route resource to all target ${targetTypeName} resources`,
        querystring: {
          ..._genericGETResourceQueryStringSchema(RelationType),
          ..._resourceSequenceQueryStringSchema(RelationType),
          ...(querystring || {}),
        },
        response: {
          200: trySharedSchemaName(RelationType) || _convertTypeToSchema(RelationType),
        },
      },
      config: { valos, sourceTypeName, relationName, targetTypeName, sourceIdRouteParam },
    };
  } catch (error) {
    throw wrapError(error, new Error(`relationsGETRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tSourceType:", ...dumpObject(SourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\tquerystring:", dumpify(querystring),
        "\n\tsourceIdRouteParam:", sourceIdRouteParam,
    );
  }
}

/*
Note: while a mapping and its corresponding relation are the same
the identity of a mapping is the triplet (sourceId, relationName, targetId)
whereas the identify of a Relation is an explicit id. The identity of
mapping is thus implicitly inferred from the route.
*/

export function mappingPOSTRoute (valos, SourceType, RelationType,
    { url, querystring, sourceIdRouteParam }) {
  try {
    const { mappingName, TargetType } = _getMappingParams(RelationType);
    const BodyType = getBaseRelationTypeOf(RelationType);
    BodyType.$V = { target: TargetType };
    const ResponseBodyType = getBaseRelationTypeOf(RelationType);
    ResponseBodyType.$V.target = BodyType.$V.target;
    const sourceTypeName = trySharedSchemaName(SourceType) || "<SourceType>";
    const targetTypeName = trySharedSchemaName(TargetType) || "<TargetType>";
    return {
      method: "POST",
      category: "mapping",
      url,
      schema: {
        description: `Create a new ${targetTypeName
          } resource *using **body.$V.target** as content* and then a new '${mappingName
          }' mapping to it from the source ${sourceTypeName
          } route resource. The remaining fields of the body are set as the mapping content.\n${
          ""} Similarily the response will contain the newly created target resource content${
          ""} in *response.$V.target* with the rest of the response containing the mapping.`,
        querystring: querystring ? { ...querystring } : undefined,
        body: _convertTypeToSchema(BodyType),
        response: {
          200: _convertTypeToSchema(ResponseBodyType),
          403: { type: "string" },
        },
      },
      config: { valos, sourceTypeName, mappingName, targetTypeName, sourceIdRouteParam },
    };
  } catch (error) {
    throw wrapError(error, new Error(`mappingPOSTRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tSourceType:", ...dumpObject(SourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\tquerystring:", dumpify(querystring),
        "\n\tsourceIdRouteParam:", sourceIdRouteParam,
    );
  }
}

export function mappingGETRoute (valos, SourceType, RelationType,
    { url, querystring, sourceIdRouteParam, targetIdRouteParam }) {
  try {
    const { mappingName, TargetType } = _getMappingParams(RelationType);
    const BaseRelationType = getBaseRelationTypeOf(RelationType);
    const sourceTypeName = trySharedSchemaName(SourceType) || "<SourceType>";
    const targetTypeName = trySharedSchemaName(TargetType) || "<TargetType>";
    return {
      method: "GET",
      category: "mapping",
      url,
      schema: {
        description: `Get the contents of a '${mappingName}' relation from the source ${
          sourceTypeName} route resource to the target ${targetTypeName} route resource`,
        querystring: {
          ..._genericGETResourceQueryStringSchema(BaseRelationType),
          ...(querystring || {}),
        },
        response: {
          200: trySharedSchemaName(BaseRelationType) || _convertTypeToSchema(BaseRelationType),
          404: { type: "string" },
        },
      },
      config: {
        valos, sourceTypeName, mappingName, targetTypeName, sourceIdRouteParam, targetIdRouteParam,
        RelationTypeSchema: _convertTypeToSchema(RelationType),
      },
    };
  } catch (error) {
    throw wrapError(error, new Error(`mappingGETRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tSourceType:", ...dumpObject(SourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\tquerystring:", dumpify(querystring),
        "\n\tsourceIdRouteParam:", sourceIdRouteParam,
        "\n\ttargetIdRouteParam:", targetIdRouteParam,
    );
  }
}

export function mappingPATCHRoute (valos, SourceType, RelationType,
    { url, querystring, sourceIdRouteParam, targetIdRouteParam, prototypeRef }) {
  try {
    if (prototypeRef === undefined) {
      throw new Error("mappingPATCHRoute.prototypeRef is undefined");
    }
    const PatchRelationType = {
      ...RelationType,
      [ArrayJSONSchema]: RelationType[ArrayJSONSchema],
      [ObjectJSONSchema]: RelationType[ObjectJSONSchema],
      $V: { ...RelationType.$V, id: IdValOSType },
    };
    const { mappingName, TargetType } = _getMappingParams(RelationType);
    const BaseRelationType = getBaseRelationTypeOf(RelationType);
    const sourceTypeName = trySharedSchemaName(SourceType) || "<SourceType>";
    const targetTypeName = trySharedSchemaName(TargetType) || "<TargetType>";
    return {
      method: "PATCH",
      category: "mapping",
      url,
      schema: {
        description: `Update the contents of a '${mappingName}' mapping from the source ${
          sourceTypeName} route resource to the target ${targetTypeName} route resource`,
        querystring: querystring ? { ...querystring } : undefined,
        body: trySharedSchemaName(BaseRelationType) || _convertTypeToSchema(BaseRelationType),
        response: {
          200: { type: "string" },
          403: { type: "string" },
          404: { type: "string" },
        },
      },
      config: {
        valos, sourceTypeName, mappingName, targetTypeName, sourceIdRouteParam, targetIdRouteParam,
        prototypeRef, RelationTypeSchema: _convertTypeToSchema(PatchRelationType),
      },
    };
  } catch (error) {
    throw wrapError(error, new Error(`mappingPATCHRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tSourceType:", ...dumpObject(SourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\tquerystring:", dumpify(querystring),
        "\n\tsourceIdRouteParam:", sourceIdRouteParam,
        "\n\ttargetIdRouteParam:", targetIdRouteParam,
    );
  }
}

export function mappingDELETERoute (valos, SourceType, RelationType,
    { url, querystring, sourceIdRouteParam, targetIdRouteParam }) {
  try {
    const { mappingName, TargetType } = _getMappingParams(RelationType);
    const sourceTypeName = trySharedSchemaName(SourceType) || "<SourceType>";
    const targetTypeName = trySharedSchemaName(TargetType) || "<TargetType>";
    return {
      method: "DELETE",
      category: "mapping",
      url,
      schema: {
        description: `Delete a '${mappingName}' mapping from the source ${
          sourceTypeName} route resource to the target ${targetTypeName} route resource.`,
        querystring: querystring ? { ...querystring } : undefined,
        response: {
          200: { type: "string" },
          403: { type: "string" },
          404: { type: "string" },
        },
      },
      config: {
        valos, sourceTypeName, mappingName, targetTypeName, sourceIdRouteParam, targetIdRouteParam,
        RelationTypeSchema: _convertTypeToSchema(RelationType),
      },
    };
  } catch (error) {
    throw wrapError(error, new Error(`mappingDELETERoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tSourceType:", ...dumpObject(SourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\tquerystring:", dumpify(querystring),
        "\n\tsourceIdRouteParam:", sourceIdRouteParam,
        "\n\ttargetIdRouteParam:", targetIdRouteParam,
    );
  }
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
  const outermost = RelationType[ArrayJSONSchema] || RelationType[ObjectJSONSchema];
  const mappingName = (outermost.valos || {}).mappingName;
  const TargetType = RelationType.$V[ObjectJSONSchema].valos.TargetType;
  if (!mappingName) {
    throw new Error("RelationType[(Array|Object)JSONSchema].valos.mappingName missing");
  }
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
