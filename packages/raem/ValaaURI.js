// @flow

import URLParse from "url-parse";

import { invariantifyString } from "~/tools/invariantify";
import { validateVRID } from "~/raem/VPath";
import { vdon } from "~/tools/vdon";

export const vdoc = vdon({ "...": { heading:
  "ValaaURI's refer to authorities, partitions, resources and their sub-aspects",
},
  0: [
    `ValaaURI is a convenience object type used to represent Valaa URI
    strings. ValOS spec specifies a subset of all URI's as well-defined
    Valaa URI's and how they are interpreted as references to various
    Valaa constructs.`,
    `The main conceptual separation is by URI fragment separator \`#\`.
    Everything to the left of it (ie. URI scheme, hierarchical and
    query parts) is the *partition* part. Everything to the right (ie.
    the URI fragment part) is the *resource*.`,
    `The partition part is used to refer to authorities and partitions.
    The ValOS spec does not specify the structure or semantics of the
    partition part at all but instead delegates the definition to
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
    *   - "valaa-memory": partition resides in memory and will not survive across restarts.
    *     authority part must be empty, thus making this URI not a URL.
    *   - "valaa-transient": deprecated alias for valaa-memory
    *   - "valaa-local": partition is local to the client device but is persisted.
    *     authority part must be empty, thus making this URI not a URL.
    *   Future candidate schemes:
    *   - "valaa": partition location is not specified (authority part must be empty). The authority
    *     for this partition must be known by the surrounding context.
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

// Naive partition URI is a fixed format URI where first query param is
// `id` and its value is the partition Id and consequently the raw id
// of its root resource. Other query arguments

export const naiveURI = {
  // Matching groups are shared with rfc3986matcher up to paramsPart
  ...genericURI,
  regex:
      /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?(id=([^#&]+)(&([^#]*))?))(#(([^?]*)(\?(.*)))?)?$/,
  //    12            3    4          5       6  7   8       9 a          b cd      e  f
  partitionIdPart: 8,
  paramsPart: 10,
  fragmentPart: 11,
  secondaryResourcePart: 12,
  resourceIdPart: 13,
  secondaryQueryPart: 14,
  secondaryParamsPart: 15,

  /**
   * Creates a partition URI from one or two string as a native URL object.
   * If only one string is given it is considered to be the full partition URI string and consumed
   * as is.
   * If the optional partitionRawId is specified the baseString is considered to be the partition
   * authority URI, and the full partition URI is generated as per authority URI schema.
   *
   * @export
   * @param {string} baseString
   * @param null partitionRawId
   * @param {any} string
   * @returns {ValaaURI}
   */
  createPartitionURI: function createNaivePartitionURI (
      baseString: string, partitionRawId: ?string): ValaaURI {
    if (!baseString || (typeof baseString !== "string")) {
      invariantifyString(baseString, "naiveURI.createPartitionURI.baseString",
          { allowEmpty: false });
    }
    const baseParts = baseString.match(genericURI.regex);
    if (!baseParts) {
      throw new Error(
          `naiveURI.createPartitionURI.baseString is not a well-formed URI: <${baseString}>`);
    }
    if (!baseParts[genericURI.schemePart]) {
      throw new Error(
          `naiveURI.createPartitionURI.baseString is missing scheme part: <${baseString}>`);
    }
    if (!partitionRawId) {
      if (partitionRawId === undefined) return baseString;
      invariantifyString(partitionRawId, "naiveURI.createPartitionURI.partitionRawId",
          { allowUndefined: true });
    }
    let idPart;
    if (partitionRawId.slice(-2) === "@@") {
      validateVRID(partitionRawId);
      idPart = partitionRawId;
    } else {
      idPart = encodeURIComponent(partitionRawId);
    }

    return `${baseParts[genericURI.protocolPart]
        }${baseParts[genericURI.authorityPart] || ""
        // https://tools.ietf.org/html/rfc3986#section-3.3
        // If a URI contains an authority component, then the path
        // component must either be empty or begin with a slash ("/") character.
        }${baseParts[genericURI.pathPart]
            || (baseParts[genericURI.authorityPart] ? "/" : "")
        }?id=${idPart
        }${!baseParts[genericURI.paramsPart] ? "" : `&${baseParts[genericURI.paramsPart]}`}`;
  },

  createChronicleURI: function createNaiveChronicleURI (authorityURI: string, chronicleId: string) {
    if ((chronicleId === undefined)
        || (chronicleId[0] !== "@") || (chronicleId.slice(-2) !== "@@")) {
      throw new Error(
          `createChronicleURI.chronicleId must be a valid VPath, got: "${chronicleId}"`);
    }
    return naiveURI.createPartitionURI(authorityURI, chronicleId);
  },

  // FIXME(iridian, 2019-02): naive partition URI's must be replaced with
  // partition schema specific logic and VRL-based API instead
  // of raw string access API.
  getPartitionRawId: function getNaivePartitionRawId (naivePartitionURI: ValaaURI): string {
    const match = (typeof naivePartitionURI === "string")
        && naivePartitionURI.match(naiveURI.regex);
    if (!match) {
      throw new Error(`Invalid naivePartitionURI (does not match naiveURI regex): <${
          naivePartitionURI}>`);
    }
    const partitionIdPart = match[naiveURI.partitionIdPart];
    return (partitionIdPart.slice(-2) === "@@")
        ? partitionIdPart
        : decodeURIComponent(partitionIdPart);
  },

  getChronicleId: function getNaiveChronicleId (naiveChronicleURI) {
    const match = (typeof naiveChronicleURI === "string")
        && naiveChronicleURI.match(naiveURI.regex);
    if (!match) {
      throw new Error(`Invalid naiveChronicleURI (does not match naiveURI regex): <${
          naiveChronicleURI}>`);
    }
    const chronicleIdPart = match[naiveURI.partitionIdPart];
    if (chronicleIdPart[0] !== "@") {
      throw new Error(`chronicle id must be a VPath in naive chronicle URI <${naiveChronicleURI}>`);
    }
    return chronicleIdPart;
  },

  getAuthorityURI: function getNaiveAuthorityURI (naivePartitionURI: ValaaURI): ValaaURI {
    const parts = naivePartitionURI.match(naiveURI.regex);
    if (!parts) {
      throw new Error(`Cannot extract authority URI from non-naive partition URI candidate: <${
          naivePartitionURI}>`);
    }
    return `${parts[naiveURI.protocolPart]
        }${parts[naiveURI.authorityPart]
        }${parts[naiveURI.pathPart]
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

export function createLocalPartitionURIFromRawId (rawId: string): ValaaURI {
  return naiveURI.createPartitionURI("valaa-local:", rawId);
}

export function createMemoryPartitionURIFromRawId (rawId: string): ValaaURI {
  return naiveURI.createPartitionURI("valaa-memory:", rawId);
}

export function createTransientPartitionURIFromRawId (rawId: string): ValaaURI {
  return naiveURI.createPartitionURI("valaa-transient:", rawId);
}

export function createTestPartitionURIFromRawId (rawId: string): ValaaURI {
  return naiveURI.createPartitionURI("valaa-test:", rawId);
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
