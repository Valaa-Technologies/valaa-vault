// @flow

import { HostRef, UnpackedHostValue } from "~/raem/VALK/hostReference";

import { isNativeIdentifier, getNativeIdentifierValue } from "~/script";

import VALEK, { dumpObject } from "~/engine/VALEK";

import type Subscription from "~/engine/Vrapper/Subscription";
import Vrapper from "~/engine/Vrapper";

import { invariantify, isSymbol, wrapError } from "~/tools";

/* eslint-disable no-bitwise */
/* eslint-disable prefer-rest-params */

export const performDefaultGet = {};
export const performFullDefaultProcess = {};

function throwUnimplementedLiveKueryError (subscription, head, scope, kueryVAKON) {
  throw new Error(`Live kuery not implemented yet for complex step: ${
      JSON.stringify(kueryVAKON)}`);
}

function throwMutationLiveKueryError (subscription, head, scope, kueryVAKON) {
  throw new Error(`Cannot make a kuery with side-effects live. Offending step: ${
      JSON.stringify(kueryVAKON)}`);
}

// undefined: use default behaviour ie. walk all arguments
// null: completely disabled
// other: call corresponding function callback, if it returns performDefaultGet then use default,
//        otherwise return the value directly.
export default Object.freeze({
  "§'": null,
  "§vrl": null,
  "§ref": null,
  "§$": undefined,
  "§map": liveMap,
  "§filter": liveFilter,
  "§method": undefined,
  "§@": undefined,
  "§?": liveTernary,
  "§//": null,
  "§[]": undefined,
  "§{}": function liveConstructObject (subscription: Subscription, head: any, scope: any,
      kueryVAKON: Array<any>) {
    return liveFieldOrScopeSet(subscription, head, scope, kueryVAKON, {});
  },
  // Allow immediate object live mutations; parameter object computed properties use this.
  "§.<-": function liveFieldSet (subscription: Subscription, head: any, scope: any,
      kueryVAKON: Array<any>) {
    return liveFieldOrScopeSet(subscription, head, scope, kueryVAKON, head);
  },
  // Allow immediate scope live mutations; they have valid uses as intermediate values.
  "§$<-": function liveScopeSet (subscription: Subscription, head: any, scope: any,
      kueryVAKON: Array<any>) {
    return liveFieldOrScopeSet(subscription, head, scope, kueryVAKON, scope);
  },
  "§expression": undefined,
  "§literal": undefined,
  "§evalk": liveEvalk,
  "§capture": undefined, // Note: captured function _contents_ are not live-hooked against
  "§apply": liveApply,
  "§call": liveCall,
  "§invoke": liveInvoke,
  "§new": throwMutationLiveKueryError,
  "§regexp": undefined,
  "§void": undefined,
  "§throw": null,
  "§typeof": liveTypeof,
  "§in": undefined,
  "§instanceof": undefined,
  "§while": throwUnimplementedLiveKueryError,
  "§!": undefined,
  "§!!": undefined,
  "§&&": liveAnd,
  "§||": liveOr,
  "§==": undefined,
  "§!=": undefined,
  "§===": undefined,
  "§!==": undefined,
  "§<": undefined,
  "§<=": undefined,
  "§>": undefined,
  "§>=": undefined,
  "§+": undefined,
  "§-": undefined,
  "§negate": undefined,
  "§*": undefined,
  "§/": undefined,
  "§%": undefined,
  "§**": undefined,
  "§&": undefined,
  "§|": undefined,
  "§^": undefined,
  "§~": undefined,
  "§<<": undefined,
  "§>>": undefined,
  "§>>>": undefined,

  "§let$$": undefined,
  "§const$$": undefined,
  "§$$": function liveIdentifier (subscription: Subscription, head: any, scope: any,
      kueryVAKON: any, evaluateKuery: boolean) {
    return liveMember(subscription, head, scope, kueryVAKON, evaluateKuery, false);
  },
  "§..": function liveProperty (subscription: Subscription, head: any, scope: any,
      kueryVAKON: any, evaluateKuery: boolean) {
    return liveMember(subscription, head, scope, kueryVAKON, evaluateKuery, true);
  },
  "§$$<-": throwMutationLiveKueryError,
  "§..<-": throwMutationLiveKueryError,
  "§delete$$": throwMutationLiveKueryError,
  "§delete..": throwMutationLiveKueryError,
/*  {
        // Live expression support not perfectly implemented yet: now subscribing to all fields of
        // a singular head preceding an expression. Considerable number of use cases work even
        // without it: most of filters, finds and conditionals are covered by this.
        // Extending support for live list filtering use cases, ie. when the head is an array,
        // should be enabled only when needed and profiled.
        // Expressions which go deeper than that will be incorrectly not live.
        subscribers.push(head.obtainSubscription(true)
            .addSubscriber({}, "test", () => this.forceUpdate()));
      }
*/
});

