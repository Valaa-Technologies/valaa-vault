import { naiveURI, getHostname } from "~/raem/ValaaURI";

describe("Basic operations", () => {
  it("roundtrips trivial uri 'foo:?id=@$~raw:a@@'", () => {
    const sourceURI = "foo:?id=@$~raw:a@@";
    const roundtripURI = naiveURI.createChronicleURI(sourceURI);
    expect(String(roundtripURI))
        .toEqual(sourceURI);
  });

  it("roundtrips non-trivial uri 'foo://bar.com/?id=@$~raw:baz@@'", () => {
    const sourceURI = "foo://bar.com/";
    const roundtripURI = naiveURI.createChronicleURI(sourceURI, "@$~raw:baz@@");
    expect(String(roundtripURI))
        .toEqual(`${sourceURI}?id=@$~raw:baz@@`);

    const authorityURIString = naiveURI.getAuthorityURI(roundtripURI);
    expect(String(authorityURIString))
        .toEqual(sourceURI);
  });

  it("adds '/' to path part when host uri 'foo://bar.com' is used as authority URI base", () => {
    const sourceURI = "foo://bar.com";
    const roundtripURI = naiveURI.createChronicleURI(sourceURI, "@$~raw:baz@@");
    expect(String(roundtripURI))
        .toEqual(`${sourceURI}/?id=@$~raw:baz@@`);

    const authorityURIString = naiveURI.getAuthorityURI(roundtripURI);
    expect(String(authorityURIString))
        .toEqual(`${sourceURI}/`);
  });

  it("doesn't add '/' to path part for pathed authority URI 'foo://bar.com/xyz'", () => {
    const sourceURI = "foo://bar.com/xyz";
    const roundtripURI = naiveURI.createChronicleURI(sourceURI, "@$~raw:baz@@");
    expect(String(roundtripURI))
        .toEqual(`${sourceURI}?id=@$~raw:baz@@`);

    const authorityURIString = naiveURI.getAuthorityURI(roundtripURI);
    expect(String(authorityURIString))
        .toEqual(sourceURI);
  });

  it("doesn't lose // from string uri with naiveURI.getAuthorityURI", () => {
    const uriString = "valaa-test://example.com/developtest?id=@$~raw:aaaaaaa-bbbb-cdef-1234@@";
    const authorityString = "valaa-test://example.com/developtest";
    expect(naiveURI.getAuthorityURI(uriString))
        .toEqual(authorityString);
  });

  it("parses 'http://brave.com%60x.code-fu.org/' fully as a host instead of host+path", () => {
    const uriString = "http://brave.com%60x.code-fu.org/";
    expect(getHostname(uriString))
        .toEqual("brave.com%60x.code-fu.org");
  });
});
