// @flow

import Vrapper from "~/engine/Vrapper";

import { dumpify, dumpObject } from "~/tools";

import { _vakonpileVPath } from "./_vakonpileOps";

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

  Object.entries(config.rules).forEach(([ruleName, rule]) => {
    if (!Array.isArray(rule)) {
      scopeBase[ruleName] = rule;
      return;
    }
    const ruleVAKON = _vakonpileVPath(rule, runtime);
    const maybeStaticReference = (ruleVAKON != null) && (ruleVAKON[0] === "§ref")
        && !ruleVAKON[1].slice(1).find(e => Array.isArray(e))
        && ruleVAKON[1].slice(1);
    const resolveRule = maybeStaticReference ? (engine => engine.getVrapper(maybeStaticReference))
        : (ruleVAKON !== null) ? ((engine, head, options) => engine.run(head, ruleVAKON, options))
        : (engine, head) => head;
    if (ruleName === "routeRoot") {
      runtime.resolveRouteRoot = resolveRule;
    } else {
      runtime.ruleResolvers.push([ruleName, resolveRule, true]);
    }
  });
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
    const activations = runtime.staticResources
        .map(staticResource => mapper.getEngine().getVrapper(staticResource).activate())
        .filter(e => e);
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
  return valkOptions;
}

export function _resolveRuntimeRules (mapper, runtime, valkOptions) {
  const scope = valkOptions.scope;
  // TODO: create transaction here.
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
  return false; // Success.
}
