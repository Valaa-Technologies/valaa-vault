// @flow

import { Iterable, OrderedMap } from "immutable";

import VRL from "~/raem/VRL";
import { qualifiedNamesOf } from "~/tools/namespace";

import { elevateFieldRawSequence } from "~/raem/state/FieldInfo";
import Transient, { PrototypeOfImmaterialTag } from "~/raem/state/Transient";
import { getObjectRawField } from "~/raem/state/getObjectField";

import { trySourcifyAbsentChroniclesAndThen } from "~/raem/tools/denormalized/partitions";

import Valker from "~/raem/VALK/Valker";
import Kuery, { dumpObject, dumpKuery, dumpScope } from "~/raem/VALK/Kuery";
import { isPackedField, tryPackedField, packedSingular } from "~/raem/VALK/packedField";
import { UnpackedHostValue, isHostRef, tryHostRef, tryUnpackedHostValue }
    from "~/raem/VALK/hostReference";
import { addStackFrameToError, SourceInfoTag } from "~/raem/VALK/StackTrace";

import { isTildeStepName, expandTildeVAKON } from "./_tildeOps";

import {
  dumpify, invariantify, invariantifyObject, invariantifyArray, isPromise, isSymbol,
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

export default {
  "§'": function literal (valker: Valker, head: any, scope: ?Object, [, value]: BuiltinStep) {
    return value;
  },
  "§.": _access,
  "§vrl": function vrl (valker: Valker, head: any, scope: ?Object,
      [, params]: BuiltinStep): VRL {
    return valker.pack(valker.obtainReference(
        typeof params !== "object" ? params : tryLiteral(valker, head, params, scope),
        null));
  },
  "§ref": function vrl (valker: Valker, head: any, scope: ?Object,
      [, params]: BuiltinStep): VRL {
    return valker.pack(valker.obtainReference(
        typeof params !== "object" ? params : tryLiteral(valker, head, params, scope),
        null));
  },
  "§$": function scopeLookup (valker: Valker, head: any, scope: ?Object,
      [, lookupName]: BuiltinStep) {
    if (lookupName === undefined) return scope;
    if (typeof scope !== "object" || !scope) {
      throw Error(`Cannot read scope variable '${lookupName}' from non-object scope: '${
          String(scope)}'`);
    }
    const eLookupName = typeof lookupName !== "object" ? lookupName
        : tryLiteral(valker, head, lookupName, scope);
    return valker.tryPack(scope[eLookupName]);
  },
  "§->": _advance,
  "§map": _map,
  "§filter": _filter,
  "§@": function doStatements (valker: Valker, head: any, scope: ?Object,
      statementsStep: BuiltinStep) {
    let index = 0;
    try {
      for (; index + 1 !== statementsStep.length; ++index) {
        const statement = statementsStep[index + 1];
        if (typeof statement === "object") valker.advance(head, statement, scope, true);
      }
    } catch (error) {
      throw valker.wrapErrorEvent(error, 1, () => [
        `raem§@/statement(#${index})`,
        "\n\thead:", ...dumpObject(head),
        "\n\tstatement:", dumpify(statementsStep[index + 1]),
      ]);
    }
    return head;
  },
  "§?": function ternary (valker: Valker, head: any, scope: ?Object,
      [, condition, thenClause, elseClause]: BuiltinStep) {
    const conditionValue = typeof condition === "boolean"
        ? condition === (head !== undefined)
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
      throw valker.wrapErrorEvent(error, "\n-\nKUERY NOTE:", commentText, "\n-\n");
    }
  },
  "§debug": function debug (valker: Valker, head: any, scope: ?Object,
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
      if (previousIndex === undefined) delete valker._indent;
      else valker._indent = previousIndex;
    }
  },
  "§[]": function array (valker: Valker, head: any, scope: ?Object,
      entriesStep: BuiltinStep, isNonFinalStep: ?boolean, startIndex: number = 1) {
    const ret = new Array(entriesStep.length - startIndex);
    for (let index = startIndex; index !== entriesStep.length; ++index) {
      const entry = entriesStep[index];
      ret[index - startIndex] = tryUnpackFullLiteral(valker, head, entry, scope);
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
    if (eValue === undefined) return ["§void"];
    const hostRef = tryHostRef(eValue);
    if (hostRef) {
      return [`§vrl`, hostRef.toJSON()];
    }
    return ["§'", eValue];
  },
  "§capture": function capture (valker: Valker, head: any, scope: ?Object,
      [, evaluatee, forwardSteppersStepName, captureName, customScope]: BuiltinStep) {
    let capturedVAKON = typeof evaluatee !== "object"
        ? evaluatee
        : tryLiteral(valker, head, evaluatee, scope);
    if (capturedVAKON === undefined) return undefined;
    if (Iterable.isIterable(capturedVAKON)) {
      console.warn("§capture.evaluatee should valk to native VAKON, instead got immutable object:",
          capturedVAKON, "as evaluatee JSON:", capturedVAKON.toJS());
      capturedVAKON = capturedVAKON.toJS();
    }
    return _createVCall(
        valker,
        capturedVAKON,
        valker[SourceInfoTag],
        forwardSteppersStepName && tryFullLiteral(valker, head, forwardSteppersStepName, scope),
        captureName && tryFullLiteral(valker, head, captureName, scope),
        ((customScope === undefined)
                ? scope
                : tryLiteral(valker, head, customScope, scope))
            || null,
        );
  },
  "§evalk": function evalk (valker: Valker, head: any, scope: ?Object,
      [, evaluatee]: BuiltinStep) {
    let evaluateeVAKON = typeof evaluatee !== "object" ? evaluatee
        : tryLiteral(valker, head, evaluatee, scope);
    if (evaluateeVAKON === undefined) return undefined;
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
    return callOrApply(this, valker, head, scope, applyStep, "§apply", undefined, undefined, eArgs);
  },
  "§call": function call (valker: Valker, head: any, scope: ?Object,
      callStep: BuiltinStep) {
    const eArgs = callStep.length <= 3 ? [] : new Array(callStep.length - 3);
    for (let index = 0; index + 3 < callStep.length; ++index) {
      const arg = callStep[index + 3];
      eArgs[index] = tryUnpackLiteral(valker, head, arg, scope);
    }
    return callOrApply(this, valker, head, scope, callStep, "$call", undefined, undefined, eArgs);
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
    return !transient ? false : (transient[PrototypeOfImmaterialTag] !== undefined);
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
    let eLeft = (typeof left !== "object") ? left : tryUnpackLiteral(valker, head, left, scope);
    let eRight = typeof right !== "object" ? right : tryUnpackLiteral(valker, head, right, scope);
    if (eLeft == eRight) return true; // eslint-disable-line
    if (eLeft && eRight) {
      const eLeftRef = tryHostRef(eLeft);
      if (eLeftRef) return eLeftRef.equals(eRight);
      const eRightRef = tryHostRef(eRight);
      if (eRightRef) return eRightRef.equals(eLeft);
      const eLeftName = qualifiedNamesOf(eLeft);
      if (eLeftName) eLeft = eLeftName[3];
      const eRightName = qualifiedNamesOf(eRight);
      if (eRightName) eRight = eRightName[3];
    }
    return eLeft == eRight; // eslint-disable-line
  },
  "§!=": function looseNotEqualTo (valker: Valker, head: any, scope: ?Object,
      [, left, right]: BuiltinStep) {
    let eLeft = (typeof left !== "object") ? left : tryUnpackLiteral(valker, head, left, scope);
    let eRight = typeof right !== "object" ? right : tryUnpackLiteral(valker, head, right, scope);
    if (eLeft == eRight) return false; // eslint-disable-line
    if (eLeft && eRight) {
      const eLeftRef = tryHostRef(eLeft);
      if (eLeftRef) return !eLeftRef.equals(eRight);
      const eRightRef = tryHostRef(eRight);
      if (eRightRef) return !eRightRef.equals(eLeft);
      const eLeftName = qualifiedNamesOf(eLeft);
      if (eLeftName) eLeft = eLeftName[3];
      const eRightName = qualifiedNamesOf(eRight);
      if (eRightName) eRight = eRightName[3];
    }
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
};

const debugWrappedBuiltinSteppers = new WeakMap();

export function debugWrapBuiltinSteppers (steppers: { [string]: Function }) {
  let ret = debugWrappedBuiltinSteppers.get(steppers);
  if (ret) return ret;
  ret = Object.create(steppers);
  for (const stepName in steppers) { // eslint-disable-line guard-for-in
    const stepper = steppers[stepName];
    if (typeof stepper !== "function") continue;
    ret[stepName] = function ( // eslint-disable-line
        valker: Valker, head: any, scope: ?Object, step: any, ...rest) {
      valker.info(`{ '${stepName}'/${stepper.name}, step:`,
          ...valker._dumpObject([...step].slice(1), 1),
          ", rest:", ...rest,
          ", head:", ...valker._dumpObject(head), ", scope:", dumpScope(scope));
      ++valker._indent;
      let nextHead;
      try {
        nextHead = stepper.call(this, valker, head, scope, step, ...rest);
        return nextHead;
      } finally {
        --valker._indent;
        valker.info(`} '${stepName}'/${stepper.name} ->`, ...valker._dumpObject(nextHead),
            ", scope:", dumpScope(scope));
      }
    };
    Object.defineProperty(ret[stepName], "name", { value: `${stepper.name}-debug` });
  }
  debugWrappedBuiltinSteppers.set(steppers, ret);
  return ret;
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
  if (vakon === null) return (typeof head === "object") ? valker.tryUnpack(head, true) : head;
  if (vakon[0] === "§'") return vakon[1];
  const ret = valker.advance(head, vakon, scope, nonFinalStep);
  if (typeof ret !== "object") return ret;
  return valker.tryUnpack(ret, true);
}

export function tryUnpackFullLiteral (valker: Valker, head: any, vakon: any, scope: ?Object,
    nonFinalStep: ?boolean): ?any {
  if ((typeof vakon !== "object") || (vakon === null)) return vakon;
  if (vakon[0] === "§'") return vakon[1];
  const ret = valker.advance(head, vakon, scope, nonFinalStep);
  if (typeof ret !== "object") return ret;
  return valker.tryUnpack(ret, true);
}

function _access (valker: Valker, head: Object | Transient, scope: ?Object,
    accessorStep: any) {
  const accessor = accessorStep[1];
  const isIndex = typeof accessor === "number";
  if (!isIndex) {
    const transient = valker.trySingularTransient(head, true);
    if (transient) {
      const resolvedObjectId = transient.get("id");
      const fieldInfo = resolvedObjectId
          ? { name: accessor, elevationInstanceId: resolvedObjectId }
          : { ...head._fieldInfo, name: accessor };
      return tryPackedField(
          getObjectRawField(valker, transient, accessor, fieldInfo,
            valker.getObjectTypeIntro(transient, head)),
          fieldInfo);
    }
    if ((head == null) || Array.isArray(head) || head._sequence) {
      throw new Error(`Cannot access ${
          (head == null) ? head : Array.isArray(head) ? "an array" : "sequence"
        } head with non-index <${accessor}>`);
    }
  } else if (head == null) {
    throw new Error(`Cannot access <${head}> head for <${accessor}>`);
  } else if (!Array.isArray(head)) {
    const indexedImmutable = (Iterable.isIndexed(head) && head)
        || (OrderedMap.isOrderedMap(head) && head.toIndexedSeq())
        || (head._sequence && elevateFieldRawSequence(
                valker, head._sequence, head._fieldInfo, undefined,
                valker._indent >= 0 ? valker._indent : undefined)
            .toIndexedSeq());
    if (!indexedImmutable) {
      throw new Error(`Cannot access non-array, non-sequence head with index <${accessor}>`);
    }
    const result = indexedImmutable.get(accessor);
    return (!head._type || head._fieldInfo.intro.isResource)
        ? result
        : packedSingular(result, head._type, head._fieldInfo);
  }
  // Object is a scope or a selection, not a denormalized resource.
  // Plain lookup is enough, but we must pack the result for the new head.
  return valker.tryPack(head[accessor]);
}

function _advance (valker: Valker, head: any, scope: ?Object, pathStep: BuiltinStep,
    nonFinalStep: ?boolean, initialIndex: number = 1, finalIndex: number = pathStep.length) {
  let index = initialIndex;
  let stepHead = head;
  let step, pathScope, type;
  try {
    // eslint-disable-next-line no-param-reassign
    for (; index < finalIndex; ++index) {
      // eslint-disable-next-line no-param-reassign
      if (index + 1 === finalIndex) nonFinalStep = false;
      step = pathStep[index];
      type = typeof step;
      switch (type) {
        case "function":
          // Inline call, delegate handling to it completely, including packing and unpacking.
          if (pathScope === undefined) {
            pathScope = !scope ? {} : nonFinalStep ? Object.create(scope) : scope;
          }
          stepHead = step(stepHead, pathScope || scope, valker, index + 1 < pathStep.length);
          continue;
        case "boolean": {
          const unpacked = valker.tryUnpack(stepHead, false);
          if (unpacked != null) continue;
          if (step) {
            throw new Error(`Valk path step head unpacks to '${unpacked}' at notNull assertion`);
          }
          return undefined;
        }
        case "object": {
          if (step === null) continue;
          if (!isSymbol(step)) {
            if (pathScope === undefined) {
              pathScope = !scope ? {} : nonFinalStep ? Object.create(scope) : scope;
            }
            const stepName = step[0];
            if (typeof stepName === "string") {
              if (typeof this[stepName] === "function") {
                type = this[stepName].name;
                stepHead = this[stepName](valker, stepHead, pathScope, step, nonFinalStep);
                continue;
              } else if (stepName === "§") {
                continue;
              } else if (stepName[0] === "§") {
                throw new Error(`Unrecognized step ${stepName}`);
              } else if (isTildeStepName(stepName)) {
                stepHead = _advance.call(this, valker, stepHead, pathScope,
                    [expandTildeVAKON(stepName, step)], nonFinalStep, 0);
                continue;
              }
            }
            if (Array.isArray(step)) {
              type = "array";
              stepHead = this["§[]"](valker, stepHead, pathScope, step, nonFinalStep, 0);
            } else if (Object.getPrototypeOf(step) === Object.prototype) {
              type = "object";
              stepHead = this["§{}"](valker, stepHead, pathScope, ["§{}", step], nonFinalStep);
            } else if (step instanceof Kuery) {
              throw new Error("Kuery objects must have been expanded as VAKON before valking");
            } else {
              throw new Error("Object steps must have Object.prototype as their prototype");
            }
            continue;
          }
        }
        // type === "object" implementations of Symbol must be allowed to fall through.
        // eslint-disable-line no-fallthrough
        case "string":
        case "symbol":
        case "number":
          stepHead = this["§."](valker, stepHead, pathScope || scope, ["§.", step], nonFinalStep);
          continue;
        default:
          throw new Error(`INTERNAL ERROR: Unrecognized step ${dumpify(step)}`);
      }
    }
    return stepHead;
  } catch (error) {
    const initialStackFrameSourceInfo = !error.sourceStackFrames && valker[SourceInfoTag];
    if (initialStackFrameSourceInfo) {
      addStackFrameToError(error, step, initialStackFrameSourceInfo, "runtime", valker);
    }
    const name = new Error(`raem§->/_advance#${index}: ${type}`);
    throw valker.wrapErrorEvent(error, 2, () => [name,
      "\n\tstep head:", ...dumpObject(stepHead),
      "\n\tstep:", type, ...dumpKuery(step),
      "\n\tpath head:", ...dumpObject(head),
      "\n\tpath:", ...dumpObject([...pathStep].slice(initialIndex, finalIndex)),
      "\n\tpath length:", pathStep.length,
      "\n\tscope:", dumpScope(pathScope),
    ]);
  }
}

function _map (valker: Valker, head: any, scope: ?Object, mapStep: any, nonFinalStep: ?boolean) {
  const ret = [];
  const mapScope = !scope ? {} : !nonFinalStep ? scope : Object.create(scope);
  const sequence = !head._sequence
      ? head
      : elevateFieldRawSequence(valker, head._sequence, head._fieldInfo);

  sequence.forEach((entry, index) => {
    const entryHead = !head._sequence ? valker.tryPack(entry) : entry;
    // mapScope.index = index;
    try {
      const result = this["§->"](valker, entryHead, mapScope, mapStep);
      ret.push(valker.tryUnpack(result, true));
    } catch (error) {
      throw valker.wrapErrorEvent(error, 1, () => [
        `raem§map/#${index}`,
        "\n\tmap head", ...dumpObject(sequence),
        "\n\tmap step:", ...dumpKuery(mapStep),
        `\n\tentry #${index} head:`, ...dumpObject(entryHead),
        "\n\tscope", dumpScope(mapScope),
      ]);
    }
  });
  return ret;
}

function _filter (valker: Valker, head: any, scope: ?Object, filterStep: any,
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
      const result = this["§->"](valker, entryHead, filterScope, filterStep);
      if (result) ret.push(isPackedSequence ? valker.tryUnpack(entry, true) : entry);
    } catch (error) {
      throw valker.wrapErrorEvent(error, 1, () => [
        `raem§filter/#${index}`,
        "\n\tfilter head:", ...dumpObject(sequence),
        "\n\tfilter step:", ...dumpKuery(filterStep),
        `\n\tentry #${index} head:`, ...dumpObject(entryHead),
        "\n\tscope", dumpScope(filterScope),
      ]);
    }
  });
  return ret;
}

