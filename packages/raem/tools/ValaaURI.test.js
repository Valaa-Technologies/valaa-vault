import { naiveURI, getHostname } from "~/raem/ValaaURI";

describe("Basic operations", () => {
  it("roundtrips trivial uri 'foo:'", () => {
    const sourceURI = "foo:";
    const roundtripURI = naiveURI.createPartitionURI(sourceURI);
    expect(String(roundtripURI))
        .toEqual(sourceURI);
  });

  it("roundtrips non-trivial uri 'foo://bar.com/?id=baz'", () => {
    const sourceURI = "foo://bar.com/";
    const roundtripURI = naiveURI.createPartitionURI(sourceURI, "baz");
    expect(String(roundtripURI))
        .toEqual(`${sourceURI}?id=baz`);

    const authorityURIString = naiveURI.getAuthorityURI(roundtripURI);
    expect(String(authorityURIString))
        .toEqual(sourceURI);
  });

  it("adds '/' to path part when host uri 'foo://bar.com' is used as authority URI base", () => {
    const sourceURI = "foo://bar.com";
    const roundtripURI = naiveURI.createPartitionURI(sourceURI, "baz");
    expect(String(roundtripURI))
        .toEqual(`${sourceURI}/?id=baz`);

    const authorityURIString = naiveURI.getAuthorityURI(roundtripURI);
    expect(String(authorityURIString))
        .toEqual(`${sourceURI}/`);
  });

  it("doesn't add '/' to path part for pathed authority URI 'foo://bar.com/xyz'", () => {
    const sourceURI = "foo://bar.com/xyz";
    const roundtripURI = naiveURI.createPartitionURI(sourceURI, "baz");
    expect(String(roundtripURI))
        .toEqual(`${sourceURI}?id=baz`);

    const authorityURIString = naiveURI.getAuthorityURI(roundtripURI);
    expect(String(authorityURIString))
        .toEqual(sourceURI);
  });

  it("doesn't lose // from string uri with naiveURI.getAuthorityURI", () => {
    const uriString = "valaa-test://example.com/developtest?id=aaaaaaa-bbbb-cdef-1234";
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
