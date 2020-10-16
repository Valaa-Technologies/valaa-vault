// @flow

import {
  denoteValOSCallable,
} from "~/raem/VALK";
import derivedId from "~/raem/tools/derivedId";
import { qualifiedSymbol } from "~/tools/namespace";

import Vrapper from "~/engine/Vrapper";

const symbols = {
  getFickleId: qualifiedSymbol("V", "getFickleId"),
  // activate: qualifiedSymbol("V", "activate"),
  // isActive: qualifiedSymbol("V", "isActive"),
  createDerivedId: qualifiedSymbol("V", "createDerivedId"),
  hasInterface: qualifiedSymbol("V", "hasInterface"),
};

export default {
  schemaTypeName: "TransientFields",
  namespaceAccessors: {
    V: "valos",
  },
  symbols,
  typeFields: {},
  prototypeFields: {
    [symbols.getFickleId]: denoteValOSCallable([
`Returns a short, descriptive but fickle identifier string of this
resource.`,
`The fickle is uniquely mapped to this resource but during this
execution session only. The returned fickle id string is guaranteed to
be at least the given *minimumLength* characters long. The fickle id
may be longer if a shorter id candidate is already allocated for
another resource.

The fickle algorithm is a best-effort algorithm which /most of the time/
returns a prefix of the resource raw id that is same across sessions,
but none of these qualities is guaranteed.
`,
      ])(function getFickleId (minimumLength) {
        return Vrapper.prototype.getFickleId.call(this, minimumLength);
      }),
      /*
TODO(iridian, 2020-10): Resolve conflict between valos.Resource.activate
as the-symbol-of-instance-field and as member-function-of-type-object
    [symbols.activate]: denoteValOSCallable([
`Returns a promise to an activation operation of this resource`,
`Activating a resource is the operation of sourcering the chronicles of
all of the resources in its prototype chain.

Once active the returned promise resolves to this resource. If the
resource is already active the returned promise is an already resolved
one.`,
      ])(function activate () {
        return Promise.resolve(Vrapper.prototype.activate.call(this));
      }),
    [symbols.isActive]: denoteValOSCallable([
`Returns true if this resource is active`,
`Returns false if this resource is inactive and not being activated at
all, or if any of the prototype chain chronicles is still undergoing
sourcery.`,
      ])(function isActive () {
        return Vrapper.prototype.isActive.call(this);
      }),
      */
  [symbols.createDerivedId]: denoteValOSCallable([
`Creates a deterministic, unique id string based on the id of *this*
resource as well as the optional *salt* and optional *contextId* strings.`,
`The generated id is always the same for same combination of these
three values.`,
      ])(function createDerivedId (salt: string, contextId: string = "") {
        return derivedId(this.getRawId(), salt, contextId);
      }),
  [symbols.hasInterface]: denoteValOSCallable(
`Returns true if *this* resource implements the host interface *interfaceName*`,
      )(function hasInterface (interfaceName: Vrapper) {
        return Vrapper.prototype.hasInterface.call(
            this, interfaceName, { discourse: this.__callerValker__ });
      }),
  },
};
