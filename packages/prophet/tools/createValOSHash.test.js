// @flow

import createValOSHash from "./createValOSHash";

describe("createValOSHash", () => {
  it("encodes example strings correctly", () => {
    expect(createValOSHash("32733037-75c1-4681-918e-eec63bb71d66"))
        .toEqual("GRPQ8f5SHGyuO8JLGdTuklOtgnmsJWgu5SJqZJIZ");
    expect(createValOSHash("147797e2-717b-4683-a374-1408f461c08f:valaa-local:?id=lcl-493ab7ff-3b66-4d75-8b16-4e4010f43c8a:10"))
        .toEqual("3FBxgD5l_hetm8X9fsKo-gJCN89E-INMSp-si7gr");
    expect(createValOSHash("1062301b-8a95-4a5c-8514-abd0f4a57b9e valaa-local:?id=lcl-0a494baa-a45e-4ae6-8f6f-be2ef222f45b 0"))
        .toEqual("SVUYEd4MTCdH5em7lzx3VZfR6dG__z_7kauTwN-6");
  });
});
