import {
  createPartitionURI, getValaaURI, createValaaURI, getPartitionAuthorityURIStringFrom,
} from "~/raem/ValaaURI";

describe("Basic operations", () => {
  it("roundtrips trivial uri 'foo:'", () => {
    const sourceURIString = "foo:";
    let roundTripURI;
    roundTripURI = createValaaURI(sourceURIString);
    expect(String(roundTripURI))
        .toEqual(sourceURIString);

    roundTripURI = createPartitionURI(sourceURIString);
    expect(String(roundTripURI))
        .toEqual(sourceURIString);

    const authorityURIString = getPartitionAuthorityURIStringFrom(roundTripURI);
    expect(String(authorityURIString))
        .toEqual(sourceURIString);
  });

  it("doesn't lose // from string uri with getValaaURI", () => {
    const uriString = "valaa-test://example.com/developtest?id=8afca35a-e64b-44d4-bc73-8902e609e040";
    const uri = getValaaURI(uriString);
    expect(String(uri))
        .toEqual(uriString);
  });

  it("doesn't lose // from string uri with getPartitionAuthorityURIStringFrom", () => {
    const uriString = "valaa-test://example.com/developtest?id=8afca35a-e64b-44d4-bc73-8902e609e040";
    const authorityString = "valaa-test://example.com/developtest";
    const uri = getValaaURI(uriString);
    expect(getPartitionAuthorityURIStringFrom(uri))
        .toEqual(authorityString);
  });

  it("parses 'http://brave.com%60x.code-fu.org/' fully as a host instead of host+path", () => {
    const uriString = "http://brave.com%60x.code-fu.org/";
    const uri = getValaaURI(uriString);
    expect(uri.hostname)
        .toEqual("brave.com%60x.code-fu.org");
  });
});