export function resolveTypeof (valker: Valker, head: any, scope: ?Object,
    [, /* object */, equalTo]: BuiltinStep, packedObject: any) {
  let type = typeof packedObject;
  if ((type === "object") && packedObject) {
    // FIXME(iridian): This is a mess and definitely broken at the
    // corner cases. The VRL/packedField etc. system should be
    // streamlined. packedRef is a useful envelope for the head and
    // could very well be mandatory distinction between ValOS objects
    // and other types, which it now not quite isn't.
    // TODO(iridian, 2019-03): The [HostRef] symbol is possibly more
    // useful and generic concept than the packedRef system for
    // non-sequence heads.
    if (isPackedField(packedObject)) {
      if (packedObject._fieldInfo) {
        type = packedObject._fieldInfo.intro.isResource ? "Resource" : "Data";
      } else if (packedObject._singular) {
        const hostRef = tryHostRef(packedObject);
        if (hostRef) type = hostRef.typeof();
        else {
          const id = packedObject._singular.id;
          type = (id instanceof VRL) ? id.typeof()
              : id ? "Resource" : "Data";
        }
      } else type = "Resource";
    } else {
      const hostRef = tryHostRef(packedObject);
      if (hostRef) type = hostRef.typeof();
      else if (Iterable.isIterable(packedObject)) type = "Resource";
    }
  }
  if (equalTo === undefined) return type;
  const candidateType = (typeof equalTo !== "object")
      ? equalTo
      : tryLiteral(valker, head, equalTo, scope);
  return type === candidateType;
}

