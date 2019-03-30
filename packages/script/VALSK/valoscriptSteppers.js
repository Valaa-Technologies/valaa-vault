// @flow

import { dumpKuery, dumpObject, Valker } from "~/raem/VALK";
import raemSteppers, {
  tryLiteral, tryFullLiteral, tryUnpackLiteral, isHostRef, resolveTypeof, callOrApply
} from "~/raem/VALK/raemSteppers";
import type { BuiltinStep } from "~/raem/VALK/raemSteppers"; // eslint-disable-line no-duplicate-imports

import { createNativeIdentifier, isNativeIdentifier, getNativeIdentifierValue,
  setNativeIdentifierValue,
} from "~/script/denormalized/nativeIdentifier";

const isSymbol = require("~/tools/isSymbol").default;

export default Object.freeze({
  ...raemSteppers,
  // @valos/script property builtin steppers
  "§let$$": function _createLetIdentifier (valker: Valker, head: any, scope: ?Object,
      [, value]: Object) {
    return createNativeIdentifier(
        (typeof value !== "object" ? value : tryUnpackLiteral(valker, head, value, scope)));
  },
  "§const$$": function _createConstIdentifier (valker: Valker, head: any, scope: ?Object,
      [, value]: Object) {
    return Object.freeze(createNativeIdentifier(
        (typeof value !== "object" ? value : tryUnpackLiteral(valker, head, value, scope))));
  },
  "§$$": function _identifierValue (valker: Valker, head: any, scope: ?Object,
      getIdentifierOp: any): any {
    return _getIdentifierOrPropertyValue(
        valker, head, scope, getIdentifierOp[1], getIdentifierOp[2], false);
  },
  "§..": function _propertyValue (valker: Valker, head: any, scope: ?Object, getPropertyOp: any) {
    return _getIdentifierOrPropertyValue(
        valker, head, scope, getPropertyOp[1], getPropertyOp[2], true);
  },
  "§$$<-": function _alterIdentifier (valker: Valker, head: any, scope: ?Object,
      alterIdentifierOp: any) {
    return _alterIdentifierOrPropertyValue(valker, head, scope, alterIdentifierOp, false);
  },
  "§..<-": function _alterProperty (valker: Valker, head: any, scope: ?Object,
      alterPropertyOp: any) {
    return _alterIdentifierOrPropertyValue(valker, head, scope, alterPropertyOp, true);
  },
  "§delete$$": function _deleteIdentifier (valker: Valker, head: any, scope: ?Object,
      deletePropertyOp: any) {
    return _deleteIdentifierOrProperty(valker, head, scope, deletePropertyOp, false);
  },
  "§delete..": function _deleteProperty (valker: Valker, head: any, scope: ?Object,
      deletePropertyOp: any) {
    return _deleteIdentifierOrProperty(valker, head, scope, deletePropertyOp, true);
  },
  "§invoke": _invoke,
  "§new": _new,
  "§typeof": function _typeof (valker: Valker, head: any, scope: ?Object,
      typeofStep: BuiltinStep) {
    const object = typeofStep[1];
    const packedObject = typeof object !== "object" ? object
    // typeof must not fail on a missing global identifier, even if plain identifier access fails.
        : (Array.isArray(object) && (object[0] === "§$$"))
            ? _getIdentifierOrPropertyValue(valker, head, scope, object[1], object[2], false, true)
        : tryLiteral(valker, head, object, scope);
    return resolveTypeof(valker, head, scope, typeofStep, packedObject);
  },
  "§while": function _while (valker: Valker, head: any, scope: ?Object,
      [, toTest, toStep = null]: any) {
    if (typeof toStep !== "object" || (toStep === null)) {
      while (typeof toTest !== "object" ? toTest : valker.advance(head, toTest, scope));
      return head;
    }
    let stepHead = head;
    if ((typeof toTest !== "object") || (toTest === null)) {
      while (toTest) {
        stepHead = valker.advance(stepHead, toStep, scope);
      }
    } else {
      while (valker.advance(stepHead, toTest, scope)) {
        stepHead = valker.advance(stepHead, toStep, scope);
      }
    }
    return stepHead;
  },
});

