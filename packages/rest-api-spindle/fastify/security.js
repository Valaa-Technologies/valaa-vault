// @flow

// import buffer from "buffer";
import crypto from "crypto";
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

export function verifySessionAuthorization (
    routeMapper, route, scope: Object, accessRoot: Vrapper) {
  try {
    const identity = routeMapper.getIdentity();
    if (!identity) {
      throw new Error("Cannot verify session authorization: valosheath identity not configured");
    }
    const rights = accessRoot.get(toRIGHTSFields);
    // const permissions = accessRoot.get(toPERMISSIONSFields);
    // console.log("rights:", accessRoot.getId(), rights, permissions);
    if ((rights == null) || !rights.length) {
      if (route.method === "GET") return false;
    } else {
      const accessToken = scope.request.cookies[identity.getSessionCookieName()];
      let timeStamp, identityPartition;
      if (accessToken) {
        ({ identityPartition, timeStamp } =
            burlaesgDecode(accessToken, identity.clientSecret).payload);
        if (!(Math.floor(Date.now() / 1000)
            < Number(timeStamp) + routeMapper.getSessionDuration())) {
          console.log("Session expired:", Math.floor(Date.now() / 1000), ">=", timeStamp,
              routeMapper.getSessionDuration(),
              "\n\tpayload:", timeStamp, identityPartition);
          scope.reply.code(401);
          scope.reply.send("Session has expired");
          return true;
        }
      }
      // console.log("scanning rights for partition:", route.method, identityPartition,
      //    "\n\trights:", rights);
      for (const right of rights) {
        if (right.partition && (right.partition !== identityPartition)) continue;
        if ((route.method === "GET") && (right.read !== false)) return false;
        if (right.write !== false) return false;
      }
    }
    scope.reply.code(403);
    scope.reply.send("Unauthorized");
    return true;
  } catch (error) {
    throw routeMapper.wrapErrorEvent(error, new Error("verifySessionAuthorization"),
        "\n\taccessRoot:", ...dumpObject(accessRoot));
  }
}

const accessFields = {
  id: VALEK.toField("rawId"),
  name: VALEK.toField("name"),
  partition: VALEK.toField("target").nullable().toField("partitionURI"),
  read: VALEK.propertyValue("read"),
  write: VALEK.propertyValue("write"),
};
const toRIGHTSFields = VALEK.relations("RIGHTS").map(VALEK.select(accessFields));
// const toPERMISSIONSFields = VALEK.relations("PERMISSIONS").map(VALEK.select(accessFields));

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
