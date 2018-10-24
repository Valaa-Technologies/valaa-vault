// @flow

import { isCreatedLike } from "~/raem/command";
import { VRef, getRawIdFrom } from "~/raem/ValaaReference";

import type { MediaInfo, RetrieveMediaBuffer } from "~/prophet/api/Prophet";

import { addDelayedOperationEntry, dumpObject, invariantifyString, thenChainEagerly, vdon }
    from "~/tools";
import { encodeDataURI } from "~/tools/html5/dataURI";
import { bufferAndContentIdFromNative } from "~/tools/textEncoding";

import Scribe from "./Scribe";
import ScribePartitionConnection from "./ScribePartitionConnection";

import { BvobInfo } from "./_databaseOps";

export const vdoc = vdon({
  "...": { heading:
    "Content ops manage shared media content and bvob buffer storage lifetimes and decoding",
  },
  0: [`Content ops are detail of Scribe and ScribePartitionConnection.`],
});

export type MediaEntry = {
  mediaId: string, // Scribe-specific info fields
  mediaInfo: MediaInfo,
  isPersisted: boolean,
  isInMemory: boolean,
};

export type MediaLookup = {
  [mediaRawId: string]: MediaEntry
};

/*
######
#     #  #    #   ####   #####
#     #  #    #  #    #  #    #
######   #    #  #    #  #####
#     #  #    #  #    #  #    #
#     #   #  #   #    #  #    #
######     ##     ####   #####
*/

export function _preCacheBvob (scribe: Scribe, bvobId: string, newInfo: Object,
    retrieveBvobContent: Function, initialPersistRefCount: number) {
  const bvobInfo = scribe._bvobLookup[bvobId];
  if (bvobInfo) {
    // This check produces false positives: if byteLengths match there is no error even if
    // the contents might still be inconsistent.
    if ((bvobInfo.byteLength !== newInfo.byteLength)
        && (bvobInfo.byteLength !== undefined) && (newInfo.byteLength !== undefined)) {
      throw new Error(`byteLength mismatch between new bvob (${newInfo.byteLength
          }) and existing bvob (${bvobInfo.byteLength}) while precaching bvob "${bvobId}"`);
    }
    return undefined;
  }
  return thenChainEagerly(
      retrieveBvobContent(bvobId),
      buffer => (buffer !== undefined)
          && scribe._writeBvobBuffer(buffer, bvobId, initialPersistRefCount));
}

export function _prepareBvob (connection: ScribePartitionConnection, content: any,
    mediaInfo: MediaInfo = {}, onError: Function) {
  const { buffer, contentId } = bufferAndContentIdFromNative(content, mediaInfo);
  if (mediaInfo && mediaInfo.bvobId && (mediaInfo.bvobId !== contentId)) {
    connection.errorEvent(`\n\tINTERNAL ERROR: bvobId mismatch when preparing bvob for Media '${
            mediaInfo.name}', CONTENT IS NOT PERSISTED`,
        "\n\tactual content id:", contentId,
        "\n\trequested bvobId:", mediaInfo.bvobId,
        "\n\tmediaInfo:", ...dumpObject(mediaInfo),
        "\n\tcontent:", ...dumpObject({ content }),
    );
    return {};
  }
  mediaInfo.bvobId = contentId;

  const pendingBvobInfo = connection._pendingBvobLookup[contentId]
      || (connection._pendingBvobLookup[contentId] = {});
  if (!pendingBvobInfo.persistProcess) {
    pendingBvobInfo.persistProcess = thenChainEagerly(
        connection._prophet._writeBvobBuffer(buffer, contentId),
        (persistedContentId) => (pendingBvobInfo.persistProcess = persistedContentId),
        onError,
    );
  }
  if (!pendingBvobInfo.prepareBvobUpstreamProcess) {
    // Begin the retrying Bvob upstream preparation process.
    pendingBvobInfo.prepareBvobUpstreamProcess = thenChainEagerly(
        _prepareBvobUpstreamWithRetries(connection, buffer, mediaInfo),
        (result) => (pendingBvobInfo.prepareBvobUpstreamProcess = result),
        onError,
    );
  }

  return { ...pendingBvobInfo, content, buffer, contentId };
}

async function _prepareBvobUpstreamWithRetries (connection: ScribePartitionConnection,
    buffer: ArrayBuffer | (() => ArrayBuffer), mediaInfo: MediaInfo,
) {
  let wrappedError;
  for (let retries = 3; ; --retries) {
    try {
      return await connection.getUpstreamConnection().prepareBvob(buffer, mediaInfo).persistProcess;
    } catch (error) {
      wrappedError = connection.wrapErrorEvent(error,
          `prepareBvobUpstreamProcess(${
              mediaInfo.name ? `"${mediaInfo.name}"` : mediaInfo.bvobId})`,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
      );
      if (!retries) throw wrappedError;
      connection.outputErrorEvent(wrappedError, "\n\tretrying upload");
    }
  }
}

/*
#######
#        #    #  ######  #    #   #####
#        #    #  #       ##   #     #
#####    #    #  #####   # #  #     #
#        #    #  #       #  # #     #
#         #  #   #       #   ##     #
#######    ##    ######  #    #     #
*/