function liveMap (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>, evaluateKuery: boolean) {
  if (!Array.isArray(head)) return undefined;
  const opVAKON = ["§->", ...kueryVAKON.slice(1)];
  const ret = evaluateKuery ? [] : undefined;
  for (const entry of head) {
    const result = subscription._buildLiveKuery(entry, opVAKON, scope, evaluateKuery);
    ret.push(result);
  }
  return ret;
}

function liveFilter (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>, evaluateKuery: boolean) {
  if (!Array.isArray(head)) return undefined;
  const opVAKON = ["§->", ...kueryVAKON.slice(1)];
  const ret = evaluateKuery ? [] : undefined;
  for (const entry of head) {
    const result = subscription._buildLiveKuery(entry, opVAKON, scope, evaluateKuery);
    if (result) ret.push(entry);
  }
  return ret;
}

function liveTernary (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>, evaluateKuery: boolean) {
  const conditionVAKON = kueryVAKON[1];
  const condition = subscription._buildLiveKuery(head, conditionVAKON, scope, true);
  const clauseTakenVAKON = condition ? kueryVAKON[2] : kueryVAKON[3];
  return subscription._processLiteral(head, clauseTakenVAKON, scope, evaluateKuery);
}

function liveAnd (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>/* , evaluateKuery: boolean */) {
  let value;
  for (let index = 1; index < kueryVAKON.length; ++index) {
    value = subscription._processLiteral(head, kueryVAKON[index], scope, true);
    if (!value) return value;
  }
  return value;
}

function liveOr (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>/* , evaluateKuery: boolean */) {
  let value;
  for (let index = 1; index < kueryVAKON.length; ++index) {
    value = subscription._processLiteral(head, kueryVAKON[index], scope, true);
    if (value) return value;
  }
  return value;
}

function liveFieldOrScopeSet (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>, target: any) {
  for (let index = 0; index + 1 !== kueryVAKON.length; ++index) {
    const setter = kueryVAKON[index + 1];
    if ((typeof setter !== "object") || (setter === null)) continue;
    if (Array.isArray(setter)) {
      const name = (typeof setter[0] !== "object") || (setter[0] === null)
          ? setter[0]
          : subscription._processLiteral(head, setter[0], scope, true);
      const value = (typeof setter[1] !== "object") || (setter[1] === null)
          ? setter[1]
          : subscription._processLiteral(head, setter[1], scope, true);
      target[name] = value;
    } else {
      for (const key of Object.keys(setter)) {
        const value = setter[key];
        target[key] = (typeof value !== "object") || (value === null)
            ? value
            : subscription._processLiteral(head, value, scope, true);
      }
    }
  }
  return target;
}

function liveEvalk (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>, evaluateKuery: boolean) {
  const evaluateeVAKON = typeof kueryVAKON[1] !== "object" ? kueryVAKON[1]
      : subscription._buildLiveKuery(head, kueryVAKON[1], scope, true);
  return subscription._buildLiveKuery(head, evaluateeVAKON, scope, evaluateKuery);
}

function liveApply (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>, evaluateKuery: boolean) {
  let eCallee = subscription._processLiteral(head, kueryVAKON[1], scope, true);
  if (typeof eCallee !== "function") {
    eCallee = subscription._emitter.engine.discourse
        .advance(eCallee, ["§callableof", null, "liveApply"], scope);
    invariantify(typeof eCallee === "function",
        `trying to call a non-function value of type '${typeof eCallee}'`,
        "\n\tfunction wannabe value:", eCallee);
  }
  let eThis = (kueryVAKON[2] === undefined)
      ? scope
      : subscription._processLiteral(head, kueryVAKON[2], scope, true);
  const eArgs = subscription._processLiteral(head, kueryVAKON[3], scope, true);
  if (!eCallee._valkCreateKuery) return performDefaultGet;
  // TODO(iridian): Fix this kludge which enables namespace proxies
  eThis = eThis[UnpackedHostValue] || eThis;
  return subscription._buildLiveKuery(
      eThis, eCallee._valkCreateKuery(...eArgs), scope, evaluateKuery);
}

function liveCall (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>, evaluateKuery: boolean) {
  let eCallee = subscription._processLiteral(head, kueryVAKON[1], scope, true);
  if (typeof eCallee !== "function") {
    eCallee = subscription._emitter.engine.discourse
        .advance(eCallee, ["§callableof", null, "liveCall"], scope);
    invariantify(typeof eCallee === "function",
        `trying to call a non-function value of type '${typeof eCallee}'`,
        `\n\tfunction wannabe value:`, eCallee);
  }
  let eThis = (kueryVAKON[2] === undefined)
      ? scope
      : subscription._processLiteral(head, kueryVAKON[2], scope, true);
  const eArgs = [];
  for (let i = 3; i < kueryVAKON.length; ++i) {
    eArgs.push(subscription._processLiteral(head, kueryVAKON[i], scope, true));
  }
  if (!eCallee._valkCreateKuery) return performDefaultGet;
  // TODO(iridian): Fix this kludge which enables namespace proxies
  eThis = eThis[UnpackedHostValue] || eThis;
  return subscription._buildLiveKuery(
      eThis, eCallee._valkCreateKuery(...eArgs), scope, evaluateKuery);
}

