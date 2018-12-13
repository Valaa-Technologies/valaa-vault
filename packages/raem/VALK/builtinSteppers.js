// @flow

import { Iterable } from "immutable";

import ValaaReference, { VRef } from "~/raem/ValaaReference";

import { elevateFieldRawSequence } from "~/raem/state/FieldInfo";
import { PrototypeOfImmaterialTag } from "~/raem/state/Transient";

import { tryConnectToMissingPartitionsAndThen } from "~/raem/tools/denormalized/partitions";

import Valker from "~/raem/VALK/Valker";
import Kuery, { dumpObject, dumpKuery, dumpScope } from "~/raem/VALK/Kuery";
import { isPackedField } from "~/raem/VALK/packedField";
import { UnpackedHostValue, isHostRef, tryHostRef, tryUnpackedHostValue }
    from "~/raem/VALK/hostReference";

import { dumpify, invariantify, invariantifyObject, invariantifyArray, isPromise, isSymbol,
  outputCollapsedError, wrapError,
} from "~/tools";

/* eslint-disable no-bitwise */
/* eslint-disable prefer-rest-params */

export { isHostRef };

export type BuiltinStep = any[];

export function isBuiltinStep (kuery: any) {
  if (kuery === null || typeof kuery !== "object") return false;
  const stepNameCandidate = kuery[0];
  return (typeof stepNameCandidate === "string") && (stepNameCandidate[0] === "§");
}

export function getBuiltinStepName (kuery: any) {
  if (!Array.isArray(kuery)) return undefined;
  const stepName = kuery[0];
  return stepName[0] === "§" ? stepName : undefined;
}

export function getBuiltinStepArguments (kuery: any) { return kuery.slice(1); }

