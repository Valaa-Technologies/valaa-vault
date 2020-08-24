import derivedId from "./derivedId";

describe("derivedId", () => {
  it("returns correct sha-256 hashes for hardcoded non-vpath derivedId inputs", () => {
    expect(derivedId("aaaabbbb-cccc-dddd-eeee-ffffffffffff", "instance", "abcd"))
        .toEqual("/W2poYYRyL4oU74Jnk6XoAaBCjCZKKuFrrISZ4rQhTI=");
    expect(derivedId("aaaabbbb-cccc-dddd-eeee-ffffffffffff", "dup", ""))
        .toEqual("lX/KvhL6kt2xVrcGya4OUDQeBBKyYstpPkdqk+SBfLw=");
  });
  it("returns structured vpaths hashes for vpath context inputs", () => {
    expect(derivedId("aaaabbbb-cccc-4ddd-8eee-ffffffffffff", "instance", "@$~raw.abcd@@"))
        .toEqual("@$~raw.abcd@_$.instance@_$~u4.aaaabbbb-cccc-4ddd-8eee-ffffffffffff@@");
    expect(derivedId("aaaa", "dup", "@$~raw.abcd@@"))
        .toEqual("@$~raw.abcd@_$.dup@_$~raw.aaaa@@");
  });
});
