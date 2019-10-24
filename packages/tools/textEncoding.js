// @flow
import { TextEncoder, TextDecoder } from "text-encoding";
import { contentHashFromArrayBuffer } from "~/tools/id/contentId";
import { thenChainEagerly } from "~/tools/thenChainEagerly";

// FIXME(iridian): This needs to be properly tested, especially on the surrogate pairs an aether
// planes, so that UCS2String and UCS2Stream give identical results!

export function bufferAndContentHashFromNative (maybeObject: any, mediaInfo?: Object):
    Object | Promise<Object> {
  if (maybeObject === undefined) return undefined;
  return thenChainEagerly(maybeObject, [
    object => {
      if (typeof object === "string") return _arrayBufferFromStringAndMediaInfo(object, mediaInfo);
      if (ArrayBuffer.isView(object)) return object.buffer;
      if (object instanceof ArrayBuffer) return object;
      if ((typeof Blob !== "undefined")
          && (object != null) && (typeof object === "object") && (object instanceof Blob)) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload(event => resolve(event.target.result));
          reader.onerror(reject);
          reader.readAsArrayBuffer(object);
        });
      }
      return _arrayBufferFromStringAndMediaInfo(JSON.stringify(object), mediaInfo);
    },
    buffer => ({ buffer, contentHash: contentHashFromArrayBuffer(buffer) }),
  ]);
}

function _arrayBufferFromStringAndMediaInfo (text: string, mediaInfo?: Object) {
  if (!mediaInfo) return arrayBufferFromUTF8String(text);
  // TODO(iridian): Implement mediaInfo encoding schemas eventually.
  // Now storing everything as utf8 which is maybe not what we want: it thrashes save/load
  // roundtrips for documents whose original encoding is not utf8.
  return arrayBufferFromUTF8String(text);
}

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

export function contentHashFromUCS2String (contentString: string) {
  const buffer = arrayBufferFromUTF8String(contentString);
  return contentHashFromArrayBuffer(buffer);
}