export function _determineEventMediaPreOps (connection: ScribePartitionConnection,
    mediaEvent: Object, rootEvent: Object, mediaId: VRef, currentEntry: MediaEntry) {
  const mediaRawId = mediaId.rawId();
  let mediaInfo;
  let newEntry: MediaEntry;
  if (currentEntry) {
    mediaInfo = { ...currentEntry.mediaInfo };
    newEntry = { ...currentEntry, mediaInfo };
  } else {
    if (mediaId.isInherited()) {
      mediaInfo = { ...connection._getMediaEntry(mediaId).mediaInfo };
    } else if (isCreatedLike(mediaEvent)) {
      mediaInfo = {};
    } else {
      // FIXME(iridian): This should throw in principle: this is an indication of a corrupted
      // event log. For now we accept and replay the event logs due to lack of resources for
      // a proper fix - corrupted event logs must be accepted as a fact of life for the time
      // being.
      connection.errorEvent(`mediaEvent for media has no previous media entry and ${
              ""}event is not CREATED, DUPLICATED and resource is not ghost`,
          "\n\treplay not blocked but media accesses made against this Media will throw.",
          "\n\tmediaId:", String(mediaId),
          "\n\tmediaEvent:", ...dumpObject(mediaEvent),
          "\n\trootEvent:", ...dumpObject(rootEvent));
      return [];
    }
    newEntry = {
      mediaId: mediaRawId, mediaInfo, isPersisted: true, isInMemory: true,
    };
  }

  const update = mediaEvent.initialState || mediaEvent.sets || {};
  if (update.name) mediaInfo.name = update.name;
  if (update.mediaType) {
    const mediaType = (typeof update.mediaType === "string")
        ? connection._prophet._mediaTypes[getRawIdFrom(update.mediaType)]
        : update.mediaType;
    Object.assign(mediaInfo, mediaType);
  }
  if (update.content) mediaInfo.bvobId = getRawIdFrom(update.content);
  return [{ mediaId: newEntry.mediaId, preOp: _retrySyncMedia.bind(null, connection, newEntry) }];
}

async function _retrySyncMedia (connection: ScribePartitionConnection, newEntry: Object,
  options: {
    getNextBackoffSeconds?: Function, retryTimes?: number, delayBaseSeconds?: number,
    retrieveMediaBuffer: RetrieveMediaBuffer,
  } = {},
) {
  connection._pendingMediaLookup[newEntry.mediaId] = newEntry;

  const mediaInfo = newEntry.mediaInfo;
  let previousBackoff;
  invariantifyString(newEntry.mediaId, "readPersistAndUpdateMedia.newEntry.mediaId",
      {}, "\n\tnewEntry", newEntry);
  mediaInfo.mediaId = newEntry.mediaId;
  let getNextBackoffSeconds = options.getNextBackoffSeconds;
  if (!getNextBackoffSeconds && (typeof options.retryTimes === "number")) {
    getNextBackoffSeconds = (previousRetries: number, mediaInfo_, error) =>
        ((previousRetries >= options.retryTimes) || (error && error.noRetry) ? undefined
            : error && error.instantRetry ? 0
            : (previousBackoff || 0) + (previousRetries * (options.delayBaseSeconds || 1)));
  }
  if (!getNextBackoffSeconds) getNextBackoffSeconds = (() => undefined);

  let i = 0;
  let content;
  while (++i) {
    try {
      if (mediaInfo.bvobId) {
        content = content
            || connection._prophet.tryGetCachedBvobContent(mediaInfo.bvobId)
            || (options.retrieveMediaBuffer && (await options.retrieveMediaBuffer(mediaInfo)));
        if (typeof content !== "undefined") {
        // TODO(iridian): Determine whether media content should be pre-cached or not.
          await connection.prepareBvob(content, mediaInfo).persistProcess;
        }
      }
      return newEntry;
    } catch (error) {
      const nextBackoff = getNextBackoffSeconds && getNextBackoffSeconds(i - 1, mediaInfo, error);
      const wrappedError = connection.wrapErrorEvent(error,
          `scribe.retrieveMedia("${mediaInfo.name}") attempt#${i}`,
          "\n\tmedia name:", mediaInfo.name,
          "\n\tmediaInfo:", mediaInfo,
          ...(i > 1 ? ["\n\tbackoff was:", previousBackoff] : []),
          "\n\terror.noRetry:", error.noRetry, ", error.immediateRetry:", error.immediateRetry,
          ...(typeof nextBackoff === "undefined"
              ? ["\n\tthis was final retry attempt"]
              : ["\n\tnext retry after (seconds):", nextBackoff]),
      );
      if (typeof nextBackoff !== "number") throw wrappedError;
      connection.outputErrorEvent(wrappedError);
      if (i > 1) await _waitBackoff(nextBackoff);
      previousBackoff = nextBackoff;
    }
  }
  return undefined; // We never get here though.
}

async function _waitBackoff (backoffSeconds: number) {
  await new Promise(resolve => { setTimeout(() => { resolve(); }, backoffSeconds * 1000); });
}

