// @flow

import { vRef } from "~/raem/VRL";
import { VALEK, Vrapper } from "~/engine";

import { dumpObject } from "~/tools";

import {
  generateBurlaesgIV, burlaesgEncode, burlaesgDecode, hs256JWTEncode, hs256JWTDecode,
} from "~/security/tokens";

const _isReadOnlyMethod = {
  CONNECT: true,
  GET: true,
  HEAD: true,
  TRACE: true,
  OPTIONS: true,
};

export class SessionExpiredError extends Error {}

export function verifySessionAuthorization (
    router, route, scope: Object, accessRoots: Vrapper, accessRootDescription: string) {
  try {
    if (!router.isSessionAuthorizationEnabled()) return true;
    let rights;
    for (const accessRoot of [].concat(accessRoots)) {
      rights = accessRoot.step(toRIGHTSFields);
      if ((rights != null) && rights.length) break;
    }
    // const permissions = accessRoot.step(toPERMISSIONSFields);
    let identityRoles;
    if ((rights == null) || !rights.length) {
      if (_isReadOnlyMethod[route.method]) return true;
    } else {
      identityRoles = scope.identityRoles
          || (scope.identityRoles = resolveScopeIdentityRoles(router, route, scope));
      router.infoEvent(3, () => [
        `CHECKING ACCESS of ${accessRootDescription} via ${router._routeName(route)}:`,
        "\n\tby identity with roles:", JSON.stringify(identityRoles),
        `\n\t${accessRootDescription}:`, ...dumpObject(accessRoots),
        "\n\twhich grants rights:", (rights || []).map(r => JSON.stringify(r)),
        "\n\trequest.query:", ...dumpObject((scope.request || {}).query),
        "\n\trequest.cookies:", ...dumpObject(Object.keys((scope.request || {}).cookies)),
      ]);
      for (const right of rights) {
        if (!identityRoles[right.chronicle || ""]) continue;
        if (_isReadOnlyMethod[route.method] && (right.read !== false)) return true;
        if (right.write !== false) return true;
      }
    }
    router.warnEvent(1, () => [
      `UNAUTHORIZED ACCESS of ${accessRootDescription} via ${router._routeName(route)}:`,
      "\n\tby identity with roles:", JSON.stringify(identityRoles),
      `\n\t${accessRootDescription}:`, ...dumpObject(accessRoots),
      "\n\twhich grants rights:", (rights || []).map(r => JSON.stringify(r)),
      "\n\trequest.query:", ...dumpObject((scope.request || {}).query),
      "\n\trequest.cookies:", ...dumpObject(Object.keys((scope.request || {}).cookies)),
    ]);
    scope.reply.code(403);
    scope.reply.send("Forbidden");
    return false;
  } catch (error) {
    throw router.wrapErrorEvent(error, 1, new Error("verifySessionAuthorization"),
        "\n\taccessRoots:", ...dumpObject(accessRoots));
  }
}

export function resolveScopeIdentityRoles (router, route, scope) {
  if (!scope.sessionPayload) {
    const name = router.getIdentity().getSessionCookieName();
    const sessionCookie = scope.request.cookies[name];
    if (sessionCookie) scope.sessionPayload = extractSessionPayload(router, sessionCookie);
  }
  const identityChronicle = (scope.sessionPayload || {}).identityChronicle;
  if (!identityChronicle) {
    return { "": true };
  }
  if (Date.now() >= (Number(scope.sessionPayload.timeStamp) + router.getSessionDuration()) * 1000) {
    const expired = new SessionExpiredError("Session expired but not properly handled");
    expired.sessionPayload = scope.sessionPayload;
    throw expired;
  }
  const ret = router.getIdentityRoles(identityChronicle);
  const [authorityURI, identityId] = router.getDiscourse().splitChronicleURI(identityChronicle);
  // const [, authorityURI, identityId] = identityChronicle.match(/^(.*)\?id=(.*)$/) || [];
  if (authorityURI) {
    scope.sessionIdentity = vRef(identityId, undefined, undefined, identityChronicle)
        .setAbsent();
    const aurChronicleURI = router.getDiscourse().createChronicleURI(
        authorityURI, `@$~aur.${encodeURIComponent(authorityURI)}@@`);
    ret[aurChronicleURI] = true;
  }
  return ret;
}

