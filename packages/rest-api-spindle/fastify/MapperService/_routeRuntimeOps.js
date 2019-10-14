// @flow

import Vrapper from "~/engine/Vrapper";

import {
  patchWith,
} from "~/tools";

export function _createRouteRuntime (mapper, {
  category, method, fastifyRoute, builtinRules, requiredRules, requiredRuntimeRules,
}, routeRuntime) {
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
  return routeRuntime;
}

function _entriesOf (object) {
  return Array.isArray(object) ? object : Object.entries(object);
}

export async function _preloadRuntimeResources (mapper, routeRuntime) {
  const activations = [];
  routeRuntime.scopeBase = patchWith({}, routeRuntime.scopeBase, {
    preExtend: (tgt, patch) => {
      if (!Array.isArray(patch) || (patch[0] !== "~ref")) return undefined;
      const vResource = mapper.getEngine().getVrapper(patch[1]);
      const activation = vResource.activate();
      if (activation) activations.push(activation);
      return vResource;
    },
    postExtend: (tgt) => {
      if (tgt && (typeof tgt === "object") && !(tgt instanceof Vrapper)) Object.freeze(tgt);
      return tgt;
    },
  });
  await Promise.all(activations);
}

/*
function preloadVAKONRefResources (mapper, kuery, resultResources = []) {
  if ((kuery == null) || (typeof kuery !== "object")) return resultResources;
  if (!Array.isArray(kuery)) {
    Object.values(kuery).map(value => mapper.preloadVAKONRefResources(value, resultResources));
  } else if (kuery[0] !== "~ref") {
    kuery.map(value => mapper.preloadVAKONRefResources(value, resultResources));
  } else {
    const vResource = mapper.getEngine().getVrapper(kuery[1]);
    resultResources.push(vResource);
    vResource.activate();
  }
  return resultResources;
}
*/

export function _buildRuntimeScope (mapper, routeRuntime, request) {
  const { scopeBase, requiredRuntimeRules, requestRules } = routeRuntime;
  const scope = Object.create(scopeBase);
  scope.request = request;
  for (const [ruleName, sourceSection, source] of requestRules) {
    scope[ruleName] = request[sourceSection][source];
  }
  // for (const [ruleName, rule] of kueryRules) {}
  for (const ruleName of requiredRuntimeRules) {
    if (scope[ruleName] === undefined) {
      throw new Error(`scope rule '${ruleName}' resolved into undefined`);
    }
  }
  return scope;
}