function _headOrScopeSet (valker: Valker, target: any, head: any, scope: ?Object,
    settersStep: any[]) {
  if (typeof settersStep[1] === "string") {
    return _headOrScopeSet(valker, target, head, scope, [null, [settersStep[1], settersStep[2]]]);
  }
  for (let index = 1; index !== settersStep.length; ++index) {
    const setter = settersStep[index];
    if (Array.isArray(setter)) {
      if ((setter.length < 2) || (setter.length > 3)) {
        invariantifyArray(setter, `${settersStep[0]}.setter#${index - 1}`,
            { min: 2, max: 3 });
      }
      const eKey = (typeof setter[0] !== "object") ? setter[0]
          : tryLiteral(valker, head, setter[0], scope);
      const setterValue = setter[setter.length - 1];
      const eValue = (typeof setterValue !== "object") || (setterValue === null) ? setterValue
          : tryUnpackLiteral(valker, head, setterValue, scope);
      if ((typeof eKey !== "string") && !isSymbol(eKey) && (typeof eKey !== "number")) {
        throw new Error(`${settersStep[0]}.setter#${index - 1}.key is not a string or a symbol`);
      }
      if (setter.length === 2) {
        target[eKey] = eValue;
      } else {
        Object.defineProperty(target[eKey], eKey, eValue);
      }
    } else if (setter && (typeof setter === "object")) {
      for (const key of Object.keys(setter)) {
        const value = setter[key];
        target[key] = (typeof value !== "object") || (value === null) ? value
            : tryUnpackLiteral(valker, head, value, scope);
      }
    } else {
      invariantifyObject(setter, `${settersStep[0]}.setter#${index - 1
          } must be an object or a key-value pair, got '${typeof setter}':`, setter);
    }
  }
  return target;
}