export default Object.freeze({
  "§'": function literal (valker: Valker, head: any, scope: ?Object, [, value]: BuiltinStep) {
    return value;
  },
  "§ref": function valaaReference (valker: Valker, head: any, scope: ?Object,
      [, params]: BuiltinStep): VRef {
    return valker.pack(valker.obtainReference(
        typeof params !== "object" ? params : tryLiteral(valker, head, params, scope),
        null));
  },
  "§$": function scopeLookup (valker: Valker, head: any, scope: ?Object,
      [, lookupName]: BuiltinStep) {
    if (typeof lookupName === "undefined") return scope;
    if (typeof scope !== "object" || !scope) {
      throw Error(`Cannot read scope variable '${lookupName}' from non-object scope: '${
          String(scope)}'`);
    }
    const eLookupName = typeof lookupName !== "object" ? lookupName
        : tryLiteral(valker, head, lookupName, scope);
    return valker.tryPack(scope[eLookupName]);
  },
  "§->": path_,
  "§map": map,
  "§filter": filter,
  "§@": function doStatements (valker: Valker, head: any, scope: ?Object,
      statementsStep: BuiltinStep) {
    let index = 0;
    try {
      for (; index + 1 !== statementsStep.length; ++index) {
        const statement = statementsStep[index + 1];
        if (typeof statement === "object") valker.advance(head, statement, scope, true);
      }
    } catch (error) {
      throw wrapError(error, `During ${valker.debugId()}\n .statement(#${index}), with:`,
          "\n\thead:", ...dumpObject(head),
          "\n\tstatement:", dumpify(statementsStep[index + 1]),
      );
    }
    return head;
  },
  "§?": function ternary (valker: Valker, head: any, scope: ?Object,
      [, condition, thenClause, elseClause]: BuiltinStep) {
    const conditionValue = typeof condition === "boolean"
        ? condition === (typeof head !== "undefined")
        : valker.advance(head, condition, scope);
    if (scope) scope.__condition__ = conditionValue;
    const resultClause = conditionValue ? thenClause : elseClause;
    return typeof resultClause !== "object" ? resultClause
        : tryLiteral(valker, head, resultClause, scope);
  },
  "§//": function comment (valker: Valker, head: any, scope: ?Object,
      [, value, commentKuery]: BuiltinStep) {
    try {
      return typeof value !== "object" ? value
          : tryLiteral(valker, head, value, scope, true);
    } catch (error) {
      const commentText = typeof commentKuery !== "object" ? commentKuery
          : tryLiteral(valker, head, commentKuery, scope);
      throw wrapError(error, "\n-\nKUERY NOTE:", commentText, "\n-\n");
    }
  },
  "§debug": function debug (valker: Valker, head: any, scope: ? Object,
      [, level, expression]: BuiltinStep) {
    const eLevel = typeof level !== "object" ? level
        : tryLiteral(valker, head, level, scope, true);
    if (typeof eLevel !== "number") {
      throw new Error(`Invalid debug level of type '${typeof eLevel} provided, expected number`);
    }
    const previousIndex = valker.hasOwnProperty("_indent") ? valker._indent : undefined;
    valker._indent = eLevel;
    try {
      return valker.advance(head, expression, scope, true);
    } finally {
      if (typeof previousIndex === "undefined") delete valker._indent;
      else valker._indent = previousIndex;
    }
  },
  "§[]": function array (valker: Valker, head: any, scope: ?Object,
      entriesStep: BuiltinStep, isNonFinalStep: ?boolean, startIndex: number = 1) {
    const ret = new Array(entriesStep.length - startIndex);
    for (let index = startIndex; index !== entriesStep.length; ++index) {
      const entry = entriesStep[index];
      ret[index - startIndex] = tryUnpackLiteral(valker, head, entry, scope);
    }
    return ret;
  },
  "§{}": function object (valker: Valker, head: any, scope: ?Object,
      propertyInitializersStep: BuiltinStep) {
    return _headOrScopeSet(valker, {}, head, scope, propertyInitializersStep);
  },
  "§$<-": function setScopeValues (valker: Valker, head: any, scope: ?Object,
      scopeSettersStep: BuiltinStep) {
    _headOrScopeSet(valker, scope, head, scope, scopeSettersStep);
    return head;
  },
  "§.<-": function setHeadProperties (valker: Valker, head: any, scope: ?Object,
      headSettersStep: BuiltinStep) {
    if (!head || (typeof head !== "object")) {
      throw new Error(`Cannot setHeadProperties fields on non-object head`);
    }
    if (isPackedField(head)) {
      throw new Error(`Cannot setHeadProperties fields on a Resource head`);
    }
    const isTransient = Iterable.isIterable(head);
    const objectTarget = _headOrScopeSet(
        valker, isTransient ? {} : head, head, scope, headSettersStep);
    if (!isTransient) return objectTarget; // just head, actually
    return head.withMutations(mutableHead => {
      for (const key of Object.keys(objectTarget)) mutableHead.set(key, objectTarget[key]);
    });
  },

  "§expression": function expression (valker: Valker, head: any, scope: ?Object,
      expressionStep: BuiltinStep) {
    const ret = new Array(expressionStep.length - 1);
    for (let index = 0; index + 1 !== expressionStep.length; ++index) {
      const component = expressionStep[index + 1];
      ret[index] = typeof component !== "object" ? component
          : tryLiteral(valker, head, component, scope);
    }
    return ret;
  },
  "§literal": function literalExpression (valker: Valker, head: any, scope: ?Object,
      [, value]: BuiltinStep) {
    if (typeof value !== "object") return ["§'", value];
    const eValue = typeof value !== "object" ? value
        : tryLiteral(valker, head, value, scope);
    if (typeof eValue === "undefined") return ["§void"];
    const hostRef = tryHostRef(eValue);
    if (hostRef) {
      return [`§ref`, hostRef.toJSON()];
    }
    return ["§'", eValue];
  },
  "§capture": capture,
  "§evalk": function evalk (valker: Valker, head: any, scope: ?Object,
      [, evaluatee]: BuiltinStep) {
    let evaluateeVAKON = typeof evaluatee !== "object" ? evaluatee
        : tryLiteral(valker, head, evaluatee, scope);
    if (typeof evaluateeVAKON === "undefined") return undefined;
    if (Iterable.isIterable(evaluateeVAKON)) {
      console.warn("§evalk.evaluatee should valk to native VAKON, instead got immutable-js object:",
          evaluateeVAKON, "as evaluatee JSON:", evaluateeVAKON.toJS());
      evaluateeVAKON = evaluateeVAKON.toJS();
    }
    return valker.advance(head, evaluateeVAKON, scope, true);
  },

  "§apply": function apply (valker: Valker, head: any, scope: ?Object,
      applyStep: BuiltinStep) {
    const eArgs = (applyStep[3] === undefined) ? []
        : tryUnpackLiteral(valker, head, applyStep[3], scope);
    return _callOrApply(valker, head, scope, applyStep, "§apply", eArgs);
  },
  "§call": function call (valker: Valker, head: any, scope: ?Object,
      callStep: BuiltinStep) {
    const eArgs = callStep.length <= 3 ? [] : new Array(callStep.length - 3);
    for (let index = 0; index + 3 < callStep.length; ++index) {
      const arg = callStep[index + 3];
      eArgs[index] = tryUnpackLiteral(valker, head, arg, scope);
    }
    return _callOrApply(valker, head, scope, callStep, "$call", eArgs);
  },
  "§callableof": function callableOf (valker: Valker, head: any, scope: ?Object,
      callableStep: BuiltinStep) {
    const ret = tryLiteral(callableStep[1]);
    if (typeof ret === "function") return ret;
    const roleName = tryUnpackLiteral(callableStep[2]);
    throw new Error(`Could not implicitly convert callee to a function for ${roleName}`);
  },
  "§argumentof": function callableOf (valker: Valker, head: any) {
    return head;
  },
  "§regexp": function regexp (valker: Valker, head: any, scope: ?Object,
      [, pattern, flags]: BuiltinStep) {
    return new RegExp(
        (typeof pattern !== "object") ? pattern : tryLiteral(valker, head, pattern, scope),
        (typeof flags !== "object") ? flags : tryLiteral(valker, head, flags, scope));
  },
  "§void": function void_ (valker: Valker, head: any, scope: ?Object,
      [, argument]: BuiltinStep) {
    if (typeof argument === "object") valker.advance(head, argument, scope);
  },
  "§throw": function throw_ (valker: Valker, head: any, scope: ?Object,
      [, argument]: BuiltinStep) {
    throw (typeof argument !== "object" ? argument : tryLiteral(valker, head, argument, scope));
  },
  "§typeof": function typeof_ (valker: Valker, head: any, scope: ?Object, typeofStep: any) {
    return resolveTypeof(valker, head, scope, typeofStep,
        ((typeof typeofStep[1] !== "object")
            ? typeofStep[1]
            : tryLiteral(valker, head, typeofStep[1], scope)));
  },
  "§in": function in_ (valker: Valker, head: any, scope: ?Object,
      [, prop, object]: BuiltinStep) {
    return tryUnpackLiteral(valker, head, prop, scope)
        in
        tryUnpackLiteral(valker, head, object, scope);
  },
  "§instanceof": function instanceof_ (valker: Valker, head: any, scope: ?Object,
      [, object, constructor_]: BuiltinStep) {
    return tryUnpackLiteral(valker, head, object, scope)
        instanceof
        tryUnpackLiteral(valker, head, constructor_, scope);
  },
  "§coupling": function coupling (valker: Valker, head: any, scope: ?Object,
      [, operand]: BuiltinStep) {
    const hostRef = tryHostRef(tryLiteral(valker, head, operand, scope));
    return hostRef && hostRef.getCoupledField();
  },
  "§isghost": function isghost (valker: Valker, head: any, scope: ?Object,
      [, object]: any) {
    // TODO(iridian): Now returning false in cases where head is not a Resource. Could throw.
    const transient = valker.trySingularTransient(tryLiteral(valker, head, object, scope));
    const id = transient && transient.get("id");
    return !id ? false : id.isGhost();
  },
  "§isimmaterial": function isghost (valker: Valker, head: any, scope: ?Object,
      [, object]: BuiltinStep) {
    // TODO(iridian): Now returning false in cases where head is not a Resource. Could throw.
    const transient = valker.trySingularTransient(tryLiteral(valker, head, object, scope));
    return !transient ? false : (typeof transient[PrototypeOfImmaterialTag] !== "undefined");
  },

  "§!": function not (valker: Valker, head: any, scope: ?Object,
      [, value]: BuiltinStep) {
    return !((typeof value !== "object") ? value : tryLiteral(valker, head, value, scope));
  },
  "§!!": function notNot (valker: Valker, head: any, scope: ?Object,
      [, value]: BuiltinStep) {
    return !!((typeof value !== "object") ? value : tryLiteral(valker, head, value, scope));
  },
  "§&&": function and (valker: Valker, head: any, scope: ?Object,
      andStep: BuiltinStep) {
    let ret = true;
    for (let index = 0; index + 1 < andStep.length; ++index) {
      const clause = andStep[index + 1];
      ret = (typeof clause !== "object") ? clause : tryLiteral(valker, head, clause, scope);
      if (!ret) return ret;
    }
    return ret;
  },
  "§||": function or (valker: Valker, head: any, scope: ?Object,
      orStep: BuiltinStep) {
    let ret = false;
    for (let index = 0; index + 1 < orStep.length; ++index) {
      const clause = orStep[index + 1];
      ret = (typeof clause !== "object") ? clause : tryLiteral(valker, head, clause, scope);
      if (ret) return ret;
    }
    return ret;
  },
  "§==": function looseEqualTo (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryUnpackLiteral(valker, head, left, scope);
    const eRight = typeof right !== "object" ? right : tryUnpackLiteral(valker, head, right, scope);
    const eLeftRef = tryHostRef(eLeft);
    if (eLeftRef) return eLeftRef.equals(eRight);
    const eRightRef = tryHostRef(eRight);
    if (eRightRef) return eRightRef.equals(eLeft);
    return eLeft == eRight; // eslint-disable-line
  },
  "§!=": function looseNotEqualTo (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryUnpackLiteral(valker, head, left, scope);
    const eRight = typeof right !== "object" ? right : tryUnpackLiteral(valker, head, right, scope);
    const eLeftRef = tryHostRef(eLeft);
    if (eLeftRef) return !eLeftRef.equals(eRight);
    const eRightRef = tryHostRef(eRight);
    if (eRightRef) return !eRightRef.equals(eLeft);
    return eLeft != eRight; // eslint-disable-line
  },
  "§===": function equalTo (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryUnpackLiteral(valker, head, left, scope);
    const eRight = typeof right !== "object" ? right : tryUnpackLiteral(valker, head, right, scope);
    return eLeft === eRight;
  },
  "§!==": function notEqualTo (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryUnpackLiteral(valker, head, left, scope);
    const eRight = typeof right !== "object" ? right : tryUnpackLiteral(valker, head, right, scope);
    return eLeft !== eRight;
  },
  "§<": function lessThan (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft < eRight;
  },
  "§<=": function lessOrEqualto (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft <= eRight;
  },
  "§>": function greaterThan (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft > eRight;
  },
  "§>=": function greaterOrEqualTo (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft >= eRight;
  },
  "§+": function add (valker: Valker, head: any, scope: ?Object,
      addStep: BuiltinStep[]) {
    let ret = typeof addStep[1] !== "object" ? addStep[1]
        : tryLiteral(valker, head, addStep[1], scope);
    for (let index = 1; index + 1 < addStep.length; ++index) {
      const term = addStep[index + 1];
      ret += typeof term !== "object" ? term : tryLiteral(valker, head, term, scope);
    }
    return ret;
  },
  "§-": function subtract (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft - eRight;
  },
  "§negate": function minus (valker: Valker, head: any, scope: ?Object,
      [, minuend]: BuiltinStep) {
    return -(typeof minuend !== "object" ? minuend : tryLiteral(valker, head, minuend, scope));
  },
  "§*": function multiply (valker: Valker, head: any, scope: ?Object,
      mulStep: BuiltinStep) {
    let ret = (typeof mulStep[1] !== "object") ? mulStep[1]
        : tryLiteral(valker, head, mulStep[1], scope);
    for (let index = 1; index + 1 < mulStep.length; ++index) {
      const factor = mulStep[index + 1];
      ret *= (typeof factor !== "object") ? factor : tryLiteral(valker, head, factor, scope);
    }
    return ret;
  },
  "§/": function divide (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft / eRight;
  },
  "§%": function remainder (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft % eRight;
  },
  "§**": function exponentiate (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft ** eRight;
  },
  "§&": function bitAnd (valker: Valker, head: any, scope: ?Object,
      bitAndStep: BuiltinStep) {
    let ret = (typeof bitAndStep[1] !== "object") ? bitAndStep[1]
        : tryLiteral(valker, head, bitAndStep[1], scope);
    for (let index = 1; index + 1 < bitAndStep.length; ++index) {
      const term = bitAndStep[index + 1];
      ret &= (typeof term !== "object") ? term : tryLiteral(valker, head, term, scope);
    }
    return ret;
  },
  "§|": function bitOr (valker: Valker, head: any, scope: ?Object,
      bitOrStep: BuiltinStep) {
    let ret = (typeof bitOrStep[1] !== "object") ? bitOrStep[1]
        : tryLiteral(valker, head, bitOrStep[1], scope);
    for (let index = 1; index + 1 < bitOrStep.length; ++index) {
      const term = bitOrStep[index + 1];
      ret |= (typeof term !== "object") ? term : tryLiteral(valker, head, term, scope);
    }
    return ret;
  },
  "§^": function bitXor (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft ^ eRight;
  },
  "§~": function bitNot (valker: Valker, head: any, scope: ?Object,
      [, operand]: BuiltinStep) {
    return ~(typeof operand !== "object" ? operand : tryLiteral(valker, head, operand, scope));
  },
  "§<<": function bitShiftLeft (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft << eRight;
  },
  "§>>": function bitShiftRight (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft >> eRight;
  },
  "§>>>": function bitShiftZeroFillRight (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    const eLeft = (typeof left !== "object") ? left : tryLiteral(valker, head, left, scope);
    const eRight = (typeof right !== "object") ? right : tryLiteral(valker, head, right, scope);
    return eLeft >>> eRight;
  },
});