const _propertyValueMethodStep = ["§method", "propertyValue"];

function _getIdentifierOrPropertyValue (valker: Valker, head: any, scope: ?Object,
      propertyName: string, container: any, isGetProperty: ?boolean,
      allowUndefinedIdentifier: ?boolean): any {
  let eContainer: Object;
  let ePropertyName: string | Symbol;
  try {
    eContainer = (container === undefined)
        ? (isGetProperty ? head : scope)
        : tryFullLiteral(valker, head, container, scope);
    ePropertyName = (typeof propertyName !== "object") ? propertyName
        : tryLiteral(valker, head, propertyName, scope);
    if (eContainer._sequence) {
      eContainer = valker.tryUnpack(eContainer, true);
    } else if (isHostRef(eContainer)) {
      const ret = valker.tryPack(valker._steppers["§method"](
          valker, eContainer, scope, _propertyValueMethodStep)(ePropertyName));
      return ret;
    }
    const property = eContainer[ePropertyName];
    if (isGetProperty) return valker.tryPack(property);
    if ((property === undefined) && !allowUndefinedIdentifier
        && !(ePropertyName in eContainer)) {
      throw new Error(`Cannot find identifier '${ePropertyName}' in scope`);
    }
    if ((typeof property !== "object") || (property === null)) return property;
    const ret = isNativeIdentifier(property) ? getNativeIdentifierValue(property)
        // FIXME(iridian): Leaking abstractions like there's no tomorrow. This (among many other
        // parts of this file) belong to the @valos/engine steppers-extension, which
        // doesn't exist, which is the reason these are not there.
        : (property._typeName === "Property") && isHostRef(valker.tryPack(property))
            ? property.extractValue({ transaction: valker }, eContainer.this)
            : property;
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

const _alterPropertyMethodStep = ["§method", "alterProperty"];

function _alterIdentifierOrPropertyValue (valker: Valker, head: any, scope: ?Object,
      [, propertyName, alterationVAKON, container]: any, isAlterProperty: ?boolean) {
  let eContainer: Object;
  let ePropertyName;
  let eAlterationVAKON;
  try {
    eContainer = (typeof container === "undefined")
        ? (isAlterProperty ? head : scope)
        : tryFullLiteral(valker, head, container, scope);
    ePropertyName = typeof propertyName !== "object" ? propertyName
        : tryLiteral(valker, head, propertyName, scope);
    eAlterationVAKON = typeof alterationVAKON !== "object" ? alterationVAKON
        : tryLiteral(valker, head, alterationVAKON, scope);
    if (isHostRef(eContainer)) {
      if (!eContainer._sequence) {
        return valker.tryPack(valker._steppers["§method"](
            valker, eContainer, scope, _alterPropertyMethodStep)(ePropertyName, eAlterationVAKON));
      }
      // TODO(iridian): Implement host sequence entry manipulation.
      throw new Error(`Modifying host sequence entries via index assignment not implemented yet`);
    }
    const property = eContainer[ePropertyName];
    if (isAlterProperty) {
      const packedNewValue = valker.advance(valker.pack(property), eAlterationVAKON, scope);
      eContainer[ePropertyName] = valker.tryUnpack(packedNewValue, true);
      return packedNewValue;
    }
    if ((typeof property === "object") && (property !== null)) {
      if (isNativeIdentifier(property)) {
        const packedNewValue = valker.advance(
            valker.tryPack(getNativeIdentifierValue(property)), eAlterationVAKON, scope);
        setNativeIdentifierValue(property, valker.tryUnpack(packedNewValue, true));
        return packedNewValue;
      }
      if ((typeof property.alterValue === "function") && isHostRef(valker.tryPack(property))) {
        return valker.tryPack(
            property.alterValue(eAlterationVAKON, { transaction: valker }, eContainer.this));
      }
    }
    throw new Error(`Cannot modify read only or non-existent scope identifier '${
        ePropertyName}' (with current value '${property}')`);
  } catch (error) {
    let actualError = error;
    // These are here as a performance optimization. The invariantifications are not cheap
    // and can be performed as a reaction to javascript native exception thrown on
    // eContainer[ePropertyName] line
    if (!error.originalError) {
      if ((typeof eContainer !== "object") || (eContainer === null)) {
        actualError = new Error(`Cannot modify ${isAlterProperty ? "property" : "identifier"} '${
            String(ePropertyName)}' of ${
            isAlterProperty ? "non-object" : "non-scope"} value '${String(eContainer)}'`);
      } else if ((typeof ePropertyName !== "string") && !isSymbol(ePropertyName)) {
        actualError = new Error(`Cannot use a value with type '${typeof ePropertyName}' as ${
            isAlterProperty ? "property" : "identifier"} name when modifying`);
      }
    }
    /*
    invariantifyObject(eAlterationVAKON, "alterProperty.alterationVAKON after valking", {},
        "\n\talterationVAKON:", ...dumpKuery(alterationVAKON),
        "\n\talterationVAKON run:", eAlterationVAKON);
    */
    throw valker.wrapErrorEvent(actualError, isAlterProperty ? "alterProperty" : "alterIdentifier",
        "\n\thead:", ...dumpObject(head),
        "\n\tcontainer:", ...dumpObject(eContainer),
        "(via kuery:", ...dumpKuery(container), ")",
        "\n\tpropertyName:", ...dumpObject(ePropertyName),
        "(via kuery:", ...dumpKuery(propertyName), ")",
        "\n\talterationVAKON:", ...dumpObject(eAlterationVAKON),
        "(via kuery:", ...dumpKuery(alterationVAKON), ")",
    );
  }
}

const _deletePropertyMethodStep = ["§method", "deleteProperty"];

function _deleteIdentifierOrProperty (valker: Valker, head: any, scope: ?Object,
      [, propertyName, container]: any, isPropertyNotIdentifier: ?boolean) {
  let eContainer: Object;
  let ePropertyName;
  try {
    eContainer = (typeof container === "undefined")
        ? (isPropertyNotIdentifier ? head : scope)
        : tryFullLiteral(valker, head, container, scope);
    ePropertyName = typeof propertyName !== "object" ? propertyName
        : tryLiteral(valker, head, propertyName, scope);
    if (isHostRef(eContainer)) {
      if (eContainer._sequence) {
        // TODO(iridian): Implement host sequence entry manipulation.
        throw new Error(`Deleting host sequence entries via index not implemented yet`);
      }
      return valker._steppers["§method"](
          valker, eContainer, scope, _deletePropertyMethodStep)(ePropertyName);
    }
    if (isPropertyNotIdentifier) {
      if (delete eContainer[ePropertyName]) return true;
      throw new SyntaxError(`Cannot delete non-configurable property '${ePropertyName}'`);
    }
    const property = eContainer[ePropertyName];
    if ((typeof property === "object") && (property !== null)) {
      if (isNativeIdentifier(property)) {
        throw new SyntaxError(
            `Cannot delete regular variable '${String(ePropertyName)}' from scope`);
      }
      if ((typeof property.deleteValue === "function") && isHostRef(valker.tryPack(property))) {
        property.destroy({ transaction: valker });
        return true;
      }
    }
    throw new SyntaxError(`Cannot delete non-existent (or immutable) identifier '${ePropertyName
        }' from scope`);
  } catch (error) {
    let actualError = error;
    if (!error.originalError) {
      if ((typeof eContainer !== "object") || (eContainer === null)) {
        actualError = new Error(`Cannot delete ${
                isPropertyNotIdentifier ? "property" : "identifier"} '${
            String(ePropertyName)}' of ${
            isPropertyNotIdentifier ? "non-object" : "non-scope"} value '${String(eContainer)}'`);
      } else if ((typeof ePropertyName !== "string") && !isSymbol(ePropertyName)) {
        actualError = new Error(`Cannot use a value with type '${typeof ePropertyName}' as ${
            isPropertyNotIdentifier ? "property" : "identifier"} name when deleting`);
      }
    }
    throw valker.wrapErrorEvent(actualError,
        isPropertyNotIdentifier ? "deleteProperty" : "deleteIdentifier",
        "\n\thead:", ...dumpObject(head),
        "\n\tcontainer:", ...dumpObject(eContainer),
        "(via kuery:", ...dumpKuery(container), ")",
        "\n\tpropertyName:", ...dumpObject(ePropertyName),
        "(via kuery:", ...dumpKuery(propertyName), ")",
    );
  }
}

// TODO(iridian): clarify the relationship between raem/VALK/hostReference.HostRef and
// ValoscriptPrimitiveKind. ValoscriptPrimitiveKind might be an alias for it.
export const ValoscriptPrimitiveKind = Symbol("Valoscript.PrimitiveKind");
export const ValoscriptPrimitive = {
  [ValoscriptPrimitiveKind]: null, // must be overridden
};

export const ValoscriptInterface = Object.assign(Object.create(ValoscriptPrimitive), {
  [ValoscriptPrimitiveKind]: "Interface",
});

export const ValoscriptNew = Symbol("Valoscript.constructor");
export const ValoscriptType = Object.assign(Object.create(ValoscriptPrimitive), {
  [ValoscriptPrimitiveKind]: "Type",
  [ValoscriptNew] () {
    throw new Error(`Valoscript constructor not defined for type ${
        this.name || (this.constructor || { name: "unnamed" }).name}`);
  },
});

export const ValoscriptPrototype = Object.assign(Object.create(ValoscriptPrimitive), {
  [ValoscriptPrimitiveKind]: "Prototype",
});

function _invoke (valker: Valker, head: any, scope: ?Object, invokeStep: BuiltinStep) {
  const eArgs = invokeStep.length <= 2 ? [] : new Array(invokeStep.length - 2);
  for (let index = 0; index + 2 < invokeStep.length; ++index) {
    const arg = invokeStep[index + 2];
    eArgs[index] = tryUnpackLiteral(valker, head, arg, scope);
  }
  const eCallee = _getIdentifierOrPropertyValue(
      valker, head, scope, invokeStep[1], undefined, true);
  if (eCallee === undefined) {
    throw new Error(`Could not find callee '${invokeStep[1]}' from head`);
  }
  return callOrApply(valker, head, scope, invokeStep, "§invoke", eCallee, head, eArgs);
}

function _new (valker: Valker, head: any, scope: ?Object, newOp: any) {
  let Type;
  let eArgs;
  try {
    const eType = valker.advance(head, newOp[1], scope);
    eArgs = new Array(newOp.length - 2);
    for (let index = 0; index + 2 !== newOp.length; ++index) {
      const arg = newOp[index + 2];
      eArgs[index] = tryUnpackLiteral(valker, head, arg, scope);
    }
    Type = valker.tryUnpack(eType, true);
    if (typeof Type === "function") {
      return valker.pack(new Type(...eArgs));
    }
    const constructor = (Type != null) && Type[ValoscriptNew];
    if (constructor) {
      return valker.pack(Type[ValoscriptNew](valker, scope, ...eArgs));
    }
    if (isHostRef(eType)) {
      const PrototypeType = scope.valos[Type.getTypeName({ transaction: valker })];
      return valker.pack(PrototypeType[".instantiate"](valker, scope, Type, ...eArgs));
    }
    throw new Error(`'new': cannot create object of type '${typeof Type
        }', expected either a function for native object construction, a ValOS type for${
        ""} ValOS object creation or a ValOS Resource for instantiation`);
  } catch (error) {
    throw valker.wrapErrorEvent(error, `builtin.§new`,
        "\n\tType:", ...dumpObject(Type),
        "\n\targs:", ...dumpObject(eArgs));
  }
}