export const toVAKONTag = Symbol("ValOS.toVAKON");

export function isValOSFunction (callerCandidate: any) { return callerCandidate[toVAKONTag]; }

export function denoteValOSBuiltin (signature, description: any = "", deprecation) {
  return (vbcall: any) => {
    vbcall._isVCall = true;
    if (signature) vbcall._valkSignature = signature;
    setCallableDescription(vbcall, description);
    setCallableDeprecation(vbcall, deprecation);
    return vbcall;
  };
}

export function denoteValOSCallable (description: any = "", deprecation: string | Array) {
  return (callee: Function, calleeBody: Function = callee) => {
    const text = calleeBody.toString();
    return denoteValOSBuiltin(text.slice(8, text.indexOf(" {")), description, deprecation)(callee);
  };
}

export function denoteDeprecatedValOSCallable (description: any = "", deprecation: string | Array) {
  return (callee: any) => {
    function deprecatedFunction (...rest: any[]) {
      console.debug("DEPRECATED: call to builtin operation", callee,
          "\n\t", deprecatedFunction._valkDeprecation);
      return callee.apply(this, rest);
    }
    return denoteValOSCallable(description, deprecation)(deprecatedFunction, callee);
  };
}

/**
 * Creates a decorator for specifying a ValOS kuery function.
 * Kuery function is a convenience construct for defining builtin
 * functions in terms of Kuery VAKON. A notable convenience aspect of
 * Kuery functions that they accept /already evaluated/ values as
 * arguments and the VAKON they return ephemeral: it is immediately
 * evaluated and discarded.
 *
 * While this quirk is not most performant in itself (ephemeral VAKON
 * created runtime on every call, it allows for flexibility. Most
 * notably the ephemeral VAKON is fully live, and because the already
 * evaluated arguments can be inspected the ephemeral VAKON can be
 * minimal and fine-tuned. In addition because the ephemeral VAKON is
 * discarded after use and thus never persisted, it is transparent to
 * outside and can be freely changed (as long as its semantics are
 * preserved).
 *
 * @export
 * @param {*} [description=""]
 * @returns
 */