const debugWrappedBuiltinSteppers = new WeakMap();

export function debugWrapBuiltinSteppers (steppers: { [string]: Function }) {
  let ret = debugWrappedBuiltinSteppers.get(steppers);
  if (ret) return ret;
  ret = {};
  for (const [stepName, stepper: Function] of Object.entries(steppers)) {
    ret[stepName] = function ( // eslint-disable-line
        valker: Valker, head: any, scope: ?Object, step: any, ...rest) {
      valker.log("  ".repeat(valker._indent++),
          `{ '${stepName}'/${stepper.name}, args:`, ...step.slice(1),
          ", head:", ...dumpObject(head), ", scope:", dumpScope(scope));
      let nextHead;
      try {
        nextHead = stepper(valker, head, scope, step, ...rest);
        return nextHead;
      } finally {
        valker.log("  ".repeat(--valker._indent),
            `} '${stepName}'/${stepper.name} ->`, ...dumpObject(nextHead),
            ", scope:", dumpScope(scope));
      }
    };
    Object.defineProperty(ret[stepName], "name", { value: `${stepper.name}-debug` });
  }
  debugWrappedBuiltinSteppers.set(steppers, ret);
  return Object.freeze(ret);
}

export function tryLiteral (valker: Valker, head: any, vakon: any, scope: ?Object,
    nonFinalStep: ?boolean): ?any {
  if (vakon === null) return head;
  if (vakon[0] === "§'") return vakon[1];
  return valker.advance(head, vakon, scope, nonFinalStep);
}

