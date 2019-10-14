// @flow

import { asyncConnectToPartitionsIfMissingAndRetry } from "~/raem/tools/denormalized/partitions";

import { dumpify, dumpObject, outputError, thenChainEagerly } from "~/tools";

import * as handlerCreators from "./handlers";

const FastifySwaggerPlugin = require("fastify-swagger");
const FastifyCookiePlugin = require("fastify-cookie");

export function _createMapper (mapperService, prefix, {
  openapi, swaggerPrefix, schemas, routes, identity, sessionDuration, ...pluginOptions
}) {
  const ret = Object.create(mapperService);
  ret.getRoutePrefix = () => prefix;
  ret.getSessionDuration = () => (sessionDuration || mapperService.getSessionDuration());
  ret.getIdentity = () => identity;

  // Create handlers for all routes before trying to register.
  // At this stage neither schema nor fastify is available for the
  // handlers.
  const routeHandlers = routes
      .map(route => _createRouteHandler(ret, route))
      .filter(notFalsy => notFalsy);
  // https://github.com/fastify/fastify/blob/master/docs/Server.md
  mapperService.getRootFastify().register(async (fastify, opts, next) => {
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
      `${prefix}: preparing ${routeHandlers.length} route handlers`,
    ]);
    await Promise.all(routeHandlers.map(routeHandler =>
        routeHandler.prepare && routeHandler.prepare(fastify)));
    ret.infoEvent(1, () => [
      `${prefix}: preloading ${routeHandlers.length} route handlers`,
    ]);
    await Promise.all(routeHandlers.map(routeHandler =>
        routeHandler.preload && routeHandler.preload()));
    ret.infoEvent(1, () => [
      `${prefix}: adding ${routeHandlers.length} fastify routes`,
    ]);
    routeHandlers.forEach(routeHandler =>
        fastify.route(routeHandler.fastifyRoute));
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

function _createRouteHandler (mapper, route) {
  const wrap = new Error(`createRouteHandler(${route.category || "<categoryless>"} ${
      route.method} ${route.url})`);
  try {
    if (!route.category) throw new Error(`Route category undefined`);
    if (!route.method) throw new Error(`Route method undefined`);
    if (!route.url) throw new Error(`Route url undefined`);
    if (!route.config) throw new Error(`Route config undefined`);
    const createRouteHandler = (handlerCreators[route.category] || {})[route.method];
    if (!createRouteHandler) {
      throw new Error(`No route handler creators found for '${route.category} ${route.method}'`);
    }
    const routeHandler = createRouteHandler(mapper, route);
    if (!routeHandler) return undefined;
    if (!routeHandler.name) routeHandler.name = `${route.category} ${route.method} ${route.url}`;
    const routeErrorMessage = `Exception caught during: ${routeHandler.name}`;
    const handleRequestAndErrors = asyncConnectToPartitionsIfMissingAndRetry(
        (request, reply) => thenChainEagerly(
            routeHandler.handleRequest(request, reply),
            result => {
              if (result !== true) {
                throw mapper.wrapErrorEvent(
                    new Error("INTERNAL SERVER ERROR: invalid route handler return value"),
                    new Error(`handleRequest return value validator`),
                    "\n\treturn value:", ...dumpObject(result),
                    "Note: routeHandler.handleRequest must explicitly call reply.code/send",
                    "and return true or return a Promise which resolves to true.",
                    "This ensures that exceptions are always caught and logged properly");
              }
            }),
        (error, request, reply) => {
          reply.code(500);
          reply.send(error.message);
          outputError(mapper.wrapErrorEvent(error, new Error(`${routeHandler.name}`),
              "\n\trequest.params:", ...dumpObject(request.params),
              "\n\trequest.query:", ...dumpObject(request.query),
              "\n\trequest.body:", ...dumpObject(request.body),
          ), routeErrorMessage, mapper.getLogger());
        },
    );
    route.handler = (request, reply) => { handleRequestAndErrors(request, reply); };
    return routeHandler;
  } catch (error) {
    throw mapper.wrapErrorEvent(error, wrap, "\n\troute:", dumpify(route, { indent: 2 }));
  }
}
