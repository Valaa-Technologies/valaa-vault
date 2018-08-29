// @flow

import ValaaURI, { getValaaURI } from "~/raem/ValaaURI";

import Prophet from "~/prophet/api/Prophet";

import { invariantify, LogEventGenerator } from "~/tools";

export default class AuthorityNexus extends LogEventGenerator {
  _authorityProphets: Object;
  _schemeModules: Object;

  constructor (options: Object = {}) {
    super(options);
    this._schemeModules = {};
    this._authorityConfigs = options.authorityConfigs || {};
    this._authorityProphets = {};
  }

  addSchemeModule (schemeModule: Object) {
    invariantify(!this._schemeModules[schemeModule.scheme],
        `URI scheme '${schemeModule.scheme}' module already exists`);
    this._schemeModules[schemeModule.scheme] = schemeModule;
  }

  addAuthorityConfig (authorityConfig: Object) {
    invariantify(!this._schemeModules[authorityConfig.scheme],
        `URI scheme '${authorityConfig.scheme}' module missing when trying to load authority${
            ""} config for '${authorityConfig.authorityURI}'`);
    this._authorityConfigs[String(authorityConfig.authorityURI)] = Object.freeze(authorityConfig);
  }

  getSchemeModule (uriScheme: string) {
    return this.trySchemeModule(uriScheme, { require: true });
  }

  trySchemeModule (uriScheme: string, { require } = {}) {
    const ret = this._schemeModules[uriScheme];
    if (!require || (typeof ret !== "undefined")) return ret;
    throw new Error(`Unrecognized URI scheme "${uriScheme}"`);
  }

  getAuthorityProphet (authorityURI: ValaaURI | string) {
    return this.tryAuthorityProphet(authorityURI, { require: true });
  }

  tryAuthorityProphet (authorityURI: ValaaURI | string, { require } = {}) {
    const ret = this._authorityProphets[String(authorityURI)];
    if (!require || (typeof ret !== "undefined")) return ret;
    throw new Error(`Cannot find authority prophet for "${String(authorityURI)}"`);
  }

  obtainAuthorityProphetOfPartition (partitionURI: ValaaURI | string) {
    return this.obtainAuthorityProphet(
        this._getAuthorityURIFromPartitionURI(getValaaURI(partitionURI)));
  }

  obtainAuthorityProphet (authorityURI: ValaaURI | string) {
    let ret = this._authorityProphets[String(authorityURI)];
    if (typeof ret === "undefined") {
      ret = this._authorityProphets[String(authorityURI)]
          = this._createAuthorityProphet(getValaaURI(authorityURI));
    }
    return ret;
  }

  _getAuthorityURIFromPartitionURI (partitionURI: ValaaURI): ValaaURI {
    return this._tryAuthorityURIFromPartitionURI(partitionURI, { require: true });
  }

  _tryAuthorityURIFromPartitionURI (partitionURI: ValaaURI, { require }: Object = {}
      ): ValaaURI {
    let schemeModule;
    try {
      schemeModule = this.trySchemeModule(partitionURI.protocol.slice(0, -1), { require });
      if (!schemeModule) return undefined;
      const ret = schemeModule.getAuthorityURIFromPartitionURI(partitionURI, { require });
      if (require && (typeof ret === "undefined")) {
        throw new Error(`Scheme "${partitionURI.protocol.slice(0, -1)
            }" could not determine authority URI of partitionURI "${String(partitionURI)}"`);
      }
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, `tryAuthorityURIFromPartitionURI("${String(partitionURI)}")`,
          "\n\tschemeModule:", schemeModule);
    }
  }

  _createAuthorityProphet (authorityURI: ValaaURI): Prophet {
    let schemeModule;
    let authorityConfig;
    try {
      schemeModule = this.getSchemeModule(authorityURI.protocol.slice(0, -1));
      authorityConfig = this._authorityConfigs[String(authorityURI)];
      if (!authorityConfig) {
        authorityConfig = schemeModule.createDefaultAuthorityConfig(authorityURI);
        if (!authorityConfig) {
          throw new Error(`No Valaa authority config found for "${String(authorityURI)}"`);
        }
      }
      return schemeModule.createAuthorityProphet({ authorityURI, authorityConfig, nexus: this });
    } catch (error) {
      throw this.wrapErrorEvent(error, `createAuthorityProphet("${String(authorityURI)}")`,
          "\n\tschemeModule:", schemeModule,
          "\n\tauthorityConfig:", authorityConfig,
          "\n\tconfigs:", this._authorityConfigs);
    }
  }
}