export function tryFullLiteral (valker: Valker, head: any, vakon: any, scope: ?Object,
    nonFinalStep: ?boolean): ?any {
  if (typeof vakon !== "object") return vakon;
  if (vakon === null) return head;
  if (vakon[0] === "§'") return vakon[1];
  return valker.advance(head, vakon, scope, nonFinalStep);
}

export function tryUnpackLiteral (valker: Valker, head: any, vakon: any, scope: ?Object,
    nonFinalStep: ?boolean): ?any {
  if (typeof vakon !== "object") return vakon;
  if (vakon === null) return (typeof head === "object") ? valker.tryUnpack(head) : head;
  if (vakon[0] === "§'") return vakon[1];
  const ret = valker.advance(head, vakon, scope, nonFinalStep);
  if (typeof ret !== "object") return ret;
  return valker.tryUnpack(ret);
}

function path_ (valker: Valker, head: any, scope: ?Object, pathStep: BuiltinStep,
    mustNotMutateScope: ?boolean, initialIndex: number = 1) {
  let index = initialIndex;
  let stepHead = head;
  let step;
  let pathScope;
  try {
    for (; index < pathStep.length; ++index) {
      step = pathStep[index];
      switch (typeof step) {
        case "string":
        case "symbol":
          stepHead = valker.field(stepHead, step, pathScope || scope);
          break;
        case "number":
          stepHead = valker.index(stepHead, step, pathScope || scope);
          break;
        case "boolean":
          if ((stepHead === null) || (typeof stepHead === "undefined")) {
            if (step) {
              throw new Error(`Valk path step head is '${stepHead}' at notNull assertion`);
            }
            stepHead = undefined;
            index = pathStep.length;
          }
          break;
        case "object":
          if (step === null) continue;
          if (isSymbol(step)) {
            stepHead = valker.field(stepHead, step, pathScope || scope);
            break;
          }
        default: // eslint-disable-line no-fallthrough
          if (typeof pathScope === "undefined") {
            pathScope = !scope ? {} : mustNotMutateScope ? Object.create(scope) : scope;
          }
          stepHead = valker.advance(stepHead, step, pathScope, index + 1 < pathStep.length);
      }
    }
    return stepHead;
  } catch (error) {
    throw wrapError(error, `During ${valker.debugId()}\n .path_, step #${index}, with:`,
        "\n\tstep head:", ...dumpObject(stepHead),
        "\n\tstep:", ...dumpKuery(step),
        "\n\tpath head:", ...dumpObject(head),
        "\n\tpath step:", ...dumpKuery(pathStep),
        "\n\tpath length:", pathStep.length,
        "\n\tscope:", dumpScope(pathScope));
  }
}

