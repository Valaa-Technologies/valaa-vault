// @flow

import type Command, { UniversalEvent } from "~/raem/command";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type { ChronicleOptions, NarrateOptions, MediaInfo, RetrieveMediaContent }
    from "~/prophet/api/Prophet";

import { dumpObject, invariantifyObject } from "~/tools";

import { _connect, _chronicleEventLog, _narrateEventLog } from "./_connectionOps";
import { _createReceiveTruthCollection, _receiveTruthOf } from "./_downstreamOps";
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

  _getOwnPartitionInfoOf (event: Object) {
    const partitionURIString = String(this.getPartitionURI());
    let ret = event.partitions[partitionURIString];
    if (!ret) {
      ret = event.partitions[this.getPartitionRawId()] || event.partitions[""];
      // const partitionAuthorityURI = (this._authorityConnection || {})
      // if (this._authorityConnection) {
      //  invariantifyString(partitionInfo.partitionAuthorityURI, "partitionInfo.partitionAuthorityURI",
      //      { value: this.partitionAuthorityURI})
      // }
    }
    invariantifyObject(ret,
        `event.partitions["${partitionURIString}" || "${this.getPartitionRawId()}"]`, {},
        "\n\tevent:", event);
    return ret;
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
      const ret = await _connect(this, initialNarrateOptions, onConnectData);
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

  /**
   * Creates a truth Event receiver collection on this connection for performant side effect
   * grouping and returns it.
   *
   * The collection.receiveTruth will process individual truths and forwards them to Scribe like
   * createReceiveTruth does.
   *
   * The collection postpones and groups complex operations with costly overheads together.
   * Most notably media retrievals will be postponed to the collection finalize phase (which is
   * triggered by calling collection.finalize). This allows dropping unneeded media retrievals and
   * potentially grouping all the retrievals into a single multi-part request.
   *
   * Additionally later other types of side-effect groupings can be added, like indexeddb writes
   * and persistence refcount updates: these are not yet implemented however and are done
   * one-by-one.
   *
   * @param {string}   collectionName
   * @param {Object}   { retrieveMediaContent, requestMediaContents }
   * @returns {Object} { receiveTruth, finalize, retrieveMediaContent, analyzeRetrievals }
   * @memberof OraclePartitionConnection
   */
  createReceiveTruthCollection (name: string,
      { retrieveMediaContent = this.getRetrieveMediaContent(), requestMediaContents }: Object): {
    receiveTruth: Function,
    finalize: Function,
    analyzeRetrievals: Function,
  } {
    return _createReceiveTruthCollection(this,
        { name, retrieveMediaContent, requestMediaContents });
  }

  async _receiveTruthOf (group: Object, truthEvent: UniversalEvent): Promise<Object> {
    let partitionInfo;
    try {
      partitionInfo = this._getOwnPartitionInfoOf(truthEvent);
      return _receiveTruthOf(this, group, partitionInfo.eventId, truthEvent);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_receiveTruthOf('${group.name}')`,
          "\n\tgroup:", ...dumpObject(group),
          "\n\tpartitionInfo:", ...dumpObject(partitionInfo),
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
        return _requestMediaContents(this, [combinedInfo], onError.bind(this))[0];
      } catch (error) { throw onError.call(this, error); }
      // Store the content to Scribe as well (but not to authority): dont wait for completion
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
