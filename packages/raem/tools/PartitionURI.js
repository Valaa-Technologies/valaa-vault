// @flow

import URL from "url-parse";
import { invariantifyString, invariantifyObject } from "~/tools/invariantify";
import wrapError from "~/tools/wrapError";

/**
 * PartitionURI is an universal identifier for a partition. Different parts of the URI define
 * different aspects of the partition.
 *
 * URI scheme part: denotes the main partition storage strategy. One of the following:
 *   - "valaa-memory": partition resides in memory and will not survive across restarts.
 *     authority part must be empty, thus making this URI not a URL.
 *   - "valaa-transient": deprecated alias for valaa-memory
 *   - "valaa-local": partition is local to the client device but is persisted.
 *     authority part must be empty, thus making this URI not a URL.
 *   Future candidate schemes:
 *   - "valaa": partition location is not specified (authority part must be empty). The authority
 *     for this partition must be known by the surrounding context.
 *
 * URI authority part: contains the location of the authority backend for this partition.
 *
 * URI path part: TODO(iridian): is partition id stored here?
 *
 * URI query part: TODO(iridian): is partition id stored here? maybe id=partitionId?
 *
 * URI fragment part: TODO(iridian): Used for anything
 *
 * If partition URI is an URL and contains
 * a network authority part
 */
export type PartitionURI = URL;

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
 * @returns {PartitionURI}
 */
export function createPartitionURI (baseString: string, partitionRawId: ?string): PartitionURI {
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

export function getValaaURI (uri: URL | string): URL {
  if (typeof uri === "string") return createValaaURI(uri);
  return uri;
}

export function createValaaURI (uriString: string): URL {
  if (typeof uriString !== "string") return undefined;
  try {
    const ret = new URL(uriString, null, true);
    // if (!ret.searchParams && ret.search) ret.searchParams = new URLSearchParams(ret.search);
    return ret;
  } catch (error) {
    throw wrapError(error, `During createValaaURI('${String(uriString)}')`);
  }
}

export function getURIQueryField (uri: URL | string, fieldName: string): ?any {
  if (uri instanceof URL) return uri;
  const valaaURI = createValaaURI(String(uri));
  return valaaURI.query && valaaURI.query[fieldName];
  /*
  const searchParams = valaaURI.searchParams
      || (valaaURI.search ? new URLSearchParams(valaaURI.search) : undefined);
  return searchParams && searchParams.get(fieldName);
  */
}

export function getPartitionRawIdFrom (partitionURI: PartitionURI): string {
  if ((typeof partitionURI !== "object") || !partitionURI || !partitionURI.href) {
    invariantifyObject(partitionURI, "partitionURI", { instanceof: URL, allowEmpty: true });
  }
  return decodeURIComponent(partitionURI.query.id);
}

export function getPartitionAuthorityURIStringFrom (partitionURI: PartitionURI): string {
  return `${partitionURI.protocol}${partitionURI.host ? `//${partitionURI.host}` : ""}${
      partitionURI.pathname}`;
}

export function createLocalPartitionURIFromRawId (rawId: string): PartitionURI {
  return createPartitionURI("valaa-local:", rawId);
}

export function createMemoryPartitionURIFromRawId (rawId: string): PartitionURI {
  return createPartitionURI("valaa-memory:", rawId);
}

export function createTransientPartitionURIFromRawId (rawId: string): PartitionURI {
  return createPartitionURI("valaa-transient:", rawId);
}

export function createTestPartitionURIFromRawId (rawId: string): PartitionURI {
  return createPartitionURI("valaa-test:", rawId);
}