function map (valker: Valker, head: any, scope: ?Object, mapStep: any, nonFinalStep: ?boolean) {
  const ret = [];
  const mapScope = !scope ? {} : !nonFinalStep ? scope : Object.create(scope);
  const sequence = !head._sequence
      ? head
      : elevateFieldRawSequence(valker, head._sequence, head._fieldInfo);

  sequence.forEach((entry, index) => {
    const entryHead = !head._sequence ? valker.tryPack(entry) : entry;
    // mapScope.index = index;
    try {
      const result = valker._builtinSteppers["§->"](valker, entryHead, mapScope, mapStep);
      ret.push(valker.tryUnpack(result));
    } catch (error) {
      throw wrapError(error, `During ${valker.debugId()}\n .map, with:`,
          "\n\tmap head", ...dumpObject(sequence),
          "\n\tmap step:", ...dumpKuery(mapStep),
          `\n\tentry #${index} head:`, ...dumpObject(entryHead),
          "\n\tscope", dumpScope(mapScope));
    }
  });
  return ret;
}

function filter (valker: Valker, head: any, scope: ?Object, filterStep: any,
    nonFinalStep: ?boolean) {
  const ret = [];
  const filterScope = !scope ? {} : !nonFinalStep ? scope : Object.create(scope);
  const isPackedSequence = head._sequence;
  const sequence = !isPackedSequence
      ? head
      : elevateFieldRawSequence(valker, head._sequence, head._fieldInfo);

  sequence.forEach((entry, index) => {
    const entryHead = isPackedSequence ? entry : valker.tryPack(entry);
    // filterScope.index = index;
    try {
      const result = valker._builtinSteppers["§->"](valker, entryHead, filterScope, filterStep);
      if (result) ret.push(isPackedSequence ? valker.tryUnpack(entry) : entry);
    } catch (error) {
      throw wrapError(error, `During ${valker.debugId()}\n .filter, with:`,
          "\n\tfilter head:", ...dumpObject(sequence),
          "\n\tfilter step:", ...dumpKuery(filterStep),
          `\n\tentry #${index} head:`, ...dumpObject(entryHead),
          "\n\tscope", dumpScope(filterScope));
    }
  });
  return ret;
}

