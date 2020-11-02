const { TextEncoder } = require("text-encoding");
const nacl = require("tweetnacl");

const { formVPlot } = require("@valos/plot");
const { base64URLFromBuffer, byteArrayFromBase64URL } = require("@valos/gateway-api/base64");

module.exports = {
  createSignatureKeys,
  signVPlot,
  verifyVPlotSignature,
};

function createSignatureKeys (seed) {
  let publicKey, secretKey;
  if (!seed) ({ publicKey, secretKey } = nacl.sign.keyPair());
  else {
    let seedArray = seed;
    if (typeof seedArray === "string") {
      seedArray = new Uint8Array(32);
      for (let i = 0, max = Math.min(32, seed.length); i < max; ++i) {
        seedArray[i] = seed.charCodeAt(i) & 0xFF; // eslint-disable-line no-bitwise
      }
    }
    ({ publicKey, secretKey } = nacl.sign.keyPair.fromSeed(seedArray));
  }
  return {
    publicKey: base64URLFromBuffer(publicKey),
    secretKey: base64URLFromBuffer(secretKey),
  };
}

function signVPlot (object, secretKey) {
  const vplot = formVPlot(object);
  return base64URLFromBuffer(nacl.sign.detached(
      new TextEncoder().encode(vplot),
      typeof secretKey === "string" ? byteArrayFromBase64URL(secretKey) : secretKey));
}

function verifyVPlotSignature (object, signature, publicKey) {
  const vplot = formVPlot(object);
  return nacl.sign.detached.verify(
      new TextEncoder().encode(vplot),
      typeof signature === "string" ? byteArrayFromBase64URL(signature) : signature,
      typeof publicKey === "string" ? byteArrayFromBase64URL(publicKey) : publicKey);
}
