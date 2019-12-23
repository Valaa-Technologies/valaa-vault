// @flow

import {
  denoteValOSBuiltinWithSignature, denoteDeprecatedValOSBuiltin, denoteValOSKueryFunction,
} from "~/raem/VALK";
import type { VRL } from "~/raem/VRL";
import derivedId from "~/raem/tools/derivedId";

import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import { duplicateResource, instantiateResource }
    from "~/engine/valosheath/valos/_resourceLifetimeOps";
import { OwnerDefaultCouplingTag } from "~/engine/valosheath/valos/enfoldSchemaSheath";

import { dumpObject, outputCollapsedError, wrapError } from "~/tools";

const symbols = {
  getField: Symbol("Resource.getField"),
  getFieldCoupling: Symbol("Resource.getFieldCoupling"),
  setField: Symbol("Resource.setField"),
  addToField: Symbol("Resource.addToField"),
  removeFromField: Symbol("Resource.removeFromField"),
  replaceWithinField: Symbol("Resource.replaceWithinField"),
  setOwner: Symbol("Resource.setOwner"),
  getEntity: Symbol("Resource.getEntity"),
  getMedia: Symbol("Resource.getMedia"),
  createDerivedId: Symbol("Resource.createDerivedId"),
  hasInterface: Symbol("Resource.hasInterface"),
  instantiate: Symbol("Resource.instantiate"),
  duplicate: Symbol("Resource.duplicate"),
  prepareBlob: Symbol("Resource.prepareBlob"),
  prepareBvob: Symbol("Resource.prepareBvob"),
};

