// @flow

import { wrapError, dumpify, dumpObject, patchWith } from "~/tools";

import {
  ArrayJSONSchema, ObjectJSONSchema, StringType, XWWWFormURLEncodedStringType, IdValOSType,
  getBaseRelationTypeOf, schemaReference, trySharedSchemaName,
} from "./types";

import * as handlers from "~/rest-api-spindle/fastify/handlers";

export function assignRulesFrom (
    ruleSource: Object,
    routeToExtract: { name: string, category: string, method: string, mappingName: string },
    rules = {}) {
  if (!ruleSource) return rules;
  const {
    ":ofName": ofName,
    ":ofCategory": ofCategory,
    ":ofMethod": ofMethod,
    ":ofMapping": ofMapping,
    ...rest
  } = ruleSource;
  Object.assign(rules, rest);
  if ((ofName || {})[routeToExtract.name]) {
    assignRulesFrom(ofName[routeToExtract.name], routeToExtract, rules);
  }
  if ((ofCategory || {})[routeToExtract.category]) {
    assignRulesFrom(ofCategory[routeToExtract.category], routeToExtract, rules);
  }
  if ((ofMethod || {})[routeToExtract.method]) {
    assignRulesFrom(ofMethod[routeToExtract.method], routeToExtract, rules);
  }
  const mappingName = ((routeToExtract.config || {}).mapping || {}).name;
  if ((ofMapping || {})[mappingName]) {
    assignRulesFrom(ofMapping[mappingName], routeToExtract, rules);
  }
  return rules;
}

