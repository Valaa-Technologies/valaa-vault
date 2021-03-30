// @flow

import { ValaaURI, getScheme } from "~/raem/ValaaURI";

import Sourcerer from "~/sourcerer/api/Sourcerer";

import { invariantify, FabricEventTarget } from "~/tools";

export type AuthorityConfig = {
  eventVersion: string,
  isLocallyRecorded: boolean,
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
  createChronicleURI: (authorityURI: string, chronicleId: string) => string,
  splitChronicleURI: (chronicleURI: string) => [string, string],
  obtainAuthorityConfig:
      (chronicleURI: string, authorityPreConfig: ?AuthorityConfig) => ?AuthorityConfig,
  createAuthority: (options: AuthorityOptions) => Sourcerer,
};

export default class AuthorityNexus extends FabricEventTarget {
  _authoritySourcerers: Object;
  _schemeModules: { [scheme: string]: SchemeModule };
  _authorityPreConfigs: { [authorityURI: string]: AuthorityConfig };
  _authoritySourcerers: { [authorityURI: string]: Sourcerer };

  constructor (options: Object = {}) {
    super(options.parent, options.verbosity, options.name);
    this._schemeModules = {};
    this._authorityPreConfigs = options.authorityConfigs || {};
    this._authoritySourcerers = {};
  }

  terminate (options) {
    return Promise.all(Object.values(this._authoritySourcerers).map(sourcerer =>
        sourcerer.terminate(options)));
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

  createChronicleURI (authorityURI: string, chronicleId: string) {
    const ret = this
        .getSchemeModule(getScheme(authorityURI))
        .createChronicleURI(authorityURI, chronicleId);
    if (!ret) {
      throw new Error(`Couldn't create chronicleURI under authority <${authorityURI}>`);
    }
    return ret;
  }

  splitChronicleURI (chronicleURI: string): [string, string] {
    const ret = this
        .getSchemeModule(getScheme(chronicleURI))
        .splitChronicleURI(chronicleURI);
    if (!ret) {
      throw new Error(`Couldn't split chronicleURI <${
          chronicleURI}> to its authority URI and chronicle id parts`);
    }
    return ret;
  }

  obtainAuthorityOfChronicle (chronicleURI: string) {
    const [authorityURI] = this.splitChronicleURI(chronicleURI);
    return this.obtainAuthority(authorityURI);
  }

  obtainAuthority (authorityURI: ValaaURI): Sourcerer {
    let ret = this._authoritySourcerers[String(authorityURI)];
    if (ret === undefined) {
      ret = this._authoritySourcerers[String(authorityURI)]
          = this._createAuthority(authorityURI);
    }
    return ret;
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
        parent: this, verbosity: authorityConfig.verbosity,
      });
    } catch (error) {
      throw this.wrapErrorEvent(error, 2, `createAuthority("${String(authorityURI)}")`,
          "\n\tschemeModule:", schemeModule,
          "\n\tauthorityConfig:", authorityConfig,
          "\n\tconfigs:", this._authorityPreConfigs);
    }
  }
}
