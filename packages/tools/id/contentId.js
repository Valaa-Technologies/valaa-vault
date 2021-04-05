// @flow

import { hexSHA512FromBuffer } from "~/security/hash";
import { arrayBufferFromUTF8String } from "~/security/textEncoding";

import { thenChainEagerly } from "~/tools/thenChainEagerly";

export function bufferAndContentHashFromNative (maybeObject: any, mediaInfo?: Object):
    Object | Promise<Object> {
  if (maybeObject === undefined) return undefined;
  return thenChainEagerly(maybeObject, [
    object => {
      if (typeof object === "string") return _arrayBufferFromStringAndMediaInfo(object, mediaInfo);
      if (ArrayBuffer.isView(object)) {
        if ((typeof Buffer !== "undefined") && object instanceof Buffer) {
          return Uint8Array.prototype.slice.call(object).buffer;
        }
        return object.buffer;
      }
      if (object instanceof ArrayBuffer) return object;
      if ((typeof Blob !== "undefined") && (object instanceof Blob)) return object.arrayBuffer();
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

export function contentHashFromUCS2String (contentString: string) {
  const buffer = arrayBufferFromUTF8String(contentString);
  return contentHashFromArrayBuffer(buffer);
}

export function contentHashFromArrayBuffer (buffer: ArrayBuffer): string {
  return hexSHA512FromBuffer(buffer);
}
