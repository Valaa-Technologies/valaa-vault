// @flow

import {
  denoteValOSBuiltinWithSignature, denoteDeprecatedValOSBuiltin, denoteValOSKueryFunction,
} from "~/raem/VALK";

import { createNativeIdentifier, qualifiedSymbol } from "~/script";

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
    createVariable: denoteDeprecatedValOSBuiltin("valos.Scope.createIdentifier",
        `DEPRECATED: valos.Scope.createVariable\n\tprefer: valos.Scope.createIdentifier`
    )(function createVariable (initialValue: any) {
      console.error("DEPRECATED: valos.Scope.createVariable",
          "\n\tprefer: valos.Scope.createIdentifier");
      return createNativeIdentifier(initialValue);
    }),
    createIdentifer: denoteValOSBuiltinWithSignature(
        `Returns an identifier object. When this object is placed context lookup it will act as${
        ""} a mutable variable binding, with the context lookup key as its identifier name.`
    )(function createIdentifier (initialValue: any) {
      return createNativeIdentifier(initialValue);
    }),
  },
  prototypeFields: {
    [symbols.getProperty]: denoteValOSKueryFunction(
        `returns the Property object with the given name in this Scope.`
    )(function getProperty (name) {
      return VALEK.property(name).toVAKON();
    }),
    [symbols.getAssociatedNativeGlobal]: denoteDeprecatedValOSBuiltin(
        "valos.Scope.getHostGlobal",
        `DEPRECATED: valos.Scope.getAssociatedNativeGlobal\n\tprefer: valos.Scope.getHostGlobal`
    )(function getAssociatedNativeGlobal () {
      console.error(
          `DEPRECATED: valos.Scope.getAssociatedNativeGlobal\n\tprefer: valos.Scope.getHostGlobal`);
      return this.getHostGlobal();
    }),
    [symbols.getHostGlobal]: denoteValOSBuiltinWithSignature(
        `returns the javascript host global object associated with this Scope. This host global${
        ""} object is used as the javascript global object for all application/javascript medias${
        ""} that are owned by this Scope. This global object prototypically inherits the host${
        ""} global object of the nearest owning Scope. Thus all host global variables introduced${
        ""} to the Scope by its directly owned javascript medias will be available to all other${
        ""} medias directly or indirectly owned by the Scope.${
        ""} The host global object can modified like a native object, so that unlike ValOS${
        ""} resource modifications any host global object modifications are${
        ""} 1. local; they are not visible to other users or tabs,${
        ""} 2. immediate; they don't wait for the surrounding transaction to be committed,${
        ""} 3. irreversible; they are not reverted if the surrounding transaction is aborted,${
        ""} 4. not persistent; they are lost on browser refresh (or on any inspire engine restart${
        ""} in general).`
    )(function getHostGlobal () {
      return this.getHostGlobal();
    }),
  },
};