export function extractAuthorizationGrantContent (router, identity, authorizationGrant) {
  return burlaesgDecode(authorizationGrant, identity.clientSecret.slice(0, 30));
}

export function fillReplySessionAndClientCookies (router, reply, sessionEnvelope, {
  identity, tokenExpirationDelay, clientRedirectPath, now, iv, nonce, refreshRequestCookiesOf,
}) {
  const {
    identityChronicle, sessionPayloadFields, clientClaimsFields, ...spuriousFields
  } = sessionEnvelope;
  const spuriousKeys = Object.keys(spuriousFields);
  if (spuriousKeys.length) {
    throw new Error(`session envelope contains spurious fields: ${spuriousKeys}`);
  }
  ["identityChronicle", "email", "preferred_username"].forEach(name => {
    if ((sessionEnvelope[name] === undefined) && ((clientClaimsFields || {})[name] === undefined)) {
      throw new Error(`session envelope is missing required field: "${name}"`);
    }
  });
  const sessionPayload = {
    timeStamp: now, nonce: nonce || "", identityChronicle, clientRedirectPath,
    ...(sessionPayloadFields || {}),
  };
  const sessionCookieText = burlaesgEncode(
      sessionPayload, identity.clientSecret.slice(0, 30), iv || generateBurlaesgIV());
  reply.setCookie(identity.sessionCookieName, sessionCookieText, {
    httpOnly: true, secure: true, maxAge: tokenExpirationDelay, path: clientRedirectPath,
  });
  const clientToken = {
    iss: identity.clientURI,
    sub: identityChronicle,
    iat: now,
    exp: now + tokenExpirationDelay,
    ...(clientClaimsFields || {}),
    // aud: "", nbf: "", jti: "",
  };
  const clientCookieText = hs256JWTEncode(clientToken, identity.clientSecret);
  reply.setCookie(identity.clientCookieName, clientCookieText, {
    httpOnly: false, secure: true, maxAge: tokenExpirationDelay, path: clientRedirectPath,
  });
  if (refreshRequestCookiesOf) {
    // Refresh the cookies in the incoming request object (if given),
    // so that its handler reattempt can succeed.
    refreshRequestCookiesOf.cookies[identity.sessionCookieName] = sessionCookieText;
    refreshRequestCookiesOf.cookies[identity.clientCookieName] = clientCookieText;
  }
}

export function clearReplySessionAndClientCookies (router, reply, cookiePath) {
  const identity = router.getIdentity();
  reply.clearCookie(identity.getSessionCookieName(), {
    httpOnly: true, secure: true, path: cookiePath || "/",
  });
  reply.clearCookie(identity.getClientCookieName(), {
    httpOnly: false, secure: true, path: cookiePath || "/",
  });
}

export function extractSessionPayload (router, sessionCookie) {
  const identity = router.getIdentity();
  const ret = burlaesgDecode(sessionCookie, identity.clientSecret.slice(0, 30)).payload;
  if (!ret) throw new Error("session token without content");
  return ret;
}

export function extractClientToken (router, clientCookie) {
  const identity = router.getIdentity();
  const ret = hs256JWTDecode(clientCookie, identity.clientSecret);
  if (!ret) throw new Error("client token without content");
  return ret;
}

const accessFields = {
  id: VALEK.toField("rawId"),
  name: VALEK.toField("name"),
  chronicle: VALEK.toField("target").nullable().toField("chronicleURI"),
  read: VALEK.propertyValue("read"),
  write: VALEK.propertyValue("write"),
};
const toRIGHTSFields = VALEK.relations("RIGHTS").map(VALEK.select(accessFields));
// const toPERMISSIONSFields = VALEK.relations("PERMISSIONS").map(VALEK.select(accessFields));
