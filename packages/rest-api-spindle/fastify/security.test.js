// @flow

import { burlaesgEncode, burlaesgDecode, hs256JWTDecode, hs256JWTEncode } from "./security";

describe("Session security", () => {
  it("roundtrips a burlaesg payload properly", () => {
    const key = "cmFuZG9tdGV4dHR3ZW50eWNoYXJhYw";
    const iv = new Uint8Array(12);
    iv.set([185, 101, 152, 96, 39, 227, 175, 178, 236, 173, 121, 187], 0);
    const nonce = "sdsd098131##";
    const identityPartition = `valaa-aws://l2t9gu7rw4.execute-api.eu-west-1.amazonaws.com/${
      ""}developtest?id=40c349af-a782-465e-9da3-526fae7ec9c6`;
    const code = burlaesgEncode({ identityPartition, nonce }, key, iv);
    const roundtripped = burlaesgDecode(code, key);
    expect(roundtripped).toMatchObject({ alg: "A256GCM", iv, payload: { nonce, identityPartition } });
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
