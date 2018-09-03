// @flow

import type Command, { UniversalEvent } from "~/raem/command";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type { ChronicleOptions, NarrateOptions, MediaInfo, RetrieveMediaContent }
    from "~/prophet/api/Prophet";

import { dumpObject, thenChainEagerly } from "~/tools";

import { _connect, _chronicleEventLog, _narrateEventLog } from "./_connectionOps";
import { _createReceiveTruthBatch, _receiveTruthOf } from "./_downstreamOps";
import { _requestMediaContents, _prepareBvob } from "./_mediaOps";

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
  _lastAuthorizedEventId: number;
  _downstreamTruthQueue: Object[];
  _retrieveMediaContentFromAuthority: ?RetrieveMediaContent;

  constructor (options: Object) {
    super(options);
    this._lastAuthorizedEventId = -1;
    this._downstreamTruthQueue = [];
    this._isConnected = false;
  }

  getScribeConnection (): PartitionConnection {
    return this._upstreamConnection;
  }

  getRetrieveMediaContent () {
    return this._retrieveMediaContentFromAuthority;
  }

  isConnected (): boolean {
    return this._isConnected;
  }

  /**
   * Asynchronous operation which activates the connection to the Scribe and loads its metadatas,
   * initiates the authority connection and narrates any requested events before finalizing.
   *
   * The initial narration looks for the requested events in following order:
   * 1. initialNarrateOptions.eventLog
   * 2. scribe in-memory and IndexedDB caches
   * 3. authority connection.narrateEventLog (only if initialNarrateOptions.lastEventId is given)
   *
   * If lastEventId is not specified, all the explicit eventLog and local cache events (starting
   * from the optional firstEventId) are narrated.
   *
   *
   * @param {NarrateOptions} initialNarrateOptions
   *
   * @memberof OraclePartitionConnection
   */
  async connect (initialNarrateOptions: NarrateOptions) {
    const onConnectData = { ...initialNarrateOptions };
    try {
      this.warnEvent(1, "\n\tBegun initializing connection with options", initialNarrateOptions,
          ...dumpObject(this));
      const ret = _connect(this, initialNarrateOptions, onConnectData);
      this.warnEvent(1, "\n\tDone initializing connection with options", initialNarrateOptions,
          "\n\tinitial narration:", ret);
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, "connect",
          "\n\tonConnectData:", onConnectData);
    }
  }

  async narrateEventLog (options: NarrateOptions = {}): Promise<any> {
    const ret = {};
    try {
      return await _narrateEventLog(this, options, ret);
    } catch (error) {
      throw this.wrapErrorEvent(error, "narrateEventLog()",
          "\n\toptions:", ...dumpObject(options),
          "\n\tcurrent ret:", ...dumpObject(ret));
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

  createReceiveTruth (originName: string) {
    return this._receiveTruthOf.bind(this, { name: originName });
  }

  createReceiveTruthBatch (batchName: string,
      { retrieveMediaContent = this.getRetrieveMediaContent(), finalizeRetrieves }: Object) {
    return _createReceiveTruthBatch(this,
        { name: batchName, retrieveMediaContent, finalizeRetrieves });
  }

  async _receiveTruthOf (group: Object, truthEvent: UniversalEvent): Promise<Object> {
    const partitionData = truthEvent.partitions && truthEvent.partitions[this.partitionRawId()];
    try {
      if (!partitionData) {
        throw new Error(`truthEvent of '${group.name}' has no partition ${this.debugId()} info`);
      }
      return _receiveTruthOf(this, group, partitionData.eventId, truthEvent);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_receiveTruthOf('${group.name}')`,
          "\n\tgroup:", ...dumpObject(group),
          "\n\teventId:", partitionData && partitionData.eventId,
          "\n\ttruthEvent:", ...dumpObject(truthEvent),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  claimCommandEvent (command: Command) {
    return this.getScribeConnection().claimCommandEvent(command, this.getRetrieveMediaContent());
  }

  _preAuthorizeCommand = this.createReceiveTruth("preAuthorizer")

  // Coming from downstream: tries scribe first, otherwise forwards the request to authority.
  // In latter case forwards the result received from authority to Scribe for caching.
  requestMediaContents (mediaInfos: MediaInfo[]): any[] {
    return mediaInfos.map(mediaInfo => {
      let ret;
      let combinedInfo;
      try {
        combinedInfo = {
          ...this.getScribeConnection().getMediaInfo(mediaInfo.mediaId),
          ...mediaInfo,
        };
        ret = _requestMediaContents(this, [combinedInfo])[0];
        if (ret === undefined || mediaInfo.asLocalURL) return ret;
      } catch (error) { throw onError.call(this, error); }
      // Store the content to Scribe as well (but not to authority): dont wait for completion
      thenChainEagerly(ret,
          (content) => this.prepareBvob(content, combinedInfo, { remotePersist: false }),
          onError.bind(this));
      return ret;
      function onError (error) {
        return this.wrapErrorEvent(error, `requestMediaContents(${
                (combinedInfo || mediaInfo).name || `unnamed media`})`,
            "\n\tmediaId:", mediaInfo.mediaId,
            "\n\tcombined MediaInfo:", combinedInfo,
            "\n\tresult candidate:", ret);
      }
    });
  }

  // Coming from downstream: stores Media content in Scribe and uploads it to possible remote
  // uploads pool.
  prepareBvob (content: any, mediaInfo: Object, options: any = {}):
      { contentId: string, persistProcess: ?Promise<any> } {
    try {
      return _prepareBvob(this, content, mediaInfo, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, `prepareBvob()`,
          "\n\tmediaInfo:", ...dumpObject(mediaInfo),
      );
    }
  }
}
