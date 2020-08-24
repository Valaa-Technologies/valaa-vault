// @flow

import JSSHA from "jssha/src/sha512";

import { thenChainEagerly } from "~/tools/thenChainEagerly";
import { arrayBufferFromUTF8String } from "~/tools/textEncoding";

export function bufferAndContentHashFromNative (maybeObject: any, mediaInfo?: Object):
    Object | Promise<Object> {
  if (maybeObject === undefined) return undefined;
  return thenChainEagerly(maybeObject, [
    object => {
      if (typeof object === "string") return _arrayBufferFromStringAndMediaInfo(object, mediaInfo);
      if (ArrayBuffer.isView(object)) return object.buffer;
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
  const sha = new JSSHA("SHA-512", "ARRAYBUFFER");
  sha.update(buffer);
  return sha.getHash("HEX");
}

/*
  Returns a promise that resolves with the sha512 hash of the content of the given stream.
*/

export function contentHashFromNativeStream (contentStream): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const sha = new JSSHA("SHA-512", "ARRAYBUFFER");
      contentStream.on("data", (bufferOrString) => {
        if (typeof bufferOrString === "string") {
          sha.update(arrayBufferFromUTF8String(bufferOrString));
        } else {
          sha.update(bufferOrString);
        }
      });
      contentStream.on("error", reject);
      contentStream.on("end", () => {
        const digest = sha.getHash("HEX");
        if (digest) {
          resolve(digest);
        } else {
          reject(new Error("Could not resolve digest for stream"));
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
