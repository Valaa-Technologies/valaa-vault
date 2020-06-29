// @flow

import type FalseProphet from "~/sourcerer/FalseProphet/FalseProphet";

import { debugObjectType, dumpObject, FabricEventTarget } from "~/tools";

const identityPrototypeMethods = require("~/gateway-api/identity");

export default class IdentityManager extends FabricEventTarget {
  constructor (options: {
    parent: Object, verbosity: ?number, name: ?string, sourcerer: FalseProphet,
    clientURI: string, sessionURI: string, add: ?Object,
  }) {
    super(options.parent, options.verbosity, options.name);
    this._sourcerer = options.sourcerer;
    this.clientURI = options.clientURI;
    this.sessionURI = options.sessionURI;
    this._activeIdentities = {};
    for (const [identityChronicleURI, identityOptions] of Object.entries(options.add || {})) {
      this.add(identityChronicleURI, identityOptions);
    }
  }

  list () { return Object.keys(this._activeIdentities); }

  add (identityChronicleURI: string, options: Object = {}) {
    try {
      if (!identityChronicleURI || (typeof identityChronicleURI !== "string")) {
        throw new Error(`IdentityManager.add.identityChronicleURI string required, got: ${
            debugObjectType(identityChronicleURI)}`);
      }
      options.authority = this._sourcerer.obtainAuthorityOfChronicle(identityChronicleURI);
      if (!options.authority) {
        throw new Error(
            `Can't determine the authority of identity chronicle: <${identityChronicleURI}>`);
      }
      this._activeIdentities[identityChronicleURI] = options;
      return options;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("identity.add"),
          "\n\tidentityChronicleURI:", ...dumpObject(identityChronicleURI));
    }
  }

  get (identityChronicleURI: string) { return this._activeIdentities[identityChronicleURI]; }

  remove (identityChronicleURI: string) {
    try {
      if (!identityChronicleURI || (typeof identityChronicleURI !== "string")) {
        throw new Error(`IdentityManager.remove.identityChronicle required, got: ${
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
