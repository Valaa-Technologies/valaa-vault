// @flow

import URLParse from "url-parse";

import { invariantifyString } from "~/tools/invariantify";
import { coerceAsVRID, validateVRID } from "~/raem/VPath";
import { vdon } from "~/tools/vdon";

export const vdoc = vdon({ "...": { heading:
  "ValaaURI's refer to authorities, chronicles, resources and their sub-aspects",
},
  0: [
    `ValaaURI is a convenience object type used to represent Valaa URI
    strings. ValOS spec specifies a subset of all URI's as well-defined
    Valaa URI's and how they are interpreted as references to various
    Valaa constructs.`,
    `The main conceptual separation is by URI fragment separator \`#\`.
    Everything to the left of it (ie. URI scheme, hierarchical and
    query parts) is the *chronicle* part. Everything to the right (ie.
    the URI fragment part) is the *resource*.`,
    `The chronicle part is used to refer to authorities and chronicles.
    The ValOS spec does not specify the structure or semantics of the
    chronicle part at all but instead delegates the definition to
    particular Valaa URI schemes (which are identified by the Valaa URI
    scheme part).`,
    `The resource part is used to not just refer to valospace
    Resources and their sub-aspects (like lens names) but also to
    communicate parameterized information to valospace applications.
    The ValOS spec fully specifies the structure of the resource part
    and also much of its semantic meaning. Where it doesn't fully
    specify the semantics the information is intended for valospace
    applications to interpret.`,
/*
    * URI scheme part: is used to identify the specification for the rest . One of the following:
    *   - "valaa-memory": chronicle resides in memory and will not survive across restarts.
    *     authority part must be empty, thus making this URI not a URL.
    *   - "valaa-transient": deprecated alias for valaa-memory
    *   - "valaa-local": chronicle is local to the client device but is persisted.
    *     authority part must be empty, thus making this URI not a URL.
    *   Future candidate schemes:
    *   - "valaa": chronicle location is not specified (authority part must be empty). The authority
    *     for this chronicle must be known by the surrounding context.
    *
    `
*/
  ],
});

export type ValaaURI = string;

export const genericURI = {
  regex: /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/,
//         12            3    4          5       6  7        8 9
  protocolPart: 1, // scheme + ':'
  schemePart: 2, // without ':'
  authorityPart: 3,
  hostPart: 4,
  pathPart: 5,
  queryPart: 6, // with '?' prefix
  paramsPart: 7,
  fragmentPart: 8, // with '#' prefix
  secondaryResourcePart: 9, // without '#'
};

// Naive chronicle URI is a fixed format URI where first query param is
// `id` and its value is the chronicle Id and consequently the raw id
// of its root resource. Other query arguments

