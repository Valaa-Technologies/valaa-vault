// @flow

import {
  denoteValOSCallable, denoteValOSKueryFunction, denoteDeprecatedValOSCallable,
} from "~/raem/VALK";
import type { VRL } from "~/raem/VRL";
import { qualifiedSymbol } from "~/tools/namespace";

import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import { duplicateResource, instantiateResource }
    from "~/engine/valosheath/resourceLifetimeOps";
import { OwnerDefaultCouplingTag } from "~/engine/valosheath/enfoldSchemaSheath";

import { dumpObject, wrapError } from "~/tools";

const symbols = {
  getField: qualifiedSymbol("V", "getField"),
  getFieldCoupling: qualifiedSymbol("V", "getFieldCoupling"),
  setField: qualifiedSymbol("V", "setField"),
  addToField: qualifiedSymbol("V", "addToField"),
  removeFromField: qualifiedSymbol("V", "removeFromField"),
  replaceWithinField: qualifiedSymbol("V", "replaceWithinField"),
  setOwner: qualifiedSymbol("V", "setOwner"),
  getEntity: qualifiedSymbol("V", "getEntity"),
  getMedia: qualifiedSymbol("V", "getMedia"),
  getSubResource: qualifiedSymbol("V", "getSubResource"),
  obtainSubResource: qualifiedSymbol("V", "obtainSubResource"),
  instantiate: qualifiedSymbol("V", "instantiate"),
  duplicate: qualifiedSymbol("V", "duplicate"),
  prepareBlob: qualifiedSymbol("V", "prepareBlob"),
  prepareBvob: qualifiedSymbol("V", "prepareBvob"),
};

