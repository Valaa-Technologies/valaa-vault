const { base64URLDecode } = require("./base64");
const inBrowser = require("./inBrowser").default;

module.exports = {
  getClientId,
  getClientCookieName,
  getSessionCookieName,
  getSessionClaims,
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
  grantProvider, client_id, clientId, clientURI, redirect_uri, sessionURI, ...rest
}) {
  if (!inBrowser()) throw new Error("Cannot authorize a session in a non-browser context");
  const authorizeURI = grantProvider || (this || {}).authorizeURI;
  if (!grantProvider) throw new Error("authorizeSession.grantProvider missing");
  if (authorizeURI.substr(0, 8) !== "https://") {
    throw new Error("Invalid grant provider: only OpenId Connect https:// scheme is supported");
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
  let requestAuthorization = `${authorizeURI}?response_type=code`;
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
