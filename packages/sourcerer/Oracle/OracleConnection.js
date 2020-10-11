// @flow

import type { EventBase } from "~/raem/events";
import { hasScheme } from "~/raem/ValaaURI";

import Connection from "~/sourcerer/api/Connection";
import {
  SourceryOptions, MediaInfo, ReceiveEvents, RetrieveMediaBuffer,
} from "~/sourcerer/api/types";

import DecoderArray from "~/sourcerer/Oracle/DecoderArray";
import upgradeEventTo0Dot2 from "~/sourcerer/tools/event-version-0.2/upgradeEventTo0Dot2";

import { mediaTypeFromContentType } from "~/tools/MediaTypeData";
import { DelayedQueue, dumpObject, thenChainEagerly } from "~/tools";

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
 * @class OracleConnection
 * @extends {Connection}
 */
export default class OracleConnection extends Connection {
  constructor ({ authoritySourcerer, ...rest }: Object) {
    super(rest);
    this._authoritySourcerer = authoritySourcerer;
    this._decoderArray = new DecoderArray({
      name: `Decoders of ${this.getName()}`,
      fallbackArray: this.getOracle().getDecoderArray(),
    });
  }

  getOracle () { return this._parent; }

  _doConnect (options: ConnectOptions) {
    // Handle step 2. of the acquireConnection first narration
    // logic (defined in Connection.js) and begin I/O bound(?)
    // scribe event log narration in parallel to the authority
    // proxy/connection creation.
    this.setUpstreamConnection(this._authoritySourcerer.acquireConnection(
        this.getChronicleURI(), {
          narrateOptions: false,
          subscribeEvents: (options.narrateOptions === false) && options.subscribeEvents,
          receiveTruths: this.getReceiveTruths(options.receiveTruths),
        }));
    const connection = this;
    return thenChainEagerly(null, this.addChainClockers(2, "oracle.doConnect.ops", [
      function _waitForActiveUpstream () {
        return connection._upstreamConnection.asActiveConnection();
      },
      function _narrateEventLog () {
        if (options.narrateOptions === false) return {};
        options.narrateOptions.subscribeEvents = options.subscribeEvents;
        return connection.narrateEventLog(options.narrateOptions);
      },
    ]));
  }

  receiveTruths (truths: EventBase[], retrieveMediaBuffer: RetrieveMediaBuffer,
      pushTruths: ?ReceiveEvents, type: string = "receiveTruths",
  ): Promise<(Promise<EventBase> | EventBase)[]> {
    try {
      if (!pushTruths) {
        throw new Error(`INTERNAL ERROR: receiveTruths..pushTruths was not defined`);
      }
      return pushTruths(
          truths.map(event => upgradeEventTo0Dot2(this, event)),
          retrieveMediaBuffer);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(type),
          "\n\ttruths:", ...dumpObject(truths),
          "\n\tretrieveMediaBuffer:", ...dumpObject(retrieveMediaBuffer));
    }
  }

  // Coming from downstream: tries scribe first, otherwise forwards the request to authority.
  // In latter case forwards the result received from authority to Scribe for caching.
  requestMediaContents (mediaInfos: MediaInfo[]): any[] {
    const connection = this;
    const urlRequests = new DelayedQueue();
    const bufferRequests = new DelayedQueue();
    const ret = mediaInfos.map(mediaInfo => {
      const wrap = new Error(`requestMediaContents().mediaInfo["${
          mediaInfo.name || `unnamed media`}"]`);
      try {
        const contentHash = mediaInfo.contentHash;
        if (!contentHash) {
          if (!mediaInfo.sourceURL) return undefined;
          const sourceURI = mediaInfo.sourceURL;
          if (mediaInfo.asURL) {
            if (mediaInfo.contentType) {
              throw new Error(`Cannot explicitly decode sourceURL-based content as '${
                  mediaInfo.contentType}' typed URL`);
            }
            if (hasScheme(sourceURI, "http") || hasScheme(sourceURI, "https")) {
              return mediaInfo.sourceURL;
            }
            // TODO(iridian): Implement schema-based request forwarding to remote authorities
            throw new Error(`non-http(s) mediaInfo.sourceURL's not implemented, got '${
                sourceURI}'`);
          }
          // TODO(iridian): Implement schema-based request forwarding to authorities
          // TODO(iridian): Implement straight mediaInfo.sourceURL retrieval if the field is
          // present, using mediaInfo.contentType as the request ContentType.
          throw new Error(`direct retrieval not implemented for mediaInfo.sourceURL '${
              sourceURI}'`);
        }
        if (mediaInfo.asURL) return urlRequests.push(mediaInfo)[0];
        let decoder;
        if (mediaInfo.contentType && (mediaInfo.contentType !== "application/octet-stream")) {
          const { type, subtype } = mediaTypeFromContentType(mediaInfo.contentType);
          decoder = connection._decoderArray.findDecoder(type, subtype);
          if (!decoder) throw new Error(`Can't find decoder for ${mediaInfo.contentType}`);
          if (mediaInfo.decodingCache) {
            const decoding = mediaInfo.decodingCache.get(decoder);
            if (decoding !== undefined) return decoding;
          }
        }
        // Split requests into three sets: one for URL's, one for actual contents and one for
        // just immediate decoding for buffer content that is already locally available.
        return thenChainEagerly(
            mediaInfo.buffer || bufferRequests.push(mediaInfo)[0],
            buffer => {
              if (buffer === undefined) return undefined;
              mediaInfo.buffer = buffer;
              if (!decoder) return buffer;
              const decoding = decoder.decode(buffer, {
                contentHash,
                mediaName: mediaInfo.name || `<unnamed>`,
                chronicleName: connection.getName(),
              });
              if (mediaInfo.decodingCache) mediaInfo.decodingCache.set(decoder, decoding);
              return decoding;
            },
            errorOnOracleConnectionRequestMediaContentForInfo);
      } catch (error) {
        return errorOnOracleConnectionRequestMediaContentForInfo(error);
      }
      function errorOnOracleConnectionRequestMediaContentForInfo (error) {
        const wrapped = connection.wrapErrorEvent(error, 1, wrap,
            "\n\tmediaVRL:", ...dumpObject(mediaInfo.mediaVRL),
            "\n\tmediaInfo:", ...dumpObject(mediaInfo));
        if (mediaInfos.length === 1) throw wrapped;
        return Promise.reject(wrapped);
      }
    });
    if (urlRequests.length) {
      urlRequests.resolve(connection.getUpstreamConnection()
          .requestMediaContents([...urlRequests]));
    }
    if (bufferRequests.length) {
      bufferRequests.resolve(connection.getUpstreamConnection()
          .requestMediaContents([...bufferRequests]));
    }
    return ret;
  }
}
