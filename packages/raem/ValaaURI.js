// @flow

import URLParse from "url-parse";

import { invariantifyString } from "~/tools/invariantify";
import { vdon } from "~/tools/vdon";
// import wrapError from "~/tools/wrapError";

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
    `The resource part is used to not just refer to ValaaSpace
    Resources and their sub-aspects (like lens names) but also to
    communicate parameterized information to ValaaSpace applications.
    The ValOS spec fully specifies the structure of the resource part
    and also much of its semantic meaning. Where it doesn't fully
    specify the semantics the information is intended for ValaaSpace
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

/* eslint-disable no-unused-vars */

const _rfc3986URIMatcher =
    /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/;
//    12            3    4          5       6  7        8 9
const _protocolIndex = 1; // scheme + ':'
const _schemeIndex = 2; // without ':'
const _authorityIndex = 3;
const _hostIndex = 4;
const _pathIndex = 5;
const _queryIndex = 6; // with '?' prefix
const _paramsIndex = 7;
const _fragmentIndex = 8; // with '#' prefix
const _secondaryResourceIndex = 9; // without '#'

// Naive partition URI is a fixed format URI where first query param is
// `id` and its value is the partition Id and consequently the raw id
// of its root resource. Other query arguments

const _naivePartitionURIMatcher =
    /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?(id=([^#&]+)(&([^#]*))?))(#(([^?]*)(\?(.*)))?)?$/;
//    12            3    4          5       6  7   8       9 a          b cd      e  f
// Matching groups are shared with rfc3986matcher up to _paramsIndex
const _naivePartitionIdIndex = 8;
const _naiveParamsIndex = 10;
const _naiveFragmentIndex = 11;
const _naiveSecondaryResourceIndex = 12;
const _naiveResourceIdIndex = 13;
const _naiveSecondaryQueryIndex = 14;
const _naiveSecondaryParamsIndex = 15;
// const fragmentIndex = 6;

/* eslint-enable no-unused-vars */

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
export function createNaivePartitionURI (baseString: string, partitionRawId: ?string): ValaaURI {
  if (!baseString || (typeof baseString !== "string")) {
    invariantifyString(baseString, "createNaivePartitionURI.baseString", { allowEmpty: false });
  }
  const baseParts = baseString.match(_rfc3986URIMatcher);
  if (!baseParts) {
    throw new Error(`createNaivePartitionURI.baseString is not a well-formed URI: <${baseString}>`);
  }
  if (!baseParts[_schemeIndex]) {
    throw new Error(`createNaivePartitionURI.baseString is missing scheme part: <${baseString}>`);
  }
  if (!partitionRawId) {
    if (partitionRawId === undefined) return baseString;
    invariantifyString(partitionRawId, "createNaivePartitionURI.partitionRawId",
        { allowUndefined: true });
  }
  return `${baseParts[_protocolIndex]
      }${baseParts[_authorityIndex] || ""
      // https://tools.ietf.org/html/rfc3986#section-3.3
      // If a URI contains an authority component, then the path
      // component must either be empty or begin with a slash ("/") character.
      }${baseParts[_pathIndex] || (baseParts[_authorityIndex] ? "/" : "")
      }?id=${encodeURIComponent(partitionRawId)
      }${!baseParts[_paramsIndex] ? "" : `&${baseParts[_paramsIndex]}`}`;
}

/*
export function getValaaURI (uri: ValaaURI | string): ValaaURI {
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

// FIXME(iridian, 2019-02): naive partition URI's must be replaced with
// partition schema specific logic and ValaaReference-based API instead
// of raw string access API.
export function getNaivePartitionRawIdFrom (naivePartitionURI: ValaaURI): string {
  if ((typeof naivePartitionURI !== "object") || !naivePartitionURI) {
    invariantifyString(naivePartitionURI, "naivePartitionURI", { allowEmpty: true });
  }
  const parts = naivePartitionURI.match(_naivePartitionURIMatcher);
  return decodeURIComponent(parts[_naivePartitionIdIndex]);
}

export function getNaiveAuthorityURIOf (naivePartitionURI: ValaaURI): ValaaURI {
  const parts = naivePartitionURI.match(_naivePartitionURIMatcher);
  if (!parts) {
    throw new Error(`Cannot extract authority URI from non-naive partition URI candidate: <${
        naivePartitionURI}>`);
  }
  return `${parts[_protocolIndex]}${parts[_authorityIndex]}${parts[_pathIndex]
      }${!parts[_naiveParamsIndex] ? "" : `?${_naiveParamsIndex}`}`;
}

export function createLocalPartitionURIFromRawId (rawId: string): ValaaURI {
  return createNaivePartitionURI("valaa-local:", rawId);
}

export function createMemoryPartitionURIFromRawId (rawId: string): ValaaURI {
  return createNaivePartitionURI("valaa-memory:", rawId);
}

export function createTransientPartitionURIFromRawId (rawId: string): ValaaURI {
  return createNaivePartitionURI("valaa-transient:", rawId);
}

export function createTestPartitionURIFromRawId (rawId: string): ValaaURI {
  return createNaivePartitionURI("valaa-test:", rawId);
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
