// @flow

const {
  ObjectSchema, trySchemaNameOf, sharedSchemaOf, enumerateMappingsOf,
} = require("@valos/rest-api-spindle/schema-builder/types");

const {
  listingGETRoute, resourceDELETERoute, resourceGETRoute, resourcePATCHRoute, resourcePOSTRoute,
  relationsGETRoute, mappingDELETERoute, mappingGETRoute, mappingPATCHRoute, mappingPOSTRoute,
  sessionGETRoute, sessionDELETERoute,
} = require("@valos/rest-api-spindle/schema-builder/routes");

const patchWith = require("@valos/tools/patchWith").default;

const testTypes = Object.values(require("./test-types")).filter(tt => (typeof tt !== "function"));
const packageJSON = require("../package");

exports.createConfig = function createConfig (options) {
  const { view, rules: globalRules, ...rest } = options;
  if (!(view || {}).focus) {
    throw new Error(`createConfig 'view.focus' option missing`);
  }
  return patchWith({
    view,
    openapi: {
      openapi: "3.0.2",
      info: {
        name: packageJSON.name,
        title: "REST API Spindle jest test",
        description: "",
        version: packageJSON.version
      },
      servers: [],
      externalDocs: {
        url: "https://swagger.io",
        description: "Find more info here"
      },
      host: "127.0.0.1",
      schemes: ["http", "https"],
      consumes: ["application/json"],
      produces: ["application/json"],
      tags: [
        { name: "user", description: "User related end-points" },
        { name: "code", description: "Code related end-points" }
      ],
      securityDefinitions: {
        apiKey: {
          type: "apiKey",
          name: "apiKey",
          in: "header"
        }
      }
    },
    schemas: testTypes.filter(schema => trySchemaNameOf(schema)).map(s => sharedSchemaOf(s)),
    routes: [
      sessionGETRoute(`/session`, {
        name: "session",
        rules: {
          grantExpirationDelay: 300,
          tokenExpirationDelay: 86400 * 7,
          clientRedirectPath: `/rest-test-app/`,
        },
      }, globalRules),

      sessionDELETERoute(`/session`, {
        name: "session",
        rules: {
          clientRedirectPath: `/rest-test-app/`,
        },
      }, globalRules),
      ...[].concat(...testTypes.map(_createGateRoutes.bind(null, globalRules))).filter(e => e),
    ],
  }, rest);
};

function _createGateRoutes (globalRules, resourceType) {
  const gate = ((resourceType[ObjectSchema] || {}).valospace || {}).gate;
  if (!gate) return [];
  return [
    listingGETRoute(`/${gate.name}`, {}, globalRules, resourceType),

    resourceGETRoute(`/${gate.name}/:resourceId`, {
      rules: {
        resource: ["!$valk:ref", ["*:$", ["!:request:params:resourceId"]]],
      },
    }, globalRules, resourceType),

    resourcePOSTRoute(`/${gate.name}`, {
      requiredRules: ["listingName"],
      rules: {
        doCreateResource: ["@",
          ["!$valk:const:newResource", ["!$valk:new", ["!:Entity"], {
            name: ["!:request:body:name"],
            owner: ["!:routeRoot"],
            properties: { name: ["!:request:body:name"] },
          }]],
          ["!$valk:new", ["!:Relation"], {
            name: "RIGHTS", source: ["!:newResource"], target: ["!:sessionIdentity"],
            properties: { read: true, write: true },
          }],
          ["!$valk:new", ["!:Relation"], {
            name: "RIGHTS", source: ["!:newResource"], target: ["!:routeRoot:user"],
            properties: { read: true, write: false },
          }],
          ["!$valk:new", ["!:Relation"], {
            name: ["!:listingName"], source: ["!:routeRoot"], target: ["!:newResource"],
          }],
          [".$V:target"],
        ],
      },
    }, globalRules, resourceType),

    resourcePATCHRoute(`/${gate.name}/:resourceId`, {
      rules: {
        resource: ["!$valk:ref", ["*:$", ["!:request:params:resourceId"]]],
        doPatchResource: null,
      },
    }, globalRules, resourceType),

    resourceDELETERoute(`/${gate.name}/:resourceId`, {
      rules: {
        resource: ["!$valk:ref", ["*:$", ["!:request:params:resourceId"]]],
        doDeleteResource: null,
      },
    }, globalRules, resourceType),

    ...[].concat(...enumerateMappingsOf(resourceType)
        .map(_createResourceTypeMappingRoutes.bind(null, globalRules, resourceType))
    ).filter(e => e),
  ];
}

function _createResourceTypeMappingRoutes (
    globalRules, resourceType, [mappingName, relationField]) {
  const gate = resourceType[ObjectSchema].valospace.gate;
  return [
    relationsGETRoute(`/${gate.name}/:resourceId/${mappingName}`, {
      enabledWithRules: ["relationName"],
      rules: {
        resource: ["!$valk:ref", ["*:$", ["!:request:params:resourceId"]]],
      },
    }, globalRules, resourceType, relationField),

    mappingGETRoute(`/${gate.name}/:resourceId/${mappingName}/:targetId`, {
      enabledWithRules: ["relationName"],
      rules: {
        resource: ["!$valk:ref", ["*:$", ["!:request:params:resourceId"]]],
        target: ["!$valk:ref", ["*:$", ["!:request:params:targetId"]]],
      },
    }, globalRules, resourceType, relationField),

    mappingPATCHRoute(`/${gate.name}/:resourceId/${mappingName}/:targetId`, {
      enabledWithRules: ["relationName"],
      rules: {
        resource: ["!$valk:ref", ["*:$", ["!:request:params:resourceId"]]],
        target: ["!$valk:ref", ["*:$", ["!:request:params:targetId"]]],
        doCreateMapping: ["!$valk:new", ["!:Relation"], {
          name: ["!:relationName"],
          source: ["!:resource"],
          target: ["!:target"],
        }],
      },
    }, globalRules, resourceType, relationField),

    mappingDELETERoute(`/${gate.name}/:resourceId/${mappingName}/:targetId`, {
      enabledWithRules: ["relationName"],
      rules: {
        resource: ["!$valk:ref", ["*:$", ["!:request:params:resourceId"]]],
        target: ["!$valk:ref", ["*:$", ["!:request:params:targetId"]]],
        doDestroyMapping: ["@",
          ["!:valos:Resource"], ["!$valk:invoke:destroy", ["!:target"]],
          ["!:valos:Resource"], ["!$valk:invoke:destroy", ["!:mapping"]],
        ],
      },
    }, globalRules, resourceType, relationField),

    mappingPOSTRoute(`/${gate.name}/:resourceId/${mappingName}`, {
      enabledWithRules: ["listingName", "relationName"],
      rules: {
        resource: ["!$valk:ref", ["*:$", ["!:request:params:resourceId"]]],
        doCreateMappingAndTarget: ["@",
          ["!$valk:const:newResource", ["!$valk:new", ["!:Entity"], {
            name: ["!:request:body", "$V", "target", "name"],
            owner: ["!:routeRoot"],
            properties: { name: ["!:request:body", "$V", "target", "name"] },
          }]],
          ["!$valk:new", ["!:Relation"], {
            name: ["!:listingName"], source: ["!:routeRoot"], target: ["!:newResource"],
          }],
          ["!$valk:new", ["!:Relation"], {
            name: ["!:relationName"], source: ["!:resource"], target: ["!:newResource"],
          }],
        ],
      },
    }, globalRules, resourceType, relationField),
  ];
}
