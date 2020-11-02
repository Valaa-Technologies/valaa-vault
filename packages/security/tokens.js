const crypto = require("crypto");

const {
  base64URLDecode, base64URLEncode, base64URLFromBuffer, byteArrayFromBase64URL,
  base64URLFromBase64,
} = require("@valos/gateway-api/base64");

const _normalizeAlg = Object.assign(Object.create(null), {
  A256GCM: "aes-256-gcm",
  "aes-256-gcm": "aes-256-gcm",
});

module.exports = {
  generateBurlaesgIV,
  burlaesgEncode,
  burlaesgDecode,
  hs256JWTEncode,
  hs256JWTDecode,
};

function generateBurlaesgIV () {
  // TODO(iridian, 2020-01): This should be randomized on start and
  // then 'one'-incremented for every request
  return new Uint8Array(crypto.randomBytes(12));
}

function burlaesgEncode (payload, key, iv) {
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

// annoying kludge
function _to32BytesNullPad (key) {
  return key + String.fromCharCode(0).repeat(Math.max(0, 32 - key.length));
}

function burlaesgDecode (base64URLCode, key) {
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

function hs256JWTEncode (payload, key, header = { alg: "HS256", typ: "JWT" }) {
  if (!(key.length >= 16)) throw new Error("Invalid key with length < 16");
  const base64HeaderAndPayload =
      `${base64URLEncode(JSON.stringify(header))}.${base64URLEncode(JSON.stringify(payload))}`;
  const signer = crypto.createHmac("sha256", key);
  signer.update(base64HeaderAndPayload);
  return `${base64HeaderAndPayload}.${base64URLFromBase64(signer.digest("base64"))}`;
}

function hs256JWTDecode (jwt, validationKey) {
  const parts = jwt.split(".");
  const ret = {
    header: JSON.parse(base64URLDecode(parts[0])),
    payload: JSON.parse(base64URLDecode(parts[1])),
    signature: parts[2],
  };
  if (ret.header.alg !== "HS256") {
    throw new Error(`Cannot decode non-HS256 JWT with alg = '${ret.header.alg}'`);
  }
  if (validationKey) {
    const signer = crypto.createHmac("sha256", validationKey);
    signer.update(jwt.substr(0, parts[0].length + 1 + parts[1].length));
    if (base64URLFromBase64(signer.digest("base64")) !== parts[2]) {
      throw new Error("HS256 JWT signature mismatch");
    }
  }
  return ret;
}
