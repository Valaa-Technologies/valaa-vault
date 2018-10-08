// @flow

import type { UniversalEvent } from "~/raem/command";
import { createValaaURI } from "~/raem/ValaaURI";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type { ChronicleOptions, ChronicleEventResult, ConnectOptions, NarrateOptions, MediaInfo }
    from "~/prophet/api/Prophet";

import DecoderArray from "~/prophet/Oracle/DecoderArray";

import { addDelayedOperationEntry, dumpObject, thenChainEagerly } from "~/tools";
// import { stringFromUTF8ArrayBuffer } from "~/tools/textEncoding";

import { _chronicleEventLog, _narrateEventLog } from "./_eventLogOps";
import { _connect } from "./_connectionOps";


/**
 * The nexus connection object, which consolidates the local scribe connections and the possible
 * authority connection.
 *
 * Unconditionally relies on scribe connection: any failures (like running over quota) will flow
 * through to front-end.
 * Unconditionally relies on authority connection also.
 * TODO(iridian): The authority connection should not be relied upon, but reconnection support needs
 * to be added.
 *
 * @export
 * @class OraclePartitionConnection
 * @extends {PartitionConnection}
 */
export default class OraclePartitionConnection extends PartitionConnection {
  constructor ({ authorityProphet, ...rest }: Object) {
    super(rest);
    this._authorityProphet = authorityProphet;
    this._decoderArray = new DecoderArray({
      name: `Decoders of ${this.getName()}`,
      fallbackArray: this.getProphet().getDecoderArray(),
    });
  }

  /**
   * Asynchronous operation which activates the connection to the Scribe and loads its metadatas,
   * initiates the authority connection and narrates any requested events before finalizing.
   *
   * The initial narration looks for the requested events in following order:
   * 1. options.eventLog
   * 2. scribe in-memory and IndexedDB caches
   * 3. authority connection.narrateEventLog (only if options.lastEventId is given)
   *
   * If lastEventId is not specified, all the explicit eventLog and local cache events (starting
   * from the optional firstEventId) are narrated.
   *
   *
   * @param {ConnectOptions} options
   *
   * @memberof OraclePartitionConnection
   */
  async connect (options: ConnectOptions) {
    try {
      return await _connect(this, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, "connect",
          "\n\toptions:", ...dumpObject(options));
    }
  }

  async narrateEventLog (options: NarrateOptions = {}): Promise<any> {
    const ret = {};
    try {
      return await _narrateEventLog(this, options, ret);
    } catch (error) {
      throw this.wrapErrorEvent(error, "narrateEventLog()",
          "\n\toptions:", ...dumpObject(options),
          "\n\tcurrent ret:", ...dumpObject(ret),
      );
    }
  }

  async chronicleEventLog (eventLog: UniversalEvent[], options: ChronicleOptions = {}):
      Promise<{ eventResults: ChronicleEventResult[] }> {
    const ret = {};
    try {
      return await _chronicleEventLog(this, eventLog, options, ret);
    } catch (error) {
      throw this.wrapErrorEvent(error, "chronicleEventLog()",
          "\n\toptions:", ...dumpObject(options),
          "\n\tcurrent ret:", ...dumpObject(ret),
      );
    }
  }

  // Coming from downstream: tries scribe first, otherwise forwards the request to authority.
  // In latter case forwards the result received from authority to Scribe for caching.
  requestMediaContents (mediaInfos: MediaInfo[]): any[] {
    const urlRequests = {};
    const bufferRequests = {};
    const ret = mediaInfos.map(mediaInfo => {
      try {
        if (!mediaInfo.bvobId) {
          if (!mediaInfo.sourceURL) return undefined;
          const sourceURI = createValaaURI(mediaInfo.sourceURL);
          if (mediaInfo.asURL) {
            if (mediaInfo.type) {
              throw new Error(`Cannot explicitly decode sourceURL-based content as '${
                  mediaInfo.mime}' typed URL`);
            }
            if (sourceURI.protocol === "http:" || sourceURI.protocol === "https:") {
              return mediaInfo.sourceURL;
            }
            // TODO(iridian): Implement schema-based request forwarding to remote authorities
            throw new Error(`non-http(s) mediaInfo.sourceURL's not implemented, got '${
                sourceURI.toString()}'`);
          }
          // TODO(iridian): Implement schema-based request forwarding to authorities
          // TODO(iridian): Implement straight mediaInfo.sourceURL retrieval if the field is
          // present, using mediaInfo.type/subtype as the request ContentType.
          throw new Error(`direct retrieval not implemented for mediaInfo.sourceURL '${
              sourceURI.toString()}'`);
        }
        if (mediaInfo.asURL) return addDelayedOperationEntry(urlRequests, mediaInfo);
        let decoder;
        if (mediaInfo.type
            && !((mediaInfo.type === "application") && (mediaInfo.subtype === "octet-stream"))) {
          decoder = this._decoderArray.findDecoder(mediaInfo);
          if (!decoder) throw new Error(`Can't find decoder for ${mediaInfo.mime}`);
          if (mediaInfo.decodingCache) {
            const decoding = mediaInfo.decodingCache.get(decoder);
            if (decoding !== undefined) return decoding;
          }
        }
        // Split requests into three sets: one for URL's, one for actual contents and one for
        // just immediate decoding for buffer content that is already locally available.
        return thenChainEagerly(
            mediaInfo.buffer || addDelayedOperationEntry(bufferRequests, mediaInfo),
            buffer => {
              if (buffer === undefined) return undefined;
              mediaInfo.buffer = buffer;
              if (!decoder) return buffer;
              const name = mediaInfo.name ? `'${mediaInfo.name}'` : `unnamed media`;
              const decoding = decoder.decode(buffer,
                  { mediaName: name, partitionName: this.getName() });
              if (mediaInfo.decodingCache) mediaInfo.decodingCache.set(decoder, decoding);
              return decoding;
            });
      } catch (error) {
        return this.wrapErrorEvent(error, `requestMediaContents().mediaInfo["${
          mediaInfo.name || `unnamed media`}"]`,
      "\n\tmediaId:", mediaInfo.mediaId,
      "\n\tmediaInfo:", ...dumpObject(mediaInfo));
      }
    });
    if (urlRequests.entries) {
      urlRequests.resolveWith(
          this.getUpstreamConnection().requestMediaContents(urlRequests.entries));
    }
    if (bufferRequests.entries) {
      bufferRequests.resolveWith(
          this.getUpstreamConnection().requestMediaContents(bufferRequests.entries));
    }
    return ret;
  }
}

/*
function _nativeObjectFromBufferAndMediaInfo (buffer: ArrayBuffer, mediaInfo?:
    { type?: string, subtype?: string, name?: string
  // TODO(iridian): any other types we'd need for
  //  https://html.spec.whatwg.org/multipage/parsing.html#determining-the-character-encoding ?
}) {
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
*/
