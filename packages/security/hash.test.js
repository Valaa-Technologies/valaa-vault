// @flow

import { arrayBufferFromUTF8String } from "~/security/textEncoding";

import { hashV240, isHashV240 } from "./hash";

// TODO(iridian, 2018-11): This test suite maybe needs to be expanded.
// Not confident in its coverage yet. But maybe after ArrayBuffer tests
// and UCS-2 surrogate pairs there is nothing else really?
// See https://mathiasbynens.be/notes/javascript-escapes for string stuff

describe("hashV240", () => {
  it("hashes example strings correctly", () => {
    expect(hashV240("32733037-75c1-4681-918e-eec63bb71d66"))
        .toEqual("GRPQ8f5SHGyuO8JLGdTuklOtgnmsJWgu5SJqZJIZ");
    expect(hashV240(`147797e2-717b-4683-a374-1408f461c08f:valaa-local:?id=${
      ""}lcl-493ab7ff-3b66-4d75-8b16-4e4010f43c8a:10`))
        .toEqual("3FBxgD5l_hetm8X9fsKo-gJCN89E-INMSp-si7gr");
    expect(hashV240(`1062301b-8a95-4a5c-8514-abd0f4a57b9e valaa-local:?id=${
      ""}lcl-0a494baa-a45e-4ae6-8f6f-be2ef222f45b 0`))
        .toEqual("SVUYEd4MTCdH5em7lzx3VZfR6dG__z_7kauTwN-6");
  });

  it("hashes surrogate pairs correctly", () => {
    expect(hashV240("𝌆"))
        .toEqual("4TUrnD3j98j0jzIfsABblZqX3VfYX-VOzMiwx-N2");
    expect(hashV240("\uD834\uDF06"))
        .toEqual("4TUrnD3j98j0jzIfsABblZqX3VfYX-VOzMiwx-N2");
    expect(hashV240("\u{1D306}"))
        .toEqual("4TUrnD3j98j0jzIfsABblZqX3VfYX-VOzMiwx-N2");
  });

  it("hashes complex strings correctlY", () => {
    expect(hashV240("κόσμε"))
        .toEqual("fmyWM1I_yGu_huBm30BMcu6rf5ura6ASeMAGqK7F");
    expect(hashV240("�ࠀ𐀀"))
        .toEqual("GjOdMNnaeyqAX5AoUdtVCqgYanveELjqFnGBrCJ2");
    expect(hashV240("������"))
        .toEqual("4m8DzxHjonwt6_Iour3IBNZ6K7FDEpHwSEQPZtYS");
    expect(hashV240("￾￿﷐﷑﷒﷓﷔﷕﷖﷗﷘﷙﷚﷛﷜﷝﷞﷟﷠﷡﷢﷣﷤﷥﷦﷧﷨﷩﷪﷫﷬﷭﷮﷯"))
        .toEqual("PsC8-8LXD9-nauJepqxsJzqvKNEAtmEUrpXUfCYK");
  });

  it("hashes ArrayBuffer's correctly", () => {
    expect(hashV240(arrayBufferFromUTF8String("32733037-75c1-4681-918e-eec63bb71d66")))
        .toEqual("GRPQ8f5SHGyuO8JLGdTuklOtgnmsJWgu5SJqZJIZ");
    expect(hashV240(arrayBufferFromUTF8String(
        `147797e2-717b-4683-a374-1408f461c08f:valaa-local:?id=${
          ""}lcl-493ab7ff-3b66-4d75-8b16-4e4010f43c8a:10`)))
        .toEqual("3FBxgD5l_hetm8X9fsKo-gJCN89E-INMSp-si7gr");
    expect(hashV240(arrayBufferFromUTF8String(
        `1062301b-8a95-4a5c-8514-abd0f4a57b9e valaa-local:?id=${
          ""}lcl-0a494baa-a45e-4ae6-8f6f-be2ef222f45b 0`)))
        .toEqual("SVUYEd4MTCdH5em7lzx3VZfR6dG__z_7kauTwN-6");

    expect(hashV240(arrayBufferFromUTF8String("𝌆")))
        .toEqual("4TUrnD3j98j0jzIfsABblZqX3VfYX-VOzMiwx-N2");
    expect(hashV240(arrayBufferFromUTF8String("\uD834\uDF06")))
        .toEqual("4TUrnD3j98j0jzIfsABblZqX3VfYX-VOzMiwx-N2");
    expect(hashV240(arrayBufferFromUTF8String("\u{1D306}")))
        .toEqual("4TUrnD3j98j0jzIfsABblZqX3VfYX-VOzMiwx-N2");

    expect(hashV240(arrayBufferFromUTF8String("κόσμε")))
        .toEqual("fmyWM1I_yGu_huBm30BMcu6rf5ura6ASeMAGqK7F");
    expect(hashV240(arrayBufferFromUTF8String("�ࠀ𐀀")))
        .toEqual("GjOdMNnaeyqAX5AoUdtVCqgYanveELjqFnGBrCJ2");
    expect(hashV240(arrayBufferFromUTF8String("������")))
        .toEqual("4m8DzxHjonwt6_Iour3IBNZ6K7FDEpHwSEQPZtYS");
    expect(hashV240(arrayBufferFromUTF8String("￾￿﷐﷑﷒﷓﷔﷕﷖﷗﷘﷙﷚﷛﷜﷝﷞﷟﷠﷡﷢﷣﷤﷥﷦﷧﷨﷩﷪﷫﷬﷭﷮﷯")))
        .toEqual("PsC8-8LXD9-nauJepqxsJzqvKNEAtmEUrpXUfCYK");
  });

  it("returns results as Hash240 strings which match isHashV240", () => {
    expect(isHashV240(hashV240("a")))
        .toEqual(true);
    expect(isHashV240("3FBxgD5l_hetm8X9fsKo-gJCN89E-INMSp-si7gr"))
        .toEqual(true);

    expect(isHashV240("FBxgD5l_hetm8X9fsKo-gJCN89E-INMSp-si7gr"))
        .toEqual(false); // Too short
    expect(isHashV240("_3FBxgD5l_hetm8X9fsKo-gJCN89E-INMSp-si7gr"))
        .toEqual(false); // Too long
    expect(isHashV240("+FBxgD5l_hetm8X9fsKo-gJCN89E-INMSp-si7gr"))
        .toEqual(false); // Wrong characters (regular base64 encoding '+')
    expect(isHashV240("/FBxgD5l_hetm8X9fsKo-gJCN89E-INMSp-si7gr"))
        .toEqual(false); // Wrong characters (regular base64 encoding '/')
  });
});