export default {
  isGlobal: true,

  symbols,
  typeFields: {
    activate: denoteValOSCallable([
`Returns a promise to an activation operation of the given *resource*`,
`Activating a resource is the operation of sourcering the chronicles of
all of the resources in its prototype chain.

The returned promise resolves to the given resource itself once all
corresponding chronicles have completed their first narration. If the
resource is already active the returned promise is an already resolved
one.`,
    ])(function activate (resource) {
      return Promise.resolve(resource.activate());
    }),

    isActive: denoteValOSCallable([
`Returns true if the given *resource* is active`,
`Returns false if the *resource* is inactive and not being activated at
all, or if any of the prototype chain chronicles is still undergoing
sourcering or first narration.`,
    ])(function isActive (resource) {
      return resource.isActive();
    }),

    getFieldOf: denoteDeprecatedValOSCallable(
"Returns the value of the host field with given *fieldName* of the given *resource*",
        ["DEPRECATED", "V:getField"],
    )(function getFieldOf (resource, fieldVAKON) {
      try {
        return resource.step(fieldVAKON, { discourse: this.__callerValker__ });
      } catch (error) {
        throw wrapError(error, `During ${this.constructor.name}\n .getFieldOf, with:`,
            "\n\tresource:", ...dumpObject(resource));
      }
    }),

    setFieldOf: denoteDeprecatedValOSCallable(
"Sets the host field with given *fieldName* of the given *resource* to given *newValue*",
        ["DEPRECATED", "V:setField"],
    )(function setFieldOf (resource, fieldName, newValue) {
      return resource.setField(fieldName, newValue, { discourse: this.__callerValker__ });
    }),

    getOwnerOf: denoteDeprecatedValOSCallable(
"Returns the owner of the given *resource*",
        ["DEPRECATED", "V:owner"],
    )(function getOwnerOf (resource) { return this.getFieldOf(resource, "owner"); }),

    setOwnerOf: denoteDeprecatedValOSCallable([
`sets the host owner of the given *resource* to the given *owner*`,
`Can optionally be given *coupledField*. If not given coupledField
default value is determined by the type of this resource to be either
'unnamedOwnlings', 'properties', 'relations' or 'listeners'`,
        ],
        ["DEPRECATED", "V:setOwner"],
    )(function setOwnerOf (
          resource, owner, coupledField = this[OwnerDefaultCouplingTag] || "unnamedOwnlings") {
      return this.setFieldOf(resource, "owner", owner.getVRef().coupleWith(coupledField));
    }),

    getActiveResource: denoteValOSCallable([
`Returns the active resource with given *id* if one exists, otherwise
throws an error.`,
`An active resource is an existing, non-destroyed resource in a fully
connected chronicle whose all possible prototypes are also active.

If the error is due to an unconnected or partially connected chronicle
an absent chronicle error is thrown. This causes an implicit chronicle
connection attempt which by default restarts this transaction.

Otherwise a regular, by default unhandled exception is thrown.`,
    ])(function getActiveResource (id: string | VRL) {
      try {
        const ret = this.__callerValker__.run({}, VALEK.fromObject(id).notNull());
        if (!ret) {
          throw new Error(`Could not find resource '${String(id)}' in the False Sourcerer corpus`);
        }
        ret.requireActive();
        return ret;
      } catch (error) {
        const ret = this.__callerValker__.run({}, VALEK.fromObject(id).nullable());
        this.__callerValker__.debugEvent(
            "DEPRECATED, SUBJECT TO CHANGE:",
            "Resource.getActiveResource returns null if no active resource is found, for now",
            "\n\tprefer: Resource.tryActiveResource returning null",
            "\n\tchange: Resource.getActiveResource will throw if no active resource is found",
            "instead of returning null. Actual error listed as collapsed below.");
        this.__callerValker__.outputErrorEvent(
            this.__callerValker__.wrapErrorEvent(error, 1, () => [
              `Resource.getActiveResource('${String(id)}')`,
              "\n\tvalker:", ...dumpObject(this.__callerValker__),
            ]),
            1,
            `Exception caught (collapsed and ignored during deprecation period: ${
              ""}\n\n\tEVENTUALLY THIS WILL BECOME AN ACTUAL ERROR\n\n)`);
        return ret;
      }
    }),

    tryActiveResource: denoteValOSCallable([
`Returns the active resource with given *id* if one exists, otherwise
returns null.`,
`An active resource is an existing, non-destroyed resource in a fully
connected chronicle whose all possible prototypes are also active.`,
    ])(function tryActiveResource (id: string | VRL) {
      const ret = this.__callerValker__.run({}, VALEK.fromObject(id).nullable());
      return ret && (ret.getPhase() === "Active") && ret;
    }),

    recombine: denoteValOSCallable([
`Returns an array of duplicated resources based on the given *duplicationDirectives* (dd).`,
`The duplications are performed as if they are part of a single
duplication; all directly and indirectly owned cross-references between
all *dd.duplicateOf* resources are updated to cross-refer to the
appropriate (sub-)resources in the resulting duplicates.

This has two major advantages over the singular duplication.

First advantage is that recombination allows for fine-grained control
over all duplicated resources and not just the top-level. When a
*dd.duplicateOf* refers to a resource which is already being implicitly
duplicated (by some other directive targeting its (grand)owner) then
the rules in the explicit dd override the default duplication instead
of creating an extra duplicate. Notably this also allows for omission
of whole sub-branches from the duplication by specifying null *dd.id*.

Second advantage is that by providing customized *dd.initialState.owner*
values the recombination can fully alter ownership hierarchy of the
duplicated objects (unlike duplication which once again can only manage
duplicated top-level resource). Specifically this enables duplication
of resources from different locations and even chronicles to under the
same entity while maintaining the internal cross-references between
different recombined resources. Vice versa recombine allows spreading
the duplicates to separate chronicles (at least insofar a
multi-chronicle commands between said chronicles is possible).`,
    ])(function recombine (...duplicationDirectives) {
      return this.__callerValker__.getFollower().recombine(duplicationDirectives,
          { discourse: this.__callerValker__ });
    }),

    destroy: denoteValOSCallable(
`Destroys the given *resource* and recursively all resources owned by it`
    )(function destroy (resource) {
      return resource.destroy({ discourse: this.__callerValker__ });
    }),
  },

  prototypeFields: {
    hasOwnProperty: denoteValOSKueryFunction(
`Returns true if this resource has the given *propertyName* as its own
locally materialized property, false otherwise.`,
        { cachingArguments: 1 },
    )(function hasOwnProperty (propertyName: string | Symbol) {
      // TODO(iridian, 2020-09): Implement field support using qualified symbols.
      return VALEK.or(
          VALEK.property(propertyName).nullable().toField("ownFields").toField("value")
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

    [symbols.getField]: denoteValOSKueryFunction([
`Returns the value of the valospace field with given *fieldName* of *this* Resource`,
`This is an internal API and should be avoided in favor of ordinary
field access.`,
        ],
        [`EXPERIMENTAL: this is an internal API.`, `.$V.<fieldName>`],
    )(function getField (fieldName: string) {
      return fieldName;
    }),

    [symbols.getFieldCoupling]: denoteValOSKueryFunction([
`Returns the coupled field of the given singular valospace field
*fieldName* of *this* Resource`,
"",
        ],
        {
          deprecation: `EXPERIMENTAL: this is an internal API with no alternative.`,
          cachingArguments: 1,
        }
    )(function getFieldCoupling (fieldName: any) {
      return VALEK.toField(fieldName).coupling().toVAKON();
    }),

    [symbols.setField]: denoteValOSCallable(
`Sets the value of the field *fieldName* of *this* Resource.`
    )(function setField (fieldName: string, newValue: any) {
      return this.setField(fieldName, newValue, { discourse: this.__callerValker__ });
    }),

    [symbols.addToField]: denoteValOSCallable([
`Adds the given *value* to the host field with given *fieldName* of *this* Resource.`,
`If the *value* is an iterable all the entries will be added in
iteration order. All added values will be placed to the end of the
sequence, even if they already exist.`,
    ])(function addToField (fieldName: string, value: any) {
      return this.addToField(fieldName, value, { discourse: this.__callerValker__ });
    }),

    [symbols.removeFromField]: denoteValOSCallable([
`Removes the given *value* from the host field with given *fieldName*
of *this* Resource.`,
`If the *value* is an iterable all the iterated entries will be removed.`,
    ])(function removeFromField (fieldName: string, value: any) {
      return this.removeFromField(fieldName, value, { discourse: this.__callerValker__ });
    }),

    [symbols.replaceWithinField]: denoteValOSCallable([
`Replaces the given *replacedValues* within the field *fieldName* of
*this* Resource with given *withValues*.`,
`Behaves like a removedFrom call followed by an addedTo call, where the
removedFrom is given the entries appearing only in *replacedValues* and
addedTo is given *withValues* as-is.`,
    ])(function replaceWithinField (fieldName: string, replacedValues: any[], withValues: any[]) {
      return this.replaceWithinField(fieldName, replacedValues, withValues,
          { discourse: this.__callerValker__ });
    }),

    [symbols.setOwner]: denoteValOSCallable([
`Sets the host owner of *this* Resource to the given *owner*, with
optionally given *coupledFieldName*.`,
`The coupledFieldName default value is based on the type of this
resource as either 'unnamedOwnlings', 'properties', 'relations' or 'listeners'`,
    ])(function setOwner (owner, coupledField
        = (this.constructor && this.constructor[OwnerDefaultCouplingTag]) || "unnamedOwnlings") {
      return this.setField("owner", owner.getVRef().coupleWith(coupledField),
          { discourse: this.__callerValker__ });
    }),

    [symbols.getEntity]: denoteValOSKueryFunction(
`Returns the first owned Entity with the given *name*.`,
        { cachingArguments: 1 },
    )(function getEntity (name: string) {
      return VALEK.toField("unnamedOwnlings")
          .filter(VALEK.isOfType("Entity").and(VALEK.hasName(name))).toIndex(0).toVAKON();
    }),

    [symbols.getMedia]: denoteValOSKueryFunction(
`Returns the first owned Media with the given *name*.`,
        { cachingArguments: 1 },
    )(function getMedia (name: string) {
      return VALEK.toField("unnamedOwnlings")
          .filter(VALEK.isOfType("Media").and(VALEK.hasName(name))).toIndex(0).toVAKON();
    }),

    [symbols.getSubResource]: denoteValOSCallable([
`Returns a reference to the structured sub-resource reached from this
resource via the given *subId* VPath.`,
`This call does not create any resources. If the sub-resource does not
exist the reference will be immaterial.

See $V.obtainSubResource.`
    ])(function getSubResource (subId, explicitChronicleURI) {
      return Vrapper.prototype.getSubResource.call(this, subId, {
        contextChronicleURI: explicitChronicleURI, discourse: this.__callerValker__,
      });
    }),

    [symbols.obtainSubResource]: denoteValOSCallable([
`Returns an existing or a newly created structured sub-resource that is
reached from this resource via the given *subId* VPath.`,
`Will create all resources traversed by the subId VPath that don't
exist.

Provides initial field and property values for the newly created
resources so that they satisfy the semantic constraints of the subId
VPath elements. This typically means that at least the resource type
and its $V.owner and $V.name are initialized, but depending on VPath
contents other properties can also be initialized.

Calls the optional callback argument *extendInitialState* for each new
resource right before the resource is created. This call is passed
*initialState* and *subIdIndex* as arguments.
The *subIdIndex* is an index to the *subId* sub-element for which a new
resource is about to be created.
The *initialState* contains the initial fields and properties for the
new resource. These values are immutable and can only be inspected but
new fields and properties can be added. Once the callback returns the
*initialState* will be passed to the V:Resource.new call.
`,
    ])(function obtainSubResource (subId, extendInitialState, explicitChronicleURI) {
      return Vrapper.prototype.obtainSubResource.call(this, subId, {
        extendInitialState,
        contextChronicleURI: explicitChronicleURI, discourse: this.__callerValker__,
      });
    }),

    [symbols.instantiate]: denoteValOSCallable(
`Instantiates *this* Resource with given *initialState*.`
    )(function instantiate (initialState) {
      return instantiateResource.call(this.getValospaceType(),
          this.__callerValker__, this.__callerScope__, this, initialState);
    }),

    [symbols.duplicate]: denoteValOSCallable(
`Duplicates *this* Resource with given *initialState*.`
    )(function duplicate (initialState) {
      return duplicateResource.call(this.getValospaceType(),
          this.__callerValker__, this.__callerScope__, this, initialState);
    }),
    /*
    hasInterface: denoteDeprecatedValOSCallable(
`Returns true if *this* resource implements the host interface *interfaceName*`,
        ["DEPRECATED", "V:hasInterface"],
    )(function hasInterface (interfaceName: Vrapper, interfaceNameLegacy: string) {
      if (this instanceof Vrapper) return this.hasInterface(interfaceName);
      return interfaceName.hasInterface(interfaceNameLegacy);
    }),
    [symbols.prepareBlob]: denoteDeprecatedValOSBuiltin(
        "Returns a promise to a Bvob creator callback. See Resource.prepareBvob.",
        ["DEPRECATED", "V:prepareBvob"],
    )(function prepareBlob (content: any) {
      return Promise.resolve(this.prepareBvob(content, { discourse: this.__callerValker__ }));
    }),
    */
    [symbols.prepareBvob]: denoteValOSCallable([
`Uploads the given *content* and returns a promise to a Bvob resource creation callback.`,
`All valospace binary content is associated with a chronicle in the
form immutable Bvob resource references. A full process of uploading
content to valospace is a two-stage process. Firstly the content must
be  uploaded and validated by persistence layers. Secondly the content
hash must be chronicled as a Bvob reference in the chronicle event log.

This function initiates the first stage and returns a promise to a
callback. The promise resolves when the given *content* has been
converted into raw data and persisted in the *nearest persistence cache*.

The resolved value is a callback which when called creates a Bvob
resource in the chronicle of *this* Resource and returns a reference to
it. This Bvob should then be immediately assigned to a resource field
in the chronicle (usually as V:content of some V:Media) to initiate the
second stage. Note that as the Bvob itself only represents binary
content all encoding information, contentType and any other metadata
should be assigned at the same time (see V:Media).

There can be a period of time between the first stage and the second
stage, especially if user interaction is performed in between. During
this period the uploaded content is pending and likely has no chronicle
references to it until the second stage is initiated and completed.

The pending content is guaranteed to remain valid until one of the
following conditions is true:`,
      { "numbered#": [
[`The bvob id is used in a command that has been successfully locally
persisted in the command queue of this chronicle. At this point the
bvob id cache validity is governed by the ordinary chronicle bvob
content persistence rules.`],
[`The execution context is reset (ie. on a browser/tab is refreshed).`],
[`Local bvob cache is explicitly flushed (which is unimplemented).`],
      ] },
    ])(function prepareBvob (content: any) {
      return Promise.resolve(this.prepareBvob(content, { discourse: this.__callerValker__ }));
    }),
  },
};
