// @flow

import type FalseProphet from "~/sourcerer/FalseProphet/FalseProphet";

import { debugObjectType, dumpObject, FabricEventTarget } from "~/tools";

const identityPrototypeMethods = require("~/gateway-api/identity");

export default class IdentityManager extends FabricEventTarget {
  constructor (options: { sourcerer: FalseProphet, clientURI: string, sessionURI: string }) {
    super(undefined, options.sourcerer.getVerbosity(), options.sourcerer);
    this._sourcerer = options.sourcerer;
    this.clientURI = options.clientURI;
    this.sessionURI = options.sessionURI;
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
      throw this.wrapErrorEvent(error, 1, new Error("identity.add"),
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
      throw this.wrapErrorEvent(error, 1, new Error("identity.remove"),
          "\n\tidentityChronicleURI:", ...dumpObject(identityChronicleURI));
    }
  }
}

Object.assign(IdentityManager.prototype, identityPrototypeMethods);
