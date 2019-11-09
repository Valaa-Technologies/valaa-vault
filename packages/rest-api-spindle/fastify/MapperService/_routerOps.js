// @flow

import { asyncConnectToPartitionsIfMissingAndRetry } from "~/raem/tools/denormalized/partitions";

import { dumpify, dumpObject, outputError, thenChainEagerly } from "~/tools";

import * as projectorCreators from "../handlers";

const FastifySwaggerPlugin = require("fastify-swagger");
const FastifyCookiePlugin = require("fastify-cookie");

export function _createPrefixRouter (rootService, prefix, {
  openapi, swaggerPrefix, schemas, routes, identity, sessionDuration, ...pluginOptions
}) {
  const ret = Object.create(rootService);
  ret.getRoutePrefix = () => prefix;
  ret.getSessionDuration = () => (sessionDuration || rootService.getSessionDuration());
  ret.getIdentity = () => identity;

  // FIXME(iridian, 2019-11): testing.

  // Create handlers for all routes before trying to register.
  // At this stage neither schema nor fastify is available for the
  // handlers.
  const projectors = routes.map(route => _createProjector(ret, route)).filter(r => r);
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
      `${prefix}: preparing ${projectors.length} projectors`,
    ]);
    await Promise.all(projectors.map(projector => projector.prepare && projector.prepare(fastify)));
    ret.infoEvent(1, () => [
      `${prefix}: preloading ${projectors.length} projectors`,
    ]);
    await Promise.all(projectors.map(projector => projector.preload && projector.preload(fastify)));
    ret.infoEvent(1, () => [
      `${prefix}: adding ${projectors.length} fastify routes`,
    ]);
    projectors.forEach(projector => fastify.route(_fastifyRouteOptions(ret, projector)));
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

function _createProjector (router, route) {
  const wrap = new Error(
      `createProjector(${route.category} ${route.method} ${route.url})`);
  try {
    if (!route.url) throw new Error(`Route url undefined`);
    if (!route.category) throw new Error(`Route category undefined`);
    if (!route.method) throw new Error(`Route method undefined`);
    if (!route.config) throw new Error(`Route config undefined`);
    const createProjector = (projectorCreators[route.category] || {})[route.method];
    if (!createProjector) {
      throw new Error(`No projector found for '${route.category} ${route.method}'`);
    }
    const projector = createProjector(router, route);
    if (projector == null) return undefined;
    if (!projector.name) projector.name = `${route.category} ${route.method} ${route.url}`;
    projector.route = route;
    return projector;
  } catch (error) {
    throw router.wrapErrorEvent(error, wrap,
        "\n\troute:", dumpify(route, { indent: 2 }));
  }
}

function _fastifyRouteOptions (router, projector) {
  return {
    ...projector.route,
    handler: _wrapHandler(router, projector),
  };
}

function _wrapHandler (router, projector) {
  const routeErrorMessage = `Exception caught during: ${projector.name}`;
  const handleRequestAndErrors = asyncConnectToPartitionsIfMissingAndRetry(
      (request, reply) => thenChainEagerly(
          projector.handler(request, reply),
          result => {
            if (result !== true) {
              throw router.wrapErrorEvent(
                  new Error("INTERNAL SERVER ERROR: invalid route handler return value"),
                  new Error(`handler return value validator`),
                  "\n\treturn value:", ...dumpObject(result),
                  "Note: projector.handler must explicitly call reply.code/send",
                  "and return true or return a Promise which resolves to true.",
                  "This ensures that exceptions are always caught and logged properly");
            }
          }),
      (error, request, reply) => {
        reply.code(500);
        reply.send(error.message);
        outputError(router.wrapErrorEvent(error, new Error(`${projector.name}`),
            "\n\trequest.params:", ...dumpObject(request.params),
            "\n\trequest.query:", ...dumpObject(request.query),
            "\n\trequest.body:", ...dumpObject(request.body),
        ), routeErrorMessage, router.getLogger());
      },
  );
  return (request, reply) => { handleRequestAndErrors(request, reply); };
}
