// @flow

import { isCreatedLike } from "~/raem/command";
import { VRef, getRawIdFrom } from "~/raem/ValaaReference";

import type { MediaInfo, RetrieveMediaContent } from "~/prophet/api/Prophet";

import { dumpObject, invariantifyString, thenChainEagerly, vdon } from "~/tools";
import { encodeDataURI } from "~/tools/html5/dataURI";
import type MediaDecoder from "~/tools/MediaDecoder";
import { stringFromUTF8ArrayBuffer } from "~/tools/textEncoding";

import type { BvobInfo } from "./_databaseOps";
import Scribe from "./Scribe";
import ScribePartitionConnection from "./ScribePartitionConnection";

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
 ######  #    #  ######  #    #   #####
 #       #    #  #       ##   #     #
 #####   #    #  #####   # #  #     #
 #       #    #  #       #  # #     #
 #        #  #   #       #   ##     #
 ######    ##    ######  #    #     #
*/

export function _initiateMediaRetrievals (connection: ScribePartitionConnection, mediaEvent: Object,
    retrieveMediaContent: RetrieveMediaContent, rootEvent: Object, mediaId: VRef,
    currentEntry: MediaEntry) {
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
  connection._pendingMediaLookup[mediaRawId] = newEntry;

  const update = mediaEvent.initialState || mediaEvent.sets || {};
  if (update.name) mediaInfo.name = update.name;
  if (update.mediaType) {
    const mediaType = (typeof update.mediaType === "string")
        ? connection._prophet._mediaTypes[getRawIdFrom(update.mediaType)]
        : update.mediaType;
    Object.assign(mediaInfo, mediaType);
  }
  if (update.content) mediaInfo.bvobId = getRawIdFrom(update.content);

  if (!retrieveMediaContent) return [];

  const tryRetrieveAndPersist = async () => {
    try {
      if (mediaInfo.bvobId && !connection._prophet.tryGetCachedBvobContent(mediaInfo.bvobId)) {
        // TODO(iridian): Determine whether media content should be pre-cached or not.
        const content = await retrieveMediaContent(mediaId, { ...mediaInfo,
          type: "application", subtype: "octet-stream", mime: "application/octet-stream",
        });
        if (typeof content !== "undefined") {
          await connection.prepareBvob(content, mediaInfo).persistProcess;
        }
      }
      // Delays actual media info content update into a finalizer function so that recordTruth
      // can be sure event has been persisted before updating mediaInfo bvob references
      invariantifyString(newEntry.mediaId, "readPersistAndUpdateMedia.newEntry.mediaId",
          {}, "\n\tnewEntry", newEntry);
    } catch (error) {
      throw connection.wrapErrorEvent(error,
          `reprocessMedia.tryRetrieveAndPersist('${mediaInfo.name}'/'${
              mediaInfo.bvobId || mediaInfo.sourceURL}')`,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo));
    }
  };

  return [_retryRetrieveMedia.bind(null, connection, {
    newEntry,
    tryRetrieveAndPersist,
    initialTry: tryRetrieveAndPersist(),
  })];
}

