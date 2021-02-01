// @flow

import { createSignatureKeys } from "~/security/signatures";
import type FalseProphet from "~/sourcerer/FalseProphet/FalseProphet";

import { dumpObject, FabricEventTarget } from "~/tools";

const identityPrototypeMethods = require("~/gateway-api/identity");

export default class IdentityMediator extends FabricEventTarget {
  constructor (options: {
    parent: Object, verbosity: ?number, name: ?string, sourcerer: FalseProphet,
    clientURI: string, sessionURI: string, identityProviderURI: string,
    add: ?Object,
  }) {
    super(options.parent, options.verbosity, options.name);
    this._sourcerer = options.sourcerer || options.parent.getSourcerer();
    this.clientId = options.clientId || options.clientURI;
    this.clientURI = options.clientURI || options.clientId;
    this.sessionURI = options.sessionURI;
    this.identityProviderURI = options.identityProviderURI;
    this._activeIdClaims = {};
    this._authorityIdentities = {};
    for (const [publicIdentity, identityOptions] of Object.entries(options.add || {})) {
      this.add(publicIdentity, identityOptions);
    }
  }

  authorize (options) { return this.authorizeSession(options); }
  revoke (options = {}) {
    if (options.redirect === undefined) options.redirect = false;
    return this.revokeSession(options);
  }

  getClaims (options = {}) { return this.getAuthenticatedIdClaims(options); }
  getClaimsFor (resource: string | Object) { return _getIdClaims(this, resource); }
  tryClaimsFor (resource: string | Object) { return _getIdClaims(this, resource, false); }

  get (resource: string | Object) {
    console.debug("DEPRECATED: IdentityMediator.prototype.get, in favor of: .getClaimsFor");
    return _getIdClaims(this, resource);
  }

  try (resource: string | Object) {
    console.debug("DEPRECATED: IdentityMediator.prototype.try, in favor of: .tryClaimsFor");
    return _getIdClaims(this, resource, false);
  }

  list () { return Object.keys(this._activeIdClaims); }

  add (publicAuthorityIdentity: string | Object, options: Object = {}) {
    try {
      const { authority, chronicleURI, resource } = this._sourcerer
          .resolveReference(publicAuthorityIdentity);
      const authorityURI = authority.getAuthorityURI();
      if (this._authorityIdentities[authorityURI]) {
        throw new Error(`IdentityMediator.prototype.add: authority <${
            authorityURI}> already has a public identity: ${
            this._authorityIdentities[authorityURI]}`);
      }
      const idClaims = {
        ...options,
        authority,
        identityChronicleURI: chronicleURI,
        publicIdentity: resource,
      };
      this._activeIdClaims[chronicleURI] = idClaims;
      this._authorityIdentities[authorityURI] = chronicleURI;
      return idClaims;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("identity.add"),
          "\n\tpublicAuthorityIdentity:", ...dumpObject(publicAuthorityIdentity),
      );
    }
  }

  remove (publicAuthorityIdentity: string | Object) {
    try {
      const { authority, chronicleURI } = this._sourcerer
          .resolveReference(publicAuthorityIdentity);
      const idClaims = this._activeIdClaims[chronicleURI];
      if (!idClaims) {
        throw new Error(`No active public authority identity: <${chronicleURI}>`);
      }
      delete this._activeIdClaims[chronicleURI];
      delete this._authorityIdentities[authority.getAuthorityURI()];
      return true;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("identity.remove"),
          "\n\tpublicAuthorityIdentity:", ...dumpObject(publicAuthorityIdentity),
      );
    }
  }

  createAuthorKeys (seed: ?string) {
    return createSignatureKeys(seed);
  }

  getPublicIdentityFor (resource: Object | string) {
    return _getIdClaims(this, resource).publicIdentity;
  }

  getContributorPropertiesFor (resource: Object | string) {
    return { ..._getIdClaims(this, resource).asContributor };
  }
}

Object.assign(IdentityMediator.prototype, identityPrototypeMethods);

function _getIdClaims (mediator, reference, require = true) {
  const { authority, resource } = mediator._sourcerer.resolveReference(reference);
  const chronicleURI = authority && mediator._authorityIdentities[authority.getAuthorityURI()];
  const ret = chronicleURI && mediator._activeIdClaims[chronicleURI];
  if (!ret && require) {
    throw new Error(`Cannot find an active public authority identity for <${resource.toString()}>`);
  }
  return ret;
}
