// @flow

import jsSHA from "jssha/src/sha3";

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
 * https://crypto.stackexchange.com/questions/43718/if-the-output-size-of-shake128-256-is-variable-why-is-the-security-fixed-at-128
 *
 * @export
 * @param {string | ArrayBuffer} input  if a text string this is interpreted as utf-8.
 * @returns
 */
export default function hashV240 (input: string | ArrayBuffer): HashV240 {
  const hash = new jsSHA("SHAKE256",
      (typeof input === "string") ? "TEXT"
      : (input instanceof ArrayBuffer) ? "ARRAYBUFFER"
      : undefined);
  hash.update(input);
  return hash.getHash("B64", { outputUpper: false, b64Pad: "=", shakeLen: 240 })
      .replace(/\+/g, "-").replace(/\//g, "_");
}

// String containing a V240 hash, ie. matches /[A-Za-z0-9\-_]{40}/ .
export type HashV240 = string;

export function isHashV240 (value: any): boolean {
  return ((typeof value === "string") && !!value.match(/^[A-Za-z0-9\-_]{40}$/));
}