export default {
  isGlobal: true,
  namespaces: {
    V: "@valos"
  },

  symbols,
  typeFields: {
    activate: denoteValOSBuiltinWithSignature(
      `activates the Resource by acquiring the partition connection and also recursively ${
        ""}activating all Resource's in the prototype chain. Returns a Promise which resolves ${
        ""}once all corresponding partitions have completed their first narration`
    )(function activate (resource) {
      return Promise.resolve(resource.activate() || resource);
    }),

    isActive: denoteValOSBuiltinWithSignature(
      `Returns true if the given Resource is already active, false if it is not yet active or ${
        ""}in an unfinished activation process`
    )(function isActive (resource) {
      return resource.isActive();
    }),

    getFieldOf: denoteDeprecatedValOSBuiltin("[Resource.getField](fieldVAKON)",
        "returns the value of the host field with given *fieldName* of the given *resource*"
    )(function getFieldOf (resource, fieldVAKON) {
      try {
        return resource.get(fieldVAKON, { discourse: this.__callerValker__ });
      } catch (error) {
        throw wrapError(error, `During ${this.constructor.name}\n .getFieldOf, with:`,
            "\n\tresource:", ...dumpObject(resource));
      }
    }),

    setFieldOf: denoteDeprecatedValOSBuiltin("[Resource.setField](fieldName, newValue)",
        "sets the host field with given *fieldName* of the given *resource* to given *newValue*"
    )(function setFieldOf (resource, fieldName, newValue) {
      return resource.setField(fieldName, newValue, { discourse: this.__callerValker__ });
    }),

    getOwnerOf: denoteDeprecatedValOSBuiltin("[Resource.owner]",
        "returns the owner of the given *resource*"
    )(function getOwnerOf (resource) { return this.getFieldOf(resource, "owner"); }),

    setOwnerOf: denoteDeprecatedValOSBuiltin("[Resource.setOwner](owner, coupledField)",
        `sets the host owner of the given *resource* to the given *owner*, with optionally ${
          ""} given *coupledField*. The coupledField default value is appropriately determined by ${
          ""} the type of this resource as either 'unnamedOwnlings', 'properties', 'relations' or ${
          ""} 'listeners'`
    )(function setOwnerOf (
          resource, owner, coupledField = this[OwnerDefaultCouplingTag] || "unnamedOwnlings") {
      return this.setFieldOf(resource, "owner", owner.getId().coupleWith(coupledField));
    }),

    getActiveResource: denoteValOSBuiltinWithSignature(
        `returns the active resource with given *id* if one exists, otherwise throws an error. ${
          ""}An active resource is an existing, non-destroyed resource in a fully connected ${
          ""}partition whose all possible prototypes are also active. If the error is due to an ${
          ""}unconnected or partially connected partition a missing partition error is thrown. ${
          ""}This causes an implicit partition connection attempt which by default restarts this ${
          ""}transaction. Otherwise a regular, by default unhandled exception is thrown.`
    )(function getActiveResource (id: string | VRL) {
      try {
        const ret = this.__callerValker__.run({}, VALEK.fromObject(id).notNull());
        if (!ret) {
          throw new Error(`Could not find resource '${String(id)}' in the False Sourcerer corpus`);
        }
        ret.requireActive();
        return ret;
      } catch (error) {
        const ret = this.__callerValker__.run({}, VALEK.fromObject(id).nullable());
        this.__callerValker__.errorEvent(
            "\n\tDEPRECATED, SUBJECT TO CHANGE:",
            "Resource.getActiveResource returns null if no active resource is found, for now",
            "\n\tprefer: Resource.tryActiveResource returning null",
            "\n\tchange: Resource.getActiveResource will throw if no active resource is found",
            "instead of returning null. Actual error listed as collapsed below.");
        outputCollapsedError(this.__callerValker__.wrapErrorEvent(error,
                `Resource.getActiveResource('${String(id)}')`,
            "\n\tvalker:", ...dumpObject(this.__callerValker__),
        ), `Caught exception (collapsed and ignored during deprecation period: ${
            ""}\n\n\tEVENTUALLY THIS WILL BECOME AN ACTUAL ERROR\n\n)`);
        return ret;
      }
    }),

    tryActiveResource: denoteValOSBuiltinWithSignature(
        `returns the active resource with given *id* if one exists, otherwise returns null. ${
          ""}An active resource is an existing, non-destroyed resource in a fully connected ${
          ""}partition whose all possible prototypes are also active.`
    )(function tryActiveResource (id: string | VRL) {
      const ret = this.__callerValker__.run({}, VALEK.fromObject(id).nullable());
      return ret && (ret.getPhase() === "Active") && ret;
    }),

    recombine: denoteValOSBuiltinWithSignature(
        `returns an array of duplicated resources based on the given *duplicationDirectives* (dd).${
            ""} The duplications are performed as if they are part of a single duplication; all${
            ""} directly and indirectly owned cross-references between all *dd.duplicateOf*${
            ""} resources are updated to cross-refer to the appropriate (sub-)resources in the${
            ""} resulting duplicates.${
            ""} This has two major advantages over the singular duplication.${
            ""} First advantage is that recombination allows for fine-grained control over all${
            ""} duplicated resources and not just the top-level. When a *dd.duplicateOf* refers to${
            ""} a resource which is already being implicitly duplicated (by some other directive${
            ""} targeting its (grand)owner) then the rules in the explicit dd override the default${
            ""} duplication instead of creating an extra duplicate. Notably this also allows for${
            ""} omission of whole sub-branches from the duplication by specifying null *dd.id*.${
            ""} Second advantage is that by providing customized *dd.initialState.owner* values${
            ""} the recombination can fully alter ownership hierarchy of the duplicated objects${
            ""} (unlike duplication which once again can only manage duplicated top-level resource).
            ""} Specifically this enables duplication of resources from different locations and${
            ""} even partitions to under the same entity while maintaining the internal${
            ""} cross-references between different recombined resources. Vice versa recombine${
            ""} allows spreading the duplicates to separate partitions (at least insofar a${
            ""} multi-partition commands between said partitions is possible).`
    )(function recombine (...duplicationDirectives) {
      return this.__callerValker__._follower.recombine(duplicationDirectives,
          { discourse: this.__callerValker__ });
    }),

    destroy: denoteValOSBuiltinWithSignature(
        `destroys the given *resource* and recursively all resources owned by it`
    )(function destroy (resource) {
      return resource.destroy({ discourse: this.__callerValker__ });
    }),
  },

  prototypeFields: {
    hasOwnProperty: denoteValOSKueryFunction(
        `returns a boolean indicating whether the object has the specified property as own (not${
            ""} inherited) property`
    )(function hasOwnProperty (fieldName: string) {
      return VALEK.or(
          VALEK.property(fieldName).nullable().toField("ownFields").toField("value")
              .ifDefined({ then: true }),
          false)
      .toVAKON();
    }),

    /*
    isPrototypeOf () {},
    propertyIsEnumerable () {},
    toLocaleString () {},
    toSource () {},
    toString () {},
    valueOf () {},
    */

    [symbols.getField]: denoteValOSKueryFunction(
        `returns the value of the host field with given *fieldName* of *this* Resource`
    )(function getField (fieldVAKON: any) {
      return fieldVAKON;
    }),

    [symbols.getFieldCoupling]: denoteValOSKueryFunction(
        `returns the coupled field of the given singular host field *fieldName* of *this* Resource`
    )(function getFieldCoupling (fieldName: any) {
      return VALEK.toField(fieldName).coupling().toVAKON();
    }),

    [symbols.setField]: denoteValOSBuiltinWithSignature(
        `sets the value of the host field with given *fieldName* of *this* Resource`
    )(function setField (fieldName: string, newValue: any) {
      return this.setField(fieldName, newValue, { discourse: this.__callerValker__ });
    }),

    [symbols.addToField]: denoteValOSBuiltinWithSignature(
        `adds the given *value* to the host field with given *fieldName* of *this* Resource.${
            ""} If the *value* is an iterable all the entries will be added in iteration order.${
            ""} All added values will be placed to the end of the sequence, even if they already${
            ""} exist.`
    )(function addToField (fieldName: string, value: any) {
      return this.addToField(fieldName, value, { discourse: this.__callerValker__ });
    }),

    [symbols.removeFromField]: denoteValOSBuiltinWithSignature(
        `removes the given *value* from the host field with given *fieldName* of *this* Resource.${
            ""} If the *value* is an iterable all the entries will be removed.`
    )(function removeFromField (fieldName: string, value: any) {
      return this.removeFromField(fieldName, value, { discourse: this.__callerValker__ });
    }),

    [symbols.replaceWithinField]: denoteValOSBuiltinWithSignature(
        `replaces the given *replacedValues* within host field with given *fieldName* of *this*${
            ""} Resource with given *withValues*. Behaves like a removedFrom call followed by${
            ""} an addedTo call, where the removedFrom is given the entries appearing only${
            ""} in *replacedValues* and addedTo is given *withValues* as-is.`
    )(function replaceWithinField (fieldName: string, replacedValues: any[], withValues: any[]) {
      return this.replaceWithinField(fieldName, replacedValues, withValues,
          { discourse: this.__callerValker__ });
    }),

    [symbols.setOwner]: denoteValOSBuiltinWithSignature(
        `sets the host owner of *this* Resource to the given *owner*, with optionally${
          ""} given *coupledFieldName*. The coupledFieldName default value is based on the type of${
          ""} this resource as either 'unnamedOwnlings', 'properties', 'relations' or 'listeners'`
    )(function setOwner (owner, coupledField
        = (this.constructor && this.constructor[OwnerDefaultCouplingTag]) || "unnamedOwnlings") {
      return this.setField("owner", owner.getId().coupleWith(coupledField),
          { discourse: this.__callerValker__ });
    }),

    [symbols.getEntity]: denoteValOSKueryFunction(
        `returns the first owned Entity with the given name.`
    )(function getEntity (name) {
      return VALEK.toField("unnamedOwnlings")
          .filter(VALEK.isOfType("Entity").and(VALEK.hasName(name))).toIndex(0).toVAKON();
    }),

    [symbols.getMedia]: denoteValOSKueryFunction(
        `returns the first owned Media with the given name.`
    )(function getMedia (name) {
      return VALEK.toField("unnamedOwnlings")
          .filter(VALEK.isOfType("Media").and(VALEK.hasName(name))).toIndex(0).toVAKON();
    }),

    [symbols.instantiate]: denoteValOSBuiltinWithSignature(
        `instantiates *this* Resource with given *initialState*.`
    )(function instantiate (initialState) {
      return instantiateResource.call(this.getValospaceType(),
          this.__callerValker__, this.__callerScope__, this, initialState);
    }),

    [symbols.duplicate]: denoteValOSBuiltinWithSignature(
        `duplicates *this* Resource with given *initialState*.`
    )(function duplicate (initialState) {
      return duplicateResource.call(this.getValospaceType(),
          this.__callerValker__, this.__callerScope__, this, initialState);
    }),

    [symbols.createDerivedId]: denoteValOSBuiltinWithSignature(
        `creates a deterministic, unique id based on the id of *this* resource as well as the ${
            ""}given *salt* and optionally given *contextId* strings. The generated id is always ${
            ""}the same for same combination of these three values`
    )(function createDerivedId (salt: string, contextId: string = "") {
      return derivedId(this.getRawId(), salt, contextId);
    }),

    [symbols.hasInterface]: denoteValOSBuiltinWithSignature(
        `returns true if *this* resource implements the host interface *interfaceName*, ${
            ""}false otherwise`
    )(function hasInterface (interfaceName: Vrapper) {
      return Vrapper.prototype.hasInterface.call(this, interfaceName);
    }),
    // TODO(iridian): Deprecate this in favor of the Symbol version [Resource.hasInterface]
    hasInterface: denoteValOSBuiltinWithSignature(
        `returns true if *this* resource implements the host interface *interfaceName*, ${
            ""}false otherwise`
    )(function hasInterface (interfaceName: Vrapper, interfaceNameLegacy: string) {
      if (this instanceof Vrapper) return this.hasInterface(interfaceName);
      return interfaceName.hasInterface(interfaceNameLegacy);
    }),

    [symbols.prepareBlob]: denoteDeprecatedValOSBuiltin("[Resource.prepareBvob](content)",
        "Returns a promise to a Bvob creator callback. See Resource.prepareBvob.",
    )(function prepareBlob (content: any) {
      return Promise.resolve(this.prepareBvob(content, { discourse: this.__callerValker__ }));
    }),
    [symbols.prepareBvob]: denoteValOSBuiltinWithSignature(
        `Returns a promise to a Bvob creator callback based on given *content*. This promise${
            ""} resolves when the given content has been converted into raw data and persisted in${
            ""} the local binary caches and its content id has been determined. When the resolved${
            ""} Bvob callback is called it creates a Bvob object in the current execution context${
            ""} (usually the partition of *this* Resource) and returns the content id.${
            ""} This bvob id can then be used as part of a command (usually Media.content) in the${
            ""} current execution context to refer to the raw content.${
            ""} Note that all encoding information, media type and any other metadata must be${
            ""} persisted separately (see Media).${
            ""} The bvob id is valid until one of the following conditions is true:${
            ""} 1. the bvob id is used in a command that has been successfully locally persisted${
            ""} in the command queue of this partition. At this point the bvob id cache validity${
            ""} is governed by the partition bvob content caching rules.${
            ""} 2. the execution context is reset (ie. on a browser/tab refresh).${
            ""} 3. local bvob cache is explicitly flushed (which is unimplemented).`
    )(function prepareBvob (content: any) {
      return Promise.resolve(this.prepareBvob(content, { discourse: this.__callerValker__ }));
    }),
  },
};