export function resolveTypeof (valker: Valker, head: any, scope: ?Object,
    [, object, equalTo]: BuiltinStep, packedObject: any) {
  let type = typeof packedObject;
  if ((type === "object") && packedObject) {
    // FIXME(iridian): This is a mess and definitely broken at the corner cases.
    // The VRef/packedField etc. system should be streamlined. packedRef is a useful envelope
    // for the head and could very well be mandatory distinction between Valaa objects and other
    // types, which it now not quite isn't.
    if (isPackedField(packedObject)) {
      if (packedObject._fieldInfo) {
        type = packedObject._fieldInfo.intro.isResource ? "Resource" : "Data";
      } else if (packedObject._singular) {
        const hostRef = tryHostRef(packedObject);
        if (hostRef) type = hostRef.typeof();
        else {
          const id = packedObject._singular.id;
          type = (id instanceof ValaaReference) ? id.typeof()
              : id ? "Resource" : "Data";
        }
      } else type = "Resource";
    } else {
      const hostRef = tryHostRef(packedObject);
      if (hostRef) type = hostRef.typeof();
      else if (Iterable.isIterable(packedObject)) type = "Resource";
    }
  }
  if (typeof equalTo === "undefined") return type;
  const candidateType = (typeof equalTo !== "object")
      ? equalTo
      : tryLiteral(valker, head, equalTo, scope);
  return type === candidateType;
}

function _headOrScopeSet (valker: Valker, target: any, head: any, scope: ?Object,
    settersStep: any[]) {
  for (let index = 1; index !== settersStep.length; ++index) {
    const setter = settersStep[index];
    if (Array.isArray(setter)) {
      if (setter.length !== 2) {
        invariantifyArray(setter, `${settersStep[0]}.setter#${index - 1}`,
            { length: 2 });
      }
      const eKey = (typeof setter[0] !== "object") ? setter[0]
          : tryLiteral(valker, head, setter[0], scope);
      const eValue = (typeof setter[1] !== "object") ? setter[1]
          : tryUnpackLiteral(valker, head, setter[1], scope);
      if ((typeof eKey !== "string") && !isSymbol(eKey) && (typeof eKey !== "number")) {
        throw new Error(`${settersStep[0]}.setter#${index - 1}.key is not a string or a symbol`);
      }
      target[eKey] = eValue;
    } else if (setter && (typeof setter === "object")) {
      for (const key of Object.keys(setter)) {
        const value = setter[key];
        target[key] = (typeof value !== "object") ? value
            : tryUnpackLiteral(valker, head, value, scope);
      }
      // Object.assign(target, valker.tryUnpack(valker.advance(head, setter, scope)));
    } else {
      invariantifyObject(setter, `${settersStep[0]}.setter#${index - 1
          } must be an object or a key-value pair, got '${typeof setter}':`, setter);
    }
  }
  return target;
}


export const toVAKON = Symbol("Valaa.toVAKON");

export function isValaaFunction (callerCandidate: any) { return callerCandidate[toVAKON]; }

export function denoteValaaBuiltin (description: any = "") {
  return (callee: any) => {
    callee._valkCaller = true;
    callee._valkDescription = description;
    return callee;
  };
}

export function denoteValaaBuiltinWithSignature (description: any = "") {
  return (callee: any) => {
    const text = callee.toString();
    return denoteValaaBuiltin(description + text.slice(8, text.indexOf(" {")))(callee);
  };
}

/**
 * Creates a decorator for specifying a Valaa kuery function.
 * Kuery function is a convenience construct for defining builtin functions in terms of Kuery VAKON.
 * A notable convenience aspect of Kuery functions that they accept /already evaluated/ values as
 * arguments and the VAKON they return ephemeral: it is immediately evaluated and discarded.
 *
 * While this quirk is not most performant in itself (ephemeral VAKON created runtime on every
 * call, it allows for flexibility. Most notably the ephemeral VAKON is fully live, and because the
 * already evaluated arguments can be inspected the ephemeral VAKON can be minimal and fine-tuned.
 * In addition because the ephemeral VAKON is discarded after use and thus never persisted, it is
 * transparent to outside and can be freely changed (as long as semantics).
 *
 * @export
 * @param {*} [description=""]
 * @returns
 */
