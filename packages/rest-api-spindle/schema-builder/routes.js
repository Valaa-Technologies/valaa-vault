// @flow

import { segmentVPath, segmentVKeyPath } from "~/raem/VPath";
import { wrapError, dumpify, dumpObject, patchWith } from "~/tools";

import {
  CollectionSchema, ObjectSchema, StringType, XWWWFormURLEncodedStringType, IdValOSType,
  extendType, getSingularRelationTypeOf, schemaRefOf, trySchemaNameOf, _resolveFunction,
} from "./types";

import * as projectors from "~/rest-api-spindle/projectors";

export function assignRulesFrom (
    ruleSource: Object,
    routeToExtract: { name: string, category: string, method: string, mappingName: string },
    rules = {}) {
  if (!ruleSource) return rules;
  const {
    "&ofName": ofName,
    "&ofCategory": ofCategory,
    "&ofMethod": ofMethod,
    "&ofResource": ofResource,
    "&ofMapping": ofMapping,
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
  const resourceName = ((routeToExtract.config || {}).resource || {}).name;
  if ((ofResource || {})[resourceName]) {
    assignRulesFrom(ofResource[resourceName], routeToExtract, rules);
  }
  const mappingName = ((routeToExtract.config || {}).relation || {}).name;
  if ((ofMapping || {})[mappingName]) {
    assignRulesFrom(ofMapping[mappingName], routeToExtract, rules);
  }
  return rules;
}

export function listingGETRoute (url, userConfig, globalRules, resourceType) {
  const route = { url, category: "listing", method: "GET" };
  try {
    if (!resourceType || (typeof resourceType !== "object")) {
      throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
    }
    if (!_setupRoute(route, userConfig, globalRules, resourceType)) {
      return undefined;
    }
    Object.assign(route.schema, {
      description: `List all listable ${route.config.resource.name} resources`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(resourceType),
        ..._resourceSequenceQueryStringSchema(resourceType),
        ...(route.schema.querystring || {}),
      },
      response: {
        200: {
          type: "array",
          items: route.config.resource.schema,
        },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`listingGETRoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tResourceType:", ...dumpObject(resourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourcePOSTRoute (url, userConfig, globalRules, resourceType) {
  const route = { url, category: "resource", method: "POST" };
  try {
    if (!resourceType || (typeof resourceType !== "object")) {
      throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
    }
    if (!_setupRoute(route, userConfig, globalRules, resourceType)) {
      return undefined;
    }
    Object.assign(route.schema, {
      description: `Create a new ${route.config.resource.name} resource`,
      body: route.config.resource.schema,
      response: {
        200: route.config.resource.schema,
        403: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourcePOSTRoute(${_routeName(route)})`),
        "\n\tresource:", dumpify(route.config.resource),
        "\n\tType:", ...dumpObject(resourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourceGETRoute (url, userConfig, globalRules, resourceType) {
  const route = { url, category: "resource", method: "GET" };
  try {
    if (!resourceType || (typeof resourceType !== "object")) {
      throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
    }
    if (!_setupRoute(route, userConfig, globalRules, resourceType)) {
      return undefined;
    }
    Object.assign(route.schema, {
      description: `Get the contents of a ${route.config.resource.name} route resource`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(resourceType),
        ...(route.schema.querystring || {}),
      },
      response: {
        200: route.config.resource.schema,
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourceGETRoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tResourceType:", ...dumpObject(resourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourcePATCHRoute (url, userConfig, globalRules, resourceType) {
  const route = { url, category: "resource", method: "PATCH" };
  try {
    if (!resourceType || (typeof resourceType !== "object")) {
      throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
    }
    if (!_setupRoute(route, userConfig, globalRules, resourceType)) {
      return undefined;
    }
    Object.assign(route.schema, {
      description: `Update parts of a ${route.config.resource.name} route resource`,
      body: route.config.resource.schema,
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourcePATCHRoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tResourceType:", ...dumpObject(resourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function resourceDELETERoute (url, userConfig, globalRules, resourceType) {
  const route = { url, category: "resource", method: "DELETE" };
  try {
    if (!resourceType || (typeof resourceType !== "object")) {
      throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
    }
    if (!_setupRoute(route, userConfig, globalRules, resourceType)) {
      return undefined;
    }
    Object.assign(route.schema, {
      description: `Destroy a ${route.config.resource.name} route resource`,
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`resourceDELETERoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tResourceType:", ...dumpObject(resourceType),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function relationsGETRoute (url, userConfig, globalRules, resourceType, relationField) {
  const route = { url, category: "relations", method: "GET" };
  try {
    if (!resourceType || (typeof resourceType !== "object")) {
      throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
    }
    if (!relationField || (typeof relationField !== "object")) {
      throw new Error(`relationField missing or invalid for ${_routeName(route)}`);
    }
    if (!_setupRoute(route, userConfig, globalRules, resourceType, relationField)) {
      return undefined;
    }
    Object.assign(route.schema, {
      description: `List all '${route.config.relation.name}' relations from the source ${
        route.config.resource.name} route resource to all target ${
        route.config.target.name} resources`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(relationField),
        ..._resourceSequenceQueryStringSchema(relationField),
        ...(route.schema.querystring || {}),
      },
      response: {
        200: route.config.relation.schema,
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`relationsGETRoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tSourceType:", ...dumpObject(resourceType),
        "\n\tRelationType[CollectionSchema]:", dumpify(relationField[CollectionSchema]),
        "\n\tRelationType[ObjectSchema]:", dumpify(relationField[ObjectSchema]),
        "\n\tRelationType.$V:", dumpify(relationField.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...relationField, $V: undefined }),
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

export function mappingPOSTRoute (url, userConfig, globalRules, resourceType, relationField_) {
  const route = { url, category: "mapping", method: "POST" };
  const relationField = _resolveFunction(relationField_);
  try {
    if (!resourceType || (typeof resourceType !== "object")) {
      throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
    }
    if (!relationField || (typeof relationField !== "object")) {
      throw new Error(`relationField missing or invalid for ${_routeName(route)}`);
    }
    if (!_setupRoute(route, userConfig, globalRules, resourceType, relationField)) {
      return undefined;
    }

    const target = relationField.$V.target[ObjectSchema].valospace.resourceType;

    Object.assign(route.schema, {
      description:
`Create a new ${route.config.target.name} resource
*using **body.$V.target** as content* and then a new '${route.config.relation.name}'
mapping to it from the source ${route.config.resource.name} route
resource. The remaining fields of the body are set as the mapping
content. Similarily the response will contain the newly created target
resource content in *response.$V.target* with the rest of the response
containing the mapping.`,
      body: schemaRefOf(getSingularRelationTypeOf(relationField, {
        $V: ["...", null, { [ObjectSchema]: {}, target }],
      })),
      response: {
        200: schemaRefOf(getSingularRelationTypeOf(relationField, {
          $V: { target },
        })),
        403: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`mappingPOSTRoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tSourceType:", ...dumpObject(resourceType),
        "\n\tRelationType[CollectionSchema]:", dumpify(relationField[CollectionSchema]),
        "\n\tRelationType[ObjectSchema]:", dumpify(relationField[ObjectSchema]),
        "\n\tRelationType.$V:", dumpify(relationField.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...relationField, $V: undefined }),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function mappingGETRoute (url, userConfig, globalRules, resourceType, relationField_) {
  const route = { url, category: "mapping", method: "GET" };
  const relationField = _resolveFunction(relationField_);
  try {
    if (!resourceType || (typeof resourceType !== "object")) {
      throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
    }
    if (!relationField || (typeof relationField !== "object")) {
      throw new Error(`relationField missing or invalid for ${_routeName(route)}`);
    }
    if (!_setupRoute(route, userConfig, globalRules, resourceType, relationField)) {
      return undefined;
    }

    const singularRelationSchema = getSingularRelationTypeOf(relationField);
    Object.assign(route.schema, {
      description:
`Get the contents of a '${route.config.relation.name}' relation from the
source ${route.config.resource.name} route resource to the target ${
route.config.target.name} route resource`,
      querystring: {
        ..._genericGETResourceQueryStringSchema(singularRelationSchema),
        ...(route.schema.querystring || {}),
      },
      response: {
        200: schemaRefOf(singularRelationSchema),
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`mappingGETRoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tSourceType:", ...dumpObject(resourceType),
        "\n\tRelationType[CollectionSchema]:", dumpify(relationField[CollectionSchema]),
        "\n\tRelationType[ObjectSchema]:", dumpify(relationField[ObjectSchema]),
        "\n\tRelationType.$V:", dumpify(relationField.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...relationField, $V: undefined }),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function mappingPATCHRoute (url, userConfig, globalRules, resourceType, relationField_) {
  const route = { url, category: "mapping", method: "PATCH" };
  const relationField = _resolveFunction(relationField_);
  try {
    if (!resourceType || (typeof resourceType !== "object")) {
      throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
    }
    if (!relationField || (typeof relationField !== "object")) {
      throw new Error(`relationField missing or invalid for ${_routeName(route)}`);
    }
    if (!_setupRoute(route, userConfig, globalRules, resourceType, relationField)) {
      return undefined;
    }

    route.config.relation.schema = schemaRefOf(extendType(relationField, {
      $V: { id: [null, IdValOSType] },
    }));

    Object.assign(route.schema, {
      description: `Update the contents of a '${route.config.relation.name
        }' mapping from the source ${route.config.resource.name
        } route resource to the target ${route.config.target.name} route resource`,
      body: schemaRefOf(getSingularRelationTypeOf(relationField)),
      response: {
        200: { type: "string" },
        201: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`mappingPATCHRoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tSourceType:", ...dumpObject(resourceType),
        "\n\tRelationType[CollectionSchema]:", dumpify(relationField[CollectionSchema]),
        "\n\tRelationType[ObjectSchema]:", dumpify(relationField[ObjectSchema]),
        "\n\tRelationType.$V:", dumpify(relationField.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...relationField, $V: undefined }),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function mappingDELETERoute (url, userConfig, globalRules, resourceType, relationField_) {
  const route = { url, category: "mapping", method: "DELETE" };
  const relationField = _resolveFunction(relationField_);
  try {
    if (!resourceType || (typeof resourceType !== "object")) {
      throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
    }
    if (!relationField || (typeof relationField !== "object")) {
      throw new Error(`relationField missing or invalid for ${_routeName(route)}`);
    }
    if (!_setupRoute(route, userConfig, globalRules, resourceType, relationField)) {
      return undefined;
    }
    Object.assign(route.schema, {
      description: `Delete a '${route.config.relation.name}' mapping from the source ${
        route.config.resource.name} route resource to the target ${
        route.config.target.name} route resource.`,
      response: {
        200: { type: "string" },
        403: { type: "string" },
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`mappingDELETERoute(${_routeName(route)})`),
        "\n\tresource:", ...dumpObject((route.config || {}).resource),
        "\n\tSourceType:", ...dumpObject(resourceType),
        "\n\tRelationType[CollectionSchema]:", dumpify(relationField[CollectionSchema]),
        "\n\tRelationType[ObjectSchema]:", dumpify(relationField[ObjectSchema]),
        "\n\tRelationType.$V:", dumpify(relationField.$V),
        "\n\tRelationType ...rest:", ...dumpObject({ ...relationField, $V: undefined }),
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
    if (!_setupRoute(route, userConfig, globalRules)) {
      return undefined;
    }
    Object.assign(route.schema, {
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
        ...(route.schema.querystring || {}),
      },
      response: {
        302: StringType,
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`sessionGETRoute(${_routeName(route)})`),
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
    if (!_setupRoute(route, userConfig, globalRules)) {
      return undefined;
    }
    Object.assign(route.schema, {
      description: `Close an active session specified by the client${
        ""} and session token cookies and also clear those cookies.`,
      response: {
        303: StringType,
        400: { type: "string" },
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`sessionDELETERoute(${_routeName(route)})`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

function _setupRoute (route, userConfig, globalRules, resourceType, relationField) {
  const category = projectors[route.category];
  if (!category) throw new Error(`No such category '${route.category}' for ${_routeName(route)}`);
  const handler = category[route.method];
  if (!handler) {
    throw new Error(`No such method '${route.method}' in category '${
        route.category}' for ${_routeName(route)}`);
  }
  const { requiredRules, requiredRuntimeRules } = handler();
  if (!route.schema) route.schema = {};
  if (!route.config) route.config = {};
  if (!route.config.rules) route.config.rules = {};
  (route.config.requiredRules || (route.config.requiredRules = [])).push(...(requiredRules || []));
  if (requiredRuntimeRules) {
    (route.config.requiredRuntimeRules || (route.config.requiredRuntimeRules = []))
        .push(...requiredRuntimeRules);
  }

  route.config = patchWith(route.config, userConfig);
  if (resourceType) {
    const name = trySchemaNameOf(resourceType) || "<resource>";
    const valospace = resourceType[ObjectSchema].valospace || {};
    if (!valospace.gate) {
      throw new Error(`Can't find valospace gate for resource '${name}' in ${_routeName(route)}`);
    }
    if (!route.name) route.name = valospace.gate.name;
    route.config.resource = {
      name,
      schema: schemaRefOf(resourceType),
      gate: {
        ...valospace.gate,
        projection: segmentVPath(valospace.gate.projection).slice(1),
      },
    };
  }

  if (relationField) {
    const actualRelation = (typeof relationField === "function" ? relationField() : relationField);
    const outermost = actualRelation[CollectionSchema] || actualRelation[ObjectSchema];
    route.config.rules.mappingName = (outermost.valospace || {}).mappingName;
    if (!route.config.rules.mappingName) {
      throw new Error(`relationType[(Array|Object)JSONSchema].valospace.mappingName missing for ${
          _routeName(route)}`);
    }
    route.config.relation = {
      name: route.config.rules.mappingName, // this is wrong. Should be the internal Relation name.
      schema: schemaRefOf(actualRelation),
    };

    const targetType = actualRelation.$V.target[ObjectSchema].valospace.resourceType;
    if (!targetType) {
      throw new Error(`relationType.$V[ObjectSchema].valospace.targetType missing for ${
          _routeName(route)}`);
    }
    route.config.target = {
      name: trySchemaNameOf(targetType) || "<target>",
      schema: schemaRefOf(targetType),
    };
  }

  assignRulesFrom(globalRules, route, route.config.rules);
  for (const ruleName of (route.config.enabledWithRules || [])) {
    if (route.config.rules[ruleName] === undefined) return undefined;
  }
  for (const [key, rule] of Object.entries(route.config.rules)) {
    route.config.rules[key] = segmentVKeyPath("@", rule).slice(1);
  }
  for (const ruleName of [].concat(
      route.config.requiredRules || [],
      route.config.requiredRuntimeRules || [])) {
    if (route.config.rules[ruleName] === undefined) {
      throw new Error(`Required route rule '${ruleName}' missing for ${_routeName(route)}`);
    }
  }

  if (route.config.querystring) route.schema.querystring = route.config.querystring;

  return route;
}

function _routeName (route) {
  return `${route.method}-${route.category} <${route.url}>`;
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

function _resourceSequenceQueryStringSchema (resourceType) {
  const ret = {
    offset: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 0 },
    sort: { ...StringType, pattern: _unreservedSortListPattern },
    ids: { ...StringType, pattern: _unreservedWordListPattern },
  };
  for (const [key, schema] of Object.entries(resourceType)) {
    if (((schema[ObjectSchema] || {}).valospace || {}).filterable) {
      ret[`require-${key}`] = IdValOSType;
    }
  }
  return ret;
}
