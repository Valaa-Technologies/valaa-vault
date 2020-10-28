// @flow

import { asyncSourcerChronicleIfAbsentAndRetry } from "~/raem/tools/denormalized/partitions";

import {
  SessionExpiredError, clearReplySessionAndClientCookies,
} from "~/web-spindle/tools/session";

import { dumpify, dumpObject, isPromise, outputError, thenChainEagerly } from "~/tools";

const FastifySwaggerPlugin = require("fastify-swagger");
const FastifyCookiePlugin = require("fastify-cookie");

export function _createPrefixRouter (rootService, prefix, prefixConfig) {
  const frameError = new Error(`createPrefixRouter(<${prefix}>)`);
  const prefixRouter = Object.create(rootService);
  const {
    openapi, swaggerPrefix, schemas, routes, identity, sessionDuration, ...pluginOptions
  } = prefixRouter._config = prefixConfig;
  prefixRouter.setName(prefix);
  prefixRouter._identity = Object.assign(
      Object.create(rootService._identity || {}),
      identity || {});
  prefixRouter._sessionDuration = sessionDuration;

  prefixRouter.getRoutePrefix = () => prefix;
  prefixRouter.getSessionDuration = () =>
      (prefixRouter._sessionDuration || rootService.getSessionDuration());
  prefixRouter.tryIdentity = () => prefixRouter._identity;
  prefixRouter.getIdentity = () => {
    if (!prefixRouter._identity) throw new Error("Router identity not configured");
    return prefixRouter._identity;
  };

  // Create the projectors for all routes before trying to register.
  // At this stage neither schema nor fastify is available for the
  // handlers.
  prefixRouter._projectors = routes
      .map(route => prefixRouter.createRouteProjector(route))
      .filter(r => r);

  let whenProjectorsPrepared;
  prefixRouter._whenProjectorsPrepared = new Promise((resolve, reject) =>
      (whenProjectorsPrepared = { resolve, reject }));

  // https://github.com/fastify/fastify/blob/master/docs/Server.md
  rootService.getRootFastify()
  .register((routerFastify, opts, next) => {
    prefixRouter._fastify = routerFastify;
    try {
      routerFastify.register(FastifyCookiePlugin);
      if (swaggerPrefix) {
        routerFastify.register(FastifySwaggerPlugin, {
          routePrefix: swaggerPrefix,
          exposeRoute: true,
          swagger: openapi,
        });
      }

      _addSchemas(prefixRouter, schemas || []);
      _prepareProjectors(prefixRouter);
      _attachProjectorFastifyRoutes(prefixRouter);

      prefixRouter.infoEvent(1, () => [
        `${prefix}: preparing the projectors and attaching their fastify routes done`,
        "\n\tinitialization now waiting for view to load to proceed",
      ]);
      thenChainEagerly(
          new Promise(resolve => whenProjectorsPrepared.resolve(resolve)),
          () => routerFastify.ready(err => {
            if (err) throw err;
            prefixRouter.infoEvent(1, () => [
              `${prefix}: projector fastify plugin ready, exposing swagger`,
            ]);
            if (swaggerPrefix) {
              routerFastify.swagger();
            }
          }));
    } catch (error) {
      errorOnCreatePrefixRouter(error);
      whenProjectorsPrepared.reject(error);
    }
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
  return prefixRouter;
  function errorOnCreatePrefixRouter (error) {
    prefixRouter.outputErrorEvent(prefixRouter.wrapErrorEvent(error, 1, frameError,
        "\n\tplugin options:", ...dumpObject(pluginOptions),
    ), `Exception intercepted during createPrefixRouter(<${prefix}>)`);
  }
}

function _addSchemas (router, schemas) {
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: adding ${schemas.length} schemas:`,
    ...schemas.map(schema => schema.schemaName),
  ]);
  for (const schema of schemas) {
    try {
      router._fastify.addSchema(schema);
    } catch (error) {
      throw router.wrapErrorEvent(error, 1,
          new Error(`_addSchemas(${schema.schemaName})`),
          "\n\tschema:", dumpify(schema, { indent: 2 }));
    }
  }
}

function _prepareProjectors (router) {
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: preparing ${router._projectors.length} projectors`,
  ]);
  for (const projector of router._projectors) {
    try {
      if (projector.prepare && isPromise(projector.prepare())) {
        throw new Error(`Projector prepare must not be async for ${
          router._projectorName(projector)}`);
      }
      projector._whenReady = new Promise(resolve => (projector._resolveWhenReady = resolve));
    } catch (error) {
      throw router.wrapErrorEvent(error, 1,
          new Error(`prepare(${router._projectorName(projector)})`),
              "\n\tprojector:", dumpify(projector, { indent: 2 }),
              "\n\tprojector.config:", dumpify(projector.config),
      );
    }
  }
}