function liveInvoke (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>, evaluateKuery: boolean) {
  let eCallee = subscription._processLiteral(head, ["§..", kueryVAKON[1]], scope, true);
  if (typeof eCallee !== "function") {
    eCallee = subscription._emitter.engine.discourse
        .advance(eCallee, ["§callableof", null, "liveInvoke"], scope);
    invariantify(typeof eCallee === "function",
        `trying to call a non-function value of type '${typeof eCallee}'`,
        `\n\tfunction wannabe value:`, eCallee);
  }
  const eArgs = [];
  for (let i = 2; i < kueryVAKON.length; ++i) {
    eArgs.push(subscription._processLiteral(head, kueryVAKON[i], scope, true));
  }
  if (!eCallee._valkCreateKuery) return performDefaultGet;
  return subscription._buildLiveKuery(
      head, eCallee._valkCreateKuery(...eArgs), scope, evaluateKuery);
}

function liveTypeof (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>) {
  const objectVAKON = kueryVAKON[1];
  return (Array.isArray(objectVAKON) && (objectVAKON[0] === "§$$")
          && (typeof objectVAKON[1] === "string"))
      ? performDefaultGet
      : performFullDefaultProcess;
}

const toProperty = {};

function liveMember (subscription: Subscription, head: any, scope: any,
    kueryVAKON: Array<any>, evaluateKuery: boolean, isProperty: boolean) {
  const containerVAKON = kueryVAKON[2];
  let container;
  let propertyName;
  let vProperty;
  try {
    container = (containerVAKON === undefined)
        ? (isProperty ? head : scope)
        : subscription._run(head, containerVAKON, scope);

    propertyName = kueryVAKON[1];
    if ((typeof propertyName !== "string") && !isSymbol(propertyName)
        && (typeof propertyName !== "number")) {
      propertyName = subscription._buildLiveKuery(head, propertyName, scope, true);
      if ((typeof propertyName !== "string") && !isSymbol(propertyName)
          && (!isProperty || (typeof propertyName !== "number"))) {
        if (propertyName === null) return undefined;
        throw new Error(`Cannot use a value with type '${typeof propertyName}' as ${
                isProperty ? "property" : "identifier"} name`);
      }
    }

    if ((typeof container !== "object") || (container === null)) {
      return evaluateKuery ? container[propertyName] : undefined;
    }
    if (container[HostRef] === undefined) {
      const property = container[propertyName];
      if ((typeof property !== "object") || (property === null)) {
        if (!isProperty && (property === undefined) && !(propertyName in container)) {
          throw new Error(`Cannot find identifier '${propertyName}' in scope`);
        }
        return property;
      }
      if (isNativeIdentifier(property)) return getNativeIdentifierValue(property);
      if (!(property instanceof Vrapper) || (property.tryTypeName() !== "Property")) {
        return property;
      }
      vProperty = property;
    } else if (container._lexicalScope && container._lexicalScope.hasOwnProperty(propertyName)) {
      vProperty = container._lexicalScope[propertyName];
    } else {
      let vrapper = container[UnpackedHostValue];
      if (vrapper === undefined) {
        throw new Error("Invalid container: expected one with valid UnpackedHostValue");
      }
      let propertyKey;
      if (vrapper === null) { // container itself is the Vrapper.
        vrapper = container;
        propertyKey = propertyName;
      } else { // container is a namespace proxy
        propertyKey = container[propertyName];
      }
      const descriptor = vrapper.engine.getHostObjectPrototype(
          vrapper.getTypeName(subscription._valkOptions))[propertyKey];
      if (descriptor) {
        if (!descriptor.writable || !descriptor.kuery) return performDefaultGet;
        return subscription._buildLiveKuery(vrapper, descriptor.kuery, scope, true);
      }
      vProperty = subscription._run(container,
          toProperty[propertyName]
              || (toProperty[propertyName] = VALEK.property(propertyName).toVAKON()),
          scope);
      if (!vProperty && isProperty) {
        subscription._buildLiveKuery(container, "properties", scope);
        return undefined;
      }
    }
    if (!vProperty && !isProperty) {
      throw new Error(`Cannot find identifier '${String(propertyName)}' in scope`);
    }
    subscription._subscribeToFieldsByFilter(vProperty, true, evaluateKuery);
    const value = subscription._run(vProperty, "value", scope);
    if (value) {
      switch (value.typeName) {
        case "Literal":
          return value.value;
        case "Identifier":
          return evaluateKuery ? performDefaultGet : undefined;
        case "KueryExpression":
          return subscription._buildLiveKuery(container, value.vakon, scope, true);
        default:
          throw new Error(`Unrecognized Property.value.typeName '${value.typeName}' in live kuery`);
      }
    }
    return undefined;
  } catch (error) {
    throw wrapError(error, new Error(`During ${subscription.debugId()}\n .liveMember(), with:`),
        "\n\tcontainer:", ...dumpObject(container),
        "\n\tpropertyName:", ...dumpObject(propertyName),
        "\n\tvProperty:", ...dumpObject(vProperty));
  }
}