export function denoteValOSKueryFunction (
    description: any = "", { deprecation, cachingArguments } = {},
) {
  // FIXME(iridian, 2020-09): evaluate and actually implement the LRU. Current does not invalidate.
  let _vakonShouldBeLRUCache;
  return (createKuery: any) => {
    function vkall (...args: any[]) {
      try {
        let vakon;
        if (args.length === cachingArguments) {
          if (cachingArguments === 0) vakon = _vakonShouldBeLRUCache;
          else if (cachingArguments === 1) vakon = _vakonShouldBeLRUCache[args[0]];
        }
        if (vakon === undefined) {
          vakon = createKuery(...args);
          if (vakon instanceof Kuery) {
            throw new Error(`INTERNAL ERROR: builtin kuery function '${createKuery.name
                }' returns a VALK Kuery object and not VAKON${
                ""} (did you forget a '.toVAKON()' from the return value?)`);
          }
          if (args.length === cachingArguments) {
            if (cachingArguments === 0) _vakonShouldBeLRUCache = vakon;
            else if (cachingArguments === 1) {
              (_vakonShouldBeLRUCache
                  || (_vakonShouldBeLRUCache = Object.create(null)))[args[0]] = vakon;
            }
          }
        }
        return this.get(vakon, { discourse: this.__callerValker__ });
      } catch (error) {
        throw !this.__callerValker__ ? error
            : this.__callerValker__.wrapErrorEvent(error, 1, () => [
          `During ${createKuery.name}`,
          "\n\targs:", ...dumpObject(args),
        ]);
      }
    }
    vkall._valkCreateKuery = createKuery;
    return denoteValOSCallable(description, deprecation)(vkall, createKuery);
  };
}

