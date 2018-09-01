// @flow

import { isCreatedLike } from "~/raem/command";
import { VRef, getRawIdFrom } from "~/raem/ValaaReference";

import type { MediaInfo, RetrieveMediaContent } from "~/prophet/api/Prophet";

import { dumpObject, invariantifyString, thenChainEagerly, vdon } from "~/tools";
import { encodeDataURI } from "~/tools/html5/urlEncode";
import type MediaDecoder from "~/tools/MediaDecoder";
import { stringFromUTF8ArrayBuffer } from "~/tools/textEncoding";

import type { BlobInfo } from "./_databaseOps";
import Scribe from "./Scribe";
import ScribePartitionConnection from "./ScribePartitionConnection";

export const vdoc = vdon({
  "...": { heading:
    "Content ops manage shared media content and blob buffer storage lifetimes and decoding",
  },
  0: [`Content ops are detail of Scribe and ScribePartitionConnection.`],
});

export type MediaEntry = {
  mediaId: string, // Scribe-specific info fields
  mediaInfo: MediaInfo,
  isPersisted: boolean,
  isInMemory: boolean,
  nativeContent?: any,
};

export type MediaLookup = {
  [mediaRawId: string]: MediaEntry
};

// Blob pathways - mostly Scribe detail

// ScribePartitionConnection & Media content pathways

