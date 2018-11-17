// @flow

import type { EventBase } from "~/raem/command";
import { createValaaURI } from "~/raem/ValaaURI";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import { ConnectOptions, MediaInfo, ReceiveEvents, RetrieveMediaBuffer } from "~/prophet/api/types";

import DecoderArray from "~/prophet/Oracle/DecoderArray";
import upgradeEventTo0Dot2 from "~/prophet/tools/event-version-0.2/upgradeEventTo0Dot2";

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

  _connect (options: ConnectOptions, onError: Function) {
    // Handle step 2. of the acquirePartitionConnection first narration logic (defined
    // in PartitionConnection.js) and begin I/O bound scribe event log narration in parallel to
    // the authority proxy/connection creation.
    const upstreamConnection = this._authorityProphet.acquirePartitionConnection(
        this.getPartitionURI(), {
          subscribe: false, narrateOptions: false,
          receiveTruths: this.getReceiveTruths(options.receiveTruths),
        });
    this.setUpstreamConnection(upstreamConnection);
    return thenChainEagerly(upstreamConnection.getSyncedConnection(),
      () => this.narrateEventLog(options.narrateOptions),
      onError);
  }

  receiveTruths (truths: EventBase[], retrieveMediaBuffer: RetrieveMediaBuffer,
      downstreamReceiveTruths: ?ReceiveEvents, type: string = "receiveTruths",
  ): Promise<(Promise<EventBase> | EventBase)[]> {
    try {
      if (!downstreamReceiveTruths) {
        throw new Error(`INTERNAL ERROR: downstreamReceiveTruths was not defined`);
      }
      return downstreamReceiveTruths(
          truths.map(event => upgradeEventTo0Dot2(event, this)),
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
    const urlRequests = new DelayedQueue();
    const bufferRequests = new DelayedQueue();
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
        if (mediaInfo.asURL) return urlRequests.push(mediaInfo)[0];
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
            mediaInfo.buffer || bufferRequests.push(mediaInfo)[0],
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
    if (urlRequests.length) {
      urlRequests.resolve(this.getUpstreamConnection().requestMediaContents([...urlRequests]));
    }
    if (bufferRequests.length) {
      bufferRequests.resolve(
          this.getUpstreamConnection().requestMediaContents([...bufferRequests]));
    }
    return ret;
  }
}
