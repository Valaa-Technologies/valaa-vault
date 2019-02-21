// @flow

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

/* eslint-disable */

export const unreservedWordListPattern = "^([a-zA-Z0-9\\-_.~]*(\,([a-zA-Z0-9\\-_.~])*)*)?$";
export const unreservedSortListPattern = "^(\-?[a-zA-Z0-9_.~]*(\,\-?([a-zA-Z0-9_.~])*)*)?$";

export function RelationType (TargetType, relationNameOrPredicate, {
    [ArrayJSONSchema]: arraySchema = {},
    [ObjectJSONSchema]: objectSchema = {},
    ...relationProperties
} = {}) {
  return {
    [ArrayJSONSchema]: {
      ...arraySchema,
      valos: {
        ...(arraySchema.valos || {}),
        predicate: (relationNameOrPredicate.slice(0, 6) !== "valos:")
            ? `valos:Relation:${relationNameOrPredicate}`
            : relationNameOrPredicate,
      }
    },
    [ObjectJSONSchema]: { ...objectSchema },
    $V: {
      [ObjectJSONSchema]: {
        valos: { route: TargetType[ObjectJSONSchema].valos.route }
      },
      href: URIReferenceType,
      rel: StringType,
    },
    ...relationProperties,
  };
}

export function sharedSchema (name, Type) {
  const schema = _expandSchema(Type);
  schema.$id = name;
  return schema;
}

function _genericGETResourceQueryStringSchema (Type) {
  return {
    fields: { ...StringType,
      pattern: unreservedWordListPattern,
    },
  };
}

function _filterQueryStringSchema (Type) {
  const ret = {};
  for (const [key, schema] of Object.entries(Type)) {
    if (((schema[ObjectJSONSchema] || {}).valos || {}).filterable) {
      ret[`require-${key}`] = IdValOSType;
    }
  }
  return ret;
}

export function listCollectionGETRoute (schemaName, Type, valos, { url, querystring }) {
  return {
    method: "GET",
    handler: "listCollection",
    url,
    schema: {
      querystring: {
        ..._genericGETResourceQueryStringSchema(Type),
        ..._filterQueryStringSchema(Type),
        offset: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 0 },
        sort: { ...StringType, pattern: unreservedSortListPattern },
        ids: { ...StringType, pattern: unreservedWordListPattern },
      },
      response: {
        200: {
          type: "array",
          items: schemaName || _expandSchema(Type),
        },
      },
    },
    config: { valos },
  };
}

export function retrieveResourceGETRoute (schemaName, Type, valos,
    { url, querystring, idRouteParam }) {
  return {
    method: "GET",
    handler: "retrieveResource",
    url,
    schema: {
      querystring: {
        ..._genericGETResourceQueryStringSchema(Type),
        ...(querystring || {}),
      },
      response: {
        200: schemaName || _expandSchema(Type),
        404: { type: "string" },
      },
    },
    config: { valos, idRouteParam },
  };
}

export function createResourcePOSTRoute (schemaName, Type, valos, { url }) {
  const typeSchema = schemaName || _expandSchema(Type);
  return {
    method: "POST",
    handler: "createResource",
    url,
    schema: {
      body: typeSchema,
      response: {
        200: typeSchema,
        403: { type: "string" },
      },
    },
    config: { valos },
  };
}

export function updateResourcePATCHRoute (schemaName, Type, valos, { url, idRouteParam }) {
  return {
    method: "PATCH",
    handler: "updateResource",
    url,
    schema: {
      body: schemaName || _expandSchema(Type),
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    },
    config: { valos, idRouteParam },
  };
}

export function destroyResourceDELETERoute (schemaName, Type, valos, { url, idRouteParam }) {
  return {
    method: "DELETE",
    handler: "destroyResource",
    url,
    schema: {
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    },
    config: { valos, idRouteParam },
  };
}

function _expandSchema (Type) {
  if (typeof Type === "function") return _expandSchema(Type());
  if (Type == null || (typeof Type !== "object")) return Type;
  const ret = {};
  let target = ret;
  if (Type[ArrayJSONSchema]) {
    Object.assign(target, Type[ArrayJSONSchema]);
    target.type = "array";
    target.items = {};
    target = target.items;
  }
  if (Type[ObjectJSONSchema]) {
    Object.assign(target, Type[ObjectJSONSchema]);
    target.type = "object";
    target.properties = {};
    target = target.properties;
  }
  for (const [key, value] of Object.entries(Type)) target[key] = _expandSchema(value);
  return ret;
}
