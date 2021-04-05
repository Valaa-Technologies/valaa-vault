const nacl = require("tweetnacl");
const JSSHA3 = require("jssha/src/sha3");
const { TextEncoder } = require("text-encoding");

const { base64URLFromBuffer } = require("@valos/gateway-api/base64");
const { formVPlot } = require("@valos/plot");

module.exports = {
  hexSHA512FromBuffer,
  hashVPlot,
  hash40,
  hashV240,
  isHashV240,
};

function hexSHA512FromBuffer (buffer) {
  const byteArray = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return hexFromBuffer(nacl.hash(new Uint8Array(byteArray)));
}

const _byteToHex = [];
for (let n = 0; n <= 0xff; ++n) _byteToHex.push(n.toString(16).padStart(2, "0"));

function hexFromBuffer (buffer) {
  const byteArray = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const ret = new Array(buffer.length);
  for (let i = 0; i < byteArray.length; ++i) ret[i] = _byteToHex[byteArray[i]];
  return ret.join("");
}

function hashVPlot (object, options) {
  const vplot = options && options.isValidVPlot ? object : formVPlot(object);
  return base64URLFromBuffer(nacl.hash(new TextEncoder().encode(vplot)))
      .slice(0, (options && options.length) || 64);
}

function hash40 (input) {
  const inputBuffer = (typeof input === "string") ? new TextEncoder().encode(input) : input;
  return base64URLFromBuffer(nacl.hash(inputBuffer)).slice(0, 40);
}

// TODO(iridian, 2020-10): The SHA3 algorithm should probably be
// replaced with 240-bit truncated version SHA-512 via tweetnacl or
// with 240-bit BLAKE3 https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf
// Once this is done and the b64SHA256FromUTF8Text is removed the
// dependency to jssha can be removed.

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

function isHashV240 (value) {
  return ((typeof value === "string") && !!value.match(/^[A-Za-z0-9\-_]{40}$/));
}