export function listingGETRoute (url, userConfig, globalRules, ResourceType) {
  const route = { url, category: "resource", method: "GET" };
  try {
    _setupRoute(route, userConfig, globalRules, ResourceType);
    route.schema = {
      description: `List all listable ${route.config.resource.name} resources`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(ResourceType),
        ..._resourceSequenceQueryStringSchema(ResourceType),
        ...(route.querystring || {}),
      },
      response: {
        200: {
          type: "array",
          items: route.config.resource.schema,
        },
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`listingGETRoute(<${route.url}>)`),
        "\n\tresource:", ...dumpObject(route.config.resource),
        "\n\tResourceType:", ...dumpObject(ResourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourcePOSTRoute (url, userConfig, globalRules, ResourceType) {
  const route = { url, category: "resource", method: "POST" };
  try {
    _setupRoute(route, userConfig, globalRules, ResourceType);
    route.schema = {
      description: `Create a new ${route.config.resource.name} resource`,
      querystring: route.querystring ? { ...route.querystring } : undefined,
      body: route.config.resource.schema,
      response: {
        200: route.config.resource.schema,
        403: { type: "string" },
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourcePOSTRoute(<${route.url}>)`),
        "\n\tresource:", dumpify(route.config.resource),
        "\n\tType:", ...dumpObject(ResourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourceGETRoute (url, userConfig, globalRules, ResourceType) {
  const route = { url, category: "resource", method: "GET" };
  try {
    _setupRoute(route, userConfig, globalRules, ResourceType);
    route.schema = {
      description: `Get the contents of a ${route.config.resource.name} route resource`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(ResourceType),
        ...(route.querystring || {}),
      },
      response: {
        200: route.config.resource.schema,
        404: { type: "string" },
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourceGETRoute(<${route.url}>)`),
        "\n\tresource:", ...dumpObject(route.config.resource),
        "\n\tResourceType:", ...dumpObject(ResourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourcePATCHRoute (url, userConfig, globalRules, ResourceType) {
  const route = { url, category: "resource", method: "PATCH" };
  try {
    _setupRoute(route, userConfig, globalRules, ResourceType);
    route.schema = {
      description: `Update parts of a ${route.config.resource.name} route resource`,
      querystring: route.config.querystring ? { ...route.config.querystring } : undefined,
      body: route.config.resource.schema,
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourcePATCHRoute(<${route.url}>)`),
        "\n\tresource:", ...dumpObject(route.config.resource),
        "\n\tResourceType:", ...dumpObject(ResourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourceDELETERoute (url, userConfig, globalRules, ResourceType) {
  const route = { url, category: "resource", method: "DELETE" };
  try {
    _setupRoute(route, userConfig, globalRules, ResourceType);
    route.schema = {
      description: `Destroy a ${route.config.resource.name} route resource`,
      querystring: route.config.querystring ? { ...route.config.querystring } : undefined,
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourceDELETERoute(<${route.url}>)`),
        "\n\tresource:", ...dumpObject(route.config.resource),
        "\n\tResourceType:", ...dumpObject(ResourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function relationsGETRoute (url, userConfig, globalRules, ResourceType, RelationType) {
  const route = { url, category: "relations", method: "GET" };
  try {
    _setupRoute(route, userConfig, globalRules, ResourceType, RelationType);
    route.schema = {
      description: `List all '${route.config.mapping.name}' relations from the source ${
        route.config.resource.name} route resource to all target ${
        route.config.target.name} resources`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(RelationType),
        ..._resourceSequenceQueryStringSchema(RelationType),
        ...(route.config.querystring || {}),
      },
      response: {
        200: route.config.mapping.schema,
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`relationsGETRoute(<${route.url}>)`),
        "\n\tresource:", ...dumpObject(route.config.resource),
        "\n\tSourceType:", ...dumpObject(ResourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

/*
Note: while a mapping and its corresponding relation are the same
the identity of a mapping is the triplet (resourceId, relationName, targetId)
whereas the identify of a Relation is an explicit id. The identity of
mapping is thus implicitly inferred from the route.
*/

export function mappingPOSTRoute (url, userConfig, globalRules, ResourceType, RelationType) {
  const route = { url, category: "mapping", method: "POST" };
  try {
    _setupRoute(route, userConfig, globalRules, ResourceType, RelationType);

    const target = RelationType.$V[ObjectJSONSchema].valospace.TargetType;
    const BodyType = getBaseRelationTypeOf(RelationType);
    BodyType.$V = { target };
    const ResponseBodyType = getBaseRelationTypeOf(RelationType);
    ResponseBodyType.$V = { ...ResponseBodyType.$V, target };

    route.schema = {
      description:
`Create a new ${route.config.target.name} resource
*using **body.$V.target** as content* and then a new '${route.config.mapping.name}'
mapping to it from the source ${route.config.resource.name} route
resource. The remaining fields of the body are set as the mapping
content. Similarily the response will contain the newly created target
resource content in *response.$V.target* with the rest of the response
containing the mapping.`,
      querystring: route.config.querystring ? { ...route.config.querystring } : undefined,
      body: schemaReference(BodyType),
      response: {
        200: schemaReference(ResponseBodyType),
        403: { type: "string" },
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`mappingPOSTRoute(<${route.url}>)`),
        "\n\tresource:", ...dumpObject(route.config.resource),
        "\n\tSourceType:", ...dumpObject(ResourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function mappingGETRoute (url, userConfig, globalRules, ResourceType, RelationType) {
  const route = { url, category: "mapping", method: "GET" };
  try {
    _setupRoute(route, userConfig, globalRules, ResourceType, RelationType);

    const BaseRelationType = getBaseRelationTypeOf(RelationType);

    route.schema = {
      description: `Get the contents of a '${route.config.mapping.name}' relation from the source ${
        route.config.resource.name} route resource to the target ${route.config.target.name} route resource`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(BaseRelationType),
        ...(route.config.querystring || {}),
      },
      response: {
        200: schemaReference(BaseRelationType),
        404: { type: "string" },
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`mappingGETRoute(<${route.url}>)`),
        "\n\tresource:", ...dumpObject(route.config.resource),
        "\n\tSourceType:", ...dumpObject(ResourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function mappingPATCHRoute (url, userConfig, globalRules, ResourceType, RelationType) {
  const route = { url, category: "mapping", method: "PATCH" };
  try {
    _setupRoute(route, userConfig, globalRules, ResourceType, RelationType);

    route.config.mapping.schema = schemaReference({
      ...RelationType,
      [ArrayJSONSchema]: RelationType[ArrayJSONSchema],
      [ObjectJSONSchema]: RelationType[ObjectJSONSchema],
      $V: { ...RelationType.$V, id: IdValOSType },
    });

    route.schema = {
      description: `Update the contents of a '${route.config.mapping.name
        }' mapping from the source ${route.config.resource.name
        } route resource to the target ${route.config.target.name} route resource`,
      querystring: route.config.querystring ? { ...route.config.querystring } : undefined,
      body: schemaReference(getBaseRelationTypeOf(RelationType)),
      response: {
        200: { type: "string" },
        201: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`mappingPATCHRoute(<${route.url}>)`),
        "\n\tresource:", ...dumpObject(route.config.resource),
        "\n\tSourceType:", ...dumpObject(ResourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function mappingDELETERoute (url, userConfig, globalRules, ResourceType, RelationType) {
  const route = { url, category: "mapping", method: "DELETE" };
  try {
    _setupRoute(route, userConfig, globalRules, ResourceType, RelationType);
    route.schema = {
      description: `Delete a '${route.config.mapping.name}' mapping from the source ${
        route.config.resource.name} route resource to the target ${
        route.config.target.name} route resource.`,
      querystring: route.config.querystring ? { ...route.config.querystring } : undefined,
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`mappingDELETERoute(<${route.url}>)`),
        "\n\tresource:", ...dumpObject(route.config.resource),
        "\n\tSourceType:", ...dumpObject(ResourceType),
        "\n\tRelationType[ArrayJSONSchema]:", dumpify(RelationType[ArrayJSONSchema]),
        "\n\tRelationType[ObjectJSONSchema]:", dumpify(RelationType[ObjectJSONSchema]),
        "\n\tRelationType.$V:", dumpify(RelationType.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...RelationType, $V: undefined }),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function sessionGETRoute (url, userConfig, globalRules) {
  const route = { url, category: "session", method: "GET", config: {
    rules: {
      grantExpirationDelay: 60,
      tokenExpirationDelay: 86400,
      userAgentState: ["!:request:cookies", ["!:identity:clientCookieName"]],
      authorizationGrant: ["!:request:query:code"],
      grantProviderState: ["!:request:query:state"],
      error: ["!:request:query:error"],
      errorDescription: ["!:request:query:error_description"],
      errorURI: ["!:request:query:error_uri"],
    },
  } };
  try {
    _setupRoute(route, userConfig, globalRules);
    route.schema = {
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
        ...(route.config.querystring || {}),
      },
      response: {
        302: StringType,
        404: { type: "string" },
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`sessionGETRoute(<${route.url}>)`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function sessionDELETERoute (url, userConfig, globalRules) {
  const route = { url, category: "session", method: "DELETE", config: {
    rules: {
      clientCookie: ["!:request:cookies", ["!:identity:clientCookieName"]],
      sessionCookie: ["!:request:cookies", ["!:identity:sessionCookieName"]],
    },
  } };
  try {
    _setupRoute(route, userConfig, globalRules);
    route.schema = {
      description: `Close an active session specified by the client${
        ""} and session token cookies and also clear those cookies.`,
      querystring: route.config.querystring ? { ...route.config.querystring } : undefined,
      response: {
        303: StringType,
        400: { type: "string" },
        404: { type: "string" },
      },
    };
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`sessionDELETERoute(<${route.url}>)`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

function _setupRoute (route, userConfig, globalRules, ResourceType, RelationType) {
  const category = handlers[route.category];
  if (!category) throw new Error(`No such category '${route.category}' for route <${route.url}>`);
  const handler = category[route.method];
  if (!handler) {
    throw new Error(`No such method '${route.method}' in category '${
        route.category}' for route <${route.url}>`);
  }
  const { requiredRules } = handler();

  route.config = patchWith({ requiredRules: [...requiredRules], rules: {} }, userConfig);

  if (ResourceType) {
    const name = trySharedSchemaName(ResourceType) || "<ResourceType>";
    const valospace = ResourceType[ObjectJSONSchema].valospace || {};
    if (!valospace.entrance) {
      throw new Error(`Can't find valospace entrance for <${route.url}> Resource '${name}'`);
    }
    if (!route.name) route.name = valospace.entrance.name;
    route.config.resource = {
      ...valospace,
      name,
      schema: schemaReference(ResourceType),
    };
  }

  if (RelationType) {
    const outermost = RelationType[ArrayJSONSchema] || RelationType[ObjectJSONSchema];
    const mappingName = (outermost.valospace || {}).mappingName;
    if (!mappingName) {
      throw new Error("RelationType[(Array|Object)JSONSchema].valospace.mappingName missing");
    }
    route.config.mapping = {
      name: mappingName,
      schema: schemaReference(RelationType),
    };

    const TargetType = RelationType.$V[ObjectJSONSchema].valospace.TargetType;
    if (!TargetType) {
      throw new Error("RelationType.$V[ObjectJSONSchema].valospace.TargetType missing");
    }
    route.config.target = {
      name: trySharedSchemaName(TargetType) || "<TargetType>",
      schema: schemaReference(TargetType),
    };
  }

  assignRulesFrom(globalRules, route, route.config.rules);
  route.config.requiredRules.forEach(ruleName => {
    if (route.config.rules[ruleName] === undefined) {
      throw new Error(`Required route rule '${ruleName}' missing for route <${route.url}>`);
    }
  });

  return route;
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
