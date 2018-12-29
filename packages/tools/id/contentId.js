// @flow
import crypto from "crypto";
import type Stream from "stream";
import JsSHA from "jssha";

export function contentIdFromArrayBuffer (buffer: ArrayBuffer): string {
  const sha = new JsSHA("SHA-512", "ARRAYBUFFER");
  sha.update(buffer);
  return sha.getHash("HEX");
}

/*
  Returns a promise that resolves with the sha512 hash of the content of the given stream.
*/
export function contentIdFromNativeStream (contentStream: Stream): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash("sha512");
      contentStream.on("end", () => {
        hash.end();
        const digest = hash.read();
        if (digest) {
          resolve(digest.toString("hex"));
        } else {
          reject(new Error("Could not resolve digest for stream"));
        }
      });
      contentStream.pipe(hash);
    } catch (err) {
      reject(err);
    }
  });
}
