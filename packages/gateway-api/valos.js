import getGlobal from "~/gateway-api/getGlobal";
import { base64URLDecode } from "~/gateway-api/base64";

const inBrowser = require("~/gateway-api/inBrowser").default;

/**
 * The global ValOS namespace object is a shared by protected namespace
 * for cross-communication between ValOS fabric, gateway and valospace
 * resources.
 * It is available in fabric side via preferred directive:
 * `const valos = require("@valos/gateway-api/valos").default;`
 * or directly by `window.valos` or `global.valos` (will not be
 * deprecated, but discouraged).
 * It is available in valospace side as the global valos object.
 */
export default (getGlobal().valos ||
    (getGlobal().Valaa = getGlobal().valos = {
  gateway: null,

  require (module) {
    if (!inBrowser()) return require(module);
    throw new Error(`Cannot valos.require requested module "${
        module}": no valos.gateway found in browser context`);
  },

  /**
   * Adds the given plugin to the global valos.plugins; this makes the
   * plugin available to:
   * 1. the ValOS application gateway itself, introducing schemas,
   *    schemes, decoders etc.
   * 2. the ValOS fabric, ie. javascript-side code, libraries and
   *    for other plugins by using ValOS require directive (preferred)
   *    or directly through global.valos or window.valos
   * 3. the valospace applications, via its global.valos
   *
   * Plugin loading has three phases.
   * 1. First phase plugins are those that were exported to valos.plugins
   *    before gateway initialization. They are attached immediately
   *    after gateway creation and are available during the remainder of
   *    gateway initialization (this including gateway prologue
   *    narrations).
   * 2. Second phase plugins are those that are pushed to valos.plugins
   *    during gateway initialization. They are attached only after init
   *    is complete but before views are created.
   *    They are thus not available during revelation prologue narration,
   *    but are available when engine or user interfaces are deployed.
   * 3. Third phase plugins are those which are pushed to valos.plugins
   *    at any later stage. They are loaded at best-effort basis; they
   *    can thus end up being loaded even before views are attached in
   *    some circumstances.
   *
   * @export
   * @param {Object} plugin
   * @returns
   */
  exportPlugin (plugin) {
    this.plugins.push(plugin);
    return plugin;
  },
  plugins: [],

  identity: {
    getSessionClaims (options = {}) {
      const sessionCookieName = this.getClientCookieName(options);
      for (const line of window.document.cookie.split(";")) {
        const [name, value] = line.split("=");
        if (name.trim() === sessionCookieName) {
          const payload = value.trim().split(".")[1];
          const claims = payload && JSON.parse(base64URLDecode(payload));
          return claims;
        }
      }
      return undefined;
    },

    getClientCookieName (options) {
      if (!options.client_id) options.client_id = options.clientURI || this._clientURI;
      if (!options.client_id) throw new Error("getClientCookieName.(clientURI|client_id) missing");
      return `__Secure-valos-client-${encodeURIComponent(options.client_id)}`;
    },

    authorizeSession ({ clientURI, grantProvider, sessionURI, ...rest }) {
      if (!inBrowser()) throw new Error("Cannot authorize a session in non-browser context");
      if (!grantProvider) throw new Error("authorizeSession.grantProvider missing");
      if (grantProvider.substr(0, 8) !== "https://") {
        throw new Error("Invalid grant provider: only OpenId Connect https:// scheme is supported");
      }
      const params = { client_id: clientURI, ...rest };
      if (sessionURI) params.redirect_uri = sessionURI;
      if (!params.redirect_uri) {
        throw new Error("authorizeSession.(sessionURI|redirect_uri) missing");
      }
      const clientCookieName = this.getClientCookieName(params);
      if (params.scope === undefined) {
        params.scope = "openid profile";
      }
      if (params.state === undefined) {
        params.state = (`${Math.random().toString(36)}000000000`).slice(2, 7);
      }
      if (params.state) {
        window.document.cookie = `${clientCookieName}=${encodeURIComponent(params.state)
          }; max-age=900; Secure; SameSite=Lax`;
      }
      let redirector = `${grantProvider}?response_type=code`;
      Object.keys(params).forEach(k => {
        if (params[k]) redirector += `&${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`;
      });
      window.location.replace(redirector);
    },

    finalizeSession (options = {}) {
      if (!inBrowser()) throw new Error("Cannot finalize a session in non-browser context");
      if (!options.sessionURI) throw new Error("finalizeSession.sessionURI missing");
      window.document.cookie = `${this.getClientCookieName(options)}=;max-age=0`;
      window.document.cookie = `__Secure-valos-session-token-${
        encodeURIComponent(options.client_id)}=;max-age=0`;
      window.fetch(options.sessionURI, {
        method: "DELETE", credentials: "same-origin", mode: "same-origin", redirect: "error",
      });
    }
  },
}));
