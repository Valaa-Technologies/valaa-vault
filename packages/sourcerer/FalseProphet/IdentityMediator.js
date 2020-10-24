// @flow

import VALK from "~/raem/VALK";
import { vRef } from "~/raem/VRL";
import { getHostRef } from "~/raem/VALK/hostReference";

import type FalseProphet from "~/sourcerer/FalseProphet/FalseProphet";

import { debugObjectType, dumpObject, FabricEventTarget } from "~/tools";

const identityPrototypeMethods = require("~/gateway-api/identity");

export default class IdentityMediator extends FabricEventTarget {
  constructor (options: {
    parent: Object, verbosity: ?number, name: ?string, sourcerer: FalseProphet,
    clientURI: string, sessionURI: string, add: ?Object,
  }) {
    super(options.parent, options.verbosity, options.name);
    this._sourcerer = options.sourcerer;
    this.clientURI = options.clientURI;
    this.sessionURI = options.sessionURI;
    this._activeIdentities = {};
    this._authorityIdentities = {};
    for (const [identityChronicleURI, identityOptions] of Object.entries(options.add || {})) {
      this.add(identityChronicleURI, identityOptions);
    }
  }

  list () { return Object.keys(this._activeIdentities); }

  add (identityChronicleURI: string, options: Object = {}) {
    try {
      if (!identityChronicleURI || (typeof identityChronicleURI !== "string")) {
        throw new Error(`IdentityMediator..add..identityChronicleURI string required, got: ${
            debugObjectType(identityChronicleURI)}`);
      }
      const identityParams = {
        ...options,
        identityChronicleURI,
        authority: this._sourcerer.obtainAuthorityOfChronicle(identityChronicleURI),
      };
      this._authorityIdentities[identityParams.authority.getAuthorityURI()] =
          this._activeIdentities[identityChronicleURI] =
          identityParams;
      return identityParams;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("identity.add"),
          "\n\tidentityChronicleURI:", ...dumpObject(identityChronicleURI));
    }
  }

  get (identityChronicleURI: string) { return this._activeIdentities[identityChronicleURI]; }

  remove (identityChronicleURI: string) {
    try {
      if (!identityChronicleURI || (typeof identityChronicleURI !== "string")) {
        throw new Error(`IdentityMediator..remove..identityChronicle required, got: ${
            debugObjectType(identityChronicleURI)}`);
      }
      const uriString = String(identityChronicleURI);
      const identityParams = this._activeIdentities[uriString];
      if (!identityParams) {
        throw new Error(`No such active identity: <${uriString}>`);
      }
      delete this._activeIdentities[identityParams.authority.getAuthorityURI()];
      delete this._authorityIdentities[identityParams.authority.getAuthorityURI()];
      return true;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("identity.remove"),
          "\n\tidentityChronicleURI:", ...dumpObject(identityChronicleURI));
    }
  }
}

Object.assign(IdentityMediator.prototype, identityPrototypeMethods);