export function denoteValaaKueryFunction (description: any = "") {
  return (createKuery: any) => {
    function callee (...args: any[]) {
      try {
        const vakon = createKuery(...args);
        if (vakon instanceof Kuery) {
          throw new Error(`INTERNAL ERROR: builtin kuery function '${createKuery.name
              }' returns a VALK Kuery object and not VAKON${
              ""} (did you forget a '.toVAKON()' from the return value?)`);
        }
        return this.get(vakon, { transaction: this.__callerValker__ });
      } catch (error) {
        throw wrapError(error, `During ${createKuery.name}`);
      }
    }
    callee._valkCaller = true;
    callee._valkCreateKuery = createKuery;
    const text = callee.toString();
    callee._valkDescription = description + text.slice(8, text.indexOf(" {"));
    return callee;
  };
}

export function denoteDeprecatedValaaBuiltin (prefer: string, description: any = "") {
  return (callee: any) => {
    function deprecated (...rest: any[]) {
      console.error("DEPRECATED: call to builtin operation", callee, "\n\tprefer:", prefer);
      return callee.apply(this, rest);
    }
    deprecated._valkCaller = true;
    const text = callee.toString();
    deprecated._valkDeprecatedPrefer = prefer;
    deprecated._valkDescription = description + text.slice(8, text.indexOf(" {"));
    return deprecated;
  };
}

function capture (valker: Valker, head: any, scope: ?Object,
    [, evaluatee, customScope]: BuiltinStep) {
  let capturedVAKON = typeof evaluatee !== "object" ? evaluatee
      : tryLiteral(valker, head, evaluatee, scope);
  if (typeof capturedVAKON === "undefined") return undefined;
  if (Iterable.isIterable(capturedVAKON)) {
    console.warn("§capturee.evaluatee should valk to native VAKON, instead got immutable object:",
        capturedVAKON, "as evaluatee JSON:", capturedVAKON.toJS());
    capturedVAKON = capturedVAKON.toJS();
  }
  const capturedScope = (typeof customScope === "undefined")
      ? scope
      : tryLiteral(valker, head, customScope, scope);

  let ret;
  if (capturedScope) {
    ret = function caller (...args: any[]) {
      const callScope = Object.create(capturedScope);
      callScope.arguments = args;
      if (this && this.__callerValker__) {
        // Direct valk caller with an active valker.
        return _advanceCapture(this.__callerValker__, this, capturedVAKON, callScope, valker);
      }
      return _runCapture(valker, this || capturedScope.this, capturedVAKON, callScope, valker);
    };
    ret._capturedScope = capturedScope;
  } else {
    ret = function callerWithNoCapture (...args: any[]) {
      if (this && this.__callerValker__) {
        // Direct valk caller with an active valker.
        return _advanceCapture(this.__callerValker__, this, capturedVAKON, { arguments: args },
            valker);
      }
      return _runCapture(valker, this || {}, capturedVAKON, { arguments: args }, valker);
    };
  }
  ret._valker = valker;
  ret._valkCaller = true;
  ret[toVAKON] = capturedVAKON;
  return ret;
}

function _advanceCapture (valker, thisArgument, vakon, callScope, capturingValker: ?Valker) {
  let ret;
  let transaction = valker.acquireTransaction();
  try {
    if (capturingValker && capturingValker.hasOwnProperty("_sourceInfo")) {
      transaction = Object.create(transaction);
      transaction._sourceInfo = capturingValker._sourceInfo;
    }
    ret = transaction.tryUnpack(
        transaction.advance(thisArgument, vakon, callScope, true));
  } catch (error) {
    transaction.abort();
    throw transaction.addVALKRuntimeErrorStackFrame(
        transaction.wrapErrorEvent(error,
            `call/advance (valk caller with active valker), unwinding transaction`,
            "\n\tthis:", ...dumpObject(thisArgument),
            "\n\tcallee vakon:", ...dumpKuery(vakon),
            "\n\tscope:", ...dumpObject(callScope)),
        vakon,
    );
  }

  try {
    transaction.releaseTransaction();
  } catch (error) {
    throw transaction.addVALKRuntimeErrorStackFrame(
        transaction.wrapErrorEvent(error,
          `call/releaseTransaction (valk caller with active valker)`,
          "\n\tthis:", ...dumpObject(thisArgument),
          "\n\tcallee vakon:", ...dumpKuery(vakon),
          "\n\tscope:", ...dumpObject(callScope),
          "\n\tret:", ...dumpObject(ret)),
        vakon,
    );
  }
  return ret;
}

