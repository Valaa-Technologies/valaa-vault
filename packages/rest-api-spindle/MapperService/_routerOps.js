// @flow

import { asyncConnectToPartitionsIfMissingAndRetry } from "~/raem/tools/denormalized/partitions";

import { dumpify, dumpObject, isPromise, outputError, thenChainEagerly } from "~/tools";

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
  ret._projectors = routes
      .map(route => ret.createRouteProjector(route))
      .filter(r => r);

  let resolveWhenProjectorsPrepared;
  ret._whenProjectorsPrepared = new Promise(resolve => (resolveWhenProjectorsPrepared = resolve));

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

    _addSchemas(ret, schemas);
    _prepareProjectors(ret, errorOnCreatePrefixRouter);
    _attachProjectorFastifyRoutes(ret);

    ret.infoEvent(1, () => [
      `${prefix}: preparing the projectors and attaching their fastify routes done`,
      "\n\tinitialization now waiting for view to load to proceed",
    ]);
    thenChainEagerly(
        new Promise(resolve => resolveWhenProjectorsPrepared(resolve)),
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

function _addSchemas (router, schemas) {
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: adding ${schemas.length} schemas:`,
    ...schemas.map(schema => schema.schemaName),
  ]);
  for (const schema of schemas) router._fastify.addSchema(schema);
}

function _prepareProjectors (router, errorOnCreatePrefixRouter) {
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: preparing ${router._projectors.length} projectors`,
  ]);
  for (const projector of router._projectors) {
    const options = {};
    try {
      if (projector.prepare && isPromise(projector.prepare(options))) {
        throw new Error(`Projector prepare must not be async for ${
          router._projectorName(projector)}`);
      }
      projector._whenReady = new Promise(resolve => (projector._resolveWhenReady = resolve));
    } catch (error) {
      const wrappedError = router.wrapErrorEvent(error,
          new Error(`prepare(${router._projectorName(projector)})`),
              "\n\tprojector:", dumpify(projector, { indent: 2 }),
              "\n\tprojector.config:", dumpify(projector.config),
              "\n\tprojector.runtime:", dumpify(projector.runtime, { indent: 2 }),
              "\n\toptions:", ...dumpObject(options),
      );
      errorOnCreatePrefixRouter(wrappedError);
      throw wrappedError;
    }
  }
}

function _attachProjectorFastifyRoutes (router) {
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: attaching ${router._projectors.length} fastify routes`,
  ]);
  for (const projector of router._projectors) {
    router._fastify.route({
      ...projector.route,
      handler: asyncConnectToPartitionsIfMissingAndRetry(
          (request, reply) => thenChainEagerly(
              projector._whenReady,
              readiness => {
                if (readiness === true) return projector.handler(request, reply);
                throw (readiness || new Error("route failed to initialize"));
              },
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
            outputError(
                router.wrapErrorEvent(error,
                    new Error(`${projector.name}`),
                    "\n\trequest.params:", ...dumpObject(request.params),
                    "\n\trequest.query:", ...dumpObject(request.query),
                    "\n\trequest.body:", ...dumpObject(request.body),
                ),
                `Exception caught during projector: ${projector.name}`,
                router.getLogger());
          },
      )
    });
  }
}

export async function _projectPrefixRoutesFromView (router, view, viewName) {
  router._view = view;
  router._engine  = view.engine;
  router._viewName = viewName;
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: projecting from view ${viewName}`,
  ]);
  const resolveProjectionsDone = await router._whenProjectorsPrepared;
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: preparation done and view attached`,
    `\n\tpreloading ${router._projectors.length} projectors`,
  ]);
  const preloadedProjectors = await Promise.all(router._projectors.map(async projector => {
    let ret;
    try {
      if (projector.preload) {
        await projector.preload(router._fastify);
      }
      ret = true;
    } catch (error) {
      router.outputErrorEvent(
          (ret = router.wrapErrorEvent(
              error,
              new Error(`preload(${projector.name})`),
          )),
          `During preload(${projector.name})`,
          router.getLogger());
    }
    projector._resolveWhenReady(ret);
    projector._whenReady = ret;
    return projector;
  }));
  const failedProjectors = preloadedProjectors.filter(projector => (projector._whenReady !== true));
  const readyProjectors = preloadedProjectors.filter(projector => (projector._whenReady === true));
  if (failedProjectors.length) {
    router.errorEvent(1, () => [
      `${router.getRoutePrefix()}: ${failedProjectors.length} PROJECTORS FAILED TO PRELOAD:`,
      ...[].concat(failedProjectors.map(projector => [
        `\n\t${projector.name}:`, projector._whenReady.message,
      ])),
    ]);
    if (!readyProjectors.length) throw new Error("Aborting: all projectors failed to preload");
    router.warnEvent(1, () => [
      `${router.getRoutePrefix()}: ${
        readyProjectors.length} projectors out of ${router._projectors.length} ready`,
    ]);
  } else {
    router.infoEvent(1, () => [
      `${router.getRoutePrefix()}: all ${router._projectors.length} projectors ready`,
    ]);
  }
  resolveProjectionsDone();
  return {
    success: true,
    prefix: router.getRoutePrefix(),
    routes: router._projectors.length,
    readyProjectors: readyProjectors.map(p => p.name),
    failedProjectors: failedProjectors.map(p => p.name),
  };
}
