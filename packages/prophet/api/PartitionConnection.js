// @flow

import { VRef } from "~/raem/ValaaReference";
import ValaaURI, { getPartitionRawIdFrom } from "~/raem/ValaaURI";

import Prophet, { MediaInfo, NarrateOptions } from "~/prophet/api/Prophet";

import Logger, { LogEventGenerator } from "~/tools/Logger";
import { invariantifyObject } from "~/tools/invariantify";

/**
 * Interface for sending commands to upstream and registering for prophecy event updates
 */
export default class PartitionConnection extends LogEventGenerator {
  _prophet: Prophet;
  _partitionURI: ValaaURI;

  _refCount: number;
  _dependentConnections: Object;
  _upstreamConnection: PartitionConnection;
  _isFrozen: boolean;

  constructor ({ name, prophet, partitionURI, logger, debugLevel }: {
    name: any, prophet: Prophet, partitionURI: ValaaURI, logger?: Logger, debugLevel?: number,
  }) {
    super({ name: name || null, logger: logger || prophet.getLogger(), debugLevel });
    invariantifyObject(prophet, "PartitionConnection.constructor.prophet",
        { instanceof: Prophet });
    invariantifyObject(partitionURI, "PartitionConnection.constructor.partitionURI",
        { instanceof: ValaaURI, allowEmpty: true });

    this._prophet = prophet;
    this._partitionURI = partitionURI;
    this._refCount = 0;
  }

  getName (): string {
    return super.getName()
        || (this._upstreamConnection && this._upstreamConnection.getName())
        || this.partitionURI().toString();
  }
  getProphet (): Prophet { return this._prophet; }

  partitionURI (): ValaaURI { return this._partitionURI; }
  partitionRawId (): string { return getPartitionRawIdFrom(this._partitionURI); }

  isLocal () { return this._partitionURI.protocol === "valaa-local:"; }
  isTransient () {
    return (this._partitionURI.protocol === "valaa-transient:")
        || (this._partitionURI.protocol === "valaa-memory:");
  }

  isConnected () {
    if (this._upstreamConnection) return this._upstreamConnection.isConnected();
    throw new Error("isConnected not implemented");
  }

  async connect (/* initialNarrateOptions: NarrateOptions */) {
    throw new Error("connect");
  }

  /**
   * disconnect - Disconnects from partition, stops receiving further requests
   *
   * @param  {type} partitions = null description
   * @returns {type}                   description
   */
  disconnect () {
    for (const dependentConnection of (this._dependentConnections || [])) {
      dependentConnection.releaseConnection();
    }
    this._dependentConnections = null;
    this._refCount = null;
  } // eslint-disable-line

  acquireConnection () { ++this._refCount; }
  releaseConnection () { if ((this._refCount !== null) && --this._refCount) this.disconnect(); }

  setIsFrozen (value: boolean = true) { this._isFrozen = value; }
  isFrozen (): boolean {
    return (typeof this._isFrozen !== "undefined") ? this._isFrozen
        : this._upstreamConnection ? this._upstreamConnection.isFrozen()
        : false;
  }

  setUpstreamConnection (connection: PartitionConnection) {
    this._upstreamConnection = connection;
  }

  /**
   * Returns a dependent connection with given dependentName. Dependent connections are connections
   * which are attached to this connection and released when this connection is disconnected.
   *
   * @param {string} dependentName
   * @returns
   *
   * @memberof PartitionConnection
   */
  getDependentConnection (dependentName: string): ?PartitionConnection {
    return this._dependentConnections && this._dependentConnections[dependentName];
  }

  transferIntoDependentConnection (dependentName: string, connection: PartitionConnection) {
    const dependents = (this._dependentConnections || (this._dependentConnections = {}));
    if (dependents[dependentName]) {
      throw new Error(`${this.debugId()}.transferIntoDependentConnection: dependent connection '${
          dependentName}' already exists`);
    }
    dependents[dependentName] = connection;
  }

  acquireAndAttachDependentConnection (dependentName: string,
      dependentConnection: PartitionConnection) {
    dependentConnection.acquireConnection();
    this.transferIntoDependentConnection(dependentName, dependentConnection);
  }

  narrateEventLog (options: NarrateOptions = {}): Promise<Object> {
    return this._upstreamConnection.narrateEventLog(options);
  }

  getLastAuthorizedEventId () {
    return this._upstreamConnection.getLastAuthorizedEventId();
  }

  getLastCommandEventId () {
    return this._upstreamConnection.getLastCommandEventId();
  }

  /**
   * Returns the media content if it is immediately synchronously available or a Promise if the
   * content is asynchronously available. Throws directly if the content is not available at all or
   * indirectly through the Promise in situations like timeouts.
   *
   * @param {VRef} mediaId
   * @param {MediaInfo} mediaInfo
   * @returns
   *
   * @memberof ValaaEngine
   */
  readMediaContent (mediaId: VRef, mediaInfo?: MediaInfo): any {
    return this._upstreamConnection.readMediaContent(mediaId, mediaInfo);
  }

  /**
   * Returns the media content if it is immediately synchronously available or a Promise if the
   * content is asynchronously available. Throws directly if the content is not available at all or
   * indirectly through the Promise in situations like timeouts.
   *
   * @param {VRef} mediaId
   * @param {MediaInfo} mediaInfo
   * @returns
   *
   * @memberof ValaaEngine
   */
  decodeMediaContent (mediaId: VRef, mediaInfo?: MediaInfo): any {
    return this._upstreamConnection.decodeMediaContent(mediaId, mediaInfo);
  }

  /**
   * Returns a URL for given mediaId pair which can be used in html context for retrieving media
   * content.
   *
   * @param {VRef} mediaId
   * @param {MediaInfo} mediaInfo
   * @returns
   *
   * @memberof ValaaEngine
   */
  getMediaURL (mediaId: VRef, mediaInfo?: MediaInfo): any {
    return this._upstreamConnection.getMediaURL(mediaId, mediaInfo);
  }


  /**
   * Prepares the blob content store process on upstream, returns the content id.
   *
   * @param {string} content
   * @param {VRef} mediaId
   * @param {string} contentId
   * @returns {string}
   *
   * @memberof Prophet
   */
  prepareBlob (content: string, mediaInfo?: Object):
      { contentId: string, persistProcess: ?Promise<any> } {
    return this._upstreamConnection.prepareBlob(content, mediaInfo);
  }
}
