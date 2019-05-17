// @flow

import type FalseProphet from "~/sourcerer/FalseProphet/FalseProphet";

import { debugObjectType, dumpObject, LogEventGenerator } from "~/tools";

export default class IdentityManager extends LogEventGenerator {
  constructor (sourcerer: FalseProphet) {
    super();
    this._sourcerer = sourcerer;
    this._activeIdentities = {};
  }

  list () { return Object.keys(this._activeIdentities); }

  add (identityPartitionURI: any, options: Object = {}) {
    try {
      if (!identityPartitionURI) {
        throw new Error(`identityPartition required, got: ${
            debugObjectType(identityPartitionURI)}`);
      }
      options.authority = this._sourcerer.obtainAuthorityOfPartition(identityPartitionURI);
      if (!options.authority) {
        throw new Error(`Can't locate the authority for identity partition: <${
            identityPartitionURI}>`);
      }
      this._activeIdentities[String(identityPartitionURI)] = options;
      return true;
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("identity.add"),
          "\n\tidentityPartitionURI:", ...dumpObject(identityPartitionURI));
    }
  }

  get (identityPartitionURI: any) { return this._activeIdentities[identityPartitionURI]; }

  remove (identityPartitionURI: any) {
    try {
      if (!identityPartitionURI) {
        throw new Error(`identityPartition required, got: ${
            debugObjectType(identityPartitionURI)}`);
      }
      const uriString = String(identityPartitionURI);
      if (!this._activeIdentities[uriString]) {
        throw new Error(`No such active identity: <${uriString}>`);
      }
      delete this._activeIdentities[uriString];
      return true;
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("identity.remove"),
          "\n\tidentityPartitionURI:", ...dumpObject(identityPartitionURI));
    }
  }
}
