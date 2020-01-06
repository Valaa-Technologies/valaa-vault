// @flow

import Vrapper from "~/engine/Vrapper";

import type { PrefixRouter } from "~/web-spindle/MapperService";

import { dumpObject, thenChainEagerly } from "~/tools";

import { _vakonpileVPath } from "./_vakonpileOps";

export function _createProjectorRuntime (
    router: PrefixRouter, { name, config }, route, runtime) {
  for (const ruleName of (config.requiredRules || [])) {
    if (config.rules[ruleName] === undefined) {
      throw new Error(`Required route rule '${ruleName}' missing for route <${route.url}>`);
    }
  }
  for (const ruleName of (config.valueAssertedRules || [])) {
    if (config.rules[ruleName] === undefined) {
      throw new Error(`Required runtime route rule '${ruleName}' missing for route <${route.url}>`);
    }
  }
  runtime.name = name;
  runtime.route = route;
  runtime.rulePresolvers = [];
  runtime.staticResources = [];
  runtime.resolvers = {};
  runtime.identity = router.getIdentity();

  const scopePreparations = runtime.scopePreparations = {};

  Object.entries(config.rules).forEach(([ruleName, rule]) => {
    if (!Array.isArray(rule)) {
      scopePreparations[ruleName] = rule;
      return;
    }
    let ruleVAKON, maybeStaticReference, resolveRule;
    try {
      ruleVAKON = _vakonpileVPath(rule, runtime);
      if (ruleVAKON[0] === "§'" && !Array.isArray(ruleVAKON[1])) {
        scopePreparations[ruleName] = ruleVAKON[1];
        return;
      }
      maybeStaticReference = (ruleVAKON != null) && (ruleVAKON[0] === "§ref")
          && !ruleVAKON[1].slice(1).find(e => Array.isArray(e))
          && ruleVAKON[1].slice(1);
      resolveRule = (ruleVAKON === null)
              ? (engine, head) => head
          : maybeStaticReference
              ? (engine => engine.getVrapper(maybeStaticReference, { contextChronicleURI: null }))
          : ((engine, head, options) => engine.run(head, ruleVAKON, options));
      const requiredAtRuntime = (config.valueAssertedRules || []).indexOf(ruleName) !== -1;
      if (ruleName === "routeRoot") {
        runtime.resolveRouteRoot = resolveRule;
      } else if ((config.runtimeRules || []).indexOf(ruleName) !== -1) {
        runtime.resolvers[ruleName] = [resolveRule, requiredAtRuntime];
      } else {
        runtime.rulePresolvers.push([ruleName, resolveRule, requiredAtRuntime]);
      }
    } catch (error) {
      throw router.wrapErrorEvent(error, new Error(`prepareRule(${ruleName})`),
          "\n\trule:", ...dumpObject(rule),
          "\n\truleVAKON:", ...dumpObject(ruleVAKON),
          "\n\tmaybeStaticReference:", ...dumpObject(maybeStaticReference),
      );
    }
  });
  return runtime;
}

export async function _preloadRuntimeResources (router: PrefixRouter, projector, runtime) {
  let vRouteRoot;
  try {
    runtime.scopeBase = Object.assign(
        Object.create(router.getViewScope()),
        runtime.scopePreparations);

    runtime.scopeBase.serviceIndex = router.getViewFocus();
    if (runtime.scopeBase.serviceIndex === undefined) {
      throw new Error(`Can't locate service index for ${router._projectorName(projector)}`);
    }

    if (!runtime.resolveRouteRoot) {
      throw new Error(`Route root rule 'routeRoot' missing for ${
          router._projectorName(projector)}`);
    }
    vRouteRoot = runtime.scopeBase.routeRoot = runtime.resolveRouteRoot(
        router.getEngine(), runtime.scopeBase.serviceIndex, { scope: runtime.scopeBase });
    if (!(vRouteRoot instanceof Vrapper)) {
      throw new Error(`Route root is not a resource for ${router._projectorName(projector)}`);
    }
    router.infoEvent(1, () => [`Preloading projector ${router._projectorName(projector)}`,
        "; activating", runtime.staticResources.length, "static rule resources and root",
        vRouteRoot.debugId()]);
    const rootActivation = vRouteRoot.activate();
    if (rootActivation) await rootActivation;
    const activations = runtime.staticResources
        .map(staticResource => router.getEngine()
            .getVrapper(staticResource, { contextChronicleURI: null }).activate())
        .filter(e => e);
    await Promise.all(activations);
    router.infoEvent(1, () => ["Done preloading projector:", router._projectorName(projector),
        (rootActivation
            ? "\n\twaited for route root activation:"
            : "\n\troute root already active:"), ...dumpObject(vRouteRoot.debugId()),
        "\n\twaited for", activations.length, `static resource activations (${
          runtime.staticResources.length - activations.length} were already active})`]);
  } catch (error) {
    throw router.wrapErrorEvent(error, new Error(`preloadRuntimeResources(${
            router._projectorName(projector)})`),
        "\n\tvRouteRoot:", ...dumpObject(vRouteRoot),
        "\n\tconfig.rules:", JSON.stringify(projector.config.rules, null, 2),
    );
  }
}

export function _buildRuntimeVALKOptions (
    router: PrefixRouter, projector, runtime, request, reply) {
  const scope = Object.create(runtime.scopeBase);
  const valkOptions = { scope };
  scope.request = request;
  scope.reply = reply;
  return valkOptions;
}

export function _resolveToScope (router: PrefixRouter, resolveHead: any, valkOptions: Object,
    scopeKey: string, resolveRule: Function, requiredAtRuntime: boolean | Function) {
  const scope = valkOptions.scope;
  scope[scopeKey] = thenChainEagerly(resolveHead, [
    head => resolveRule(router.getEngine(), head, Object.create(valkOptions)),
    resolution => (scope[scopeKey] = resolution),
  ]);
  if (!requiredAtRuntime || (scope[scopeKey] !== undefined)) return true;
  if (typeof requiredAtRuntime === "function") {
    return requiredAtRuntime(scopeKey, router.getEngine(), resolveHead, valkOptions);
  }
  scope.reply.code(400);
  scope.reply.send(`Required route runtime rule '${scopeKey}' resolved into undefined`);
  return false;
}
