// @flow

import { wrapError, dumpify, dumpObject } from "~/tools";

import {
  CollectionSchema, ObjectSchema, IdValOSType,
  extendType, getSingularRelationTypeOf, schemaRefOf, trySchemaNameOf, _resolveFunction,
} from "./types";

import {
  _prepareRoute, _finalizeRoute, _routeName,
  _genericGETResourceQueryStringSchema, _resourceSequenceQueryStringSchema,
} from "./_routesCommon";

import { _setupRouteResourceConfig } from "./_resourceRoutes";

export function _setupRelationRoute (route, userConfig, globalRules, resourceType, relationField) {
  if (!resourceType || (typeof resourceType !== "object")) {
    throw new Error(`resourceType missing or invalid for ${_routeName(route)}`);
  }
  if (!relationField || (typeof relationField !== "object")) {
    throw new Error(`relationField missing or invalid for ${_routeName(route)}`);
  }
  _prepareRoute(route, userConfig);
  _setupRouteResourceConfig(route, resourceType);
  _setupRouteRelationConfig(route, relationField);
  return _finalizeRoute(route, userConfig, globalRules);
}

function _setupRouteRelationConfig (route, relationField) {
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

export function relationsGETRoute (url, userConfig, globalRules, resourceType, relationField) {
  const route = { url, category: "relations", method: "GET" };
  try {
    if (!_setupRelationRoute(route, userConfig, globalRules, resourceType, relationField)) {
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
        403: { type: "string" },
        404: { type: "string" },
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
    if (!_setupRelationRoute(route, userConfig, globalRules, resourceType, relationField)) {
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
        404: { type: "string" },
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
    if (!_setupRelationRoute(route, userConfig, globalRules, resourceType, relationField)) {
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
        403: { type: "string" },
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
    if (!_setupRelationRoute(route, userConfig, globalRules, resourceType, relationField)) {
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
    if (!_setupRelationRoute(route, userConfig, globalRules, resourceType, relationField)) {
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
