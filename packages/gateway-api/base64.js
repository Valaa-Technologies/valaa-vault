const base64js = require("base64-js");

module.exports = {
  base64URLFromBase64,
  base64FromBase64URL,
  base64FromUnicode,
  unicodeFromBase64,
  base64FromBuffer,
  byteArrayFromBase64,
  base64URLFromBuffer,
  byteArrayFromBase64URL,
  base64Encode,
  base64Decode,
  base64URLEncode,
  base64URLDecode,
};

function base64URLFromBase64 (base64 /* : string */) {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64FromBase64URL (base64URL /* : string */) {
  return base64URL.replace(/-/g, "+").replace(/_/g, "/")
      + "=".repeat(3 - ((base64URL.length + 3) % 4));
}

function base64FromUnicode (unicodeString /* : string */) {
  return btoa(encodeURIComponent(unicodeString).replace(/%([0-9A-F]{2})/g,
    (match, p1) => String.fromCharCode(parseInt(p1, 16))
  ));
}

function unicodeFromBase64 (base64String /* : string */) {
  return decodeURIComponent(atob(base64String).split("").map(
    (c) => `%${`${"00"}${c.charCodeAt(0).toString(16)}`.slice(-2)}`
  ).join(""));
}

function base64FromBuffer (data /* : ArrayBuffer */) {
  return base64js.fromByteArray(new Uint8Array(data));
}

function byteArrayFromBase64 (base64Data /* : string */) {
  return base64js.toByteArray(base64Data);
}

function base64URLFromBuffer (data /* : ArrayBuffer */) {
  return base64URLFromBase64(base64FromBuffer(data));
}

function byteArrayFromBase64URL (base64Data /* : string */) {
  return byteArrayFromBase64(base64FromBase64URL(base64Data));
}

let TextEncoder;
function base64Encode (data, encoding /* : string */ = "utf-8") {
  if (!TextEncoder) TextEncoder = require("text-encoding").TextEncoder;
  return base64FromBuffer(new TextEncoder(encoding).encode(data));
}

let TextDecoder;
function base64Decode (base64Data /* : string */, encoding /* : string */ = "utf-8") {
  if (!TextDecoder) TextDecoder = require("text-encoding").TextDecoder;
  return new TextDecoder(encoding).decode(base64js.toByteArray(base64Data));
}

function base64URLEncode (data, encoding /* : string */) {
  return base64URLFromBase64(base64Encode(data, encoding));
}

function base64URLDecode (base64URLData /* : string */, encoding /* : string */) {
  return base64Decode(base64FromBase64URL(base64URLData), encoding);
}
