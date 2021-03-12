// @flow

import { disjoinVPlotOutline } from "~/plot";
import { patchWith } from "~/tools";

import { ObjectSchema, StringType, IdValOSType } from "./types";

import * as projectors from "~/web-spindle/projectors";

export function _setupRoute (route, userConfig, globalRules) {
  _prepareRoute(route, userConfig);
  return _finalizeRoute(route, userConfig, globalRules);
}

export function _prepareRoute (route, userConfig) {
  const category = projectors[route.category];
  if (!category) {
    throw new Error(`No such category '${route.category}' for route: ${_routeName(route)}`);
  }
  const handler = category[route.method];
  if (!handler) {
    throw new Error(`No such method '${route.method}' in category '${
        route.category}' for route: ${_routeName(route)}`);
  }
  const { requiredRules, valueAssertedRules, runtimeRules } = handler();
  if (!route.config) route.config = {};
  if (!route.config.schema) route.config.schema = {};
  if (!route.config.rules) route.config.rules = {};
  (route.config.requiredRules || (route.config.requiredRules = [])).push(...(requiredRules || []));
  (route.config.runtimeRules || (route.config.runtimeRules = [])).push(...(runtimeRules || []));
  if (valueAssertedRules) {
    (route.config.valueAssertedRules || (route.config.valueAssertedRules = []))
        .push(...valueAssertedRules);
  }
  route.config = patchWith(
      route.config, userConfig, { spreaderKey: "...", deleteUndefined: true  });
  route.schema = route.config.schema;
  delete route.config.schema;
}

export function _finalizeRoute (route, userConfig, globalRules) {
  _assignRulesFrom(globalRules, route, route.config.rules);
  for (const ruleName of (route.config.enabledWithRules || [])) {
    if (route.config.rules[ruleName] === undefined) return undefined;
  }
  for (const [key, rule] of Object.entries(route.config.rules)) {
    route.config.rules[key] = disjoinVPlotOutline(rule);
  }
  for (const ruleName of [].concat(
      route.config.requiredRules || [],
      route.config.valueAssertedRules || [])) {
    if (route.config.rules[ruleName] === undefined) {
      throw new Error(`Required route rule '${ruleName}' missing for ${_routeName(route)}`);
    }
  }
  if (route.config.querystring) route.schema.querystring = route.config.querystring;
  return route;
}

function _assignRulesFrom (
    ruleSource: Object,
    routeToExtract: { name: string, category: string, method: string, mappingName: string },
    rules = {}) {
  if (!ruleSource) return rules;
  const {
    "&ofName": ofName,
    "&ofCategory": ofCategory,
    "&ofMethod": ofMethod,
    "&ofResource": ofResource,
    "&ofRelation": ofRelation,
    ...rest
  } = ruleSource;
  Object.assign(rules, rest);
  if ((ofName || {})[routeToExtract.name]) {
    _assignRulesFrom(ofName[routeToExtract.name], routeToExtract, rules);
  }
  if ((ofCategory || {})[routeToExtract.category]) {
    _assignRulesFrom(ofCategory[routeToExtract.category], routeToExtract, rules);
  }
  if ((ofMethod || {})[routeToExtract.method]) {
    _assignRulesFrom(ofMethod[routeToExtract.method], routeToExtract, rules);
  }
  const resourceName = ((routeToExtract.config || {}).resource || {}).name;
  if ((ofResource || {})[resourceName]) {
    _assignRulesFrom(ofResource[resourceName], routeToExtract, rules);
  }
  const relationName = ((routeToExtract.config || {}).relation || {}).name;
  if ((ofRelation || {})[relationName]) {
    _assignRulesFrom(ofRelation[relationName], routeToExtract, rules);
  }
  return rules;
}

export function _routeName (route) {
  return `${route.category}: ${route.method} <${route.url}>`;
}

const _unreservedWordListPattern = "^([a-zA-Z0-9\\-_.~/*$]*(\\,([a-zA-Z0-9\\-_.~/*$])*)*)?$";
const _unreservedSortListPattern = "^(\\-?[a-zA-Z0-9_.~/$]*(\\,\\-?([a-zA-Z0-9_.~/$])*)*)?$";

export function _genericGETResourceQueryStringSchema (/* Type */) {
  return {
    fields: { ...StringType,
      pattern: _unreservedWordListPattern,
    },
  };
}

export function _resourceSequenceQueryStringSchema (resourceType) {
  const ret = {
    offset: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 0 },
    sort: { ...StringType, pattern: _unreservedSortListPattern },
    ids: { ...StringType, pattern: _unreservedWordListPattern },
  };
  for (const [key, schema] of Object.entries(resourceType)) {
    if (((schema[ObjectSchema] || {}).valospace || {}).filterable) {
      ret[`require-${key}`] = IdValOSType;
    }
  }
  return ret;
}
