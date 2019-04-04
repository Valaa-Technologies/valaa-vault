// @flow

import { Valker, dumpKuery } from "~/raem/VALK";
import type { BuiltinStep } from "~/raem/VALK"; // eslint-disable-line no-duplicate-imports
import { tryUnpackedHostValue } from "~/raem/VALK/hostReference";

import { isHostRef, tryLiteral, tryFullLiteral, tryUnpackLiteral } from "~/raem/VALK/raemSteppers";

import valoscriptSteppers from "~/script/VALSK/valoscriptSteppers";
import { isNativeIdentifier, getNativeIdentifierValue } from "~/script";

import getImplicitCallable from "~/engine/Vrapper/getImplicitCallable";
import { NamespaceInterfaceTag } from "~/engine/valospace/namespace";

// import { createNativeIdentifier } from "~/script/denormalized/nativeIdentifier";

import { isSymbol, wrapError, dumpObject } from "~/tools";

export default Object.assign(Object.create(valoscriptSteppers), {
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
    throw wrapError(error, `During ${valker.debugId()}\n .callableof, with:`,
        "\n\thead:", ...dumpObject(head),
        "\n\tcallee candidate:", ...dumpObject(eCandidate),
    );
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
        const mime = vrapper.resolveMediaInfo({ discourse: valker }).mime;
        if ((mime === "application/javascript")
            || (mime === "application/valaascript") || (mime === "application/valoscript")) {
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
    throw wrapError(error, `During ${valker.debugId()}\n .argumentOf, with:`,
        "\n\thead:", ...dumpObject(head),
        "\n\tcallee candidate:", ...dumpObject(eHostValue),
    );
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
    throw wrapError(new Error("Can't find host object or it is missing member .getVALKMethod"),
        `During ${valker.debugId()}\n .toMethod(${callableName}), with:`,
        "\n\thead:", ...dumpObject(head),
        "\n\thostValue:", ...dumpObject(actualHostHead));
  }
  const eMethodName = (typeof callableName !== "object") ? callableName
      : tryLiteral(valker, head, callableName, scope);
  return actualHostHead.getVALKMethod(eMethodName, valker, transient, scope);
}

function _engineIdentifierOrPropertyValue (steppers: Object, valker: Valker, head: any,
      scope: ?Object, propertyName: string, container: any, isGetProperty: ?boolean,
      allowUndefinedIdentifier: ?boolean): any {
  let eContainer: Object;
  let ePropertyName: string | Symbol;
  try {
    eContainer = (container === undefined)
        ? (isGetProperty ? head : scope)
        : tryFullLiteral(valker, head, container, scope);
    ePropertyName = (typeof propertyName !== "object") || isSymbol(propertyName)
        ? propertyName
        : tryLiteral(valker, head, propertyName, scope);
    let ret;
    if (eContainer._sequence) {
      eContainer = valker.tryUnpack(eContainer, true);
    } else if (isHostRef(eContainer)) {
      const vContainer = tryUnpackedHostValue(eContainer) || valker.unpack(eContainer);
      const namespace = eContainer[NamespaceInterfaceTag];
      if (namespace) {
        const symbol = namespace._namespaceFields[ePropertyName];
        if (!symbol) {
          throw new Error(`Namespace ${namespace.name} interface doesn't implement field ${
              ePropertyName}`);
        }
        ePropertyName = symbol;
      }
      return valker.tryPack(vContainer.propertyValue(ePropertyName, { discourse: valker }));
    }
    ret = eContainer[ePropertyName];
    if (!isGetProperty) {
      if ((ret === undefined) && !allowUndefinedIdentifier
          && !(ePropertyName in eContainer)) {
        throw new Error(`Cannot find identifier '${ePropertyName}' in scope`);
      }
      if ((typeof ret !== "object") || (ret === null)) return ret;
      ret = isNativeIdentifier(ret) ? getNativeIdentifierValue(ret)
          : (ret._typeName === "Property") && isHostRef(valker.tryPack(ret))
              ? ret.extractValue({ discourse: valker }, eContainer.this)
              : ret;
    }
    return valker.tryPack(ret);
  } catch (error) {
    let actualError = error;
    if (!error.originalError) {
      if ((eContainer === null)
          || ((typeof eContainer !== "object") && (typeof eContainer !== "function")
              && (typeof eContainer !== "string"))) {
        actualError = new Error(`Cannot access ${isGetProperty ? "property" : "identifier"} '${
            String(ePropertyName)}' from ${isGetProperty ? "non-object-like" : "non-scope"
            } value '${String(eContainer)}'`);
      } else if ((typeof ePropertyName !== "string") && !isSymbol(ePropertyName)) {
        actualError = new Error(`Cannot use a value with type '${typeof ePropertyName}' as ${
            isGetProperty ? "property" : "identifier"} name`);
      }
    }
    throw valker.wrapErrorEvent(actualError, isGetProperty ? "getProperty" : "getIdentifier",
        "\n\thead:", ...dumpObject(head),
        "\n\tcontainer:", ...dumpObject(eContainer),
        "(via kuery:", ...dumpKuery(container), ")",
        "\n\tpropertyName:", ...dumpObject(ePropertyName),
        "(via kuery:", ...dumpKuery(propertyName), ")",
    );
  }
}
