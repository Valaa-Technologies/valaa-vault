// @flow

import {
  generateBurlaesgIV, burlaesgEncode, burlaesgDecode, hs256JWTDecode, hs256JWTEncode,
} from "./security";

describe("Session security", () => {
  it("roundtrips a burlaesg payload properly", () => {
    const key = "abcdefghijklmnopqrstuvwxyz0123";
    // USE THIS in external code (only occasionally in tests)
    const iv = generateBurlaesgIV();
    // const iv = new Uint8Array(12);
    // iv.set([185, 101, 152, 96, 39, 227, 175, 178, 236, 173, 121, 187], 0);
    const nonce = "sdsd098131##";
    const identityChronicle = `valaa-test:?id=test-partition`; // old name for 'chronicle'
    const code = burlaesgEncode({ identityChronicle, nonce }, key, iv);
    const roundtripped = burlaesgDecode(code, key);
    expect(roundtripped)
        .toMatchObject({ alg: "A256GCM", iv, payload: { nonce, identityChronicle } });
  });

  it("roundtrips a basic JWT properly", () => {
    const secret = "'4' chosen by a fair dice roll";
    const token = hs256JWTEncode({ sub: "text" }, secret);
    expect(hs256JWTDecode(token, secret))
        .toMatchObject({ header: { alg: "HS256", typ: "JWT" }, payload: { sub: "text" } });
  });

  it("rejects too short HS256 JWT secret", () => {
    expect(() => hs256JWTEncode({ sub: "text" }, "a".repeat(15)))
        .toThrow(/Invalid/);
    expect(() => hs256JWTEncode({ sub: "text" }, "a".repeat(16)))
        .not.toThrow(/Invalid/);
  });
});
