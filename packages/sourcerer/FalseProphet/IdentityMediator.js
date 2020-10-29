// @flow

import { vRef } from "~/raem/VRL";
import { getHostRef } from "~/raem/VALK/hostReference";

import type FalseProphet from "~/sourcerer/FalseProphet/FalseProphet";

import { dumpObject, FabricEventTarget } from "~/tools";

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
    for (const [publicIdentity, identityOptions] of Object.entries(options.add || {})) {
      this.add(publicIdentity, identityOptions);
    }
  }

  list () { return Object.keys(this._activeIdentities); }

  add (publicAuthorityIdentity: string | Object, options: Object = {}) {
    try {
      const { authority, chronicleURI, resource } = this._sourcerer
          .resolveReference(publicAuthorityIdentity);
      const authorityURI = authority.getAuthorityURI();
      if (this._authorityIdentities[authorityURI]) {
        throw new Error(`IdentityMediator..add: authority <${
            authorityURI}> already has a public identity: ${
            this._authorityIdentities[authorityURI].identityId}`);
      }
      const identityParams = {
        ...options,
        authority,
        identityChronicleURI: chronicleURI,
        publicIdentity: resource,
      };
      this._activeIdentities[chronicleURI] = identityParams;
      this._authorityIdentities[authorityURI] = identityParams;
      return identityParams;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("identity.add"),
          "\n\tpublicAuthorityIdentity:", ...dumpObject(publicAuthorityIdentity),
      );
    }
  }

  get (resource: string | Object) { return _getIdentityParams(this, resource); }
  try (resource: string | Object) { return _getIdentityParams(this, resource, false); }

  remove (publicAuthorityIdentity: string | Object) {
    try {
      const { authority, chronicleURI } = this._sourcerer
          .resolveReference(publicAuthorityIdentity);
      const identityParams = this._activeIdentities[chronicleURI];
      if (!identityParams) {
        throw new Error(`No active public authority identity: <${chronicleURI}>`);
      }
      delete this._activeIdentities[chronicleURI];
      delete this._authorityIdentities[authority.getAuthorityURI()];
      return true;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("identity.remove"),
          "\n\tpublicAuthorityIdentity:", ...dumpObject(publicAuthorityIdentity),
      );
    }
  }

  getPublicIdentityFor (resource: Object | string) {
    return _getIdentityParams(this, resource).publicIdentity;
  }

  getContributorPropertiesFor (resource: Object | string) {
    return { ..._getIdentityParams(this, resource).asContributor };
  }
}

Object.assign(IdentityMediator.prototype, identityPrototypeMethods);

function _getIdentityParams (mediator, reference, require = true) {
  const { authority, resource } = mediator._sourcerer.resolveReference(reference);
  const identityParams = mediator._authorityIdentities[authority.getAuthorityURI()];
  if (require && !identityParams) {
    throw new Error(`Cannot find an active public authority identity for <${resource.toString()}>`);
  }
  return identityParams;
}