function _attachProjectorFastifyRoutes (router) {
  router.infoEvent(1, () => [
    `${router.getRoutePrefix()}: attaching ${router._projectors.length} fastify routes`,
  ]);
  router._projectors.forEach(projector => {
    let fastifyRoute;
    try {
      projector.smartHandler = _createSmartHandler(router, projector);
      fastifyRoute = { ...projector.route, handler: projector.smartHandler };
      router._fastify.route(fastifyRoute);
    } catch (error) {
      throw router.wrapErrorEvent(error, 1,
          new Error(`_attachProjectorFastifyRoute(${router._projectorName(projector)})`),
          "\n\tfastifyRoute:", dumpify(fastifyRoute, { indent: 2 }),
      );
    }
  });
}

function _createSmartHandler (router, projector) {
  return asyncSourcerChronicleIfAbsentAndRetry(
      (request, reply, ...rest) => thenChainEagerly(projector._whenReady, [
        function _handleRequest (readiness) {
          if (readiness === true) return projector.handler(request, reply, ...rest);
          throw (readiness || new Error("Route failed to initialize"));
        },
        function _validateRequestResult (result) {
          if (result !== true) {
            const error = new Error("INTERNAL ERROR: invalid route handler return value");
            throw router.wrapErrorEvent(error, 0,
                new Error(`handler return value validator`),
                "\n\treturn value:", ...dumpObject(result),
                "\n\tNote: projector.handler must explicitly call reply.code/send",
                "and return true or return a Promise which resolves to true.",
                "This ensures that exceptions are always caught and logged properly");
          }
        },
      ]),
      (error, request, reply) => thenChainEagerly(null,
          function _checkSessionExpiry () {
            if (error instanceof SessionExpiredError) {
              return _handleExpiredSessionRequest(error, request, reply);
            }
            throw error;
          },
          function _deliverError (actualError) {
            if (!reply.statusCode) reply.code(500);
            if (!reply.sent) reply.send(actualError.message);
            if (!router.getVerbosity() && (reply.statusCode < 500)) {
              router.warnEvent(`Exception caught during projector: ${projector.name}:`,
                  reply.statusCode, actualError.message);
            } else {
              outputError(router.wrapErrorEvent(actualError,
                      new Error(`${projector.name}`),
                      "\n\trequest.params:", ...dumpObject(request.params),
                      "\n\trequest.query:", ...dumpObject(request.query),
                      "\n\trequest.cookies:", ...dumpObject(Object.keys(request.cookies || {})),
                      "\n\trequest.body:", ...dumpObject(request.body),
                      "\n\treply.statusCode:", reply.statusCode),
                  `Exception caught during projector: ${projector.name}`,
                  router);
            }
          }));
  function _handleExpiredSessionRequest (expiryError, request, reply) {
    const {
      timeStamp, identityChronicle, clientRedirectPath, expiryRedirectPath,
    } = expiryError.sessionPayload;
    if (projector.runtime.scopeBase.autoRefreshSession) {
      const refreshSessionProjector = router.getRefreshSessionProjector();
      if (!refreshSessionProjector) {
        throw new Error("Session auto-refresh requested but no refresh session route configured");
      }
      return thenChainEagerly(null, [
        function _refreshSession () {
          return refreshSessionProjector.handler(request, reply, true);
        },
        function _retryRequestWithRefreshedSession () {
          return !reply.sent && projector.smartHandler(request, reply);
        },
      ]);
    }
    clearReplySessionAndClientCookies(router, reply, clientRedirectPath);
    if (expiryRedirectPath) {
      reply.code(303);
      reply.redirect(expiryRedirectPath);
    } else {
      reply.code(401);
      reply.send("Session has expired, please relogin");
    }
    router.logEvent(1, () => [
      "Session expired (ms):", Date.now(),
          ">=", timeStamp * 1000, router.getSessionDuration() * 1000,
      "\n\tpayload:", timeStamp, identityChronicle,
      "\n\treply code:", reply.statusCode,
      ...(!expiryRedirectPath ? [] : ["\n\tredirect:", expiryRedirectPath]),
    ]);
    return undefined;
  }
}

export async function _projectPrefixRoutesFromView (router, view, viewName) {
  router._view = view;
  router._engine = view.getEngine();
  router._viewName = viewName;
  (view.prefixRouters || (view.prefixRouters = {}))[router.getRoutePrefix()] = router;
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
          (ret = router.wrapErrorEvent(error, 1,
              new Error(`preload(${projector.name})`),
          )),
          `Exception caught during preload(${projector.name})`,
          router);
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
