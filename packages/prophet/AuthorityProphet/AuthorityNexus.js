// @flow

import { ValaaURI, getScheme } from "~/raem/ValaaURI";

import Prophet from "~/prophet/api/Prophet";

import { invariantify, LogEventGenerator } from "~/tools";

export type AuthorityConfig = {
  eventVersion: string,
  isLocallyPersisted: boolean,
  isPrimaryAuthority: boolean,
  isRemoteAuthority: boolean,
};

export type AuthorityProphetOptions = {
  authorityConfig: AuthorityConfig,
  authorityURI: ValaaURI,
  nexus: AuthorityNexus,
};

export type SchemeModule = {
  scheme: string,
  getAuthorityURIFromPartitionURI: (partitionURI: ValaaURI) => ValaaURI,
  obtainAuthorityConfig:
      (partitionURI: ValaaURI, authorityPreConfig: ?AuthorityConfig) => ?AuthorityConfig,
  createAuthorityProphet: (options: AuthorityProphetOptions) => Prophet,
};

export default class AuthorityNexus extends LogEventGenerator {
  _authorityProphets: Object;
  _schemeModules: { [scheme: string]: SchemeModule };
  _authorityPreConfigs: { [authorityURI: string]: AuthorityConfig };
  _authorityProphets: { [authorityURI: string]: Prophet };

  constructor (options: Object = {}) {
    super(options);
    this._schemeModules = {};
    this._authorityPreConfigs = options.authorityConfigs || {};
    this._authorityProphets = {};
  }

  addSchemeModule (schemeModule: SchemeModule) {
    invariantify(!this._schemeModules[schemeModule.scheme],
        `URI scheme '${schemeModule.scheme}' module already exists`);
    this._schemeModules[schemeModule.scheme] = schemeModule;
  }

  addAuthorityPreConfig (authorityPreConfig: AuthorityConfig) {
    invariantify(!this._schemeModules[authorityPreConfig.scheme],
        `URI scheme '${authorityPreConfig.scheme}' module missing when trying to load${
            ""} authority config for '${authorityPreConfig.authorityURI}'`);
    if (!authorityPreConfig.eventVersion) authorityPreConfig.eventVersion = "0.1";
    this._authorityPreConfigs[String(authorityPreConfig.authorityURI)] =
        Object.freeze(authorityPreConfig);
  }

  getSchemeModule (uriScheme: string): SchemeModule {
    return this.trySchemeModule(uriScheme, { require: true });
  }

  trySchemeModule (uriScheme: string, { require } = {}): ?SchemeModule {
    const ret = this._schemeModules[uriScheme];
    if (!require || (ret !== undefined)) return ret;
    throw new Error(`Unrecognized URI scheme "${uriScheme}"`);
  }

  getAuthorityProphet (authorityURI: ValaaURI) {
    return this.tryAuthorityProphet(authorityURI, { require: true });
  }

  tryAuthorityProphet (authorityURI: ValaaURI, { require } = {}) {
    const ret = this._authorityProphets[String(authorityURI)];
    if (!require || (ret !== undefined)) return ret;
    throw new Error(`Cannot find authority prophet for "${String(authorityURI)}"`);
  }

  obtainAuthorityProphetOfPartition (partitionURI: ValaaURI) {
    return this.obtainAuthorityProphet(
        this.getAuthorityURIFromPartitionURI(partitionURI));
  }

  obtainAuthorityProphet (authorityURI: ValaaURI): Prophet {
    let ret = this._authorityProphets[String(authorityURI)];
    if (ret === undefined) {
      ret = this._authorityProphets[String(authorityURI)]
          = this._createAuthorityProphet(authorityURI);
    }
    return ret;
  }

  getAuthorityURIFromPartitionURI (partitionURI: ValaaURI): ValaaURI {
    return this._tryAuthorityURIFromPartitionURI(partitionURI, { require: true });
  }

  _tryAuthorityURIFromPartitionURI (partitionURI: ValaaURI, { require }: Object = {}): ValaaURI {
    let schemeModule;
    try {
      schemeModule = this.trySchemeModule(getScheme(partitionURI), { require });
      if (!schemeModule) return undefined;
      const ret = schemeModule.getAuthorityURIFromPartitionURI(partitionURI, { require });
      if (require && (ret === undefined)) {
        throw new Error(`Scheme "${getScheme(partitionURI)
            }" could not determine authority URI of partitionURI "${partitionURI}"`);
      }
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, `tryAuthorityURIFromPartitionURI("${partitionURI}")`,
          "\n\tschemeModule:", schemeModule);
    }
  }

  _createAuthorityProphet (authorityURI: ValaaURI): Prophet {
    let schemeModule;
    let authorityConfig;
    try {
      schemeModule = this.getSchemeModule(getScheme(authorityURI));
      authorityConfig = schemeModule.obtainAuthorityConfig(authorityURI,
          this._authorityPreConfigs[String(authorityURI)]);
      if (!authorityConfig) {
        throw new Error(`No ValOS authority config found for "${String(authorityURI)}"`);
      }
      return schemeModule.createAuthorityProphet({
        authorityURI, authorityConfig, nexus: this,
        verbosity: authorityConfig.hasOwnProperty("verbosity")
            ? authorityConfig.verbosity : this.getVerbosity(),
      });
    } catch (error) {
      throw this.wrapErrorEvent(error, `createAuthorityProphet("${String(authorityURI)}")`,
          "\n\tschemeModule:", schemeModule,
          "\n\tauthorityConfig:", authorityConfig,
          "\n\tconfigs:", this._authorityPreConfigs);
    }
  }
}