export function setCallableDescription (callable, description: string | [string, string]) {
  if (!description) return;
  if (!Array.isArray(description)) {
    callable._valkDescription = description;
  } else {
    callable._valkDescription = description[0];
    callable._valkIntroduction = description.slice(1);
  }
}

export function setCallableDeprecation (callable, deprecation: string | [string, string]) {
  if (!deprecation) return;
  if (!Array.isArray(deprecation)) {
    callable._valkDeprecation = deprecation;
  } else {
    callable._valkDeprecation = `${deprecation[0]}, prefer: ${deprecation[1]}`;
    callable._valkDeprecatedPrefer = deprecation[1];
  }
}

function _createVCall (capturingValker: Valker, vakon: any, sourceInfo: ?Object,
    forwardSteppersStepName: ?string, captureName: ?string, capturedScope: any) {
  const vcall = function vcall () {
    const scope = Object.create(capturedScope);
    scope.arguments = Array.prototype.slice.call(arguments);
    let activeTransaction;
    // FIXME(iridian, 2019-05): Fix Undocumented dependency on
    // FalseProphetDiscourse transaction internal details.
    // Both valk §capture/§call and the Transactor/Fabricator systems
    // should probably be moved to @valos/script.
    if (capturingValker._transaction !== undefined) {
      if (capturingValker.isActiveFabricator()) {
        activeTransaction = capturingValker;
      } else {
        // Reset the transaction context to top level for
        // completed/rejected transactions for the non-valk caller
        // pathway. Do it here instead of in the branch #2 to
        // facilitate GC for branch #1 as well, as otherwise
        // valk-caller callbacks would never trigger the release of
        // a completed capturingValker transaction resources.
        // Captures with closures referring to completed transactions
        // but whose callbacks never get called retain memory
        // references indefinitely.
        capturingValker = capturingValker.getRootDiscourse(); // eslint-disable-line
      }
    }
    let transaction;
    let ret;
    let head = this;
    let advanceError;
    const valkCaller = head && head.__callerValker__;
    try {
      if (valkCaller) {
        transaction = valkCaller.acquireFabricator(`vcall-${captureName || "capture"}`);
      } else {
        // Direct caller is not valk context: this is a callback thunk
        // that is being called by fabric/javascript code.
        if (!head) head = capturedScope.this || {};
        transaction = capturingValker.acquireFabricator(`extcall-${captureName || "capture"}`);
        head = transaction.tryPack(head);
      }
      if (sourceInfo) transaction[SourceInfoTag] = sourceInfo;
      if (forwardSteppersStepName) {
        const callerSteppers = transaction._steppers[forwardSteppersStepName];
        if (callerSteppers) transaction.setSteppers(callerSteppers);
      }
      ret = transaction.advance(head, vakon, scope, true);
  } catch (error) {
      advanceError = error;
      // ? if (outerTransaction) throw error;
    }
    let transactionError;
    if (transaction) {
      try {
        if (!advanceError) {
          transaction.releaseFabricator();
          return valkCaller ? ret : transaction.tryUnpack(ret, true);
        }
        transaction.releaseFabricator({ rollback: advanceError });
      } catch (error) {
        transactionError = error;
      }
    }
    const contextText = valkCaller ? " (valk caller)"
        : activeTransaction ? " (external caller with active capture transaction)"
        : " (external non-transactional caller)";
    let opName;
    if (!transaction) {
      opName = `raem§call/acquireFabricator ${contextText}`;
    } else if (transactionError) {
      opName = `raem§call/releaseFabricator ${
          advanceError ? "({ rollback: true })" : "()"}${contextText}`;
    } else {
      opName = `raem§call/${valkCaller ? "advance" : "run"}${contextText}`;
      if (!valkCaller) {
        const absentChronicleSourcery = trySourcifyAbsentChroniclesAndThen(
          advanceError, () => vcall.apply(this, arguments));
        if (absentChronicleSourcery) return absentChronicleSourcery;
      }
    }
    const wrap = (transaction || capturingValker).wrapErrorEvent(
        transactionError || advanceError, 1,
        opName,
        ...((transactionError && advanceError)
            ? ["\n\t\tadvance rollback cause:", ...dumpObject(advanceError)] : []),
        "\n\tthis:", ...dumpObject(head),
        "\n\tcallee vakon:", ...dumpKuery(vakon),
        "\n\tscope:", ...dumpObject(scope),
        "\n\tret:", ...dumpObject(ret),
        "\n\ttransaction:", ...dumpObject(transaction),
        "\n\ttransaction.state:", ...dumpObject(transaction && transaction.getState().toJS()),
        "\n\tcapturingValker:", ...dumpObject(capturingValker),
        "\n\tcapturingValker.state:", ...dumpObject(
            capturingValker && capturingValker.getState().toJS()),
    );
    if (sourceInfo) addStackFrameToError(wrap, vakon, sourceInfo, opName, transaction);
    throw wrap;
  };
  vcall._isVCall = true;
  vcall[toVAKONTag] = vakon;
  vcall[SourceInfoTag] = sourceInfo;
  vcall._capturedScope = capturedScope;
  return vcall;
}

