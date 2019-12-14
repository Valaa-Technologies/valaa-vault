// @flow

import type FalseProphet from "~/sourcerer/FalseProphet/FalseProphet";

import { debugObjectType, dumpObject, FabricEventTarget } from "~/tools";

export default class IdentityManager extends FabricEventTarget {
  constructor (sourcerer: FalseProphet) {
    super(undefined, sourcerer.getVerbosity(), sourcerer);
    this._sourcerer = sourcerer;
    this._activeIdentities = {};
  }

  list () { return Object.keys(this._activeIdentities); }

  add (identityChronicleURI: any, options: Object = {}) {
    try {
      if (!identityChronicleURI) {
        throw new Error(`identityChronicle required, got: ${
            debugObjectType(identityChronicleURI)}`);
      }
      options.authority = this._sourcerer.obtainAuthorityOfPartition(identityChronicleURI);
      if (!options.authority) {
        throw new Error(`Can't locate the authority for identity chronicle: <${
            identityChronicleURI}>`);
      }
      this._activeIdentities[String(identityChronicleURI)] = options;
      return true;
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("identity.add"),
          "\n\tidentityChronicleURI:", ...dumpObject(identityChronicleURI));
    }
  }

  get (identityChronicleURI: any) { return this._activeIdentities[identityChronicleURI]; }

  remove (identityChronicleURI: any) {
    try {
      if (!identityChronicleURI) {
        throw new Error(`identityChronicle required, got: ${
            debugObjectType(identityChronicleURI)}`);
      }
      const uriString = String(identityChronicleURI);
      if (!this._activeIdentities[uriString]) {
        throw new Error(`No such active identity: <${uriString}>`);
      }
      delete this._activeIdentities[uriString];
      return true;
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("identity.remove"),
          "\n\tidentityChronicleURI:", ...dumpObject(identityChronicleURI));
    }
  }
}