export const naiveURI = {
  // Matching groups are shared with rfc3986matcher up to paramsPart
  ...genericURI,
  regex:
      /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?(id=([^#&]+)(&([^#]*))?))(#(([^?]*)(\?(.*)))?)?$/,
  //    12            3    4          5       6  7   8       9 a          b cd      e  f
  chronicleIdPart: 8,
  paramsPart: 10,
  fragmentPart: 11,
  secondaryResourcePart: 12,
  resourceIdPart: 13,
  secondaryQueryPart: 14,
  secondaryParamsPart: 15,

  validateChronicleURI: function validateNaiveChronicleURI (chronicleURI: string) {
    const breakdown = chronicleURI.match(/^([^?#]*)\?id=([^/;=&#]*)([/;=&#].*)?$/);
    if (!breakdown) throw new Error(`Malformed chronicleURI is not a naiveURI: <${chronicleURI}>`);
    const [, authorityURI, chronicleVRID, rest] = breakdown;
    if (!authorityURI || !authorityURI.match(genericURI.regex)) {
      throw new Error(`Malformed chronicleURI authorityURI part is not a URI: <${authorityURI}>`);
    }
    validateVRID(chronicleVRID);
    if (rest) throw new Error(`Invalid chronicleURI; chronicleVRID must be last, got: "${rest}"`);
    return chronicleURI;
  },
  createChronicleURI: function createNaiveChronicleURI (
      authorityURI: string, chronicleVRID: string) {
    if (typeof chronicleVRID !== "string") {
      throw new Error("naiveURI.createChronicleURI.chronicleVRID missing");
    }
    validateVRID(chronicleVRID);
    const uriParts = authorityURI && authorityURI.match(genericURI.regex);
    if (!uriParts) {
      throw new Error(`naiveURI.createChronicleURI.authorityURI is not a well-formed URI: <${
          authorityURI}>`);
    }
    if (uriParts[genericURI.queryPart]) {
      throw new Error(`naiveURI.createChronicleURI.authorityURI must not have query part, got: <${
          uriParts[genericURI.queryPart]}>`);
    }
    if (uriParts[genericURI.fragmentPart]) {
      throw new Error(`naiveURI.createChronicleURI.authorityURI must not have fragment, got: <${
          uriParts[genericURI.fragmentPart]}>`);
    }
    /*
`${chronicleURIParts[genericURI.protocolPart]}${
    chronicleURIParts[genericURI.authorityPart] || ""}${
    // https://tools.ietf.org/html/rfc3986#section-3.3
    // If a URI contains an authority component, then the path
    // component must either be empty or begin with a slash ("/") character.
    chronicleURIParts[genericURI.pathPart]
        || (chronicleURIParts[genericURI.authorityPart] ? "/" : "")}`,
    */
    return `${authorityURI
      }${(!uriParts[genericURI.pathPart] && uriParts[genericURI.authorityPart]) ? "/" : ""
      }?id=${chronicleVRID}`;
  },

  createPartitionURI: function createNaivePartitionURI (
      baseString: string, partitionRawId: ?string): ValaaURI {
    if (partitionRawId !== undefined) {
      if (typeof partitionRawId !== "string") {
        throw new Error("naiveURI.createPartitionURI.partitionRawId must be a string");
      }
      let chronicleVRID = partitionRawId;
      if (partitionRawId.slice(-2) !== "@@") {
        chronicleVRID = coerceAsVRID(partitionRawId);
        console.log(`DEPRECATED: createPartitionURI.chronicleId must be a valid VPath, got: ${
          partitionRawId}, coerced as: ${chronicleVRID}`);
      }
      return naiveURI.createChronicleURI(baseString, chronicleVRID);
    }
    const match = _naiveChronicleURILookup[baseString];
    if (match) return match;
    if (!baseString || (typeof baseString !== "string")) {
      invariantifyString(baseString, "naiveURI.createPartitionURI.baseString",
          { allowEmpty: false });
    }
    const idPos = baseString.indexOf("?id=");
    if (idPos === -1) {
      throw new Error(`naiveURI.createPartitionURI.baseString missing required "?id=" separator`);
    }
    return (_naiveChronicleURILookup[baseString] =
        naiveURI.createPartitionURI(baseString.slice(0, idPos), baseString.slice(idPos + 4)));
  },

  // FIXME(iridian, 2019-02): naive chronicle URI's must be replaced with
  // chronicle schema specific logic and VRL-based API instead
  // of raw string access API.
  getPartitionRawId: function getNaivePartitionRawId (naivePartitionURI: ValaaURI): string {
    const match = (typeof naivePartitionURI === "string")
        && naivePartitionURI.match(naiveURI.regex);
    if (!match) {
      throw new Error(`Invalid naivePartitionURI (does not match naiveURI regex): <${
          naivePartitionURI}>`);
    }
    const chronicleIdPart = match[naiveURI.chronicleIdPart];
    if (chronicleIdPart.slice(-2) === "@@") return chronicleIdPart;
    return decodeURIComponent(chronicleIdPart);
  },

  getChronicleId: function getNaiveChronicleId (naiveChronicleURI) {
    const match = (typeof naiveChronicleURI === "string")
        && naiveChronicleURI.match(naiveURI.regex);
    if (!match) {
      throw new Error(`Invalid naiveChronicleURI (does not match naiveURI regex): <${
          naiveChronicleURI}>`);
    }
    const chronicleIdPart = match[naiveURI.chronicleIdPart];
    if (chronicleIdPart[0] !== "@") {
      throw new Error(`chronicle id must be a VPath in naive chronicle URI <${naiveChronicleURI}>`);
    }
    return chronicleIdPart;
  },

  getAuthorityURI: function getNaiveAuthorityURI (naiveChronicleURI: ValaaURI): ValaaURI {
    const parts = naiveChronicleURI.match(naiveURI.regex);
    if (!parts) {
      throw new Error(`Cannot extract authority URI from non-naive chronicle URI candidate: <${
          naiveChronicleURI}>`);
    }
    return `${parts[naiveURI.protocolPart]
        }${parts[naiveURI.authorityPart] || ""
        }${parts[naiveURI.pathPart] || ""
        }${!parts[naiveURI.naiveParamsPart] ? ""
            : `?${naiveURI.naiveParamsPart}`}`;
  },
};

/*
export function getValosURI (uri: ValaaURI | string): ValaaURI {
  if (typeof uri === "string") return createValaaURI(uri);
  return uri;
}

export function createValaaURI (uriString: string): ValaaURI {
  try {
    // if (uriString instanceof ValaaURI) return uriString;
    if (typeof uriString !== "string") {
      throw new Error(`Invalid uri: expected a string, got '${typeof uriString}'`);
    }
    return uriString;
    // const ret = new ValaaURI(uriString, null, true);
    // return ret;
  } catch (error) {
    throw wrapError(error, `During createValaaURI('${String(uriString)}')`);
  }
}
*/

export function getURIQueryField (uri: ValaaURI, fieldName: string): ?any {
  const uriObject = new URLParse(uri, null, true);
  return uriObject.query && uriObject.query[fieldName];
}

export function createLocalChronicleURIFromRootId (rootId: string): ValaaURI {
  return naiveURI.createChronicleURI("valaa-local:", rootId);
}

export function createMemoryChronicleURIFromRootId (rootId: string): ValaaURI {
  return naiveURI.createChronicleURI("valaa-memory:", rootId);
}

export function createTestChronicleURIFromRootId (rootId: string): ValaaURI {
  return naiveURI.createChronicleURI("valaa-test:", rootId);
}

export function getScheme (uri: string): string {
  return uri.match(/^([^:]*):/)[1];
}

export function getHostname (uri: string): string {
  return (new URLParse(uri)).hostname;
}

export function hasScheme (uri: string, scheme): boolean {
  return uri.slice(0, scheme.length + 1) === `${scheme}:`;
}

const _naiveChronicleURILookup = {};