export function callOrApply (steppers: Object, valker: Valker, head: any, scope: ?Object,
    step: BuiltinStep, opName: string, eCallee_: any, eThis_: any, eArgs: any) {
  let eCallee = eCallee_;
  let eThis = eThis_;
  let kueryFunction;
  try {
    if (eCallee === undefined) {
      eCallee = tryLiteral(valker, head, step[1], scope);
    }
    if (typeof eCallee !== "function") {
      eCallee = steppers["§callableof"](valker, eCallee, scope, ["§callableof", null, opName]);
      invariantify(typeof eCallee === "function",
          `trying to call a non-function value of type '${typeof eCallee}'`,
          `\n\tfunction wannabe value:`, eCallee);
    }
    if (eCallee._valkCreateKuery) {
      if (eThis === undefined) {
        eThis = (step[2] === undefined) ? scope : tryLiteral(valker, head, step[2], scope);
        // TODO(iridian): Fix this kludge which enables namespace proxies
        eThis = (eThis[UnpackedHostValue] && tryHostRef(eThis)) || eThis;
      }
      kueryFunction = eCallee._valkCreateKuery(...eArgs);
      return valker.advance(eThis, kueryFunction, scope);
    }
    if (eThis === undefined) {
      eThis = (step[2] === undefined)
          ? scope : tryUnpackLiteral(valker, head, step[2], scope);
      eThis = (eThis[UnpackedHostValue] && tryUnpackedHostValue(eThis)) || eThis;
    }
    if (eCallee._isVCall) {
      if (eThis == null) {
        eThis = { __callerValker__: valker, __callerScope__: scope };
      } else if ((typeof eThis === "object") || (typeof eThis === "function")) {
        eThis = Object.create(eThis);
        eThis.__callerValker__ = valker;
        eThis.__callerScope__ = scope;
      }
    } else {
      for (let i = 0; i !== eArgs.length; ++i) {
        if (isHostRef(eArgs[i])) {
          eArgs[i] = steppers["§argumentof"](
              valker, eArgs[i], scope, ["§argumentof", null, opName]);
        }
      }
    }
    const ret = (opName === "§apply")
        ? eCallee.apply(eThis, eArgs)
        : eCallee.call(eThis, ...eArgs);
    if ((ret != null) && ret.then && isPromise(ret)) {
      ret.catch(error => {
        valker.outputErrorEvent(
            onError(error),
            1,
            `Exception re-raised by VALK.${opName}('${eCallee.name}').ret:Promise.catch`);
        throw error;
      });
    }
    const ret2 = eCallee._capturedScope ? ret : valker.tryPack(ret);
    // if (ret2 === null) console.log("ret2:", ret, ret2);
    return ret2;
  } catch (error) {
    throw onError(error);
  }
  function onError (error) {
    return valker.wrapErrorEvent(error, 1, `raem${opName}`,
        "\n\thead:", ...dumpObject(head),
        "\n\tcallee (is vcall):", (eCallee != null) && eCallee._isVCall, ...dumpObject(eCallee),
        "(via kuery:", ...dumpKuery(step[1]), ")",
        "\n\tthis:", ...dumpObject(eThis),
        "(via kuery:", ...dumpKuery(step[2]), ")",
        "\n\targs:", ...dumpObject(eArgs),
        "(via VAKONs:", ...dumpKuery(opName === "§apply" ? step[3] : step.slice(3)), ")",
        ...(kueryFunction ? ["\n\tkueryFunction VAKON:", ...dumpKuery(kueryFunction)] : []),
        "\n\tstate:", ...dumpObject(valker.getState().toJS()),
    );
  }
}
