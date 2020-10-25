const JSSHA256 = require("jssha/src/sha256");
const JSSHA512 = require("jssha/src/sha512");
const JSSHA3 = require("jssha/src/sha3");

const { arrayBufferFromUTF8String } = require("./textEncoding");

module.exports = {
  hashV240,
  isHashV240,
  b64SHA256FromUTF8Text,
  hexSHA512FromArrayBuffer,
  hexSHA512PromiseFromStream,
};

function b64SHA256FromUTF8Text (utf8Text) {
  const sha = new JSSHA256("SHA-256", "TEXT", { encoding: "UTF8" });
  sha.update(utf8Text);
  return sha.getHash("B64");
}

function hexSHA512FromArrayBuffer (arrayBuffer) {
  const sha = new JSSHA512("SHA-512", "ARRAYBUFFER");
  sha.update(arrayBuffer);
  return sha.getHash("HEX");
}

function hexSHA512PromiseFromStream (octetOrUTF8StringStream) {
  return new Promise((resolve, reject) => {
    try {
      const sha = new JSSHA512("SHA-512", "ARRAYBUFFER");
      octetOrUTF8StringStream.on("data", (bufferOrString) => {
        if (typeof bufferOrString === "string") {
          sha.update(arrayBufferFromUTF8String(bufferOrString));
        } else {
          sha.update(bufferOrString);
        }
      });
      octetOrUTF8StringStream.on("error", reject);
      octetOrUTF8StringStream.on("end", () => {
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

/* eslint-disable max-len */
/**
 * Returns a 240-bit SHAKE256 hash of the given input buffer or utf-8
 * text string as a base64-url encoded string (ie. [A-Za-z0-9\-_]{40}).
 *
 * Bit-count choice rationale:
 * 1. practicality: divisible by 6 and 8 for exact representation both
 *    in base64-url and octets formats
 * 2. security: preimage attack strength 240 is close enough to the max ~256 of SHAKE256
 *    (see https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf , A.1 Summary)
 * 3. security: collision attack strength 120 is still better than SHA3-224
 * 4. aesthetics: base64-url length at 40 is only 4 chars longer than uuidv4: tolerable.
 * 5. aesthetics: octet length at 30 fits snugly in 32 bytes, for whatever that's worth.
 * 6. debugging: as 40 char base64-url string a ValOS hash should in
 *    practice be recognizable and differentiable from other similar
 *    identifiers in various listings.
 *
 * See also:
 *
 * https://crypto.stackexchange.com/questions/43718/if-the-output-size-of-shake128-256-is-variable-why-is-the-security-fixed-at-128
 *
 * @export
 * @param {string | ArrayBuffer} input  if a text string this is interpreted as utf-8.
 * @returns
 */
function hashV240 (input) {
/* eslint-enable max-len */
  const hash = new JSSHA3("SHAKE256",
      (typeof input === "string") ? "TEXT"
      : (input instanceof ArrayBuffer) ? "ARRAYBUFFER"
      : undefined);
  hash.update(input);
  return hash.getHash("B64", { outputUpper: false, b64Pad: "=", shakeLen: 240 })
      .replace(/\+/g, "-").replace(/\//g, "_");
}

function isHashV240 (value): boolean {
  return ((typeof value === "string") && !!value.match(/^[A-Za-z0-9\-_]{40}$/));
}
