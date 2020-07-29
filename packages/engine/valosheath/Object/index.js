// @flow

import { PartialRemovesTag } from "~/raem/state/partialSequences";

import { ValoscriptPrimitiveKind } from "~/script";

import VALEK, { expressionFromProperty } from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";
import {
  createHostMaterializedFieldDescriptor, createHostPropertyDescriptor,
  PropertyDescriptorsTag,
} from "~/engine/valosheath/hostDescriptors";

import { dumpObject } from "~/tools";

/* eslint-disable prefer-rest-params */

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
export default function extendObject (scope: Object, hostDescriptors: Map<any, Object>,
    valos: Object) {
  const UndecoratedObject = scope.Object || Object;
  scope.Object = function DecoratedObject (...rest) {
    return UndecoratedObject.call(this, ...rest);
  };
  scope.Object.prototype = Object.prototype;

  function _createArg0Dispatcher (description: string,
      objectOperation: () => any,
      valosOperation,
      valosTypeOperation = objectOperation,
      valosPrototypeOperation = objectOperation) {
    const dispatchers = {
      "": objectOperation,
      Vrapper: valosOperation,
      Type: valosTypeOperation,
      Prototype: valosPrototypeOperation,
    };
    const ret = function valosArg0Dispatch () {
      return dispatchers[((arguments[0] != null) && arguments[0][ValoscriptPrimitiveKind]) || ""]
          .apply(this, arguments);
    };
    Object.defineProperty(ret, "name", { value: `valoscript_Object_${objectOperation.name}` });
    ret._valkDescription = description;
    ret._isVCall = true;
    return ret;
  }

  function _createArg01Dispatcher (description: string,
      objectOperation: () => any,
      valosOperation,
      valosTypeOperation = objectOperation,
      valosPrototypeOperation = objectOperation) {
    const dispatchers = {
      "": objectOperation,
      Vrapper: valosOperation,
      Type: valosTypeOperation,
      Prototype: valosPrototypeOperation,
    };
    const ret = function objectDecoratorArg01Dispatcher () {
      const arg0Kind = (arguments[0] != null) && arguments[0][ValoscriptPrimitiveKind];
      const arg1Kind = (arguments[1] != null) && arguments[1][ValoscriptPrimitiveKind];
      return dispatchers[arg0Kind || arg1Kind || ""].apply(this, arguments);
    };
    ret._valkDescription = description;
    ret._isVCall = true;
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
      getOwnPropertyDescriptorWithAny, getOwnPropertyDescriptorWithAny);
  scope.Object.getOwnPropertyDescriptors = _createArg0Dispatcher("",
      Object.getOwnPropertyDescriptors, getOwnPropertyDescriptorsWithResource,
      getOwnPropertyDescriptorsWithAny, getOwnPropertyDescriptorsWithAny);
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
    const options = this.__callerValker__ && { discourse: this.__callerValker__ };
    const ret = vResource.step("prototype", options);
    if (ret) return ret;
    return valos[vResource.getTypeName(options)].prototype;
  }

  function setPrototypeOfWithResource (/* vResource: Vrapper, vPrototype: Vrapper */) {
    throw new Error("setPrototypeOfWithResource not implemented");
  }

  function assignValOS (target: any, ...rest: any[]) {
    const options = { discourse: this.__callerValker__ };
    let discourse, releaseOpts;
    try {
      let combinedSources;
      if (rest.length === 1 && !(rest[0] instanceof Vrapper)) {
        combinedSources = rest[0];
      } else {
        combinedSources = {};
        for (const source of rest) {
          if (!(source instanceof Vrapper)) Object.assign(combinedSources, source);
          else {
            const subOptions = Object.create(options);
            for (const property of source.step("properties", subOptions)) {
              combinedSources[property.step("name", subOptions)] =
                  property.extractValue(subOptions);
            }
          }
        }
      }
      if (!(target instanceof Vrapper)) {
        return Object.assign(target, combinedSources);
      }
      discourse = options.discourse = options.discourse.acquireFabricator("Object.assign");
      target.updateProperties(combinedSources, options);
    } catch (error) {
      releaseOpts = { rollback: error };
      throw error;
    } finally {
      if (discourse) options.discourse.releaseFabricator(releaseOpts);
    }
    return target;
  }
  assignValOS._valkDescription = "";
  assignValOS._isVCall = true;

  const toValOSKeys = VALEK.to("properties")
      .filter(VALEK.isImmaterial().not()).map(VALEK.to("name"));
  function keysWithResource (vResource: Vrapper) {
    if (!vResource.hasInterface("Scope")) return [];
    return vResource.step(toValOSKeys, { discourse: this.__callerValker__ });
  }

  const toValOSValues = VALEK.to("properties")
      .filter(VALEK.isImmaterial().not()).map(VALEK.extractValue());
  function valuesWithResource (vResource: Vrapper) {
    if (!vResource.hasInterface("Scope")) return [];
    return vResource.step(toValOSValues, { discourse: this.__callerValker__ });
  }

  const toEntriesWithResource = VALEK.to("properties")
      .filter(VALEK.isImmaterial().not()).map(VALEK.array(VALEK.to("name"), VALEK.extractValue()));
  function entriesWithResource (vResource: Vrapper) {
    if (!vResource.hasInterface("Scope")) return [];
    return vResource.step(toEntriesWithResource, { discourse: this.__callerValker__ });
  }


  function isFrozenWithResource (vResource: Vrapper) {
    return vResource.step("isFrozen", { discourse: this.__callerValker__ });
  }

  function freezeWithResource (vResource: Vrapper) {
    vResource.setField("isFrozen", true, { discourse: this.__callerValker__ });
    return vResource;
  }

  function isSealedWithResource (vResource: Vrapper) {
    // TODO(iridian): This only works as long as sealWithResource is not implemented.
    return vResource.step("isFrozen", { discourse: this.__callerValker__ });
  }

  function sealWithResource (/* vResource: Vrapper */) {
    throw new Error("sealWithResource not implemented");
  }

  function isExtensibleWithResource (vResource: Vrapper) {
    // TODO(iridian): This only works as long as preventExtensionsWithResource is not implemented.
    return !vResource.step("isFrozen", { discourse: this.__callerValker__ });
  }

  function preventExtensionsWithResource (/* vResource: Vrapper */) {
    throw new Error("preventExtensionsWithResource not implemented");
  }

  function definePropertiesWithResource (/* vResource: Vrapper */) {
    throw new Error("definePropertiesWithResource not implemented");
  }

  function definePropertyWithResource (vResource: Vrapper, property: string | Symbol,
      descriptor: Object) {
    const options = { discourse: this.__callerValker__ };
    const valospaceType = valos[vResource.getTypeName(options)];
    const fieldDescriptor = valospaceType.prototype[PropertyDescriptorsTag][property];
    try {
      if ((fieldDescriptor != null) && fieldDescriptor.writableFieldName) {
        // Define a native field value
        // TODO(iridian): handle other descriptor parameters (at least check they're valid).
        if (!descriptor.hasOwnProperty("value")) {
          throw new Error(`descriptor.value is missing when trying to define a native field '${
              String(property)}'`);
        }
        vResource.setField(fieldDescriptor.writableFieldName, descriptor.value,
            { discourse: this.__callerValker__ });
      } else if (!vResource.hasInterface("Scope")) {
        throw new Error(`Cannot define valospace property '${String(property)
            }' for an object which doesn't implement Scope`);
      } else {
        // Define a Scope property
        const value = expressionFromProperty(descriptor.value, property, descriptor);
        const vProperty = vResource.getPropertyResource(property, options);
        if (vProperty) {
          vProperty.setField("value", value, options);
        } else {
          vResource.emplaceAddToField("properties", { name: property, value }, options);
        }
      }
      return vResource;
    } catch (error) {
      throw vResource.wrapErrorEvent(error, 1, () => [
        `defineProperty(${String(property)})`,
        "\n\tresource:", ...dumpObject(vResource),
        "\n\tproperty:", String(property),
        "\n\tdescriptor:", ...dumpObject(descriptor),
      ]);
    }
  }

  function definePropertyWithBuiltin (builtinType: Object) {
    throw new Error(`Object.defineProperty not implemented for builtin valoscript types (here '${
        builtinType.name}'`);
  }

  function definePropertyWithPrototype (prototype: Object) {
    throw new Error(`Object.defineProperty not implemented for Resource prototypes (here '${
        prototype.constructor.name}')`);
  }

  function getOwnPropertyDescriptorWithAny (valospaceValue: Object, property: string) {
    // TODO(iridian, 2019-04): possibly wrong semantics, might need to throw
    if (valospaceValue == null) return undefined;
    const descriptorBase = (valospaceValue[PropertyDescriptorsTag] || {})[property];
    if (!descriptorBase) return Object.getOwnPropertyDescriptor(valospaceValue, property);
    return { ...descriptorBase, value: valospaceValue[property] };
  }

  function getOwnPropertyDescriptorWithResource (vResource: Vrapper, property: string | Symbol) {
    const options = { discourse: this.__callerValker__ };
    const valospaceType = valos[vResource.getTypeName(options)];
    const descriptorBase = valospaceType.prototype[PropertyDescriptorsTag][property];
    if (!descriptorBase) {
      if (!vResource.hasInterface("Scope")) return undefined;
      const vProperty = vResource.getPropertyResource(property, options);
      if (!vProperty || !vProperty.isMaterialized()) return undefined;
      return createHostPropertyDescriptorFromProperty(vProperty, vResource, options);
    }
    const writableFieldName = descriptorBase.writableFieldName;
    if (!writableFieldName) return { ...descriptorBase, value: valospaceType.prototype[property] };
    const transient = vResource.getTransient(options);
    const value = transient.get(writableFieldName);
    if ((value === undefined) && !transient.has(writableFieldName)) return undefined;
    return createHostMaterializedFieldDescriptorFromLocal(
        this.__callerValker__, value, descriptorBase);
  }

  function createHostPropertyDescriptorFromProperty (vProperty: Vrapper, vResource: Vrapper,
      options: Object) {
    const valueEntry = vProperty.getTransient(options).get("value");
    if (valueEntry === undefined) return undefined;
    return createHostPropertyDescriptor(
        vProperty.extractPropertyValue(options, vResource, valueEntry));
  }

  function createHostMaterializedFieldDescriptorFromLocal (valker: any, localValue: any,
      descriptor: any) {
    let removes;
    if (descriptor.sequence) {
      const removesEntry = (typeof localValue === "object") && (localValue !== null)
          && localValue[PartialRemovesTag];
      removes = (removesEntry && valker.tryUnpack(removesEntry, true)) || [];
    }
    return createHostMaterializedFieldDescriptor(
        valker.tryUnpack(localValue, true), descriptor, removes);
  }

  const toOwnProperties = VALEK.toField("properties")
      .filter(VALEK.toField("ownFields").toField("value").ifDefined({ then: true }));
  function getOwnPropertyDescriptorsWithResource (vResource: Vrapper) {
    const ret = {};
    const options = { discourse: this.__callerValker__ };
    const transient = vResource.getTransient(options);
    if (transient) {
      const valospaceType = valos[vResource.getTypeName(options)];
      transient.forEach((fieldValue, fieldName) => {
        const fieldSymbol = valospaceType[fieldName] || "";
        const fieldDescriptor = valospaceType.prototype[PropertyDescriptorsTag][fieldSymbol];
        if ((fieldDescriptor != null) && fieldDescriptor.writableFieldName) {
          ret[fieldSymbol] = createHostMaterializedFieldDescriptorFromLocal(
              options.discourse, fieldValue, fieldDescriptor);
        }
      });
      if (transient.get("properties")) {
        // TODO(iridian): This could be done with one query, but
        // passing extractValue.vExplicitOwner is a bit tricky.
        const properties = vResource.step(toOwnProperties, options);
        for (const vProperty of properties) {
          ret[vProperty.step("name", options)] =
              createHostPropertyDescriptorFromProperty(vProperty, vResource, options);
        }
      }
    }
    return ret;
  }

  function getOwnPropertyDescriptorsWithAny (valospaceType: Object) {
    const ret = {};
    for (const name of Object.getOwnPropertyNames(valospaceType)) {
      ret[name] = getOwnPropertyDescriptorWithAny(valospaceType, name);
    }
    for (const symbol of Object.getOwnPropertySymbols(valospaceType)) {
      ret[symbol] = getOwnPropertyDescriptorWithAny(valospaceType, symbol);
    }
    return ret;
  }

  const toOwnPropertyNames = toOwnProperties.map(VALEK.toField("name"));
  function getOwnPropertyNamesWithResource (vResource: Vrapper) {
    if (!vResource.hasInterface("Scope")) return [];
    return vResource.step(toOwnPropertyNames, { discourse: this.__callerValker__ });
  }

  function getOwnPropertyNamesWithBuiltin (valospaceType: Object) {
    // TODO(iridian): Might not work if symbols are polyfilled. Should!
    return Object.getOwnPropertyNames(valospaceType);
  }

  function getOwnPropertyNamesWithPrototype (valospacePrototype: Object) {
    // TODO(iridian): Might not work if symbols are polyfilled. Should!
    return Object.getOwnPropertyNames(valospacePrototype);
  }


  function getOwnPropertySymbolsWithResource (vResource: Vrapper) {
    const ret = [];
    const options = { discourse: this.__callerValker__ };
    const transient = vResource.getTransient(options);
    if (transient) {
      const valospaceType = valos[vResource.getTypeName(options)];
      const fieldDescriptors = valospaceType.prototype[PropertyDescriptorsTag];
      transient.forEach((fieldValue, fieldName) => {
        let fieldSymbol = valospaceType[fieldName];
        let fieldDescriptor = fieldDescriptors[fieldSymbol];
        if (!fieldDescriptor) {
          if (fieldName === "name") {
            fieldSymbol = valospaceType.nameAlias;
          } else if (fieldName === "prototype") {
            fieldSymbol = valospaceType.prototypeAlias;
          }
          fieldDescriptor = fieldDescriptors[fieldSymbol];
          if (!fieldDescriptor) return;
        }
        if (fieldDescriptor.writableFieldName) ret.push(fieldSymbol);
      });
    }
    return ret;
  }

  function getOwnPropertySymbolsWithBuiltin (valospaceType: Object) {
    // TODO(iridian): Might not work if symbols are polyfilled. Should!
    return Object.getOwnPropertySymbols(valospaceType);
  }

  function getOwnPropertySymbolsWithPrototype (valospacePrototype: Object) {
    // TODO(iridian): Might not work if symbols are polyfilled. Should!
    return Object.getOwnPropertySymbols(valospacePrototype);
  }
}
