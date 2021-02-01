const { base64URLDecode } = require("./base64");
const inBrowser = require("./inBrowser").default;

module.exports = {
  getClientId,
  getClientCookieName,
  getSessionCookieName,
  getSessionClaims,
  getAuthenticatedIdClaims,
  authorizeSession,
  revokeSession,
  finalizeSession,
};

function getClientId (options = {}) {
  return options.clientId || options.clientURI || (this || {}).clientId || (this || {}).clientURI;
}

function getClientCookieName (options = {}) {
  if (!options.client_id) options.client_id = getClientId.call(this, options);
  if (!options.client_id) throw new Error("getClientCookieName.(clientURI|client_id) missing");
  return `__Secure-valos-client-${encodeURIComponent(options.client_id)}`;
}

function getSessionCookieName (options = {}) {
  if (!options.client_id) options.client_id = getClientId.call(this, options);
  if (!options.client_id) throw new Error("getSessionCookieName.(clientURI|client_id) missing");
  return `__Secure-valos-session-token-${encodeURIComponent(options.client_id)}`;
}

function getSessionClaims (options = {}) {
  return getAuthenticatedIdClaims.call(this, options);
}

function getAuthenticatedIdClaims (options = {}) {
  const clientCookieName = getClientCookieName.call(this, options);
  for (const line of window.document.cookie.split(";")) {
    const [name, value] = line.split("=");
    if (name.trim() === clientCookieName) {
      const payload = value.trim().split(".")[1];
      const claims = payload && JSON.parse(base64URLDecode(payload));
      return claims;
    }
  }
  return undefined;
}

/* eslint-disable camelcase */
function authorizeSession ({
  identityProviderURI,             // Authorization server is an OpenId Connect identity provider
  authorizationURI, grantProvider, // Any other authorization server
  clientId, sessionURI,
  client_id, clientURI, redirect_uri, ...rest
}) {
  if (!inBrowser()) throw new Error("Cannot authorize a session in a non-browser context");
  const actualProviderURI = identityProviderURI || (this || {}).identityProviderURI;
  const actualAuthorizationURI = actualProviderURI
      || authorizationURI || grantProvider || (this || {}).authorizationURI;
  if (!actualAuthorizationURI) {
    throw new Error("Both authorizeSession.identityProviderURI and .authorizationURI are missing");
  }
  if (actualAuthorizationURI.substr(0, 8) !== "https://") {
    throw new Error(`Invalid authorizeSession.${
          actualProviderURI ? "identityProviderURI" : "authorizationURI"
        }: only https:// scheme is supported`);
  }
  const params = {
    client_id: getClientId.call(this, { clientId: client_id || clientId, clientURI }),
    redirect_uri: redirect_uri || sessionURI || (this || {}).sessionURI,
    ...rest,
  };
  if (!params.redirect_uri) {
    throw new Error("authorizeSession.(sessionURI|redirect_uri) missing");
  }
  const clientCookieName = getClientCookieName.call(this, params);
  if (actualProviderURI) {
    // OpenId Connect
    if (params.scope === undefined) {
      params.scope = "openid";
    } else if (!params.scope.includes("openid")) {
      throw new Error(
          `Invalid explicit authorizeSession.scope: OpenId Connect requirement "openid" missing`);
    }
  }
  if (params.state === undefined) {
    params.state = (`${Math.random().toString(36)}000000000`).slice(2, 7);
  }
  if (params.state) {
    window.document.cookie = `${clientCookieName}=${encodeURIComponent(params.state)
      }; max-age=900; Secure; SameSite=Lax`;
  }
  let requestAuthorization = `${actualAuthorizationURI}?response_type=code`;
  Object.keys(params).forEach(k => {
    if (params[k]) {
      requestAuthorization += `&${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`;
    }
  });
  window.location.replace(requestAuthorization);
}

function finalizeSession (options = {}) {
  return revokeSession.call(this, options);
}

function revokeSession (options = {}) {
  let ret;
  if (options.redirect !== false) {
    if (!inBrowser()) throw new Error("Cannot finalize a session in a non-browser context");
    const sessionURI = options.redirect_uri || options.sessionURI || (this || {}).sessionURI;
    if (!sessionURI) throw new Error("finalizeSession.sessionURI missing");
    ret = (options.redirect !== false) && window.fetch(sessionURI, {
      method: "DELETE", credentials: "same-origin", mode: "same-origin", redirect: "error",
    });
  }
  window.document.cookie = `${getClientCookieName.call(this, options)}=;max-age=0`;
  window.document.cookie = `${getSessionCookieName.call(this, options)}=;max-age=0`;
  return ret;
}
