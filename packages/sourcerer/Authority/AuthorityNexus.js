// @flow

import { ValaaURI, getScheme } from "~/raem/ValaaURI";

import Sourcerer from "~/sourcerer/api/Sourcerer";

import { invariantify, FabricEventTarget } from "~/tools";

export type AuthorityConfig = {
  eventVersion: string,
  isLocallyPersisted: boolean,
  isPrimaryAuthority: boolean,
  isRemoteAuthority: boolean,
};

export type AuthorityOptions = {
  authorityConfig: AuthorityConfig,
  authorityURI: ValaaURI,
  nexus: AuthorityNexus,
};

export type SchemeModule = {
  scheme: string,
  getAuthorityURIFromPartitionURI: (partitionURI: ValaaURI) => ValaaURI,
  obtainAuthorityConfig:
      (partitionURI: ValaaURI, authorityPreConfig: ?AuthorityConfig) => ?AuthorityConfig,
  createAuthority: (options: AuthorityOptions) => Sourcerer,
};

export default class AuthorityNexus extends FabricEventTarget {
  _authoritySourcerers: Object;
  _schemeModules: { [scheme: string]: SchemeModule };
  _authorityPreConfigs: { [authorityURI: string]: AuthorityConfig };
  _authoritySourcerers: { [authorityURI: string]: Sourcerer };

  constructor (options: Object = {}) {
    super(options.name, options.verbosity, options.logger);
    this._schemeModules = {};
    this._authorityPreConfigs = options.authorityConfigs || {};
    this._authoritySourcerers = {};
  }

  addSchemeModule (schemeModule: SchemeModule) {
    invariantify(schemeModule.scheme, `schemeModule is missing scheme`);
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

  getAuthority (authorityURI: ValaaURI) {
    return this.tryAuthority(authorityURI, { require: true });
  }

  tryAuthority (authorityURI: ValaaURI, { require } = {}) {
    const ret = this._authoritySourcerers[String(authorityURI)];
    if (!require || (ret !== undefined)) return ret;
    throw new Error(`Cannot find authority for "${String(authorityURI)}"`);
  }

  obtainAuthorityOfPartition (partitionURI: ValaaURI) {
    return this.obtainAuthority(
        this.getAuthorityURIFromPartitionURI(partitionURI));
  }

  obtainAuthority (authorityURI: ValaaURI): Sourcerer {
    let ret = this._authoritySourcerers[String(authorityURI)];
    if (ret === undefined) {
      ret = this._authoritySourcerers[String(authorityURI)]
          = this._createAuthority(authorityURI);
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

  _createAuthority (authorityURI: ValaaURI): Sourcerer {
    let schemeModule;
    let authorityConfig;
    try {
      schemeModule = this.getSchemeModule(getScheme(authorityURI));
      authorityConfig = schemeModule.obtainAuthorityConfig(authorityURI,
          this._authorityPreConfigs[String(authorityURI)]);
      if (!authorityConfig) {
        throw new Error(`No ValOS authority config found for "${String(authorityURI)}"`);
      }
      return schemeModule.createAuthority({
        authorityURI, authorityConfig, nexus: this,
        verbosity: authorityConfig.hasOwnProperty("verbosity")
            ? authorityConfig.verbosity : this.getVerbosity(),
      });
    } catch (error) {
      throw this.wrapErrorEvent(error, `createAuthority("${String(authorityURI)}")`,
          "\n\tschemeModule:", schemeModule,
          "\n\tauthorityConfig:", authorityConfig,
          "\n\tconfigs:", this._authorityPreConfigs);
    }
  }
}
