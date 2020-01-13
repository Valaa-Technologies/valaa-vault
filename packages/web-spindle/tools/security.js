// @flow

// import buffer from "buffer";
import crypto from "crypto";

import { vRef } from "~/raem/VRL";
import { VALEK, Vrapper } from "~/engine";

import { dumpObject } from "~/tools";
import {
  base64URLDecode, base64URLEncode, base64URLFromBuffer, byteArrayFromBase64URL,
  base64URLFromBase64,
} from "~/gateway-api/base64";

const _normalizeAlg = Object.assign(Object.create(null), {
  A256GCM: "aes-256-gcm",
  "aes-256-gcm": "aes-256-gcm",
});

const _isReadOnlyMethod = {
  CONNECT: true,
  GET: true,
  HEAD: true,
  TRACE: true,
  OPTIONS: true,
};

export function verifySessionAuthorization (
    router, route, scope: Object, accessRoots: Vrapper, accessRootDescription: string) {
  try {
    if (!router.isSessionAuthorizationEnabled()) return false;
    let rights;
    for (const accessRoot of [].concat(accessRoots)) {
      rights = accessRoot.get(toRIGHTSFields);
      if ((rights != null) && rights.length) break;
    }
    // const permissions = accessRoot.get(toPERMISSIONSFields);
    let identityRoles;
    if ((rights == null) || !rights.length) {
      if (_isReadOnlyMethod[route.method]) return false;
    } else {
      identityRoles = resolveIdentityRoles(router, route, scope);
      if (identityRoles === null) return true;
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
        if (_isReadOnlyMethod[route.method] && (right.read !== false)) return false;
        if (right.write !== false) return false;
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
    return true;
  } catch (error) {
    throw router.wrapErrorEvent(error, 1, new Error("verifySessionAuthorization"),
        "\n\taccessRoots:", ...dumpObject(accessRoots));
  }
}

export function resolveIdentityRoles (router, route, scope) {
  if (scope.identityRoles !== undefined) return scope.identityRoles;
  const identity = router.getIdentity();
  if (!identity) {
    throw new Error("Cannot verify session authorization: valosheath identity not configured");
  }
  if (!scope.sessionPayload) {
    const sessionToken = scope.request.cookies[identity.getSessionCookieName()];
    if (!sessionToken) return (scope.identityRoles = { "": true });
    scope.sessionPayload = burlaesgDecode(sessionToken, identity.clientSecret.slice(0, 30)).payload;
    if (!scope.sessionPayload) throw new Error("session token without content");
  }
  const { timeStamp, identityChronicle } = scope.sessionPayload;
  if (!(Math.floor(Date.now() / 1000)
      < Number(timeStamp) + router.getSessionDuration())) {
    router.logEvent(1, () => [
      "Session expired:", Math.floor(Date.now() / 1000), ">=", timeStamp,
        router.getSessionDuration(),
      "\n\tpayload:", timeStamp, identityChronicle,
    ]);
    scope.reply.code(401);
    scope.reply.send("Session has expired");
    return (scope.identityRoles = null);
  }
  scope.identityRoles = router.getIdentityRoles(identityChronicle);
  const [, authorityURI, identityId] = identityChronicle.match(/^(.*)\?id=(.*)$/) || [];
  if (authorityURI) {
    scope.sessionIdentity = vRef(identityId, undefined, undefined, identityChronicle)
        .setInactive();
    scope.identityRoles[`${authorityURI}?id=@$~aur:${encodeURIComponent(authorityURI)}@@`] = true;
  }
  return scope.identityRoles;
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

export function generateBurlaesgIV () {
  // TODO(iridian, 2020-01): This should be randomized on start and
  // then 'one'-incremented for every request
  return new Uint8Array(crypto.randomBytes(12));
}

export function burlaesgEncode (payload: any, key: string, iv: Uint8Array) {
  const cipher = crypto.createCipheriv("aes-256-gcm", _to32BytesNullPad(key), iv);
  let enc = cipher.update(base64URLEncode(JSON.stringify(payload)), "utf8", "base64");
  enc += cipher.final("base64");
  return base64URLEncode(JSON.stringify({
    iv: base64URLFromBuffer(iv),
    tag: base64URLFromBuffer(cipher.getAuthTag()),
    alg: "A256GCM",
    ciphertext: enc,
  }));
}

// &/&¤# kludge
function _to32BytesNullPad (key: string) {
  return key + String.fromCharCode(0).repeat(Math.max(0, 32 - key.length));
}

export function burlaesgDecode (base64URLCode: string, key: string) {
  const code = base64URLDecode(base64URLCode);
  const { iv: bIV, tag: bTag, alg, ciphertext } = JSON.parse(code);
  const iv = byteArrayFromBase64URL(bIV);
  const tag = byteArrayFromBase64URL(bTag);
  const normalizedAlg = _normalizeAlg[alg];
  if (!normalizedAlg) throw new Error("Unrecognized session encryption algorithm");
  // console.log("base64URLCode:", base64URLCode);
  // console.log("code:", code, "\n\tiv, tag, alg, cipher:", iv, tag, alg, ciphertext);
  const decipher = crypto.createDecipheriv(normalizedAlg, _to32BytesNullPad(key), iv);
  decipher.setAuthTag(tag);
  const dec = decipher.update(ciphertext, "base64", "utf8");
  // console.log("pre-final dec:", dec);
  return { iv, alg, payload: JSON.parse(base64URLDecode(dec + decipher.final("utf8"))) };
}

export function hs256JWTEncode (payload: string, key: string,
    header = { alg: "HS256", typ: "JWT" }) {
  if (!(key.length >= 16)) throw new Error("Invalid key with length < 16");
  const base64HeaderAndPayload =
      `${base64URLEncode(JSON.stringify(header))}.${base64URLEncode(JSON.stringify(payload))}`;
  const signer = crypto.createHmac("sha256", key);
  signer.update(base64HeaderAndPayload);
  return `${base64HeaderAndPayload}.${base64URLFromBase64(signer.digest("base64"))}`;
}

export function hs256JWTDecode (jwt: string, key: string) {
  const parts = jwt.split(".");
  const ret = {
    header: JSON.parse(base64URLDecode(parts[0])),
    payload: JSON.parse(base64URLDecode(parts[1])),
    signature: parts[2],
  };
  if (ret.header.alg !== "HS256") {
    throw new Error(`Cannot decode non-HS256 JWT with alg = '${ret.header.alg}'`);
  }
  const signer = crypto.createHmac("sha256", key);
  signer.update(jwt.substr(0, parts[0].length + 1 + parts[1].length));
  if (base64URLFromBase64(signer.digest("base64")) !== parts[2]) {
    throw new Error("HS256 JWT signature mismatch");
  }
  return ret;
}
