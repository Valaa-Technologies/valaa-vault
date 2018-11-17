// @flow

import type { Action, Story } from "~/raem/redux/Bard";

import { Discourse } from "~/prophet";

import VALEK, { Kuery, dumpKuery, VALKOptions } from "~/engine/VALEK";

import VrapperSubscriber from "~/engine/Vrapper/VrapperSubscriber";

import { LogEventGenerator, wrapError, dumpObject } from "~/tools";


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

  run (head: any, kuery: Kuery, options: any = {}) {
    try {
      options.scope = options.scope ? Object.create(options.scope) : {};
      options.scope.self = options.scope;
      if (options.onUpdate) {
        // TODO(iridian): Eventually live kuery functionality might need to be moved into Valker.
        // A convenient time to do this is when the asynchronous kuery functionality is added there.
        const subscriber = new VrapperSubscriber();
        const callback = options.onUpdate;
        if (options.transaction) {
          options.state = options.transaction.getState();
          options.transaction = undefined;
        }
        options.onUpdate = undefined;
        subscriber.initializeKuery(this, head, kuery, callback, options, !options.noImmediateRun);
        return subscriber;
      }
      return (options.transaction || this.engine.discourse).run(head, kuery, options);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .run(), with:`,
          "\n\thead:", ...dumpObject(head),
          "\n\tkuery:", ...dumpKuery(kuery),
          "\n\toptions:", ...dumpObject(options));
    }
  }

  acquireTransaction (customEventCallback: ?(actions: Action[]) => Story): Discourse {
    return this.engine.discourse.acquireTransaction(customEventCallback);
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

export function executeHandlers (rule, passage, args, handlerObject, objectsHandled = new Set()) {
  let currentRuleDebugInfo;
  try {
    if (!rule) return false;
    if (typeof rule === "function") {
      currentRuleDebugInfo = rule;
      const handled = rule.apply(handlerObject, args);
      if (handled || typeof handled === "undefined") objectsHandled.add(handlerObject);
      return handled || typeof handled === "undefined";
    }
    if (Array.isArray(rule)) {
      if (!objectsHandled.has(rule[0])) {
        currentRuleDebugInfo = rule;
        return executeHandlers(rule[1], passage, args, rule[0], objectsHandled);
      }
    } else {
      let promises;
      for (const [clause, subRule] of rule) {
        currentRuleDebugInfo = [clause, passage[clause]];
        const handled = (typeof clause !== "string"
            // Non-string clause is straight-up used as a handler object.
            ? executeHandlers(subRule, passage, args, clause, objectsHandled)
            // A string clause (like "id" or "typeName") picks the corresponding selector from
            // passage, which is then used to select the one matching rule from subRules.
            : executeHandlers(
                subRule.get(passage[clause]), passage, args, handlerObject, objectsHandled));
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

