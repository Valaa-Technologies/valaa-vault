// @flow

import base64js from "base64-js";

export function base64URLFromBase64 (base64: string) {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64FromBase64URL (base64URL: string) {
  return base64URL.replace(/-/g, "+").replace(/_/g, "/")
      + "=".repeat(3 - ((base64URL.length + 3) % 4));
}

export function base64FromUnicode (unicodeString: string) {
  return btoa(encodeURIComponent(unicodeString).replace(/%([0-9A-F]{2})/g,
    (match: any, p1: any) => String.fromCharCode(parseInt(p1, 16))
  ));
}

export function unicodeFromBase64 (base64String: string) {
  return decodeURIComponent(atob(base64String).split("").map(
    (c) => `%${`${"00"}${c.charCodeAt(0).toString(16)}`.slice(-2)}`
  ).join(""));
}

export function base64FromBuffer (data: ArrayBuffer) {
  return base64js.fromByteArray(new Uint8Array(data));
}

export function byteArrayFromBase64 (base64Data: string) {
  return base64js.toByteArray(base64Data);
}

export function base64URLFromBuffer (data: ArrayBuffer) {
  return base64URLFromBase64(base64FromBuffer(data));
}

export function byteArrayFromBase64URL (base64Data: string) {
  return byteArrayFromBase64(base64FromBase64URL(base64Data));
}

let TextEncoder;
export function base64Encode (data: any, encoding: string = "utf-8") {
  if (!TextEncoder) TextEncoder = require("text-encoding").TextEncoder;
  return base64FromBuffer(new TextEncoder(encoding).encode(data));
}

let TextDecoder;
export function base64Decode (base64Data: string, encoding: string = "utf-8") {
  if (!TextDecoder) TextDecoder = require("text-encoding").TextDecoder;
  return new TextDecoder(encoding).decode(base64js.toByteArray(base64Data));
}

export function base64URLEncode (data: any, encoding: string) {
  return base64URLFromBase64(base64Encode(data, encoding));
}

export function base64URLDecode (base64URLData: string, encoding: string) {
  return base64Decode(base64FromBase64URL(base64URLData), encoding);
}
