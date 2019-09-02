// @flow

import { wrapError, dumpify, dumpObject } from "~/tools";

import {
  ArrayJSONSchema, ObjectJSONSchema, StringType, XWWWFormURLEncodedStringType, IdValOSType,
  getBaseRelationTypeOf, schemaReference, trySharedSchemaName,
} from "./types";

export function listingGETRoute (valos, ResourceType, { url, querystring, ...rest }) {
  try {
    const resourceSchema = schemaReference(ResourceType);
    const resourceTypeName = trySharedSchemaName(ResourceType) || "<Type>";
    return {
      category: "listing",
      method: "GET",
      url,
      schema: {
        description: `List all listable ${resourceTypeName} resources`,
        querystring: {
          ..._genericGETResourceQueryStringSchema(ResourceType),
          ..._resourceSequenceQueryStringSchema(ResourceType),
          ...(querystring || {}),
        },
        response: {
          200: {
            type: "array",
            items: resourceSchema,
          },
        },
      },
      config: { valos, resourceSchema, resourceTypeName, ...rest },
    };
  } catch (error) {
    throw wrapError(error, new Error(`listingGETRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tResourceType:", ...dumpObject(ResourceType),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function resourcePOSTRoute (valos, ResourceType,
    { url, querystring, createResource, ...rest }) {
  try {
    const resourceSchema = schemaReference(ResourceType);
    const resourceTypeName = trySharedSchemaName(ResourceType) || "<Type>";
    return {
      category: "resource",
      method: "POST",
      url,
      schema: {
        description: `Create a new ${resourceTypeName} resource`,
        querystring: querystring ? { ...querystring } : undefined,
        body: resourceSchema,
        response: {
          200: resourceSchema,
          403: { type: "string" },
        },
      },
      config: { valos, resourceSchema, resourceTypeName, createResource, ...rest },
    };
  } catch (error) {
    throw wrapError(error, new Error(`resourcePOSTRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tType:", ...dumpObject(ResourceType),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function resourceGETRoute (valos, ResourceType, { url, querystring, ...rest }) {
  try {
    const resourceSchema = schemaReference(ResourceType);
    const resourceTypeName = trySharedSchemaName(ResourceType) || "<Type>";
    return {
      category: "resource",
      method: "GET",
      url,
      schema: {
        description:
            `Get the contents of a ${resourceTypeName} route resource`,
        querystring: {
          ..._genericGETResourceQueryStringSchema(ResourceType),
          ...(querystring || {}),
        },
        response: {
          200: resourceSchema,
          404: { type: "string", resourceTypeName },
        },
      },
      config: { valos, resourceSchema, ...rest },
    };
  } catch (error) {
    throw wrapError(error, new Error(`resourceGETRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tResourceType:", ...dumpObject(ResourceType),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function resourcePATCHRoute (valos, ResourceType, { url, querystring, ...rest }) {
  try {
    const resourceSchema = schemaReference(ResourceType);
    const resourceTypeName = trySharedSchemaName(ResourceType) || "<Type>";
    return {
      category: "resource",
      method: "PATCH",
      url,
      schema: {
        description: `Update parts of a ${resourceTypeName} route resource`,
        querystring: querystring ? { ...querystring } : undefined,
        body: resourceSchema,
        response: {
          200: { type: "string" },
          403: { type: "string" },
          404: { type: "string" },
        },
      },
      config: { valos, resourceSchema, resourceTypeName, ...rest },
    };
  } catch (error) {
    throw wrapError(error, new Error(`resourcePATCHRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tResourceType:", ...dumpObject(ResourceType),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function resourceDELETERoute (valos, Type,
    { url, querystring, ...rest }) {
  try {
    const resourceTypeName = trySharedSchemaName(Type) || "<Type>";
    return {
      category: "resource",
      method: "DELETE",
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
      config: { valos, resourceTypeName, ...rest },
    };
  } catch (error) {
    throw wrapError(error, new Error(`resourceDELETERoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tType:", ...dumpObject(Type),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function relationsGETRoute (valos, ResourceType, RelationType,
    { url, querystring, ...rest }) {
  try {
    const { mappingName: relationName, TargetType } = _getMappingParams(RelationType);
    // const BaseRelationType = getBaseRelationTypeOf(RelationType);
    const resourceTypeName = trySharedSchemaName(ResourceType) || "<ResourceType>";
    const targetTypeName = trySharedSchemaName(TargetType) || "<TargetType>";
    return {
      category: "relations",
      method: "GET",
      url,
      schema: {
        description: `List all '${relationName}' relations from the source ${
          resourceTypeName} route resource to all target ${targetTypeName} resources`,
        querystring: {
          ..._genericGETResourceQueryStringSchema(RelationType),
          ..._resourceSequenceQueryStringSchema(RelationType),
          ...(querystring || {}),
        },
        response: {
          200: schemaReference(RelationType),
        },
      },
      config: {
        valos, resourceTypeName, relationName, targetTypeName,
        resourceSchema: schemaReference(ResourceType),
        ...rest,
      },
    };
  } catch (error) {
    throw wrapError(error, new Error(`relationsGETRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tSourceType:", ...dumpObject(ResourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

/*
Note: while a mapping and its corresponding relation are the same
the identity of a mapping is the triplet (resourceId, relationName, targetId)
whereas the identify of a Relation is an explicit id. The identity of
mapping is thus implicitly inferred from the route.
*/

export function mappingPOSTRoute (valos, ResourceType, RelationType,
    { url, querystring, createResourceAndMapping, ...rest }) {
  try {
    const { mappingName, TargetType } = _getMappingParams(RelationType);
    const BodyType = getBaseRelationTypeOf(RelationType);
    BodyType.$V = { target: TargetType };
    const ResponseBodyType = getBaseRelationTypeOf(RelationType);
    ResponseBodyType.$V = { ...ResponseBodyType.$V, target: BodyType.$V.target };
    const resourceTypeName = trySharedSchemaName(ResourceType) || "<ResourceType>";
    const targetTypeName = trySharedSchemaName(TargetType) || "<TargetType>";
    return {
      category: "mapping",
      method: "POST",
      url,
      schema: {
        description: `Create a new ${targetTypeName
          } resource *using **body.$V.target** as content* and then a new '${mappingName
          }' mapping to it from the source ${resourceTypeName
          } route resource. The remaining fields of the body are set as the mapping content.\n${
          ""} Similarily the response will contain the newly created target resource content${
          ""} in *response.$V.target* with the rest of the response containing the mapping.`,
        querystring: querystring ? { ...querystring } : undefined,
        body: schemaReference(BodyType),
        response: {
          200: schemaReference(ResponseBodyType),
          403: { type: "string" },
        },
      },
      config: {
        valos, resourceTypeName, mappingName, targetTypeName, createResourceAndMapping,
        resourceSchema: schemaReference(ResourceType),
        relationSchema: schemaReference(RelationType),
        targetSchema: schemaReference(TargetType),
        ...rest,
      },
    };
  } catch (error) {
    throw wrapError(error, new Error(`mappingPOSTRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tSourceType:", ...dumpObject(ResourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function mappingGETRoute (valos, ResourceType, RelationType,
    { url, querystring, ...rest }) {
  try {
    const { mappingName, TargetType } = _getMappingParams(RelationType);
    const BaseRelationType = getBaseRelationTypeOf(RelationType);
    const resourceTypeName = trySharedSchemaName(ResourceType) || "<ResourceType>";
    const targetTypeName = trySharedSchemaName(TargetType) || "<TargetType>";
    return {
      category: "mapping",
      method: "GET",
      url,
      schema: {
        description: `Get the contents of a '${mappingName}' relation from the source ${
          resourceTypeName} route resource to the target ${targetTypeName} route resource`,
        querystring: {
          ..._genericGETResourceQueryStringSchema(BaseRelationType),
          ...(querystring || {}),
        },
        response: {
          200: schemaReference(BaseRelationType),
          404: { type: "string" },
        },
      },
      config: {
        valos, resourceTypeName, mappingName, targetTypeName,
        resourceSchema: schemaReference(ResourceType),
        relationSchema: schemaReference(RelationType),
        ...rest,
      },
    };
  } catch (error) {
    throw wrapError(error, new Error(`mappingGETRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tSourceType:", ...dumpObject(ResourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function mappingPATCHRoute (valos, ResourceType, RelationType,
    { url, querystring, createMapping, ...rest }) {
  try {
    /*
    if (createMapping === undefined) {
      throw new Error("mappingPATCHRoute.createMapping is undefined");
    }
    */
    const PatchRelationType = {
      ...RelationType,
      [ArrayJSONSchema]: RelationType[ArrayJSONSchema],
      [ObjectJSONSchema]: RelationType[ObjectJSONSchema],
      $V: { ...RelationType.$V, id: IdValOSType },
    };
    const { mappingName, TargetType } = _getMappingParams(RelationType);
    const BaseRelationType = getBaseRelationTypeOf(RelationType);
    const resourceTypeName = trySharedSchemaName(ResourceType) || "<ResourceType>";
    const targetTypeName = trySharedSchemaName(TargetType) || "<TargetType>";
    return {
      category: "mapping",
      method: "PATCH",
      url,
      schema: {
        description: `Update the contents of a '${mappingName}' mapping from the source ${
          resourceTypeName} route resource to the target ${targetTypeName} route resource`,
        querystring: querystring ? { ...querystring } : undefined,
        body: schemaReference(BaseRelationType),
        response: {
          200: { type: "string" },
          201: { type: "string" },
          403: { type: "string" },
          404: { type: "string" },
        },
      },
      config: {
        valos, resourceTypeName, mappingName, targetTypeName, createMapping,
        resourceSchema: schemaReference(ResourceType),
        relationSchema: schemaReference(PatchRelationType),
        targetSchema: schemaReference(TargetType),
        ...rest,
      },
    };
  } catch (error) {
    throw wrapError(error, new Error(`mappingPATCHRoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tSourceType:", ...dumpObject(ResourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function mappingDELETERoute (valos, ResourceType, RelationType,
    { url, querystring, ...rest }) {
  try {
    const { mappingName, TargetType } = _getMappingParams(RelationType);
    const resourceTypeName = trySharedSchemaName(ResourceType) || "<ResourceType>";
    const targetTypeName = trySharedSchemaName(TargetType) || "<TargetType>";
    return {
      category: "mapping",
      method: "DELETE",
      url,
      schema: {
        description: `Delete a '${mappingName}' mapping from the source ${
          resourceTypeName} route resource to the target ${targetTypeName} route resource.`,
        querystring: querystring ? { ...querystring } : undefined,
        response: {
          200: { type: "string" },
          403: { type: "string" },
          404: { type: "string" },
        },
      },
      config: {
        valos, resourceTypeName, mappingName, targetTypeName,
        resourceSchema: schemaReference(ResourceType),
        relationSchema: schemaReference(RelationType),
        ...rest,
      },
    };
  } catch (error) {
    throw wrapError(error, new Error(`mappingDELETERoute(<${url}>)`),
        "\n\tvalos:", dumpify(valos),
        "\n\tSourceType:", ...dumpObject(ResourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function sessionGETRoute ({ url, querystring, clientRedirectPath, ...rest }) {
  try {
    return {
      category: "session",
      method: "GET",
      url,
      schema: {
        description: `Get a session redirection via a ValOS OpenId Connect authorization response`,
        querystring: {
          code: { ...XWWWFormURLEncodedStringType },
          state: { ...XWWWFormURLEncodedStringType },
          error: StringType, // ASCII,
          error_description: StringType,
          // Values for the "error_description" parameter MUST NOT include
          // characters outside the set %x20-21 / %x23-5B / %x5D-7E.
          error_uri: StringType,
          // Values for the "error_uri" parameter MUST conform to the
          // URI-reference syntax and thus MUST NOT include characters
          // outside the set %x21 / %x23-5B / %x5D-7E.
          ...(querystring || {}),
        },
        response: {
          302: StringType,
          404: { type: "string" },
        },
      },
      config: {
        ...rest,
        constantRules: {
          ...(rest.constantRules || {}),
          clientRedirectPath,
        },
        queryRules: {
          ...(rest.queryRules || {}),
          authorizationGrant: "code", grantProviderState: "state",
          error: "error", errorDescription: "error_description", errorURI: "error_uri",
        },
      },
    };
  } catch (error) {
    throw wrapError(error, new Error(`sessionGETRoute(<${url}>)`),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

export function sessionDELETERoute ({ url, querystring, clientRedirectPath, ...rest }) {
  try {
    return {
      category: "session",
      method: "DELETE",
      url,
      schema: {
        description: `Close an active session specified by the client${
          ""} and session token cookies and also clear those cookies.`,
        querystring: querystring ? { ...querystring } : undefined,
        response: {
          303: StringType,
          400: { type: "string" },
          404: { type: "string" },
        },
      },
      config: {
        ...(rest || {}),
        constantRules: {
          ...(rest.constantRules || {}),
          clientRedirectPath,
        },
        queryRules: { ...(rest.queryRules || {}) },
      },
    };
  } catch (error) {
    throw wrapError(error, new Error(`sessionDELETERoute(<${url}>)`),
        "\n\tquerystring:", dumpify(querystring),
    );
  }
}

const _unreservedWordListPattern = "^([a-zA-Z0-9\\-_.~/*$]*(\\,([a-zA-Z0-9\\-_.~/*$])*)*)?$";
const _unreservedSortListPattern = "^(\\-?[a-zA-Z0-9_.~/$]*(\\,\\-?([a-zA-Z0-9_.~/$])*)*)?$";

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