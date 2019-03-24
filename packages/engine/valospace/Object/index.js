// @flow

import { PartialRemovesTag } from "~/raem/state/partialSequences";

import { BuiltinTypePrototype, ValOSPrimitiveTag } from "~/script";

import VALEK, { expressionFromProperty } from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";
import {
  createHostPrototypeFieldDescriptor, createHostMaterializedFieldDescriptor,
  createHostFunctionDescriptor, createHostPropertyDescriptor,
} from "~/engine/valospace/hostPropertyDescriptors";

import { wrapError, dumpObject } from "~/tools";

/**
 * Creates a ValOS-decorated Object constructor for use inside
 * valoscript as the standard Object. The decorator overrides all
 * standard Object as well as all Object.prototype methods and
 * properties so that they work transparently with ValOS Resource's ie.
 * Vrapper's.
 *
 * @export
 * @param {Object} valos
 * @returns
 */
export default function extendObject (scope: Object, hostObjectDescriptors: Map<any, Object>,
    valos: Object) {
  const UndecoratedObject = scope.Object || Object;
  scope.Object = function DecoratedObject (...rest) {
    return UndecoratedObject.call(this, ...rest);
  };
  scope.Object.prototype = Object.prototype;


  function _createArg0Dispatcher (description: string, objectOperation: () => any,
      valosOperation, valosTypeOperation = objectOperation,
      valosPrototypeOperation = objectOperation) {
    const ret = function objectDecoratorArg0Dispatcher (...rest) {
      const isValos0 = (typeof rest[0] === "object") && (rest[0] !== null)
          && rest[0][ValOSPrimitiveTag];
      return (!isValos0 ? objectOperation
              : rest[0] instanceof Vrapper ? valosOperation
              : BuiltinTypePrototype.isPrototypeOf(rest[0]) ? valosTypeOperation
              : valosPrototypeOperation)
          .apply(this, rest);
    };
    ret._valkDescription = description;
    ret._valkCaller = true;
    return ret;
  }

  function _createArg01Dispatcher (description: string, objectOperation: () => any,
      valosOperation: () => any) {
    const ret = function objectDecoratorArg01Dispatcher (...rest) {
      const isValos0 = (typeof rest[0] === "object") && (rest[0] !== null)
          && rest[0][ValOSPrimitiveTag];
      const isValos1 = (typeof rest[1] === "object") && (rest[1] !== null)
          && rest[1][ValOSPrimitiveTag];
      return (!isValos0 && !isValos1 ? objectOperation : valosOperation).apply(this, rest);
    };
    ret._valkDescription = description;
    ret._valkCaller = true;
    return ret;
  }

  scope.Object.is = _createArg01Dispatcher("", Object.is, isWithResource);

  scope.Object.create = _createArg0Dispatcher("", Object.create, createWithResource);
  scope.Object.getPrototypeOf = _createArg01Dispatcher("", Object.getPrototypeOf,
      getPrototypeOfWithResource);
  scope.Object.setPrototypeOf = _createArg01Dispatcher("", Object.setPrototypeOf,
      setPrototypeOfWithResource);

  scope.Object.assign = assignValOS;
  scope.Object.keys = _createArg0Dispatcher("", Object.keys, keysWithResource);
  scope.Object.values = _createArg0Dispatcher("", Object.values, valuesWithResource);
  scope.Object.entries = _createArg0Dispatcher("", Object.entries, entriesWithResource);

  scope.Object.isFrozen = _createArg0Dispatcher("", Object.isFrozen, isFrozenWithResource);
  scope.Object.freeze = _createArg0Dispatcher("", Object.freeze, freezeWithResource);
  scope.Object.isSealed = _createArg0Dispatcher("", Object.isSealed, isSealedWithResource);
  scope.Object.seal = _createArg0Dispatcher("", Object.seal, sealWithResource);

  scope.Object.isExtensible = _createArg0Dispatcher("", Object.isExtensible,
      isExtensibleWithResource);
  scope.Object.preventExtensions = _createArg0Dispatcher("", Object.preventExtensions,
      preventExtensionsWithResource);

  scope.Object.defineProperties = _createArg0Dispatcher("", Object.defineProperties,
      definePropertiesWithResource);
  scope.Object.defineProperty = _createArg0Dispatcher("",
      Object.defineProperty, definePropertyWithResource,
      definePropertyWithBuiltin, definePropertyWithPrototype);

  scope.Object.getOwnPropertyDescriptor = _createArg0Dispatcher("",
      Object.getOwnPropertyDescriptor, getOwnPropertyDescriptorWithResource,
      getOwnPropertyDescriptorWithBuiltin, getOwnPropertyDescriptorWithPrototype);
  scope.Object.getOwnPropertyDescriptors = _createArg0Dispatcher("",
      Object.getOwnPropertyDescriptors, getOwnPropertyDescriptorsWithResource,
      getOwnPropertyDescriptorsWithBuiltin, getOwnPropertyDescriptorsWithPrototype);
  scope.Object.getOwnPropertyNames = _createArg0Dispatcher("",
      Object.getOwnPropertyNames, getOwnPropertyNamesWithResource,
      getOwnPropertyNamesWithBuiltin, getOwnPropertyNamesWithPrototype);
  scope.Object.getOwnPropertySymbols = _createArg0Dispatcher("",
      Object.getOwnPropertySymbols, getOwnPropertySymbolsWithResource,
      getOwnPropertySymbolsWithBuiltin, getOwnPropertySymbolsWithPrototype);

  function isWithResource (/* left: Vrapper | any, right: Vrapper | any */) {
    throw new Error("isWithResource not implemented");
  }


  function createWithResource (/* vPrototype: Vrapper, descriptors?: Object */) {
    throw new Error("createWithResource not implemented");
  }

  function getPrototypeOfWithResource (vResource: Vrapper) {
    const options = this.__callerValker__ && { transaction: this.__callerValker__ };
    const ret = vResource.get("prototype", options);
    if (ret) return ret;
    return valos[vResource.getTypeName(options)].hostObjectPrototype;
  }

  function setPrototypeOfWithResource (/* vResource: Vrapper, vPrototype: Vrapper */) {
    throw new Error("setPrototypeOfWithResource not implemented");
  }

  function assignValOS (target: any, ...rest: any[]) {
    const options = { transaction: this.__callerValker__ };
    let combinedSources;
    if (rest.length === 1 && !(rest[0] instanceof Vrapper)) {
      combinedSources = rest[0];
    } else {
      combinedSources = {};
      for (const source of rest) {
        if (!(source instanceof Vrapper)) Object.assign(combinedSources, source);
        else {
          for (const property of source.get("properties", options)) {
            combinedSources[property.get("name", options)] = property.extractValue(options);
          }
        }
      }
    }
    if (!(target instanceof Vrapper)) {
      return Object.assign(target, combinedSources);
    }
    for (const propertyName in combinedSources) { // eslint-disable-line
      target.alterProperty(propertyName, VALEK.fromValue(combinedSources[propertyName]),
          Object.create(options));
    }
    return target;
  }
  assignValOS._valkDescription = "";
  assignValOS._valkCaller = true;

  const toValOSKeys = VALEK.to("properties")
      .filter(VALEK.isImmaterial().not()).map(VALEK.to("name"));
  function keysWithResource (vResource: Vrapper) {
    if (!vResource.hasInterface("Scope")) return [];
    return vResource.get(toValOSKeys, { transaction: this.__callerValker__ });
  }

  const toValOSValues = VALEK.to("properties")
      .filter(VALEK.isImmaterial().not()).map(VALEK.extractValue());
  function valuesWithResource (vResource: Vrapper) {
    if (!vResource.hasInterface("Scope")) return [];
    return vResource.get(toValOSValues, { transaction: this.__callerValker__ });
  }

  const toEntriesWithResource = VALEK.to("properties")
      .filter(VALEK.isImmaterial().not()).map(VALEK.array(VALEK.to("name"), VALEK.extractValue()));
  function entriesWithResource (vResource: Vrapper) {
    if (!vResource.hasInterface("Scope")) return [];
    return vResource.get(toEntriesWithResource, { transaction: this.__callerValker__ });
  }


  function isFrozenWithResource (vResource: Vrapper) {
    return vResource.get("isFrozen", { transaction: this.__callerValker__ });
  }

  function freezeWithResource (vResource: Vrapper) {
    vResource.setField("isFrozen", true, { transaction: this.__callerValker__ });
    return vResource;
  }

  function isSealedWithResource (vResource: Vrapper) {
    // TODO(iridian): This only works as long as sealWithResource is not implemented.
    return vResource.get("isFrozen", { transaction: this.__callerValker__ });
  }

  function sealWithResource (/* vResource: Vrapper */) {
    throw new Error("sealWithResource not implemented");
  }

  function isExtensibleWithResource (vResource: Vrapper) {
    // TODO(iridian): This only works as long as preventExtensionsWithResource is not implemented.
    return !vResource.get("isFrozen", { transaction: this.__callerValker__ });
  }

  function preventExtensionsWithResource (/* vResource: Vrapper */) {
    throw new Error("preventExtensionsWithResource not implemented");
  }

  function definePropertiesWithResource (/* vResource: Vrapper */) {
    throw new Error("definePropertiesWithResource not implemented");
  }

  function definePropertyWithResource (vResource: Vrapper, property: string | Symbol,
      descriptor: Object) {
    const options = { transaction: this.__callerValker__ };
    const Type = valos[vResource.getTypeName(options)];
    const prototypeEntry = Type.hostObjectPrototype[property];
    try {
      if ((typeof prototypeEntry === "object") && (prototypeEntry !== null)
          && prototypeEntry.writableFieldName) {
        // Define a native field value
        // TODO(iridian): handle other descriptor parameters (at least check they're valid).
        if (!descriptor.hasOwnProperty("value")) {
          throw new Error(`descriptor.value is missing when trying to define a native field '${
              String(property)}'`);
        }
        vResource.setField(prototypeEntry.writableFieldName, descriptor.value,
            { transaction: this.__callerValker__ });
      } else if (!vResource.hasInterface("Scope")) {
        throw new Error(`Cannot define valospace property '${String(property)
            }' for an object which doesn't implement Scope`);
      } else {
        // Define a Scope property
        const value = expressionFromProperty(descriptor.value, property, descriptor);
        const vProperty = vResource._getProperty(property, options);
        if (vProperty) {
          vProperty.setField("value", value, options);
        } else {
          vResource.emplaceAddToField("properties", { name: property, value }, options);
        }
      }
      return vResource;
    } catch (error) {
      throw wrapError(error, `During ${vResource.debugId()}\n .defineProperty(${
              String(property)}), with:`,
          "\n\tresource:", ...dumpObject(vResource),
          "\n\tproperty:", String(property),
          "\n\tdescriptor:", ...dumpObject(descriptor),
      );
    }
  }

  function definePropertyWithBuiltin (builtinType: Object) {
    throw new Error(`Object.defineProperty not implemented for builtin ValOS types (here '${
        builtinType.name}'`);
  }

  function definePropertyWithPrototype (prototype: Object) {
    throw new Error(`Object.defineProperty not implemented for ValOS Resource prototypes (here '${
        prototype.constructor.name}')`);
  }

  function getOwnPropertyDescriptorWithResource (vResource: Vrapper, property: string | Symbol) {
    const options = { transaction: this.__callerValker__ };
    const Type = valos[vResource.getTypeName(options)];
    const prototypeEntry = Type.hostObjectPrototype[property];
    if ((typeof prototypeEntry === "object") && (prototypeEntry !== null)
        && prototypeEntry.writableFieldName) {
      const transient = vResource.getTransient(options);
      if (!transient.has(prototypeEntry.writableFieldName)) return undefined;
      return createHostMaterializedFieldDescriptorFromLocal(
          this.__callerValker__, transient.get(prototypeEntry.writableFieldName), prototypeEntry);
    }
    if (!vResource.hasInterface("Scope")) return undefined;
    const vProperty = vResource._getProperty(property, options);
    if (!vProperty || !vProperty.isMaterialized()) return undefined;
    return createHostPropertyDescriptorFromProperty(vProperty, vResource, options);
  }

  function createHostPropertyDescriptorFromProperty (vProperty: Vrapper, vResource: Vrapper,
      options: Object) {
    const valueEntry = vProperty.getTransient(options).get("value");
    if (typeof valueEntry === "undefined") return undefined;
    return createHostPropertyDescriptor(
        vProperty.extractPropertyValue(options, vResource, valueEntry));
  }

  function createHostMaterializedFieldDescriptorFromLocal (valker: any, localValue: any,
      descriptor: any) {
    let removes;
    if (descriptor.sequence) {
      const removesEntry = (typeof localValue === "object") && (localValue !== null)
          && localValue[PartialRemovesTag];
      removes = (removesEntry && valker.tryUnpack(removesEntry)) || [];
    }
    return createHostMaterializedFieldDescriptor(valker.tryUnpack(localValue), descriptor, removes);
  }

  function getOwnPropertyDescriptorWithBuiltin (Type: Object, property: string) {
    if (!Type.hasOwnProperty(property)) return undefined;
    // 'name' value is a string but is not a native field symbol. Skip.
    if ((typeof property === "string") && (property !== "name")) {
      const typeDescriptor = hostObjectDescriptors.get(Type);
      const propertyDescriptor = typeDescriptor && typeDescriptor[property];
      if (propertyDescriptor) return propertyDescriptor;
    }
    return Object.getOwnPropertyDescriptor(Type, property);
  }

  function getOwnPropertyDescriptorWithPrototype (hostObjectPrototype: Object,
      property: string | Symbol) {
    const field = hostObjectPrototype[property];
    return (field && field.isHostField && createHostPrototypeFieldDescriptor(field))
        || (field && createHostFunctionDescriptor(field));
  }

  const toOwnProperties = VALEK.toField("properties")
      .filter(VALEK.toField("ownFields").toField("value").ifDefined({ then: true }));
  function getOwnPropertyDescriptorsWithResource (vResource: Vrapper) {
    const ret = {};
    const options = { transaction: this.__callerValker__ };
    const transient = vResource.getTransient(options);
    if (transient) {
      const Type = valos[vResource.getTypeName(options)];
      transient.forEach((fieldValue, fieldName) => {
        const prototypeEntry = Type.hostObjectPrototype[Type[fieldName] || ""];
        if ((typeof prototypeEntry === "object") && (prototypeEntry !== null)
            && prototypeEntry.writableFieldName) {
          ret[fieldValue] = createHostMaterializedFieldDescriptorFromLocal(
              options.transaction, fieldValue, prototypeEntry);
        }
      });
    }
    if (transient.get("properties")) {
      // TODO(iridian): This could be done with one query, but passing extractValue.vExplicitOwner
      // is a bit tricky.
      const properties = vResource.get(toOwnProperties, options);
      for (const vProperty of properties) {
        ret[vProperty.get("name", options)] =
            createHostPropertyDescriptorFromProperty(vProperty, vResource, options);
      }
    }
    return ret;
  }

  function getOwnPropertyDescriptorsWithBuiltin (Type: Object) {
    const ret = {};
    for (const property of Object.getOwnPropertyNames(Type)
        .concat(Object.getOwnPropertySymbols(Type))) {
      ret[property] = getOwnPropertyDescriptorWithBuiltin(Type, property);
    }
    return ret;
  }

  function getOwnPropertyDescriptorsWithPrototype (hostObjectPrototype: Object) {
    const ret = {};
    for (const property of Object.getOwnPropertyNames(hostObjectPrototype)
        .concat(Object.getOwnPropertySymbols(hostObjectPrototype))) {
      ret[property] = getOwnPropertyDescriptorWithPrototype(hostObjectPrototype, property);
    }
    return ret;
  }


  const toOwnPropertyNames = toOwnProperties.map(VALEK.toField("name"));
  function getOwnPropertyNamesWithResource (vResource: Vrapper) {
    if (!vResource.hasInterface("Scope")) return [];
    return vResource.get(toOwnPropertyNames, { transaction: this.__callerValker__ });
  }

  function getOwnPropertyNamesWithBuiltin (Type: Object) {
    // TODO(iridian): Might not work if symbols are polyfilled. Should!
    return Object.getOwnPropertyNames(Type);
  }

  function getOwnPropertyNamesWithPrototype (hostObjectPrototype: Object) {
    // TODO(iridian): Might not work if symbols are polyfilled. Should!
    return Object.getOwnPropertyNames(hostObjectPrototype);
  }


  function getOwnPropertySymbolsWithResource (vResource: Vrapper) {
    const ret = [];
    const options = { transaction: this.__callerValker__ };
    const transient = vResource.getTransient(options);
    if (transient) {
      const Type = valos[vResource.getTypeName(options)];
      transient.forEach((fieldValue, fieldName) => {
        let fieldSymbol = Type[fieldName];
        let fieldIntro = fieldSymbol && Type.hostObjectPrototype[fieldSymbol];
        if (!fieldIntro) {
          if (fieldName === "name") {
            fieldSymbol = Type.nameAlias;
          } else if (fieldName === "prototype") {
            fieldSymbol = Type.prototypeAlias;
          }
          fieldIntro = Type.hostObjectPrototype[fieldSymbol];
          if (!fieldIntro) return;
        }
        if (fieldIntro.writableFieldName) ret.push(fieldSymbol);
      });
    }
    return ret;
  }

  function getOwnPropertySymbolsWithBuiltin (type: Object) {
    // TODO(iridian): Might not work if symbols are polyfilled. Should!
    return Object.getOwnPropertySymbols(type);
  }

  function getOwnPropertySymbolsWithPrototype (hostObjectPrototype: Object) {
    // TODO(iridian): Might not work if symbols are polyfilled. Should!
    return Object.getOwnPropertySymbols(hostObjectPrototype);
  }
}
