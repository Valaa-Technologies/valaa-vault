// @flow

import { Valker, dumpKuery } from "~/raem/VALK";
import type { BuiltinStep } from "~/raem/VALK"; // eslint-disable-line no-duplicate-imports
import { tryUnpackedHostValue } from "~/raem/VALK/hostReference";

import { isHostRef, tryLiteral, tryFullLiteral, tryUnpackLiteral } from "~/raem/VALK/raemSteppers";

import valoscriptSteppers from "~/script/VALSK/valoscriptSteppers";
import { isNativeIdentifier, getNativeIdentifierValue } from "~/script";

import getImplicitCallable from "~/engine/Vrapper/getImplicitCallable";
import { tryNamespaceFieldSymbolOrPropertyName } from "~/engine/valosheath/namespace";

// import { createNativeIdentifier } from "~/script/denormalized/nativeIdentifier";

import { isSymbol, dumpObject } from "~/tools";

const engineSteppers = Object.assign(Object.create(valoscriptSteppers), {
  "§callableof": callableOf,
  "§argumentof": argumentOf,
  "§method": toMethod,
  "§$$": function _identifierValue (valker: Valker, head: any, scope: ?Object,
      getIdentifierOp: any): any {
    return _engineIdentifierOrPropertyValue(this,
        valker, head, scope, getIdentifierOp[1], getIdentifierOp[2], false);
  },
  "§..": function _propertyValue (valker: Valker, head: any, scope: ?Object, getPropertyOp: any) {
    return _engineIdentifierOrPropertyValue(this,
        valker, head, scope, getPropertyOp[1], getPropertyOp[2], true);
  },
});

engineSteppers["§nonlive"] = engineSteppers;
export default engineSteppers;

function callableOf (valker: Valker, head: any, scope: ?Object,
    [, callee, toRoleName]: BuiltinStep) {
  let eCandidate;
  try {
    eCandidate = tryUnpackLiteral(valker, head, callee, scope);
    if (typeof eCandidate === "function") return eCandidate;
    const roleName = tryUnpackLiteral(valker, head, toRoleName, scope);
    const vrapper = tryUnpackedHostValue(eCandidate);
    if (vrapper && (vrapper.tryTypeName() === "Media")) {
      return getImplicitCallable(vrapper, roleName, { discourse: valker });
    }
    throw new Error(`Can't convert ${typeof eCandidate} callee to a function for ${roleName}`);
  } catch (error) {
    throw valker.wrapErrorEvent(error, 2, () => [
      `§callableof`,
      "\n\thead:", ...dumpObject(head),
      "\n\tcallee candidate:", ...dumpObject(eCandidate),
    ]);
  }
}

function argumentOf (valker: Valker, head: any /* , scope: ?Object,
    [, hostValue]: BuiltinStep */) {
  let eHostValue;
  try {
    /*
    // Temporarily disabled
    eHostValue = tryUnpackLiteral(valker, head, hostValue, scope);
    if (eHostValue != null) {
      const vrapper = tryUnpackedHostValue(eHostValue);
      if (vrapper && (vrapper.tryTypeName() === "Media")) {
        const contentType = vrapper.resolveMediaInfo({ discourse: valker }).contentType;
        if ((contentType === "application/javascript")
            || (contentType === "application/valaascript")
            || (contentType === "application/valoscript")) {
          const ret = vrapper.extractValue({ discourse: valker, synchronous: true });
          if (ret !== undefined) {
            if ((ret != null) && (typeof ret.default === "function")) return ret.default;
            return ret;
          }
        }
      }
    }
    */
    return head;
  } catch (error) {
    throw valker.wrapErrorEvent(error, 2, () => [
      `§argumentOf`,
      "\n\thead:", ...dumpObject(head),
      "\n\tcallee candidate:", ...dumpObject(eHostValue),
    ]);
  }
}

