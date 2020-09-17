// @flow

import {
  denoteValOSCallable, denoteValOSKueryFunction,
} from "~/raem/VALK";
import { qualifiedSymbol } from "~/raem/tools/namespaceSymbols";

import { createNativeIdentifier } from "~/script";

import VALEK from "~/engine/VALEK";

const symbols = {
  getProperty: qualifiedSymbol("V", "getProperty"),
  getAssociatedNativeGlobal: qualifiedSymbol("V", "getAssociatedNativeGlobal"),
  getHostGlobal: qualifiedSymbol("V", "getHostGlobal"),
};

export default {
  isGlobal: true,
  symbols,
  typeFields: {
    /*
    createVariable: denoteDeprecatedValOSCallable(
        `See valos.Scope.createIdentifier`,
        ["DEPRECATED", "valos.Scope.createIdentifier"],
    )(function createVariable (initialValue: any) {
      console.error("DEPRECATED: valos.Scope.createVariable",
          "\n\tprefer: valos.Scope.createIdentifier");
      return createNativeIdentifier(initialValue);
    }),
    */
    createIdentifer: denoteValOSCallable([
`Creates and returns an identifier binding object.`,
`When an identifier object is placed as a scope lookup value it will
act as an assignable identifier binding for valoscript identifier
operations with name equal to the key of the scope lookup.`
    ])(function createIdentifier (initialValue: any) {
      return createNativeIdentifier(initialValue);
    }),
  },
  prototypeFields: {
    [symbols.getProperty]: denoteValOSKueryFunction([
`Returns the Property object with the given name in this Scope.`,
`This Property object is an internal detail of @valos/engine.`,
        ],
        { deprecation: ["DEPRECATED", "Object.getOwnPropertyDescriptor"] },
    )(function getProperty (name) {
      return VALEK.property(name).toVAKON();
    }),
    /*
    [symbols.getAssociatedNativeGlobal]: denoteDeprecatedValOSCallable(
        `See valos.Scope.getHostGlobal`,
        ["DEPRECATED", "valos.Scope.getHostGlobal"],
    )(function getAssociatedNativeGlobal () {
      console.error(
          `DEPRECATED: valos.Scope.getAssociatedNativeGlobal\n\tprefer: valos.Scope.getHostGlobal`);
      return this.getHostGlobal();
    }),
    */
    [symbols.getHostGlobal]: denoteValOSCallable([
`Returns the javascript host global object associated with this Scope.`,
`The host global object of a Scope resource is used as the javascript
global object for all application/javascript medias that are owned by
the Scope.
This global object prototypically inherits the host global object of
the nearest owning Scope. Thus all host global variables introduced to
the Scope by its directly owned javascript medias will be available to
all other medias directly or indirectly owned by the Scope.

The host global object is a native host environment javascript object,
so that unlike valospace resource modifications, the host global object
modifications are:`,
      { "numbered#": [
["local; they are not visible to other users or tabs"],
["immediate; they don't wait for the surrounding transaction to be committed"],
["irreversible; they are not reverted if the surrounding transaction is aborted"],
["not persistent; they are lost on browser refresh (or on any inspire engine restart in general)"],
      ] },
    ])(function getHostGlobal () {
      return this.getHostGlobal();
    }),
  },
};
