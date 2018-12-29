// @flow

import { Valker, denoteValaaBuiltinWithSignature, denoteDeprecatedValaaBuiltin,
  denoteValaaKueryFunction,
} from "~/raem/VALK";
import { getHostRef } from "~/raem/VALK/hostReference";
import type { VRef } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";

import { BuiltinTypePrototype, createNativeIdentifier, ValaaPrimitiveTag } from "~/script";

import VALEK, { extractFunctionVAKON } from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import { derivedId, dumpObject, invariantifyObject, outputCollapsedError, wrapError }
    from "~/tools";

/* eslint-disable prefer-arrow-callback */

export const defaultOwnerCoupledField = Symbol("Valaa.defaultOwnerCoupledField");

export default function injectSchemaTypeBindings (Valaa: Object, scope: Object) {
  scope.Bvob = Object.assign(Object.create(BuiltinTypePrototype), {
    name: "Bvob",
    ".new": function new_ (valker: Valker, innerScope: ?Object, initialState: ?Object) {
      if (!initialState || !initialState.id) {
        throw new Error("initialState.id missing when trying to create a Bvob");
      }
      return valker._follower.create("Blob", undefined,
          { transaction: valker, id: initialState.id });
    },
  });
  scope.Blob = scope.Bvob;

  scope.TransientFields = Valaa.TransientFields =
      Object.assign(Object.create(BuiltinTypePrototype), { name: "TransientFields" });

  scope.TransientFields.prototype = Object.assign(Object.create(Object.prototype), {
    constructor: scope.TransientFields,
  });
  scope.TransientFields.hostObjectPrototype = scope.TransientFields.prototype;
  scope.TransientFields.prototype[ValaaPrimitiveTag] = true;

  scope.ResourceStub = Valaa.ResourceStub = scope.TransientFields;

  scope.Resource = Valaa.Resource = Object.assign(Object.create(scope.TransientFields), {
    name: "Resource",
    ".new": function new_ (valker: Valker, innerScope: ?Object, initialState: ?Object) {
      const actualInitialState = prepareInitialState(this, innerScope, initialState, "new");
      // TODO(iridian): Replace valker._follower with some builtinStep when moving ValaaSpace to
      // @valos/script. Now this relies on valker always being a FalseProphetDiscourse/transaction.
      const resource = valker._follower.create(this.name, actualInitialState,
          { transaction: valker });
      return resource;
    },

    activate: denoteValaaBuiltinWithSignature(
      `activates the Resource by acquiring the partition connection and also recursively ${
        ""}activating all Resource's in the prototype chain. Returns a Promise which resolves ${
        ""}once all corresponding partitions have completed their first narration`
    )(function activate (resource) {
      return Promise.resolve(resource.activate());
    }),

    isActive: denoteValaaBuiltinWithSignature(
      `Returns true if the given Resource is already active, false if it is not yet active or ${
        ""}in an unfinished activation process`
    )(function isActive (resource) {
      return resource.isActive();
    }),

    getField: Symbol("Resource.getField"),
    getFieldOf: denoteDeprecatedValaaBuiltin("[Resource.getField](fieldVAKON)",
        "returns the value of the host field with given *fieldName* of the given *resource*"
    )(function getFieldOf (resource, fieldVAKON) {
      try {
        return resource.get(fieldVAKON, { transaction: this.__callerValker__ });
      } catch (error) {
        throw wrapError(error, `During ${this.constructor.name}\n .getFieldOf, with:`,
            "\n\tresource:", ...dumpObject(resource));
      }
    }),

    getFieldCoupling: Symbol("Resource.getFieldCoupling"),

    setField: Symbol("Resource.setField"),
    setFieldOf: denoteDeprecatedValaaBuiltin("[Resource.setField](fieldName, newValue)",
        "sets the host field with given *fieldName* of the given *resource* to given *newValue*"
    )(function setFieldOf (resource, fieldName, newValue) {
      return resource.setField(fieldName, newValue, { transaction: this.__callerValker__ });
    }),

    addToField: Symbol("Resource.addToField"),
    removeFromField: Symbol("Resource.removeFromField"),
    replaceWithinField: Symbol("Resource.replaceWithinField"),

    getOwnerOf: denoteDeprecatedValaaBuiltin("[Resource.owner]",
        "returns the owner of the given *resource*"
    )(function getOwnerOf (resource) { return this.getFieldOf(resource, "owner"); }),

    setOwner: Symbol("Resource.setOwner"),
    setOwnerOf: denoteDeprecatedValaaBuiltin("[Resource.setOwner](owner, coupledField)",
        `sets the host owner of the given *resource* to the given *owner*, with optionally ${
          ""} given *coupledField*. The coupledField default value is appropriately determined by ${
          ""} the type of this resource as either 'unnamedOwnlings', 'properties', 'relations' or ${
          ""} 'listeners'`
    )(function setOwnerOf (
          resource, owner, coupledField = this[defaultOwnerCoupledField] || "unnamedOwnlings") {
      return this.setFieldOf(resource, "owner", owner.getId().coupleWith(coupledField));
    }),

    getEntity: Symbol("Resource.getEntity"),

    getMedia: Symbol("Resource.getMedia"),

    createDerivedId: Symbol("Resource.createDerivedId"),

    hasInterface: Symbol("Resource.hasInterface"),

    getActiveResource: denoteValaaBuiltinWithSignature(
        `returns the active resource with given *id* if one exists, otherwise throws an error. ${
          ""}An active resource is an existing, non-destroyed resource in a fully connected ${
          ""}partition whose all possible prototypes are also active. If the error is due to an ${
          ""}unconnected or partially connected partition a missing partition error is thrown. ${
          ""}This causes an implicit partition connection attempt which by default restarts this ${
          ""}transaction. Otherwise a regular, by default unhandled exception is thrown.`
    )(function getActiveResource (id: string | VRef) {
      try {
        const ret = this.__callerValker__.run({}, VALEK.fromObject(id));
        if (!ret) {
          throw new Error(`Could not find resource '${String(id)}' in the False Prophet corpus`);
        }
        ret.requireActive();
        return ret;
      } catch (error) {
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
      }
      return this.__callerValker__.run({}, VALEK.fromObject(id).nullable());
    }),

    tryActiveResource: denoteValaaBuiltinWithSignature(
        `returns the active resource with given *id* if one exists, otherwise returns null. ${
          ""}An active resource is an existing, non-destroyed resource in a fully connected ${
          ""}partition whose all possible prototypes are also active.`
    )(function tryActiveResource (id: string | VRef) {
      return this.__callerValker__.run({}, VALEK.fromObject(id).nullable());
    }),

    instantiate: Symbol("Resource.instantiate"),
    ".instantiate": function _instantiate (valker: Valker, innerScope: ?Object,
        resource: any, initialState: ?Object) {
      return resource.instantiate(prepareInitialState(
          this, innerScope, initialState, "instantiate"), { transaction: valker });
    },

    duplicate: Symbol("Resource.duplicate"),

    recombine: denoteValaaBuiltinWithSignature(
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
      // TODO(iridian): Replace valker._follower with some builtinStep when moving ValaaSpace to
      // @valos/script. Now this relies on valker always being a FalseProphetDiscourse/transaction.
      return this.__callerValker__._follower.recombine(duplicationDirectives,
          { transaction: this.__callerValker__ });
    }),

    destroy: denoteValaaBuiltinWithSignature(
        `destroys the given *resource* and recursively all resources owned by it`
    )(function destroy (resource) {
      return resource.destroy({ transaction: this.__callerValker__ });
    }),

    prepareBlob: Symbol("Resource.prepareBlob"),
    prepareBvob: Symbol("Resource.prepareBvob"),
  });

  scope.Resource.prototype = Object.assign(Object.create(scope.TransientFields.prototype), {
    constructor: scope.Resource,

    $V: {
      isHostField: true, enumerable: false, configurable: false, namespace: "@valos",
    },

    hasOwnProperty: denoteValaaKueryFunction(
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

    [scope.Resource.getField]: denoteValaaKueryFunction(
        `returns the value of the host field with given *fieldName* of *this* Resource`
    )(function getField (fieldVAKON: any) {
      return fieldVAKON;
    }),

    [scope.Resource.getFieldCoupling]: denoteValaaKueryFunction(
        `returns the coupled field of the given singular host field *fieldName* of *this* Resource`
    )(function getFieldCoupling (fieldName: any) {
      return VALEK.toField(fieldName).coupling().toVAKON();
    }),

    [scope.Resource.setField]: denoteValaaBuiltinWithSignature(
        `sets the value of the host field with given *fieldName* of *this* Resource`
    )(function setField (fieldName: string, newValue: any) {
      return this.setField(fieldName, newValue, { transaction: this.__callerValker__ });
    }),

    [scope.Resource.addToField]: denoteValaaBuiltinWithSignature(
        `adds the given *value* to the host field with given *fieldName* of *this* Resource.${
            ""} If the *value* is an iterable all the entries will be added in iteration order.${
            ""} All added values will be placed to the end of the sequence, even if they already${
            ""} exist.`
    )(function addToField (fieldName: string, value: any) {
      return this.addToField(fieldName, value, { transaction: this.__callerValker__ });
    }),

    [scope.Resource.removeFromField]: denoteValaaBuiltinWithSignature(
        `removes the given *value* from the host field with given *fieldName* of *this* Resource.${
            ""} If the *value* is an iterable all the entries will be removed.`
    )(function removeFromField (fieldName: string, value: any) {
      return this.removeFromField(fieldName, value, { transaction: this.__callerValker__ });
    }),

    [scope.Resource.replaceWithinField]: denoteValaaBuiltinWithSignature(
        `replaces the given *replacedValues* within host field with given *fieldName* of *this*${
            ""} Resource with given *withValues*. Behaves like a removedFrom call followed by${
            ""} an addedTo call, where the removedFrom is given the entries appearing only${
            ""} in *replacedValues* and addedTo is given *withValues* as-is.`
    )(function replaceWithinField (fieldName: string, replacedValues: any[], withValues: any[]) {
      return this.replaceWithinField(fieldName, replacedValues, withValues,
          { transaction: this.__callerValker__ });
    }),

    [scope.Resource.setOwner]: denoteValaaBuiltinWithSignature(
        `sets the host owner of *this* Resource to the given *owner*, with optionally${
          ""} given *coupledFieldName*. The coupledFieldName default value is based on the type of${
          ""} this resource as either 'unnamedOwnlings', 'properties', 'relations' or 'listeners'`
    )(function setOwner (owner, coupledField
        = (scope[this.name] && scope[this.name][defaultOwnerCoupledField]) || "unnamedOwnlings") {
      return this.setField("owner", owner.getId().coupleWith(coupledField),
          { transaction: this.__callerValker__ });
    }),

    [scope.Resource.getEntity]: denoteValaaKueryFunction(
        `returns the first owned Entity with the given name.`
    )(function getEntity (name) {
      return VALEK.toField("unnamedOwnlings")
          .filter(VALEK.isOfType("Entity").and(VALEK.hasName(name))).toIndex(0).toVAKON();
    }),

    [scope.Resource.getMedia]: denoteValaaKueryFunction(
        `returns the first owned Media with the given name.`
    )(function getMedia (name) {
      return VALEK.toField("unnamedOwnlings")
          .filter(VALEK.isOfType("Media").and(VALEK.hasName(name))).toIndex(0).toVAKON();
    }),

    [scope.Resource.instantiate]: denoteValaaBuiltinWithSignature(
        `instantiates *this* Resource with given *initialState*. If initialState.owner is not${
            ""} specified the current global context *self* is used as the default owner`
    )(function instantiate (initialState) {
      return this.instantiate(prepareInitialState(this, this.__callerScope__, initialState,
          "instantiate"), { transaction: this.__callerValker__ }, true);
    }),

    [scope.Resource.duplicate]: denoteValaaBuiltinWithSignature(
        `duplicates *this* Resource with given *initialState*.`
    )(function duplicate (initialState) {
      return this.duplicate(prepareInitialState(this, this.__callerScope__, initialState, false),
          { transaction: this.__callerValker__ });
    }),

    [scope.Resource.createDerivedId]: denoteValaaBuiltinWithSignature(
        `creates a deterministic, unique id based on the id of *this* resource as well as the ${
            ""}given *salt* and optionally given *contextId* strings. The generated id is always ${
            ""}the same for same combination of these three values`
    )(function createDerivedId (salt: string, contextId: string = "") {
      return derivedId(this.getRawId(), salt, contextId);
    }),

    [scope.Resource.hasInterface]: denoteValaaBuiltinWithSignature(
        `returns true if *this* resource implements the host interface *interfaceName*, ${
            ""}false otherwise`
    )(function hasInterface (interfaceName: Vrapper) {
      return Vrapper.prototype.hasInterface.call(this, interfaceName);
    }),
    // TODO(iridian): Deprecate this in favor of the Symbol version [scope.Resource.hasInterface]
    hasInterface: denoteValaaBuiltinWithSignature(
        `returns true if *this* resource implements the host interface *interfaceName*, ${
            ""}false otherwise`
    )(function hasInterface (interfaceName: Vrapper, interfaceNameLegacy: string) {
      if (this instanceof Vrapper) return this.hasInterface(interfaceName);
      return interfaceName.hasInterface(interfaceNameLegacy);
    }),

    [scope.Resource.prepareBlob]: denoteDeprecatedValaaBuiltin("[Resource.prepareBlob](content)",
        "Returns a promise to a Bvob creator callback. See Resource.prepareBvob.",
    )(function prepareBlob (content: any) {
      return Promise.resolve(this.prepareBvob(content, { transaction: this.__callerValker__ }));
    }),
    [scope.Resource.prepareBvob]: denoteValaaBuiltinWithSignature(
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
      return Promise.resolve(this.prepareBvob(content, { transaction: this.__callerValker__ }));
    }),
  });
  scope.Resource.hostObjectPrototype = scope.Resource.prototype;

  scope.Resource.prototype[ValaaPrimitiveTag] = true;

  scope.Discoverable = Valaa.Discoverable = Object.assign(Object.create(scope.Resource), {
    name: "Discoverable",
    getNameOf: denoteDeprecatedValaaBuiltin("[Valaa.name]",
        `returns the host *name* of *this* resource`
    )(function getNameOf (discoverable) {
      return this.getFieldOf(discoverable, "name");
    }),
    setNameOf: denoteDeprecatedValaaBuiltin("[Valaa.name] = newName",
        `sets the host *name* of *this* resource to given *newName*`
    )(function setNameOf (discoverable, newName) {
      return this.setFieldOf(discoverable, "name", newName);
    }),

    getTags: Symbol("Resource.getTags"),
  });
  scope.Discoverable.prototype = Object.assign(Object.create(scope.Resource.prototype), {
    constructor: scope.Discoverable,
    [scope.Discoverable.getTags]: denoteValaaKueryFunction(
        `returns an array of host *tags* of *this* resource, ${
            ""}optionally filtered by given *additionalConditions*`
    )(function getTags (discoverable, ...additionalConditions) {
      return VALEK.tags(...additionalConditions.map(condition =>
          VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
  });
  scope.Discoverable.hostObjectPrototype = scope.Discoverable.prototype;

  scope.Describable = Valaa.Describable = Object.assign(Object.create(scope.Discoverable), {
    name: "Describable",
  });
  scope.Describable.prototype = Object.assign(Object.create(scope.Discoverable.prototype), {
    constructor: scope.Describable,
  });
  scope.Describable.hostObjectPrototype = scope.Describable.prototype;

  scope.TransientScriptFields = Valaa.TransientScriptFields = Object.assign(
      Object.create(scope.TransientFields),
      { name: "TransientScriptFields" });
  scope.TransientScriptFields.prototype = Object.assign(
      Object.create(scope.TransientFields.prototype),
      { constructor: scope.TransientScriptFields });
  scope.TransientScriptFields.hostObjectPrototype = scope.TransientScriptFields.prototype;

  // The fact that Scope inherits from Describable is an implementation
  // hack compared to the actual Scope interface declaration which
  // doesn't inherit any interfaces (and in principle could be
  // available for Data types as well). However, in practice a Scope is
  // only inherited by Relatable alongside multiply inheriting
  // Describable. By making Describable the base of Scope the need for
  // multiple inheritance diagram here is avoided.
  scope.Scope = Valaa.Scope = Object.assign(Object.create(scope.Describable), {
    name: "Scope",
    createVariable: denoteDeprecatedValaaBuiltin("Valaa.Scope.createIdentifier",
        `DEPRECATED: Valaa.Scope.createVariable\n\tprefer: Valaa.Scope.createIdentifier`
    )(function createVariable (initialValue: any) {
      console.error("DEPRECATED: Valaa.Scope.createVariable",
          "\n\tprefer: Valaa.Scope.createIdentifier");
      return createNativeIdentifier(initialValue);
    }),
    createIdentifer: denoteValaaBuiltinWithSignature(
        `Returns an identifier object. When this object is placed context lookup it will act as${
        ""} a mutable variable binding, with the context lookup key as its identifier name.`
    )(function createIdentifier (initialValue: any) {
      return createNativeIdentifier(initialValue);
    }),
    getProperty: Symbol("Scope.getProperty"),
    getAssociatedNativeGlobal: Symbol("Scope.getAssociatedNativeGlobal"),
    getHostGlobal: Symbol("Scope.getHostGlobal"),
  });
  scope.Scope.prototype = Object.assign(Object.create(scope.Describable.prototype), {
    constructor: scope.Scope,
    [scope.Scope.getProperty]: denoteValaaKueryFunction(
        `returns the Property object with the given name in this Scope.`
    )(function getProperty (name) {
      return VALEK.property(name).toVAKON();
    }),
    [scope.Scope.getAssociatedNativeGlobal]: denoteDeprecatedValaaBuiltin(
        "Valaa.Scope.getGostGlobal",
        `DEPRECATED: Valaa.Scope.getAssociatedNativeGlobal\n\tprefer: Valaa.Scope.getHostGlobal`
    )(function getAssociatedNativeGlobal () {
      console.error(
          `DEPRECATED: Valaa.Scope.getAssociatedNativeGlobal\n\tprefer: Valaa.Scope.getHostGlobal`);
      return this.getHostGlobal();
    }),
    [scope.Scope.getHostGlobal]: denoteValaaBuiltinWithSignature(
        `returns the javascript host global object associated with this Scope. This host global${
        ""} object is used as the javascript global object for all application/javascript medias${
        ""} that are owned by this Scope. This global object prototypically inherits the host${
        ""} global object of the nearest owning Scope. Thus all host global variables introduced${
        ""} to the Scope by its directly owned javascript medias will be available to all other${
        ""} medias directly or indirectly owned by the Scope.${
        ""} The host global object can modified like a native object, so that unlike Valaa${
        ""} resource modifications any host global object modifications are${
        ""} 1. local; they are not visible to other users or tabs,${
        ""} 2. immediate; they don't wait for the surrounding transaction to be committed,${
        ""} 3. irreversible; they are not reverted if the surrounding transaction is aborted,${
        ""} 4. not persistent; they are lost on browser refresh (or on any inspire engine restart${
        ""} in general).`
    )(function getHostGlobal () {
      return this.getHostGlobal();
    }),
  });
  scope.Scope.hostObjectPrototype = scope.Scope.prototype;

  scope.Property = Valaa.Property = Object.assign(Object.create(scope.Describable), {
    name: "Property",
    [defaultOwnerCoupledField]: "properties",
  });
  scope.Property.prototype = Object.assign(Object.create(scope.Describable.prototype), {
    constructor: scope.Property,
  });
  scope.Property.hostObjectPrototype = scope.Property.prototype;


  const RelatableMultipleInherited = Object.assign(Object.create(scope.Scope),
      scope.TransientScriptFields);
  delete RelatableMultipleInherited.name;
  scope.Relatable = Valaa.Relatable = Object.assign(Object.create(RelatableMultipleInherited), {
    name: "Relatable",

    getRelations: Symbol("Relatable.getRelations"),
    getRelationsTargets: Symbol("Relatable.getRelationTargets"),
    setRelations: Symbol("Relatable.setRelations"),

    getRelationsOf: denoteDeprecatedValaaBuiltin(
        "[Relatable.getRelations](name, ...additionalConditions)",
        `returns an array which contains all Relation objects which have given *name*, have given ${
            ""} *relatable* as their host *Relation.source* field value and which fullfill all ${
            ""} constaints of given additionalConditions`
    )(function getRelationsOf (relatable, name, ...additionalConditions) {
      try {
        return this.getFieldOf(relatable,
            VALEK.relations(name,
                ...additionalConditions.map(condition =>
                    VALEK.fromVAKON(extractFunctionVAKON(condition)))));
      } catch (error) {
        throw wrapError(error, `During ${this.constructor.name}\n .getRelationsOf, with:`,
            "\n\tthis:", this,
            "\n\trelatable:", relatable,
            "\n\tname:", name,
            "\n\tadditionalConditions:", additionalConditions);
      }
    }),

    getIncomingRelations: Symbol("Relatable.getIncomingRelations"),
    getIncomingRelationsSources: Symbol("Relatable.getIncomingRelationSources"),
    setIncomingRelations: Symbol("Relatable.setIncomingRelations"),

    getIncomingRelationsOf: denoteDeprecatedValaaBuiltin(
        "[Relatable.getIncomingRelations](name, ...additionalConditions)",
        `returns an array which contains all Relation objects which have given *name*, have *this*${
            ""} relatable as their host *Relation.target* field value and which fullfill all ${
            ""} constaints of given additionalConditions`
    )(function getIncomingRelationsOf (entity, name, ...additionalConditions) {
      return this.getFieldOf(entity,
          VALEK.incomingRelations(name,
              ...additionalConditions.map(condition =>
                  VALEK.fromVAKON(extractFunctionVAKON(condition)))));
    }),
  });

  const RelatablePrototypeMultipleInherited = Object.assign(Object.create(scope.Scope.prototype),
      scope.TransientScriptFields.hostObjectPrototype);
  scope.Relatable.prototype = Object.assign(Object.create(RelatablePrototypeMultipleInherited), {
    constructor: scope.Relatable,
    [scope.Relatable.getRelations]: denoteValaaKueryFunction(
        `returns an array which contains all outgoing (connected or not) *Relation* resources${
            ""} which have the given *name* as their *Describable.name*${
            ""} and which satisfy all constraints of the optionally given *additionalConditions*.${
            ""} Outgoing relations are listed in *Relatable.relations*${
            ""} and they all have *this* *Relatable* as their *Relation.source*.${
            ""} Note: all matching relations are selected, even those in unconnected partitions.`
    )(function getRelations (name, ...additionalConditions) {
      return VALEK.relations(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [scope.Relatable.getRelationsTargets]: denoteValaaKueryFunction(
        `returns an array which contains all *Relation.target* *Relatable* resources of the ${
            ""} selected outgoing *Relation* resources.${
            ""} This selection is defined identically to *Relatable.getRelations*${
            ""} using the given *name* and the optionally given *additionalConditions*.`
    )(function getRelationsTargets (name, ...additionalConditions) {
      return VALEK.relationTargets(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [scope.Relatable.setRelations]: denoteValaaBuiltinWithSignature(
        `Replaces all relations with given *name* with relations in given *newRelations* sequence.${
            ""} This can be used to reorder the relations, as even if no entries are actually${
            ""} removed or added (if the new set has the same entries as the existing set), their${
            ""} order will be changed to match the order in the new sequence.`
    )(function setRelations (name, newRelations: any[]) {
      try {
        return this.replaceWithinField("relations",
            this.get(VALEK.relations(name), { transaction: this.__callerValker__ }),
            newRelations, { transaction: this.__callerValker__ });
      } catch (error) {
        throw wrapError(error, `During ${this.constructor.name}\n .setRelations('${name}'), with:`,
            "\n\tnewRelations:", ...dumpObject(newRelations));
      }
    }),
    [scope.Relatable.getIncomingRelations]: denoteValaaKueryFunction(
        `returns an array which contains all incoming, connected *Relation* resources${
            ""} which have the given *name* as their *Describable.name*${
            ""} and which satisfy all constraints of the optionally given *additionalConditions*.${
            ""} Incoming relations are listed in *Relatable.incomingRelations*${
            ""} and they all have *this* *Relatable* as their *Relation.target*.${
            ""} Note: only relations inside connected partitions are listed${
            ""} (even though some might be inactive, f.ex. if they have an inactive prototype).`
    )(function getIncomingRelations (name, ...additionalConditions) {
      return VALEK.incomingRelations(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [scope.Relatable.getIncomingRelationsSources]: denoteValaaKueryFunction(
        `returns an array which contains all *Relation.source* *Relatable* resources of the ${
            ""} selected incoming *Relation* resources.${
            ""} This selection is defined identically to *Relatable.getIncomingRelations*${
            ""} using the given *name* and the optionally given *additionalConditions*.`
    )(function getIncomingRelationsSources (name, ...additionalConditions) {
      return VALEK.incomingRelationSources(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [scope.Relatable.setIncomingRelations]: denoteValaaBuiltinWithSignature(
        `Replaces all incoming relations with given *name* with relations in given${
            ""} *newIncomingRelations* sequence.${
            ""} This can be used to reorder the relations, as even if no entries are actually${
            ""} removed or added (if the new set has the same entries as the existing set), their${
            ""} order will be changed to match the order in the new sequence.`
    )(function setIncomingRelations (name, newIncomingRelations: any[]) {
      try {
        return this.replaceWithinField("incomingRelations",
            this.get(VALEK.incomingRelations(name), { transaction: this.__callerValker__ }),
            newIncomingRelations, { transaction: this.__callerValker__ });
      } catch (error) {
        throw wrapError(error, `During ${this.constructor.name}\n .setIncomingRelations('${name
            }'), with:`,
            "\n\tnewIncomingRelations:", ...dumpObject(newIncomingRelations));
      }
    }),
  });
  scope.Relatable.hostObjectPrototype = scope.Relatable.prototype;

  scope.Relation = Valaa.Relation = Object.assign(Object.create(scope.Relatable), {
    name: "Relation",
    [defaultOwnerCoupledField]: "relations",
    getSourceOf: denoteDeprecatedValaaBuiltin("[Relation.source]")(
        function getSourceOf (relation) { return relation.get("source"); }), // eslint-disable-line
    setSourceOf: denoteDeprecatedValaaBuiltin("[Relation.source] = newSource")(
        function setSourceOf (relation, newSource) { relation.setField("source", newSource); }),  // eslint-disable-line
    getTargetOf: denoteDeprecatedValaaBuiltin("[Relation.target]")(
        function getTargetOf (relation) { return relation.get("target"); }),  // eslint-disable-line
    setTargetOf: denoteDeprecatedValaaBuiltin("[Relation.target] = newSource")(
        function setTargetOf (relation, newTarget) { relation.setField("target", newTarget); }), // eslint-disable-line
  });
  scope.Relation.prototype = Object.assign(Object.create(scope.Relatable.prototype), {
    constructor: scope.Relation,
  });
  scope.Relation.hostObjectPrototype = scope.Relation.prototype;

  scope.Partition = Valaa.Partition = Object.assign(Object.create(scope.Resource), {
    name: "Partition",
    createPartitionURI: denoteValaaBuiltinWithSignature(
        `Creates a URI from given *base* and *partitionId* strings`
    )(createPartitionURI),
    tryPartitionConnection: denoteValaaBuiltinWithSignature(
        `Returns an existing, fully synced connection to the partition with given${
          ""} *partitionURI*, undefined otherwise`
    )(function tryPartitionConnection (partitionURI) {
      const ret = this.__callerValker__.getProphet()
          .acquirePartitionConnection(partitionURI, { require: false, newConnection: false });
      return (ret && ret.isSynced()) ? ret : undefined;
    }),
    acquirePartitionConnection: denoteValaaBuiltinWithSignature(
        `Returns a promise to a full connection to the partition with given *partitionURI* and${
            ""} *options*. If no full connection exists, waits on a possibly existing on-going ${
            ""} connection process. If none exists creates a new connection process.`
    )(function acquirePartitionConnection (partitionURI, options = {}) {
      return Promise.resolve(this.__callerValker__.getProphet()
          .acquirePartitionConnection(partitionURI, options)
          .getSyncedConnection());
    }),
  });
  scope.Partition.prototype = Object.assign(Object.create(scope.Resource.prototype), {
    constructor: scope.Entity,
  });
  scope.Partition.hostObjectPrototype = scope.Partition.prototype;

  const EntityMultipleInherited = Object.assign(Object.create(scope.Relatable), scope.Partition);
  delete EntityMultipleInherited.name;
  scope.Entity = Valaa.Entity = Object.assign(Object.create(EntityMultipleInherited), {
    name: "Entity",
    getListenersOf (entity, name, ...additionalConditions) {
      return this.getFieldOf(entity,
          VALEK.listeners(name,
              ...additionalConditions.map(condition =>
                  VALEK.fromVAKON(extractFunctionVAKON(condition)))));
    },
  });
  const EntityPrototypeMultipleInherited = Object.assign(Object.create(scope.Relatable.prototype),
      scope.Partition.hostObjectPrototype);
  scope.Entity.prototype = Object.assign(Object.create(EntityPrototypeMultipleInherited), {
    constructor: scope.Entity,
  });
  scope.Entity.hostObjectPrototype = scope.Entity.prototype;

  scope.Media = Valaa.Media = Object.assign(Object.create(scope.Relatable), {
    name: "Media",
    immediateContent: Symbol("Media.immediateContent"),
    readContent: Symbol("Media.readContent"),
    getURL: Symbol("Media.getURL"),
  });
  scope.Media.prototype = Object.assign(Object.create(scope.Relatable.prototype), {
    constructor: scope.Media,
    [scope.Media.immediateContent]: denoteValaaKueryFunction(
        `returns the Media content if it is immediately available.`
    )(function immediateContent (options: any) {
      return VALEK.interpretContent({
        synchronous: true,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
    }),
    [scope.Media.readContent]: denoteValaaKueryFunction(
        `returns a promise to the Media content.`
    )(function readContent (options: any) {
      const ret = VALEK.interpretContent({
        synchronous: false,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
      return ret;
    }),
    [scope.Media.interpretContent]: denoteValaaKueryFunction(
        `returns a promise to the Media content.`
    )(function interpretContent (options: any) {
      const ret = VALEK.interpretContent({
        synchronous: false,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
      return ret;
    }),
    [scope.Media.getURL]: denoteValaaKueryFunction(
        `returns a promise to a transient Media URL which can be used in the local${
        ""} context (ie. browser HTML) to access the Media content.`
    )(function getURL (options: any) {
      return VALEK.mediaURL({
        synchronous: false,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
    }),
  });
  scope.Media.hostObjectPrototype = scope.Media.prototype;
}

function prepareInitialState (Type: Object, scope: ?Object, initialState: ?Object,
    requireOwnerOperation: ?string) {
  invariantifyObject(initialState, "new initialState", { allowEmpty: true, allowUndefined: true });
  // TODO(iridian): Check for non-allowed fields.
  const initialOwner = initialState && (initialState.owner !== undefined
      ? initialState.owner : hasOwnerAlias(Type, initialState));
  if (!initialOwner) {
    if (initialOwner === null) return initialState;
    if (requireOwnerOperation) {
      throw new Error(`${requireOwnerOperation} initialState.owner required`);
    }
    /*
    if (!hasOwnerAlias(Type, initialState)
        && scope && (typeof scope.self === "object") && scope.self.this) {
      ret.owner = scope.self.this.getId().coupleWith(Type[defaultOwnerCoupledField]);
    }
    */
  } else if (typeof initialOwner !== "object") {
    throw new Error(`${requireOwnerOperation || "duplicate"
        } initialState.owner must be a Resource, got '${typeof initialOwner}'`);
  } else if ((initialState.owner !== undefined) && Type[defaultOwnerCoupledField]) {
    initialState.owner =
        getHostRef(initialState.owner, `${requireOwnerOperation || "duplicate"} initialState.owner`)
        .coupleWith(Type[defaultOwnerCoupledField]);
  }
  return initialState;
}

function hasOwnerAlias (Type: Object, initialState: Object) {
  return (Type.name === "Relation") && initialState.source;
}