function toMethod (valker: Valker, head: any, scope: ?Object, [, callableName]: any,
    hostHead?: Object) {
  if (valker.pure) {
    // TODO(iridian): kuery protection is disabled as it's not
    // semantically pure (pun intended). It was intended to denote
    // kueries which have no side effects and could thus be called
    // freely. This relevant for kueries performing UI rendering, for
    // example. However the theory of abstraction piercing methods and
    // purity being congruent did not hold for a day.
    // This system should be re-thought: idempotency and abstraction
    // piercing are separate concepts.
    // throw new Error("'`getHostCallable' VALK abstraction piercing found in pure kuery");
  }
  // FIXME(iridian) So messy... the big idea here was to treat the
  // abstraction piercing host methods as first class objects, so that
  // they can be given to §call/§apply. But the annoying thing with
  // that is that there needs to be a way to forward the valker as
  // a discourse to the Vrapper methods so that they can keep accessing
  // and modifying any possible transactional state. So getVALKMethod
  // below encapsulates the valker, transient and scope etc. in
  // a closure and then constructs a native function which uses them,
  // so that the native function can pretend to be a normal javascript
  // function.
  // So we get to keep some of the expressive power at the cost of both
  // complexity and performance. Luckily with valoscript no external
  // interface exposes these details anymore so they can eventually be
  // simplified and made performant.
  // TODO(iridian, 2019-04): This simplification process was implemented
  // for property and identifier accesses with
  // the _engineIdentifierOrPropertyValue function below, which no
  // longer uses this toMethod (unlike the valoscript alternative).
  const transient = valker.trySingularTransient(head);
  const actualHostHead = hostHead || valker.unpack(transient) || head;
  if (!actualHostHead || !actualHostHead.getVALKMethod) {
    throw valker.wrapErrorEvent(
        new Error("Can't find host object or it is missing member .getVALKMethod"),
        1, () => [
          `§method(${callableName})`,
          "\n\thead:", ...dumpObject(head),
          "\n\thostValue:", ...dumpObject(actualHostHead),
        ],
      );
  }
  const eMethodName = (typeof callableName !== "object") ? callableName
      : tryLiteral(valker, head, callableName, scope);
  return actualHostHead.getVALKMethod(eMethodName, valker, transient, scope);
}

function _engineIdentifierOrPropertyValue (steppers: Object, valker: Valker, head: any,
      scope: ?Object, propertyName: string, container: any, isGetProperty: ?boolean,
      allowUndefinedIdentifier: ?boolean): any {
  let eContainer = (container === undefined)
      ? (isGetProperty ? head : scope)
      : tryFullLiteral(valker, head, container, scope);
  const ePropertyName = (typeof propertyName !== "object") || isSymbol(propertyName)
      ? propertyName
      : tryLiteral(valker, head, propertyName, scope);
  try {
    if (eContainer._sequence) {
      eContainer = valker.tryUnpack(eContainer, true);
    } else if (isHostRef(eContainer)) {
      const vContainer = tryUnpackedHostValue(eContainer) || valker.unpack(eContainer);
      return valker.tryPack(vContainer.propertyValue(
          tryNamespaceFieldSymbolOrPropertyName(eContainer, ePropertyName),
          { discourse: valker }));
    }
    const property = eContainer[ePropertyName];
    if (isGetProperty) return valker.tryPack(property);
    if ((property === undefined) && !allowUndefinedIdentifier
        && !(ePropertyName in eContainer)) {
      throw new Error(`Cannot find identifier '${ePropertyName}' in scope`);
    }
    if ((typeof property !== "object") || (property === null)) return property;
    return valker.tryPack(
        isNativeIdentifier(property)
            ? getNativeIdentifierValue(property)
        : (property._typeName === "Property") && isHostRef(valker.tryPack(property))
            ? property.extractValue({ discourse: valker }, eContainer.this)
            : property);
  } catch (error) {
    let actualError = error;
    if (eContainer == null) {
      actualError = new Error(`Cannot access ${isGetProperty ? "property" : "identifier"} '${
        String(ePropertyName)}' from ${isGetProperty ? "non-object-like" : "non-scope"
        } value '${String(eContainer)}'`);
    } else if ((typeof ePropertyName !== "string") && !isSymbol(ePropertyName)) {
      actualError = new Error(`Cannot use a value with type '${typeof ePropertyName}' as ${
          isGetProperty ? "property" : "identifier"} name`);
    }
    throw valker.wrapErrorEvent(actualError, 1, isGetProperty ? "getProperty" : "getIdentifier",
        "\n\thead:", ...dumpObject(head),
        "\n\tcontainer:", ...dumpObject(eContainer),
        "(via kuery:", ...dumpKuery(container), ")",
        "\n\tpropertyName:", ...dumpObject(ePropertyName),
        "(via kuery:", ...dumpKuery(propertyName), ")",
    );
  }
}