export function _reprocessMedia (connection: ScribePartitionConnection, mediaEvent: Object,
    retrieveMediaContent: RetrieveMediaContent, rootEvent: Object, mediaId: VRef,
    currentEntry: MediaEntry) {
  const mediaRawId = mediaId.rawId();
  let mediaInfo;
  let newEntry: MediaEntry;
  if (currentEntry) {
    mediaInfo = { ...currentEntry.mediaInfo };
    newEntry = { ...currentEntry, mediaInfo, nativeContent: undefined };
  } else {
    if (mediaId.isInherited()) {
      mediaInfo = { ...connection._getMediaEntry(mediaId).mediaInfo };
    } else if (isCreatedLike(mediaEvent)) {
      mediaInfo = {};
    } else {
      throw new Error(`mediaEvent has no previous media entry and ${
          ""}event is not CREATED, DUPLICATED and resource is not ghost`);
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
  if (update.content) mediaInfo.blobId = getRawIdFrom(update.content);

  if (!retrieveMediaContent) return [];

  const tryRetrieve = async () => {
    try {
      if (mediaInfo.blobId && connection._prophet.tryGetCachedBlobContent(mediaInfo.blobId)) {
        if (currentEntry && (currentEntry.mediaInfo.blobId === mediaInfo.blobId)) {
          // content is in blob buffer cache with equal blobId. Reuse.
          newEntry.nativeContent = currentEntry.nativeContent;
        }
      } else if (mediaInfo.blobId || mediaInfo.sourceURL) {
        // TODO(iridian): Determine whether media content should be pre-cached or not.
        const content = await retrieveMediaContent(mediaId, mediaInfo);
        if (typeof content !== "undefined") {
          newEntry.nativeContent = content;
          const { persistProcess } = connection.prepareBlob(newEntry.nativeContent, mediaInfo);
          await persistProcess;
        }
      }
      // Delays actual media info content update into a finalizer function so that recordTruth
      // can be sure event has been persisted before updating mediaInfo blob references
      invariantifyString(newEntry.mediaId, "readPersistAndUpdateMedia.newEntry.mediaId",
          {}, "\n\tnewEntry", newEntry);
      return () => connection._persistMediaEntry(newEntry, currentEntry);
    } catch (error) {
      throw connection.wrapErrorEvent(error, `reprocessMedia.tryRetrieve('${mediaInfo.name}'/'${
              mediaInfo.blobId || mediaInfo.sourceURL}')`,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo));
    }
  };

  return [_retrieveMedia.bind(null, connection, {
    mediaInfo,
    tryRetrieve,
    initialAttempt: tryRetrieve(),
  })];
}

async function _retrieveMedia (connection: ScribePartitionConnection,
    { mediaInfo, tryRetrieve, initialAttempt }, options:
        { getNextBackoffSeconds?: Function, retryTimes?: number, delayBaseSeconds?: number } = {}
) {
  let previousBackoff;
  let getNextBackoffSeconds = options.getNextBackoffSeconds;
  if (!getNextBackoffSeconds && (typeof options.retryTimes === "number")) {
    getNextBackoffSeconds = (previousRetries: number) =>
        (previousRetries < options.retryTimes
            ? (previousBackoff || 0) + (previousRetries * (options.delayBaseSeconds || 1))
            : undefined);
  }
  if (!getNextBackoffSeconds) getNextBackoffSeconds = (() => undefined);

  let i = 0;
  for (let currentAttempt = initialAttempt; ++i; currentAttempt = tryRetrieve()) {
    try {
      const persistMedia = await currentAttempt;
      await persistMedia();
      break;
    } catch (error) {
      const nextBackoff = getNextBackoffSeconds
          && getNextBackoffSeconds(i - 1, mediaInfo, error);
      const wrappedError = connection.wrapErrorEvent(error,
          `takeNextPendingDownstreamTruth.scribe.retrieveMedia("${mediaInfo.name}") attempt#${i}`,
          "\n\tmedia name:", mediaInfo.name,
          "\n\tmediaInfo:", mediaInfo,
          ...(i > 1 ? ["\n\tbackoff was:", previousBackoff] : []),
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
}

async function _waitBackoff (backoffSeconds: number) {
  await new Promise(resolve => { setTimeout(() => { resolve(); }, backoffSeconds * 1000); });
}

// Returns the requested media content immediately as a native object if it is in in-memory cache.
// Otherwise if the media is in a local persisted cache returns a promise to a native object.
// Otherwise is known in the partition returns undefined.
// Otherwise throws an error.
export function _readMediaContent (connection: ScribePartitionConnection, mediaId: VRef,
    mediaEntry: MediaEntry, mediaInfo: MediaInfo, onError: Function): any {
  // Only return cached in-memory nativeContent if its id matches the requested id.
  if (mediaEntry
      && (typeof mediaEntry.nativeContent !== "undefined")
      && (mediaInfo.blobId === mediaEntry.mediaInfo.blobId)) {
    return mediaEntry.nativeContent;
  }
  if (!mediaInfo.blobId) return undefined;
  return thenChainEagerly(
      connection._prophet.readBlobContent(mediaInfo.blobId),
      (buffer) => {
        if (!buffer) return undefined;
        // nativeContent should go in favor of blobInfo decoded contents
        const nativeContent = _nativeObjectFromBufferAndMediaInfo(buffer, mediaInfo);
        if (mediaEntry && (mediaInfo.blobId === mediaEntry.mediaInfo.blobId)) {
          mediaEntry.nativeContent = nativeContent;
        }
        return nativeContent;
      },
      onError.bind(connection));
}

export function _decodeMediaContent (connection: ScribePartitionConnection, mediaId: VRef,
    mediaInfo: MediaInfo, decoder: MediaDecoder, onError: Function): any {
  const name = mediaInfo.name ? `'${mediaInfo.name}'` : `unnamed media`;
  return thenChainEagerly(
      connection._prophet.decodeBlobContent(mediaInfo.blobId, decoder,
          { mediaName: name, partitionName: connection.getName() }),
      undefined,
      onError.bind(connection));
}

export function _decodeBlobContent (scribe: Scribe, blobInfo: BlobInfo,
    decoder: MediaDecoder, contextInfo?: Object, onError: Function) {
  const cacheHit = blobInfo.decodings && blobInfo.decodings.get(decoder);
  if (cacheHit) return cacheHit;
  return thenChainEagerly(scribe.readBlobContent(blobInfo.blobId), [
    (buffer) => (typeof buffer === "undefined"
        ? undefined
        : decoder.decode(buffer, contextInfo)),
    (decodedContent) => {
      if (typeof decodedContent !== "undefined") {
        if (!blobInfo.decodings) blobInfo.decodings = new WeakMap();
        blobInfo.decodings.set(decoder, decodedContent);
      }
      return decodedContent;
    },
  ], onError.bind(scribe));
}

export function _getMediaURL (connection: ScribePartitionConnection, mediaId: VRef,
    mediaInfo?: MediaInfo, mediaEntry: MediaEntry): any {
  let nativeContent;
  // Only use cached in-memory nativeContent if its id matches the requested id.
  if ((!mediaInfo || !mediaInfo.blobId || (mediaInfo.blobId === mediaEntry.mediaInfo.blobId))
      && (typeof mediaEntry.nativeContent !== "undefined")) {
    nativeContent = mediaEntry.nativeContent;
  } else {
    const blobId = (mediaInfo && mediaInfo.blobId) || mediaEntry.mediaInfo.blobId;
    if (!blobId) return undefined;
    const bufferCandidate = connection._prophet.tryGetCachedBlobContent(blobId);
    nativeContent = bufferCandidate &&
        _nativeObjectFromBufferAndMediaInfo(bufferCandidate, mediaInfo || mediaEntry.mediaInfo);
    if (blobId === mediaEntry.mediaInfo.blobId) {
      mediaEntry.nativeContent = nativeContent;
    }
  }
  if ((typeof nativeContent === "string") && nativeContent.length < 10000) {
    // TODO(iridian): Is there a use case to create data URI's for json types?
    const { type, subtype } = mediaInfo || mediaEntry.mediaInfo;
    return encodeDataURI(nativeContent, type, subtype);
  }
  // TODO(iridian): With systems that support Service Workers we return URL's which the service
  // workers recognize and can redirect to 'smooth' IndexedDB accesses, see
  // https://gist.github.com/inexorabletash/687e7c5914049536f5a3
  // ( https://www.google.com/search?q=url+to+indexeddb )
  // Otherwise IndexedDB can't be accessed by the web pages directly, but horrible hacks must be
  // used like so:
  // https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
  return undefined;
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
