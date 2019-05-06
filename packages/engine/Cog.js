// @flow

import { Discourse } from "~/sourcerer";

import type { VALKOptions } from "~/raem";

import { transpileValoscriptBody } from "~/script/transpileValoscript";

import VALEK, { Kuery, dumpKuery } from "~/engine/VALEK";
import Subscription from "~/engine/Vrapper/Subscription";

import { LogEventGenerator, wrapError, dumpObject, thenChainEagerly } from "~/tools";


/**
 * Cog is a piece of the engine.
 * It is a base class with convenience functions for getting event notifications and executing
 * kueries against the engine.
 *
 * @export
 * @class Cog
 * @extends {LogEventGenerator}
 */
export default class Cog extends LogEventGenerator {
  constructor ({ name, engine, parent, logger, verbosity }: Object) {
    super({ name, verbosity, logger: logger || (engine && engine.getLogger()) });
    if (engine) this.engine = engine;
    if (parent) this.parent = parent;
  }

  // Public API

  setEngine (engine: Object) {
    this.engine = engine;
    if (engine && (this.getLogger() === console)) this.setLogger(engine.getLogger());
  }

  VALK () { return VALEK; }

  /**
   * get - runs the kuery against current engine entry partition as head and returns results.
   */
  get (kuery: any, options: VALKOptions) {
    return this.run(this.getSelfAsHead(), kuery, options);
  }
  do (kuery: Kuery, options: VALKOptions) {
    return this.run(this.getSelfAsHead(), kuery, options);
  }

  doValoscript (valoscriptBody: string, options: VALKOptions = {}) {
    options.discourse = this.engine.discourse.acquireTransaction("do-body");
    const ret = this.do(transpileValoscriptBody(valoscriptBody, {
      verbosity: options.verbosity || 0,
      customVALK: VALEK,
      sourceInfo: options.sourceInfo,
    }), options);
    if (options.discourse) {
      const result = options.discourse.releaseTransaction();
      if (result) {
        return thenChainEagerly(
            (options.awaitResult || (r => r.getPersistedEvent()))(result),
            () => ret);
      }
    }
    return ret;
  }

  run (head: any, kuery: Kuery, options: any = {}) {
    try {
      options.scope = options.scope ? Object.create(options.scope) : {};
      return options.obtainSubscriptionTransaction
          ? this.obtainSubscription(kuery, options, head)
          : this.engine.discourse.run(head, kuery, options);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .run(), with:`,
          "\n\thead:", ...dumpObject(head),
          "\n\tkuery:", ...dumpKuery(kuery),
          "\n\toptions:", ...dumpObject(options));
    }
  }

  acquireTransaction (name: string): Discourse {
    return this.engine.discourse.acquireTransaction(name);
  }

  obtainSubscription (liveOperation: any, options: ?Object, head: ?any) {
    return new Subscription(this, options).initialize(liveOperation, head);
  }

  // Implementation

  outputStatus (output) {
    output.log(`${this.getName()}: exists`);
  }

  getSelfAsHead () {
    throw this.wrapErrorEvent(new Error(`not implemented`), "getSelfAsHead()");
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