/*
######
#     #  ######   ####   #    #  ######   ####    #####
#     #  #       #    #  #    #  #       #          #
######   #####   #    #  #    #  #####    ####      #
#   #    #       #  # #  #    #  #            #     #
#    #   #       #   #   #    #  #       #    #     #
#     #  ######   ### #   ####   ######   ####      #
*/

export function _requestMediaContents (connection: ScribePartitionConnection,
    mediaInfos: MediaInfo[], onError: Function) {
  const upstreamOperation = {};
  const ret = mediaInfos.map(mediaInfo => {
    const onErrorWInfo = error => onError(error, mediaInfo);
    try {
      const mediaEntry = connection._getMediaEntry(mediaInfo.mediaId, !!mediaInfo.asURL);
      const actualInfo = { ...mediaInfo };
      if (!actualInfo.bvobId) {
        if (!mediaEntry || !mediaEntry.mediaInfo) {
          throw new Error(`Cannot find Media info for '${String(mediaInfo.mediaId)}'`);
        }
        Object.assign(actualInfo, mediaEntry.mediaInfo);
      }
      if (!actualInfo.asURL) {
        return _getMediaContent(connection, actualInfo, upstreamOperation);
      }
      if ((actualInfo.asURL === true)
          || (actualInfo.asURL === "data")
          || ((actualInfo.asURL === "source") && !connection.isRemoteAuthority())) {
        return _getMediaURL(connection, actualInfo, mediaEntry, onErrorWInfo);
      }
      return undefined;
    } catch (error) {
      error.mediaInfo = mediaInfo;
      throw error;
    }
  });
  if (!upstreamOperation.entries) return ret;
  return thenChainEagerly(
      upstreamOperation.resolveWith(
          connection.getUpstreamConnection().requestMediaContents(upstreamOperation.entries)),
      () => ret,
      onError);
}

function _getMediaContent (connection: ScribePartitionConnection, mediaInfo: MediaInfo,
    upstreamOperation: Object) {
  const actualInfo = { ...mediaInfo };
  const bvobInfo = connection._prophet._bvobLookup[actualInfo.bvobId || ""];
  if (bvobInfo) {
    actualInfo.buffer = bvobInfo.buffer || bvobInfo.pendingBuffer
        || (bvobInfo.persistRefCount && connection._prophet.readBvobContent(actualInfo.bvobId));
    const isArrayBufferType = !actualInfo.type
        || (actualInfo.type === "application" && actualInfo.subtype === "octet-stream");
    if (isArrayBufferType && actualInfo.buffer) return actualInfo.buffer;
    if (!isArrayBufferType && !bvobInfo.decodings) bvobInfo.decodings = new WeakMap();
    // Even if the decoding could be found from the cache we have to forward the call to
    // upstream. Only Oracle knows about the decoders which acts as the weak map key for
    // the cached decoding.
    // Oracle will add the decoding into decodingCache if it didn't exist yet.
    actualInfo.decodingCache = bvobInfo.decodings;
  }
  return addDelayedOperationEntry(upstreamOperation, actualInfo);
}

const maxDataURISourceBytes = 48000;

function _getMediaURL (connection: ScribePartitionConnection, mediaInfo: MediaInfo,
    onError: Function): any {
  // Only use cached in-memory nativeContent if its id matches the requested id.
  const bvobInfo = connection._prophet._bvobLookup[mediaInfo.bvobId || ""];
  // Media's with sourceURL or too large/missing bvobs will be handled by Oracle
  if (!bvobInfo) {
    if (mediaInfo.asURL === "data") {
      throw new Error(`Cannot create a data URI for Media ${mediaInfo.name
          }: can't find Bvob info for ${mediaInfo.bvobId}`);
    }
    return undefined;
  }
  if ((mediaInfo.asURL !== "data") && !(bvobInfo.byteLength <= maxDataURISourceBytes)) {
    if (connection.isRemoteAuthority()) return undefined;
    connection.warnEvent(`getMediaURL requested on a local Media "${mediaInfo.name
        }" of ${bvobInfo.byteLength} bytes, larger than recommended ${maxDataURISourceBytes
        } bytes for data URI's.`,
        "However as no Service Worker implementation is found returning as large data URI anyway.");
  }
  // TODO(iridian): With systems that support Service Workers we will eventually return URL's which
  // the service workers recognize and can redirect to 'smooth' IndexedDB accesses, see
  // https://gist.github.com/inexorabletash/687e7c5914049536f5a3
  // ( https://www.google.com/search?q=url+to+indexeddb )
  // Otherwise IndexedDB can't be accessed by the web pages directly, but horrible hacks must be
  // used like so:
  // https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
  return thenChainEagerly(connection._prophet.readBvobContent(mediaInfo.bvobId),
      (buffer => {
        if (!buffer) {
          if (mediaInfo.asURL === "data") {
            throw new Error(`Cannot create a data URI for Media ${mediaInfo.name
                }: can't read Bvob content for ${mediaInfo.bvobId}`);
          }
        }
        const { type, subtype } = mediaInfo;
        return encodeDataURI(buffer, type, subtype);
      }),
      onError);
}