function _runCapture (valker, thisArgument, vakon, callScope, capturingValker: Valker) {
  // TODO(iridian): Undocumented dependency on transaction semi-internal details
  const actualValker = (valker.transactionDepth && !valker.isActiveTransaction())
      // There is no active transaction so we are the outermost caller.
      // Do the housekeeping: create the transaction and handle missing partition retries.
      ? valker.nonTransactionalBase
      // The valker associated with this function still has an active transaction: we're a nested
      // callback call. No housekeeping, just add exception context if necessary.
      : valker;
  const transaction = actualValker.acquireTransaction();
  let ret;
  try {
    ret = transaction.run(thisArgument, vakon,
        { scope: callScope, sourceInfo: capturingValker._sourceInfo });
  } catch (error) {
    transaction.abort();
    let opName;
    if (actualValker !== valker.nonTransactionalBase) {
      opName = `call/run (non-valk caller in active transactional callback context)`;
    } else {
      opName = `call/run (non-valk caller as outermost context)`;
      const connectingMissingPartitions = tryConnectToMissingPartitionsAndThen(error,
          () => _runCapture(valker, thisArgument, vakon, callScope, capturingValker));
      if (connectingMissingPartitions) return connectingMissingPartitions;
    }
    throw capturingValker.addVALKRuntimeErrorStackFrame(
        actualValker.wrapErrorEvent(error, opName,
            "\n\ttransaction:", ...dumpObject(transaction),
            "\n\tthis:", ...dumpObject(thisArgument),
            "\n\tcallee vakon:", ...dumpKuery(vakon),
            "\n\tscope:", ...dumpObject(callScope)),
        vakon,
    );
  }

  try {
    transaction.releaseTransaction();
  } catch (error) {
    throw capturingValker.addVALKRuntimeErrorStackFrame(
        transaction.wrapErrorEvent(error,
            actualValker !== valker.nonTransactionalBase
                ? `call/releaseTransaction (non-valk caller in active transactional callback ${
                    ""}context)`
                : `call/releaseTransaction (non-valk caller as outermost context)`,
            "\n\tthis:", ...dumpObject(thisArgument),
            "\n\tcallee vakon:", ...dumpKuery(vakon),
            "\n\tscope:", ...dumpObject(callScope),
            "\n\tret:", ...dumpObject(ret)),
        vakon,
    );
  }

  return ret;
}

function _callOrApply (valker: Valker, head: any, scope: ?Object, step: BuiltinStep,
    opName: string, eArgs: any) {
  let eCallee;
  let eThis;
  let kueryFunction;
  try {
    eCallee = tryLiteral(valker, head, step[1], scope);
    if (typeof eCallee !== "function") {
      eCallee = valker._builtinSteppers["§callableof"](
          valker, eCallee, scope, ["§callableof", null, opName]);
      invariantify(typeof eCallee === "function",
          `trying to call a non-function value of type '${typeof eCallee}'`,
          `\n\tfunction wannabe value:`, eCallee);
    }
    if (eCallee._valkCreateKuery) {
      eThis = (typeof step[2] === "undefined")
          ? scope : tryLiteral(valker, head, step[2], scope);
      // TODO(iridian): Fix this kludge which enables namespace proxies
      eThis = (eThis[UnpackedHostValue] && tryHostRef(eThis)) || eThis;
      kueryFunction = eCallee._valkCreateKuery(...eArgs);
      return valker.advance(eThis, kueryFunction, scope);
    }
    eThis = (typeof step[2] === "undefined")
        ? scope : tryUnpackLiteral(valker, head, step[2], scope);
    eThis = (eThis[UnpackedHostValue] && tryUnpackedHostValue(eThis)) || eThis;
    if (eCallee._valkCaller) {
      if (eThis === null || typeof eThis === "undefined") {
        eThis = { __callerValker__: valker, __callerScope__: scope };
      } else if ((typeof eThis === "object") || (typeof eThis === "function")) {
        eThis = Object.create(eThis);
        eThis.__callerValker__ = valker;
        eThis.__callerScope__ = scope;
      }
    } else {
      for (let i = 0; i !== eArgs.length; ++i) {
        if (isHostRef(eArgs[i])) {
          eArgs[i] = valker._builtinSteppers["§argumentof"](
              valker, eArgs[i], scope, ["§argumentof", null, opName]);
        }
      }
    }
    const ret = (opName === "§apply")
        ? eCallee.apply(eThis, eArgs)
        : eCallee.call(eThis, ...eArgs);
    if ((typeof ret === "object") && (ret !== null) && ret.catch && isPromise(ret)) {
      ret.catch(error => {
        outputCollapsedError(onError(error),
            `Exception re-raised by VALK.${opName}('${eCallee.name}').ret:Promise.catch`);
        throw error;
      });
    }
    return valker.tryPack(ret);
  } catch (error) {
    throw onError(error);
  }
  function onError (error) {
    return valker.wrapErrorEvent(error, `builtin.${opName}`,
        "\n\thead:", ...dumpObject(head),
        "\n\tcallee (is valk):", (eCallee != null) && eCallee._valkCaller, ...dumpObject(eCallee),
        "(via kuery:", ...dumpKuery(step[1]), ")",
        "\n\tthis:", ...dumpObject(eThis),
        "(via kuery:", ...dumpKuery(step[2]), ")",
        "\n\targs:", ...dumpObject(eArgs),
        "(via VAKONs:", ...dumpKuery(opName === "§apply" ? step[3] : step.slice(3)), ")",
        ...(kueryFunction ? ["\n\tkueryFunction VAKON:", ...dumpKuery(kueryFunction)] : []),
    );
  }
}
