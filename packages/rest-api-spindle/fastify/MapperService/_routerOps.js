// @flow

import { asyncConnectToPartitionsIfMissingAndRetry } from "~/raem/tools/denormalized/partitions";

import { dumpify, dumpObject, isPromise, outputError, thenChainEagerly } from "~/tools";

import * as projectorCreators from "../handlers";

const FastifySwaggerPlugin = require("fastify-swagger");
const FastifyCookiePlugin = require("fastify-cookie");

export function _createPrefixRouter (rootService, prefix, prefixConfig) {
  const frameError = new Error(`createPrefixRouter(<${prefix}>)`);
  const ret = Object.create(rootService);
  const {
    openapi, swaggerPrefix, schemas, routes, identity, sessionDuration, ...pluginOptions
  } = ret._config = prefixConfig;
  ret.setName(prefix);
  ret._identity = Object.assign(Object.create(rootService._identity || {}), identity || {});

  ret.getRoutePrefix = () => prefix;
  ret.getSessionDuration = () => (sessionDuration || rootService.getSessionDuration());
  ret.getIdentity = () => ret._identity;

  // Create the projectors for all routes before trying to register.
  // At this stage neither schema nor fastify is available for the
  // handlers.
  ret._projectors = routes.map(route => _createProjector(ret, route)).filter(r => r);

  let resolvePreparationDone;
  ret._preparationDone = new Promise(resolve => { resolvePreparationDone = resolve; });

  // https://github.com/fastify/fastify/blob/master/docs/Server.md
  rootService.getRootFastify()
  .register((routerFastify, opts, next) => {
    ret._fastify = routerFastify;
    routerFastify.register(FastifyCookiePlugin);
    if (swaggerPrefix) {
      routerFastify.register(FastifySwaggerPlugin, {
        routePrefix: swaggerPrefix,
        exposeRoute: true,
        swagger: openapi,
      });
    }
    ret.infoEvent(1, () => [
      `${prefix}: adding ${schemas.length} schemas:`,
      ...schemas.map(schema => schema.schemaName),
    ]);
    for (const schema of schemas) routerFastify.addSchema(schema);
    ret.infoEvent(1, () => [
      `${prefix}: preparing ${ret._projectors.length} projectors`,
    ]);
    for (const projector of ret._projectors) {
      const options = {};
      try {
        if (projector.prepare && isPromise(projector.prepare(options))) {
          throw new Error(`Projector prepare must not be async for ${
              ret._projectorName(projector)}`);
        }
      } catch (error) {
        const wrappedError = ret.wrapErrorEvent(error,
            new Error(`prepare(${ret._projectorName(projector)})`),
                "\n\tprojector:", dumpify(projector, { indent: 2 }),
                "\n\tprojector.config:", dumpify(projector.config),
                "\n\tprojector.runtime:", dumpify(projector.runtime, { indent: 2 }),
                "\n\toptions:", ...dumpObject(options),
        );
        errorOnCreatePrefixRouter(wrappedError);
        throw wrappedError;
      }
    }
    ret.infoEvent(1, () => [
      `${prefix}: projector preparation done, returning`,
      "\n\tinitialization waiting for view to load to proceed",
    ]);
    thenChainEagerly(
        new Promise(resolve => resolvePreparationDone(resolve)),
        () => routerFastify.ready(err => {
          if (err) throw err;
          ret.infoEvent(1, () => [
            `${prefix}: projector fastify plugin ready, exposing swagger`,
          ]);
          routerFastify.swagger();
        }));
    next(); // Always install other plugins
  }, {
    prefix,
    ...pluginOptions,
  }).ready(error => {
    if (error) {
      errorOnCreatePrefixRouter(error);
      throw error;
    }
  });
  return ret;
  function errorOnCreatePrefixRouter (error) {
    ret.outputErrorEvent(ret.wrapErrorEvent(error, frameError,
        "\n\tplugin options:", ...dumpObject(pluginOptions),
    ), `Exception intercepted during createPrefixRouter(<${prefix}>)`);
  }
}

export async function _projectPrefixRoutesFromView (router, view, viewName) {
  router._view = view;
  router._engine  = view.engine;
  router._viewName = viewName;
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: projecting from view ${viewName}`,
  ]);
  const resolveProjectionsDone = await router._preparationDone;
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: preparation done and view attached; preloading ${
        router._projectors.length} projectors`,
  ]);
  await Promise.all(router._projectors.map(projector =>
      projector.preload && projector.preload(router._fastify)));
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: adding ${router._projectors.length} fastify routes`,
  ]);
  router._projectors.forEach(projector =>
      router._fastify.route(_fastifyRouteOptions(router, projector)));
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: ${router._projectors.length} projectors ready`,
  ]);

  resolveProjectionsDone();
  return {
    success: true,
    prefix: router.getRoutePrefix(),
    routes: router._projectors.length,
  };
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
    if (!projector.name) projector.name = router._routeName(route);
    projector.route = route;
    projector.config = route.config;
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
