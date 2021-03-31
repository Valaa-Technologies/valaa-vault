// @flow

import { isCreatedLike } from "~/raem/events";
import VRL, { getRawIdFrom } from "~/raem/VRL";

import { MediaInfo, RetrieveMediaBuffer } from "~/sourcerer/api/types";
import { tryAspect } from "~/sourcerer/tools/EventAspects";

import { DelayedQueue, dumpObject, invariantifyString, mapEagerly, thenChainEagerly, vdon }
    from "~/tools";
import { encodeDataURI } from "~/tools/html5/dataURI";

import Scribe from "./Scribe";
import ScribeConnection from "./ScribeConnection";

import { BvobInfo } from "./_databaseOps";

export const vdoc = vdon({
  "...": { heading:
    "Content ops manage shared media content and bvob buffer storage lifetimes and decoding",
  },
  0: [`Content ops are detail of Scribe and ScribeConnection.`],
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

export function _preCacheBvob (scribe: Scribe, contentHash: string, newInfo: BvobInfo,
    retrieveBvobContent: Function, initialPersistRefCount: number) {
  const bvobInfo = scribe._bvobLookup[contentHash];
  if (bvobInfo) {
    // This check produces false positives: if byteLengths match there is no error even if
    // the contents might still be inconsistent.
    if ((bvobInfo.byteLength !== newInfo.byteLength)
        && (bvobInfo.byteLength !== undefined) && (newInfo.byteLength !== undefined)) {
      throw new Error(`byteLength mismatch between new bvob (${newInfo.byteLength
          }) and existing bvob (${bvobInfo.byteLength}) while precaching bvob "${contentHash}"`);
    }
    return undefined;
  }
  return thenChainEagerly(
      retrieveBvobContent(contentHash),
      buffer => (buffer !== undefined)
          && scribe._writeBvobBuffer(buffer, contentHash, initialPersistRefCount));
}

const defaultRetries = 3;

export function _prepareBvob (connection: ScribeConnection, content: any, buffer, contentHash,
    mediaInfo: MediaInfo = {}, onError: Function) {
  if (!mediaInfo.contentHash) {
    mediaInfo.contentHash = contentHash;
  } else if (mediaInfo.contentHash !== contentHash) {
    connection.errorEvent(
        `\n\tINTERNAL ERROR: contentHash mismatch when preparing bvob for Media '${
            mediaInfo.name}', CONTENT IS NOT PERSISTED`,
        "\n\tactual content sha512 hash:", contentHash,
        "\n\tbased on content:", ...dumpObject({ content }),
        "\n\texpected contentHash:", mediaInfo.contentHash,
        "\n\tbased on mediaInfo:", ...dumpObject(mediaInfo),
    );
    return {};
  }

  const mediaName = mediaInfo && (mediaInfo.name ? `"${mediaInfo.name}"` : contentHash);

  const pendingBvobInfo = connection._pendingBvobLookup[contentHash]
      || (connection._pendingBvobLookup[contentHash] = {});

  if ((mediaInfo.prepareBvobToUpstream !== false)
      && (pendingBvobInfo.upstreamPrepareBvobProcess === undefined)) {
    // Begin the retrying Bvob upstream preparation process.
    pendingBvobInfo.upstreamPrepareBvobProcess = thenChainEagerly(
        _prepareBvobToUpstreamWithRetries(connection, buffer, mediaInfo, mediaName,
            new Error(`_prepareBvobToUpstreamWithRetries(${mediaName})`),
            defaultRetries),
        (result) => (pendingBvobInfo.upstreamPrepareBvobProcess = result),
        onError,
    );
  }

  if (pendingBvobInfo.persistProcess === undefined) {
    pendingBvobInfo.persistProcess = thenChainEagerly(null, [
      () => {
        if (connection.isLocallyRecorded()) {
          return connection.getScribe()._writeBvobBuffer(buffer, contentHash);
        }
        if (pendingBvobInfo.upstreamPrepareBvobProcess !== undefined) {
          return pendingBvobInfo.upstreamPrepareBvobProcess;
        }
        throw new Error(`Can't prepare bvob locally (chronicle isLocallyRecorded is falsy) ${
            ""}and upstream prepare is not available.`);
      },
      (persistedContentHash) => (pendingBvobInfo.persistProcess = persistedContentHash),
    ], onError);
  }
  return { ...pendingBvobInfo, content, buffer, contentHash };
}

function _prepareBvobToUpstreamWithRetries (connection: ScribeConnection,
    buffer: ArrayBuffer | (() => ArrayBuffer), mediaInfo: MediaInfo,
    mediaName: string, contextName: Error, retriesRemaining: number,
) {
  // TODO(iridian, 2019-01): This should use active connection, but
  // right at this moment I don't dare to take the risk of deadlock.
  // return thenChainEagerly(connection.getUpstreamConnection().asSourceredConnection(), [
  return thenChainEagerly(connection.getUpstreamConnection(), [
    upstream => upstream.prepareBvob(buffer, mediaInfo),
    preparation => preparation.persistProcess,
  ], errorOnScribePrepareBvobToUpstream);
  function errorOnScribePrepareBvobToUpstream (error) {
    const wrappedError = connection.wrapErrorEvent(error, 1, contextName,
        "\n\tmediaInfo:", ...dumpObject(mediaInfo),
    );
    const response = error.response;
    if (response && error.isRetryable === undefined) {
      error.isRetryable = _isRetryableStatus[response.status];
    }
    if (error.isRetryable && (retriesRemaining > 0)) {
      connection.outputErrorEvent(wrappedError,
          `Exception caught while preparing bvob ${mediaName
            } to upstream (retrying with ${retriesRemaining} retries remaining):`);
      return _prepareBvobToUpstreamWithRetries(connection, buffer, mediaInfo, mediaName,
          contextName, retriesRemaining - 1);
    }
    error.isSchismatic = true;
    error.isRevisable = false;
    error.isReformable = false;
    throw wrappedError;
  }
}

const _isRetryableStatus = {
  408: true,
  503: true,
  504: true,
};

/*
#######
#        #    #  ######  #    #   #####
#        #    #  #       ##   #     #
#####    #    #  #####   # #  #     #
#        #    #  #       #  # #     #
#         #  #   #       #   ##     #
#######    ##    ######  #    #     #
*/

export function _determineEventMediaPreOps (connection: ScribeConnection,
    mediaAction: Object, rootEvent: Object, mediaVRL: VRL, currentEntry: MediaEntry) {
  const mediaId = mediaVRL.rawId();
  let mediaInfo;
  let newEntry: MediaEntry;
  const isPersisted = connection.isLocallyRecorded();
  if (currentEntry) {
    mediaInfo = { ...currentEntry.mediaInfo };
    newEntry = { ...currentEntry, mediaInfo };
  } else {
    if (mediaVRL.isInherited()) {
      const mediaEntry = connection._getMediaEntry(mediaVRL, false);
      if (!mediaEntry) {
        console.warn(`Could not determine media entry for media <${
            mediaVRL}>; most likely a ghost media with absent prototype chronicle`);
        return [];
      }
      mediaInfo = { ...mediaEntry.mediaInfo };
    } else if (isCreatedLike(mediaAction)) {
      mediaInfo = {};
    } else {
      // FIXME(iridian): This should throw in principle: this is an
      // indication of a corrupted event log. For now we accept and
      // replay the event logs due to lack of resources for a proper
      // fix - corrupted event logs must be accepted as a fact of life
      // for the time being.
      connection.errorEvent(`mediaAction for media has no previous media entry and ${
              ""}event is not CREATED, DUPLICATED and resource is not ghost`,
          "\n\treplay not blocked but media accesses made against this Media will throw.",
          "\n\tmediaVRL:", String(mediaVRL),
          "\n\tmediaAction:", ...dumpObject(mediaAction),
          "\n\trootEvent:", ...dumpObject(rootEvent));
      return [];
    }
    newEntry = { mediaId, mediaInfo, isPersisted, isInMemory: true };
  }
  newEntry.logIndex = tryAspect(rootEvent, "log").index || 0;
  connection._pendingMediaLookup[newEntry.mediaId] = newEntry;

  const update = mediaAction.initialState || mediaAction.sets || {};
  if (update.name) mediaInfo.name = update.name;
  if (update.mediaType) {
    const mediaType = (typeof update.mediaType === "string")
        ? connection.getScribe()._mediaTypes[getRawIdFrom(update.mediaType)]
        : update.mediaType;
    Object.assign(mediaInfo, mediaType);
  }
  if (update.content) {
    mediaInfo.contentHash = getRawIdFrom(update.content);
    if (mediaInfo.contentHash.slice(0, 8) === "@$~bvob.") {
      mediaInfo.contentHash = mediaInfo.contentHash.slice(8, mediaInfo.contentHash.length - 2);
    }
  }
  return [{ mediaEntry: newEntry }];
}

export async function _retryingTwoWaySyncMediaContent (connection: ScribeConnection,
    mediaEntry: Object, options: {
      getNextBackoffSeconds?: Function, retryTimes?: number, delayBaseSeconds?: number,
      retrieveMediaBuffer: RetrieveMediaBuffer, prepareBvob?: Function,
      blockOnBrokenDownload: boolean,
    } = {},
) {
  const mediaInfo = mediaEntry.mediaInfo;
  let previousBackoff;
  invariantifyString(mediaEntry.mediaId, "_retryingTwoWaySyncMediaContent.mediaEntry.mediaId",
      {}, "\n\tnewEntry", mediaEntry);
  mediaInfo.mediaVRL = (new VRL()).initNSS(mediaEntry.mediaId);
  let getNextBackoffSeconds = options.getNextBackoffSeconds;
  if (!getNextBackoffSeconds && (typeof options.retryTimes === "number")) {
    getNextBackoffSeconds = (previousRetries: number, mediaInfo_, error = {}) =>
        ((previousRetries >= options.retryTimes) || (error.isRetryable === false)
                || (error.statusCode === 404)
            ? undefined
        : error.immediateRetry
            ? 0
            : (previousBackoff || 0) + (previousRetries * (options.delayBaseSeconds || 1)));
  }
  if (!getNextBackoffSeconds) getNextBackoffSeconds = (() => undefined);

  let i = 0;
  let content;
  while (++i) {
    try {
      if (mediaInfo.contentHash) {
        content = content
            || connection.getScribe().tryGetCachedBvobContent(mediaInfo.contentHash)
            || (!options.retrieveMediaBuffer ? undefined
                : (await options.retrieveMediaBuffer(mediaInfo)));
        if ((content !== undefined) && options.prepareBvob) {
        // TODO(iridian): Determine whether media content should be pre-cached or not.
          const preparation = await options.prepareBvob(content, mediaInfo);
          await preparation.persistProcess;
          await preparation.upstreamPrepareBvobProcess;
        }
      }
      return mediaEntry;
    } catch (error) {
      const nextBackoff = getNextBackoffSeconds && getNextBackoffSeconds(i - 1, mediaInfo, error);
      const wrappedError = connection.wrapErrorEvent(error, 1,
          `scribe.retrieveMedia("${mediaInfo.name}") attempt#${i}`,
          "\n\terror.statusCode:", error.statusCode, ", isRetryable:", error.isRetryable,
              ", immediateRetry:", error.immediateRetry,
          "\n\tmedia name:", mediaInfo.name, "mediaInfo:", mediaInfo,
          ...(i > 1 ? ["\n\tbackoff was:", previousBackoff] : []),
          ...((nextBackoff !== undefined)
                  ? ["\n\tnext retry after (seconds):", nextBackoff]
              : ((content === undefined) && (options.blockOnBrokenDownload === false))
                  ? ["\n\tthis was final retry attempt but accepting as broken download",
                    "\n\tcontinuing playback"]
                  : ["\n\tthis was final retry attempt, REJECTING broken download",
                    "\n\tEVENT PLAYBACK BLOCKED"]),
      );
      if (typeof nextBackoff !== "number") {
        if ((content === undefined) && (options.blockOnBrokenDownload === false)) {
          connection.outputErrorEvent(wrappedError,
              "Exception caught for a broken but non-blocking download");
          mediaEntry.downloadStatus = "broken";
          return mediaEntry;
        }
        throw wrappedError;
      }
      connection.outputErrorEvent(wrappedError,
          `Exception caught when downloading content, retrying after ${nextBackoff} seconds`);
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

export function _requestMediaContents (connection: ScribeConnection,
    mediaInfos: MediaInfo[], onError: Function) {
  const upstreamOperation = new DelayedQueue();
  const ret = mediaInfos.map(mediaInfo => {
    const onErrorWInfo = error => onError(error, mediaInfo);
    try {
      const actualInfo = { ...mediaInfo };
      // If contentHash is null or defined then downstream has provided
      // the full mediaInfo.
      if (actualInfo.contentHash === undefined) {
        // the require clause was !!mediaInfo.asURL. Why, though?
        const mediaEntry = connection._getMediaEntry(mediaInfo.mediaVRL, false);
        if (!mediaEntry || !mediaEntry.mediaInfo) {
          throw new Error(`Cannot find Media info for '${String(mediaInfo.mediaVRL)}'`);
        }
        Object.assign(actualInfo, mediaEntry.mediaInfo);
      }
      if (!actualInfo.asURL) {
        return _getMediaContent(connection, actualInfo, upstreamOperation);
      }
      if ((actualInfo.asURL === true)
          || (actualInfo.asURL === "data")
          || ((actualInfo.asURL === "source") && !connection.isRemoteAuthority())) {
        return _getMediaURL(connection, actualInfo, upstreamOperation, onErrorWInfo);
      }
      return undefined;
    } catch (error) {
      error.mediaInfo = mediaInfo;
      throw error;
    }
  });
  if (!upstreamOperation.length) return ret;
  const upstreamInfos = [...upstreamOperation];
  return thenChainEagerly(
      mapEagerly(connection.getUpstreamConnection().requestMediaContents(upstreamInfos),
          entry => entry,
          errorOnScribeConnectionMediaInfo,
      ), [
        results => upstreamOperation.resolve(results),
        () => ret,
      ],
      onError);
  function errorOnScribeConnectionMediaInfo (error, mediaInfo, index) {
    error.upstreamRequest = upstreamInfos;
    error.upstreamIndex = index;
    error.mediaInfo = mediaInfo;
    throw error;
  }
}

function _getMediaContent (connection: ScribeConnection, mediaInfo: MediaInfo,
    upstreamOperation: Object) {
  const actualInfo = { ...mediaInfo };
  const contentHash = actualInfo.contentHash || "";
  const bvobInfo = connection.getScribe()._bvobLookup[contentHash];
  if (bvobInfo) {
    actualInfo.buffer = bvobInfo.buffer || bvobInfo.pendingBuffer
    // TODO(iridian, 2019-05): even ref count 0 is persisted at the
    // moment. Once finalizing the ref count persistence system, fix
    // this site as well.
        || ((bvobInfo.persistRefCount !== undefined)
          && connection.getScribe().readBvobContent(contentHash));
    const isArrayBufferType = !actualInfo.contentType
        || (actualInfo.contentType === "application/octet-stream");
    if (isArrayBufferType && actualInfo.buffer) return actualInfo.buffer;
    if (!isArrayBufferType && !bvobInfo.decodings) bvobInfo.decodings = new WeakMap();
    // Even if the decoding could be found from the cache we have to forward the call to
    // upstream. Only Oracle knows about the decoders which acts as the weak map key for
    // the cached decoding.
    // Oracle will add the decoding into decodingCache if it didn't exist yet.
    actualInfo.decodingCache = bvobInfo.decodings;
    if (actualInfo.buffer) {
      // If we have buffer available locally request a decoding synchronously.
      return connection.getUpstreamConnection().requestMediaContents([actualInfo])[0];
    }
  }
  return upstreamOperation.push(actualInfo)[0];
}

const maxDataURISourceBytes = 48000;

function _getMediaURL (connection: ScribeConnection, mediaInfo: MediaInfo,
    upstreamOperation: Object, onError: Function): any {
  // Only use cached in-memory nativeContent if its id matches the requested id.
  const contentHash = mediaInfo.contentHash || "";
  const bvobInfo = connection.getScribe()._bvobLookup[contentHash];
  // Media's with sourceURL or too large/missing bvobs will be handled by Oracle
  if (!bvobInfo) {
    if (mediaInfo.asURL === "data") {
      throw new Error(`Cannot create a data URI for Media ${mediaInfo.name
          }: can't find Bvob info for ${contentHash}`);
    }
    return upstreamOperation.push(mediaInfo)[0];
  }
  if ((mediaInfo.asURL !== "data") && !(bvobInfo.byteLength <= maxDataURISourceBytes)) {
    if (connection.isRemoteAuthority()) return upstreamOperation.push(mediaInfo)[0];
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
  return thenChainEagerly(connection.getScribe().readBvobContent(contentHash),
      (buffer => {
        if (!buffer) {
          if (mediaInfo.asURL === "data") {
            throw new Error(`Cannot create a data URI for Media ${mediaInfo.name
                }: can't read Bvob content for ${contentHash}`);
          }
        }
        const { type, subtype } = mediaInfo;
        return encodeDataURI(buffer, type, subtype);
      }),
      onError);
}
