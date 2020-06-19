// @flow

import { Discourse } from "~/sourcerer";

import type { VALKOptions } from "~/raem";

import VALEK, { Kuery, dumpKuery } from "~/engine/VALEK";
import Subscription from "~/engine/Vrapper/Subscription";

import { FabricEventTarget, wrapError, dumpObject } from "~/tools";


/**
 * Cog is a piece of the engine.
 * It is a base class with convenience functions for getting event notifications and executing
 * kueries against the engine.
 *
 * @export
 * @class Cog
 * @extends {FabricEventTarget}
 */
export default class Cog extends FabricEventTarget {
  VALK () { return VALEK; }

  /**
   * get - runs the kuery against current engine entry chronicle as
   *       head and returns results.
   */
  get (kuery: any, options: VALKOptions = {}) {
    try {
      options.pure = true;
      return this.run(this.getVRef(), kuery, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, "get",
          "\n\tkuery:", ...dumpKuery(kuery),
          "\n\toptions:", ...dumpObject(options));
    }
  }

  do (kuery: any, options: VALKOptions = {}) {
    try {
      return this.run(this.getVRef(), kuery, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, "do",
          "\n\tkuery:", ...dumpKuery(kuery),
          "\n\toptions:", ...dumpObject(options));
    }
  }

  run (head: any, kuery: Kuery, options: VALKOptions = {}) {
    try {
      options.scope = options.scope ? Object.create(options.scope) : {};
      return this.getEngine().discourse.run(head, kuery, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, () => [
        `run()`,
        "\n\thead:", ...dumpObject(head),
        "\n\tkuery:", ...dumpKuery(kuery),
        "\n\toptions:", ...dumpObject(options),
      ]);
    }
  }

  acquireFabricator (name: string): Discourse {
    return this.getEngine().discourse.acquireFabricator(name);
  }

  obtainSubscription (liveOperation: any, options: ?Object, obtainDiscourse: Function, head: ?any) {
    return new Subscription(this, options, obtainDiscourse)
        .initialize(liveOperation, head);
  }

  // Implementation

  getVRef () {
    throw this.wrapErrorEvent(new Error(`not implemented`), "getVRef()");
  }

  outputStatus (output) {
    output.log(`${this.getName()}: exists`);
  }

  registerHandlers (target, handler =
      (this.eventHandlers || (this.eventHandlers = this.initializeEventHandlers()))) {
    if (Array.isArray(handler) || typeof handler === "function") return handler;
    const targetMap = target || new Map();
    for (const [rule, clause] of handler) {
      targetMap.set(rule, this.registerHandlers(targetMap.get(rule), clause));
    }
    return targetMap;
  }

  unregisterHandlers (target, handler = this.eventHandlers) {
    if (Array.isArray(handler) || typeof handler === "function") return true;
    for (const [rule, clause] of handler) {
      const targetClause = target.get(rule);
      if (this.unregisterHandlers(targetClause, clause)) target.delete(rule);
    }
    return target.size === 0;
  }

  initializeEventHandlers () {
    return extractMagicMemberEventHandlers(new Map(), this);
  }
}

const eventHandlerMatcher =
    /^on(Timed|Timeless|Event)([A-Z][_A-Z0-9]*)?($([A-Z])+|([A-Z][a-z]\w*))?$/;

export function extractMagicMemberEventHandlers (target, eventHandlerObject,
    objectRule = eventHandlerObject) {
  for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(eventHandlerObject))) {
    const listener = eventHandlerMatcher.exec(methodName);
    if (listener) {
      addEventHandler(target, [
        ...(((listener[1] !== "Event") && ["timedness", listener[1]]) || []),
        ...(((listener[2] && (listener[2] !== "ANY")) && ["type", listener[2]]) || []),
        ...(((listener[4] && (listener[4] !== "Any")) && ["typeName", listener[4]]) || []),
        ...(((listener[5] && (listener[5] !== "Any")) && ["typeName", listener[5]]) || []),
        objectRule,
        eventHandlerObject[methodName],
      ]);
    }
  }
  return target;
}

export function addEventHandler (target, [rule, ...rest]) {
  if (!rule) return addEventHandler(target, rest);
  if (typeof rule === "function") return rule;
  if (typeof rule === "string") {
    const targetMap = target || new Map();
    const targetClause = targetMap.get(rule);
    targetMap.set(rule, addEventHandler(targetClause, rest));
    return targetMap;
  }
  return [rule, addEventHandler(null, rest)];
}

export function executeHandlers (rule, passage, story, handlerObject, objectsHandled = new Set()) {
  let currentRuleDebugInfo;
  try {
    if (!rule) return false;
    if (typeof rule === "function") {
      currentRuleDebugInfo = rule;
      const handled = rule.call(handlerObject, passage, story);
      if (handled || typeof handled === "undefined") objectsHandled.add(handlerObject);
      return handled || typeof handled === "undefined";
    }
    if (Array.isArray(rule)) {
      if (!objectsHandled.has(rule[0])) {
        currentRuleDebugInfo = rule;
        return executeHandlers(rule[1], passage, story, rule[0], objectsHandled);
      }
    } else {
      let promises;
      for (const [clause, subRule] of rule) {
        currentRuleDebugInfo = [clause, passage[clause]];
        const handled = (typeof clause !== "string"
            // Non-string clause is straight-up used as a handler object.
            ? executeHandlers(subRule, passage, story, clause, objectsHandled)
            // A string clause (like "id" or "typeName") picks the corresponding selector from
            // passage, which is then used to select the one matching rule from subRules.
            : executeHandlers(
                subRule.get(passage[clause]), passage, story, handlerObject, objectsHandled));
        if (handled) {
          if (handlerObject) return handled;
          if (typeof handled === "object") {
            if (Array.isArray(handled)) (promises || (promises = [])).push(...handled);
            else (promises || (promises = [])).push(handled);
          }
        }
      }
      return promises;
    }
  } catch (error) {
    throw wrapError(error, `During executeHandlers())\n .executeHandlers(), with:`,
        "\n\tcurrentRule:", ...dumpObject(currentRuleDebugInfo));
  }
  return false;
}
