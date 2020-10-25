// @flow
import { TextEncoder, TextDecoder } from "text-encoding";

// FIXME(iridian): This needs to be properly tested, especially on the surrogate pairs an aether
// planes, so that UCS2String and UCS2Stream give identical results!

export function utf8StringFromArrayBuffer (buffer: ArrayBuffer): string {
  return _stringFromArrayBuffer("utf-8", buffer);
}

export function utf16LEStringFromArrayBuffer (buffer: ArrayBuffer): string {
  return _stringFromArrayBuffer("utf-16le", buffer);
}

export function utf16BEStringFromArrayBuffer (buffer: ArrayBuffer): string {
  return _stringFromArrayBuffer("utf-16be", buffer);
}

function _stringFromArrayBuffer (encoding: string, buffer: ArrayBuffer): string {
  const enc = new TextDecoder(encoding);
  return enc.decode(new Uint8Array(buffer));
}

export function arrayBufferFromUTF8String (stringContent: string): ArrayBuffer {
  return _arrayBufferFromString("utf-8", stringContent);
}

export function arrayBufferFromUTF16LEString (stringContent: string): ArrayBuffer {
  return _arrayBufferFromString("utf-16le", stringContent);
}

export function arrayBufferFromUTF16BEString (stringContent: string): ArrayBuffer {
  return _arrayBufferFromString("utf-16be", stringContent);
}

function _arrayBufferFromString (encoding: string, stringContent: string): ArrayBuffer {
  const enc = new TextEncoder(encoding);
  return enc.encode(stringContent).buffer;
}
