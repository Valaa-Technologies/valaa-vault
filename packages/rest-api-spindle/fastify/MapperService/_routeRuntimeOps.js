// @flow

import Vrapper from "~/engine/Vrapper";

import { dumpify, dumpObject } from "~/tools";

export function _createRouteRuntime (mapper, { url, config }, runtime) {
  for (const ruleName of config.requiredRules) {
    if (config.rules[ruleName] === undefined) {
      throw new Error(`Required route rule '${ruleName}' missing for route <${url}>`);
    }
  }
  const scopeBase = runtime.scopeBase = {};
  runtime.ruleResolvers = [];
  runtime.staticResources = [];
  runtime.identity = mapper.getIdentity();

  Object.assign(routeRuntime, {
    category, method, url: fastifyRoute.url,
    fastifyRoute,
    scopeBase: { ...(fastifyRoute.config.staticRules || {}) },
    requestRules: [],
    // kueryRules: [],
    requiredRuntimeRules: requiredRuntimeRules || [],
  });
  [..._entriesOf(builtinRules || {}),
    ..._entriesOf(fastifyRoute.config.constantRules || {})
        .map(([k, v]) => ([k, ["constant", v]])),
    ..._entriesOf(fastifyRoute.config.routeRules || {})
        .map(([k, v]) => ([k, ["params", v]])),
    ..._entriesOf(fastifyRoute.config.queryRules || {})
        .map(([k, v]) => ([k, ["query", v]])),
    ..._entriesOf(fastifyRoute.config.cookieRules || {})
        .map(([k, v]) => ([k, ["cookies", v]])),
  ].forEach(([ruleName, [sourceSection, source]]) => {
    if (source === undefined) return;
    if (sourceSection === "constant") {
      routeRuntime.scopeBase[ruleName] = source;
    } else {
      routeRuntime.requestRules.push([ruleName, sourceSection, source]);
    }
  });
  // routeRuntime.kueryRules.push(..._entriesOf(fastifyRoute.config.kueryRules));
  for (const requiredRuleName of [...(requiredRules || []), ...(requiredRuntimeRules || [])]) {
    if ((routeRuntime.scopeBase[requiredRuleName] === undefined)
        && !routeRuntime.requestRules.find(([ruleName]) => (ruleName === requiredRuleName))
        // && !routeRuntime.kueryRules.find(([ruleName]) => (ruleName === requiredRuleName)
        ) {
      throw new Error(`Required ${category} ${method} rule '${requiredRuleName}' is undefined`);
    }
  }
  return runtime;
}

export async function _preloadRuntimeResources (mapper, route, runtime) {
  let vRouteRoot, vPreloads;
  try {
    runtime.scopeBase.serviceIndex = mapper.getViewFocus();
    if (runtime.scopeBase.serviceIndex === undefined) {
      throw new Error(`Can't locate service index for route: ${route.name}`);
    }

    if (!runtime.resolveRouteRoot) {
      throw new Error(`Route root rule 'toRouteRoot' missing for route: ${route.name}`);
    }
    vRouteRoot = runtime.scopeBase.routeRoot = runtime.resolveRouteRoot(
        mapper.getEngine(), runtime.scopeBase.serviceIndex, { scope: runtime.scopeBase });
    if (!(vRouteRoot instanceof Vrapper)) {
      throw new Error(`Route root is not a resource for route: ${route.name}`);
    }
    mapper.infoEvent("Preloading route ", route.name, "; activating root resource and",
        runtime.staticResources.length, "static rule resources");
    await vRouteRoot.activate();
    const activations = [];
    for (const staticResource of runtime.staticResources) {
      const vStaticResource = mapper.getEngine().getVrapper(staticResource);
      const activation = vStaticResource.activate();
      if (activation) activations.push(activation);
    }
    await Promise.all(activations);
    mapper.infoEvent("Done preloading route:", route.name,
        "\n\tactive route root:", ...dumpObject(vRouteRoot.debugId()),
        "\n\tactivated", activations.length, "static rule resources");
  } catch (error) {
    throw mapper.wrapErrorEvent(error, new Error(`preloadRuntimeResources(${route.name})`),
        "\n\tvRouteRoot:", ...dumpObject(vRouteRoot),
        "\n\ttoPreloads:", dumpify(this.toPreloads, { indent: 2 }),
        "\n\tvTargets:", ...dumpObject(vPreloads),
    );
  }
}

export function _buildRuntimeVALKOptions (mapper, route, runtime, request, reply) {
  const scope = Object.create(runtime.scopeBase);
  const valkOptions = { scope };
  scope.request = request;
  scope.reply = reply;
  for (const [ruleName, resolveRule, requireRuntimeRule] of runtime.ruleResolvers) {
    scope[ruleName] = resolveRule(mapper.getEngine(), scope.routeRoot, valkOptions);
    if (requireRuntimeRule && scope[ruleName] === undefined) {
      if (typeof requireRuntimeRule === "function") {
        requireRuntimeRule(ruleName, mapper.getEngine(), scope.routeRoot, valkOptions);
      } else {
        throw new Error(`Required route runtime rule '${ruleName
          }' unsatisfied: value resolved into undefined`);
      }
    }
  }
  return valkOptions;
}
