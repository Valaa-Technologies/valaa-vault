// @flow

import { asyncConnectToPartitionsIfMissingAndRetry } from "~/raem/tools/denormalized/partitions";

import { dumpify, dumpObject, outputError, thenChainEagerly } from "~/tools";

import * as routerCreators from "./handlers";

const FastifySwaggerPlugin = require("fastify-swagger");
const FastifyCookiePlugin = require("fastify-cookie");

export function _createPrefixService (rootService, prefix, {
  openapi, swaggerPrefix, schemas, routes, identity, sessionDuration, ...pluginOptions
}) {
  const ret = Object.create(rootService);
  ret.getRoutePrefix = () => prefix;
  ret.getSessionDuration = () => (sessionDuration || rootService.getSessionDuration());
  ret.getIdentity = () => identity;

  // Create handlers for all routes before trying to register.
  // At this stage neither schema nor fastify is available for the
  // handlers.
  const routers = routes.map(route => _createRouter(ret, route)).filter(r => r);
  // https://github.com/fastify/fastify/blob/master/docs/Server.md
  rootService.getRootFastify().register(async (fastify, opts, next) => {
    ret._fastify = fastify;
    fastify.register(FastifyCookiePlugin);
    if (swaggerPrefix) {
      fastify.register(FastifySwaggerPlugin, {
        routePrefix: swaggerPrefix,
        exposeRoute: true,
        swagger: openapi,
      });
    }
    ret.infoEvent(1, () => [
      `${prefix}: adding ${schemas.length} schemas:`,
      ...schemas.map(schema => schema.schemaName),
    ]);
    schemas.forEach(schema => fastify.addSchema(schema));
    ret.infoEvent(1, () => [
      `${prefix}: preparing ${routers.length} routers`,
    ]);
    await Promise.all(routers.map(router => router.prepare && router.prepare(fastify)));
    ret.infoEvent(1, () => [
      `${prefix}: preloading ${routers.length} routers`,
    ]);
    await Promise.all(routers.map(router => router.preload && router.preload(fastify)));
    ret.infoEvent(1, () => [
      `${prefix}: adding ${routers.length} fastify routes`,
    ]);
    routers.forEach(router => fastify.route(_fastifyRouteOptions(ret, router)));
    ret.infoEvent(1, () => [
      `${prefix}: plugin ready`,
    ]);
    fastify.ready(err => {
      if (err) throw err;
      fastify.swagger();
    });
    next(); // Always install other plugins
  }, {
    prefix,
    ...pluginOptions,
  });
  return ret;
}

function _createRouter (mapper, route) {
  const wrap = new Error(
      `createRouter(${route.category} ${route.method} ${route.url})`);
  try {
    if (!route.url) throw new Error(`Route url undefined`);
    if (!route.category) throw new Error(`Route category undefined`);
    if (!route.method) throw new Error(`Route method undefined`);
    if (!route.config) throw new Error(`Route config undefined`);
    const createRouter = (routerCreators[route.category] || {})[route.method];
    if (!createRouter) throw new Error(`No router found for '${route.category} ${route.method}'`);
    const router = createRouter(mapper, route);
    if (router == null) return undefined;
    if (!router.name) router.name = `${route.category} ${route.method} ${route.url}`;
    router.route = route;
    return router;
  } catch (error) {
    throw mapper.wrapErrorEvent(error, wrap,
        "\n\troute:", dumpify(route, { indent: 2 }));
  }
}

function _fastifyRouteOptions (mapper, router) {
  return {
    ...router.route,
    handler: _wrapHandler(mapper, router),
  };
}

function _wrapHandler (mapper, router) {
  const routeErrorMessage = `Exception caught during: ${router.name}`;
  const handleRequestAndErrors = asyncConnectToPartitionsIfMissingAndRetry(
      (request, reply) => thenChainEagerly(
          router.handler(request, reply),
          result => {
            if (result !== true) {
              throw mapper.wrapErrorEvent(
                  new Error("INTERNAL SERVER ERROR: invalid route handler return value"),
                  new Error(`handler return value validator`),
                  "\n\treturn value:", ...dumpObject(result),
                  "Note: router.handler must explicitly call reply.code/send",
                  "and return true or return a Promise which resolves to true.",
                  "This ensures that exceptions are always caught and logged properly");
            }
          }),
      (error, request, reply) => {
        reply.code(500);
        reply.send(error.message);
        outputError(mapper.wrapErrorEvent(error, new Error(`${router.name}`),
            "\n\trequest.params:", ...dumpObject(request.params),
            "\n\trequest.query:", ...dumpObject(request.query),
            "\n\trequest.body:", ...dumpObject(request.body),
        ), routeErrorMessage, mapper.getLogger());
      },
  );
  return (request, reply) => { handleRequestAndErrors(request, reply); };
}
