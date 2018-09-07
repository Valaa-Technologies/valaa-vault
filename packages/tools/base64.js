// @flow

import { TextEncoder, TextDecoder } from "text-encoding";
import base64js from "base64-js";

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

export function base64FromArrayBuffer (data: ArrayBuffer) {
  return base64js.fromByteArray(new Uint8Array(data));
}

export function arrayBufferFromBase64 (base64Data: string) {
  return base64js.toByteArray(base64Data).buffer;
}

export function base64Encode (data: any, encoding: string = "utf-8") {
  const bytes = new TextEncoder(encoding).encode(data);
  return base64js.fromByteArray(bytes);
}

export function base64Decode (base64Data: string, encoding: string = "utf-8") {
  const bytes = base64js.toByteArray(base64Data);
  return new TextDecoder(encoding).decode(bytes);
}
