// @flow

import type { UniversalEvent } from "~/raem/command";
import { createValaaURI } from "~/raem/ValaaURI";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type { ChronicleOptions, ConnectOptions, NarrateOptions, MediaInfo }
    from "~/prophet/api/Prophet";

import { dumpObject } from "~/tools";

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
      Promise<any> {
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
    const upstreamURLRequests = {};
    const upstreamContentRequests = {};
    const ret = mediaInfos.map(mediaInfo => {
      try {
        if (!mediaInfo.bvobId) {
          if (!(mediaInfo.asURL && mediaInfo.sourceURL)) return undefined;
          const sourceURI = createValaaURI(mediaInfo.sourceURL);
          if (mediaInfo.asURL) {
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
        // Split requests into two sets: one for URL's, one for actual contents.
        return _addDelayedEntry(mediaInfo,
            mediaInfo.asURL ? upstreamURLRequests : upstreamContentRequests);
      } catch (error) {
        return this.wrapErrorEvent(error, `requestMediaContents().mediaInfo["${
          mediaInfo.name || `unnamed media`}"]`,
      "\n\tmediaId:", mediaInfo.mediaId,
      "\n\tmediaInfo:", ...dumpObject(mediaInfo));
      }
    });
    if (upstreamURLRequests.entries) {
      upstreamURLRequests.resolveWith(
          this.getUpstreamConnection().requestMediaContents(upstreamURLRequests.entries));
    }
    if (upstreamContentRequests.entries) {
      upstreamContentRequests.resolveWith(
          this.getUpstreamConnection().requestMediaContents(upstreamContentRequests.entries));
    }
    return ret;
  }
}

function _addDelayedEntry (operation, entry) {
  if (!operation.entries) {
    operation.entries = [];
    operation.results = new Promise(
        (resolve, reject) => { operation.resolve = resolve; operation.reject = reject; });
    operation.resolveWith = maybeThenable =>
        Promise.resolve(maybeThenable).then(operation.resolve, operation.reject);
  }
  const index = operation.entries.length;
  operation.entries.push(entry);
  return operation.results.then(values => values[index]);
}
