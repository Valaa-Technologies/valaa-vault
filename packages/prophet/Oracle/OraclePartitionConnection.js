// @flow

import type { EventBase } from "~/raem/command";
import { createValaaURI } from "~/raem/ValaaURI";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type { ConnectOptions, MediaInfo, ReceiveEvents, RetrieveMediaBuffer }
    from "~/prophet/api/Prophet";

import DecoderArray from "~/prophet/Oracle/DecoderArray";
import { upgradeEventToVersion0dot2 } from "~/prophet/tools/upgradeEventToVersion0dot2";

import { addDelayedOperationEntry, dumpObject, thenChainEagerly } from "~/tools";
// import { stringFromUTF8ArrayBuffer } from "~/tools/textEncoding";

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
   * If lastEventId is not specified, all the explicit eventLog and locally cached events (both
   * truths and queued commands starting from the optional firstEventId) are narrated.
   *
   *
   * @param {ConnectOptions} options
   *
   * @memberof OraclePartitionConnection
   */
  connect (options: ConnectOptions) {
    try {
      return this._syncedConnection || (this._syncedConnection = thenChainEagerly(
          _connect(this, options, errorOnConnect.bind(this, new Error("connect"))),
          () => (this._syncedConnection = this)));
    } catch (error) { return errorOnConnect.call(this, error); }
    function errorOnConnect (wrapperError, error) {
      throw this.wrapErrorEvent(error, wrapperError, "\n\toptions:", ...dumpObject(options));
    }
  }

  receiveTruths (truths: EventBase[], retrieveMediaBuffer: RetrieveMediaBuffer,
      downstreamReceiveTruths: ?ReceiveEvents, type: string = "receiveTruths",
  ): Promise<(Promise<EventBase> | EventBase)[]> {
    try {
      if (!downstreamReceiveTruths) {
        throw new Error(`INTERNAL ERROR: downstreamReceiveTruths was not defined`);
      }
      return downstreamReceiveTruths(
          truths.map(event => upgradeEventToVersion0dot2(event, this)),
          retrieveMediaBuffer);
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error(type),
          "\n\ttruths:", ...dumpObject(truths),
          "\n\tretrieveMediaBuffer:", ...dumpObject(retrieveMediaBuffer));
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
