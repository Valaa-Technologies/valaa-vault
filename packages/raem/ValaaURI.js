// @flow

import ValaaURI from "url-parse";

import { invariantifyString, invariantifyObject } from "~/tools/invariantify";
import { vdon } from "~/tools/vdon";
import wrapError from "~/tools/wrapError";

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

export default ValaaURI;

const PARTITION_URI_LRU_MAX_SIZE = 1000;
const partitionURILRU = new Map();

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
export function createPartitionURI (baseString: string, partitionRawId: ?string): ValaaURI {
  invariantifyString(baseString, "createPartitionURI.baseString", { allowEmpty: false });
  invariantifyString(partitionRawId, "createPartitionURI.partitionRawId", { allowUndefined: true });
  const partitionURIString = (typeof partitionRawId === "undefined")
      ? baseString
      : `${baseString}?id=${encodeURIComponent(partitionRawId)}`;
  let ret = partitionURILRU.get(partitionURIString);
  if (ret) {
    if (partitionURILRU.size < PARTITION_URI_LRU_MAX_SIZE) return ret;
    partitionURILRU.delete(partitionURIString);
  } else {
    ret = createValaaURI(partitionURIString);
    if (partitionURILRU.size >= PARTITION_URI_LRU_MAX_SIZE) {
      for (const [key] of partitionURILRU) {
        partitionURILRU.delete(key);
        break;
      }
    }
  }
  partitionURILRU.set(partitionURIString, ret);
  return ret;
}

export function getValaaURI (uri: ValaaURI | string): ValaaURI {
  if (typeof uri === "string") return createValaaURI(uri);
  return uri;
}

export function createValaaURI (uriString: string): ValaaURI {
  if (typeof uriString !== "string") return undefined;
  try {
    const ret = new ValaaURI(uriString, null, true);
    // if (!ret.searchParams && ret.search) ret.searchParams = new URLSearchParams(ret.search);
    return ret;
  } catch (error) {
    throw wrapError(error, `During createValaaURI('${String(uriString)}')`);
  }
}

export function getURIQueryField (uri: ValaaURI | string, fieldName: string): ?any {
  if (uri instanceof ValaaURI) return uri;
  const valaaURI = createValaaURI(String(uri));
  return valaaURI.query && valaaURI.query[fieldName];
  /*
  const searchParams = valaaURI.searchParams
      || (valaaURI.search ? new URLSearchParams(valaaURI.search) : undefined);
  return searchParams && searchParams.get(fieldName);
  */
}

export function getPartitionRawIdFrom (partitionURI: ValaaURI): string {
  if ((typeof partitionURI !== "object") || !partitionURI || !partitionURI.href) {
    invariantifyObject(partitionURI, "partitionURI",
        { instanceof: ValaaURI, allowEmpty: true });
  }
  return decodeURIComponent(partitionURI.query.id);
}

export function getPartitionAuthorityURIStringFrom (partitionURI: ValaaURI): string {
  return `${partitionURI.protocol}${partitionURI.host ? `//${partitionURI.host}` : ""}${
      partitionURI.pathname}`;
}

export function createLocalPartitionURIFromRawId (rawId: string): ValaaURI {
  return createPartitionURI("valaa-local:", rawId);
}

export function createMemoryPartitionURIFromRawId (rawId: string): ValaaURI {
  return createPartitionURI("valaa-memory:", rawId);
}

export function createTransientPartitionURIFromRawId (rawId: string): ValaaURI {
  return createPartitionURI("valaa-transient:", rawId);
}

export function createTestPartitionURIFromRawId (rawId: string): ValaaURI {
  return createPartitionURI("valaa-test:", rawId);
}