async function _retryRetrieveMedia (connection: ScribePartitionConnection,
    { newEntry, tryRetrieveAndPersist, initialTry }, options:
        { getNextBackoffSeconds?: Function, retryTimes?: number, delayBaseSeconds?: number } = {}
) {
  const mediaInfo = newEntry.mediaInfo;
  let previousBackoff;
  let getNextBackoffSeconds = options.getNextBackoffSeconds;
  if (!getNextBackoffSeconds && (typeof options.retryTimes === "number")) {
    getNextBackoffSeconds = (previousRetries: number, mediaInfo_, error) =>
        ((previousRetries >= options.retryTimes) || (error && error.noRetry) ? undefined
            : error && error.instantRetry ? 0
            : (previousBackoff || 0) + (previousRetries * (options.delayBaseSeconds || 1)));
  }
  if (!getNextBackoffSeconds) getNextBackoffSeconds = (() => undefined);

  let i = 0;
  for (let currentTry = initialTry; ++i; currentTry = tryRetrieveAndPersist()) {
    try {
      await currentTry;
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
 #####   ######   ####   #    #  ######   ####    #####
 #    #  #       #    #  #    #  #       #          #
 #    #  #####   #    #  #    #  #####    ####      #
 #####   #       #  # #  #    #  #            #     #
 #   #   #       #   #   #    #  #       #    #     #
 #    #  ######   ### #   ####   ######   ####      #
*/

export function _decodeBvobContent (scribe: Scribe, bvobInfo: BvobInfo,
    decoder: MediaDecoder, contextInfo?: Object, onError: Function) {
  const cacheHit = bvobInfo.decodings && bvobInfo.decodings.get(decoder);
  if (cacheHit) return cacheHit;
  return thenChainEagerly(scribe.readBvobContent(bvobInfo.bvobId), [
    (buffer) => (typeof buffer === "undefined"
        ? undefined
        : decoder.decode(buffer, contextInfo)),
    (decodedContent) => {
      if (typeof decodedContent !== "undefined") {
        if (!bvobInfo.decodings) bvobInfo.decodings = new WeakMap();
        bvobInfo.decodings.set(decoder, decodedContent);
      }
      return decodedContent;
    },
  ], onError);
}

export function _requestMediaContents (connection: ScribePartitionConnection,
    mediaInfos: MediaInfo[], onError: Function) {
  return mediaInfos.map(mediaInfo => {
    const onErrorWInfo = error => onError(error, mediaInfo);
    try {
      const mediaEntry = connection._getMediaEntry(mediaInfo.mediaId, !!mediaInfo.asURL);
      if (mediaInfo.asURL) {
        if ((mediaInfo.asURL === true) || (mediaInfo.asURL === "data")
            || ((mediaInfo.asURL === "source") && !connection.isRemote())) {
          return _getMediaURL(connection, mediaInfo, mediaEntry, onErrorWInfo);
        }
        return undefined;
      }
      let actualInfo = mediaInfo;
      if (!actualInfo.bvobId) {
        if (!mediaEntry || !mediaEntry.mediaInfo) {
          throw new Error(`Cannot find Media info for '${String(mediaInfo.mediaId)}'`);
        }
        actualInfo = { ...mediaInfo, ...mediaEntry.mediaInfo };
      }
      if (!mediaInfo.type) {
        return _readMediaContent(connection, actualInfo, mediaEntry, onErrorWInfo);
      }
      if (!actualInfo.bvobId) return undefined;
      if (actualInfo.sourceURL) {
        throw new Error(`Cannot explicitly decode sourceURL-content as '${mediaInfo.mime}'`);
      }
      const decoder = connection._decoderArray.findDecoder(actualInfo);
      if (!decoder) {
        throw new Error(`Can't find decoder for ${actualInfo.type}/${actualInfo.subtype}`);
      }
      const name = actualInfo.name ? `'${mediaInfo.name}'` : `unnamed media`;
      return thenChainEagerly(
        connection._prophet.decodeBvobContent(actualInfo.bvobId, decoder,
              { mediaName: name, partitionName: connection.getName() }),
          undefined,
          onErrorWInfo);
    } catch (error) {
      error.mediaInfo = mediaInfo;
      throw error;
    }
  });
}

const maxDataURISourceBytes = 48000;

function _getMediaURL (connection: ScribePartitionConnection, mediaInfo: MediaInfo,
    mediaEntry: MediaEntry, onError: Function): any {
  // Only use cached in-memory nativeContent if its id matches the requested id.
  const bvobId = (mediaInfo && mediaInfo.bvobId) || mediaEntry.mediaInfo.bvobId;
  const bvobInfo = connection._prophet._bvobLookup[bvobId || ""];
  // Media's with sourceURL or too large/missing bvobs will be handled by Oracle
  if (!bvobInfo) {
    if (mediaInfo.asURL === "data") {
      throw new Error(`Cannot create a data URI for Media ${mediaInfo.name
          }: can't find Bvob info for ${bvobId}`);
    }
    return undefined;
  }
  if ((mediaInfo.asURL !== "data") && !(bvobInfo.byteLength <= maxDataURISourceBytes)) {
    if (connection.isRemote()) return undefined;
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
  return thenChainEagerly(connection._prophet.readBvobContent(bvobId),
      (buffer => {
        if (!buffer) {
          if (mediaInfo.asURL === "data") {
            throw new Error(`Cannot create a data URI for Media ${mediaInfo.name
                }: can't read Bvob content for ${bvobId}`);
          }
        }
        const { type, subtype } = mediaInfo || mediaEntry.mediaInfo;
        return encodeDataURI(buffer, type, subtype);
      })
      , onError);
}

// Returns the requested media content immediately as a native object if it is in in-memory cache.
// Otherwise if the media is in a local persisted cache returns a promise to a native object.
// Otherwise is known in the partition returns undefined.
// Otherwise throws an error.
function _readMediaContent (connection: ScribePartitionConnection, mediaInfo: MediaInfo,
    mediaEntry: MediaEntry, onError: Function): any {
  const bvobId = mediaInfo.bvobId;
  if (!bvobId) return undefined;
  return thenChainEagerly(connection._prophet.readBvobContent(bvobId),
      (buffer) => (!buffer ? undefined : _nativeObjectFromBufferAndMediaInfo(buffer, mediaInfo)),
      onError);
}

function _nativeObjectFromBufferAndMediaInfo (buffer: ArrayBuffer, mediaInfo?:
    { type?: string, subtype?: string, name?: string
  /* TODO(iridian): any other types we'd need for
    https://html.spec.whatwg.org/multipage/parsing.html#determining-the-character-encoding ?
  */ }) {
  // TODO(iridian): This is a quick hack for common types: we should really obey the above practice.
  if (!mediaInfo) return buffer;
  if (_isTextType(mediaInfo)) {
    const text = stringFromUTF8ArrayBuffer(buffer);
    if (mediaInfo.subtype === "json") return JSON.parse(text);
    return text;
  }
  return buffer;
}

function _isTextType ({ type, subtype }: { type: string, subtype: string }) {
  if (type === "text") return true;
  if (type === "application") return _applicationTextSubtypes[subtype];
  return false;
}

const _applicationTextSubtypes: any = {
  valaascript: true,
  "x-javascript": true,
  javascript: true,
  ecmascript: true,
  vsx: true,
  jsx: true,
};
