// @flow

import { createValaaURI } from "~/raem/ValaaURI";
import { VRef } from "~/raem/ValaaReference";

import type { MediaInfo } from "~/prophet/api/Prophet";
import PartitionConnection from "~/prophet/api/PartitionConnection";

import OraclePartitionConnection from "./OraclePartitionConnection";

export function _readMediaContent (connection: OraclePartitionConnection, mediaId: VRef,
    mediaInfo?: MediaInfo, actualInfo: MediaInfo): any {
  if (!actualInfo.blobId && !actualInfo.sourceURL) return undefined;
  const ret = PartitionConnection.prototype.readMediaContent.call(connection, mediaId, mediaInfo);
  if (ret !== undefined) return ret;
  if (!actualInfo.blobId) {
    const sourceURI = createValaaURI(actualInfo.sourceURL);
    // TODO(iridian): Implement schema-based request forwarding to authorities
    // TODO(iridian): Implement straight mediaInfo.sourceURL retrieval if the field is
    // present, using actualInfo.type/subtype as the request ContentType.
    throw new Error(`direct retrieval not implemented for mediaInfo.sourceURL '${
        sourceURI.toString()}'`);
  }
  const retrieveMediaContent = connection.getRetrieveMediaContent();
  if (!retrieveMediaContent) {
    throw new Error(`Could not locate media content in Scribe and ${
      ""}no OraclePartitionConnection._(override)retrieveMediaContent is defined`);
  }
  return retrieveMediaContent(mediaId, actualInfo);
}

export function _getMediaURL (connection: OraclePartitionConnection, mediaId: VRef,
    mediaInfo?: MediaInfo, actualInfo: MediaInfo): any {
  if (!actualInfo.blobId) return undefined;
  const ret = PartitionConnection.prototype.getMediaURL.call(connection, mediaId, mediaInfo);
  if (ret !== undefined) return ret;
  if (!actualInfo.blobId) {
    const sourceURI = createValaaURI(actualInfo.sourceURL);
    if (sourceURI.protocol === "http:" || sourceURI.protocol === "https:") {
      return actualInfo.sourceURL;
    }
    // TODO(iridian): Implement schema-based request forwarding to remote authorities
    throw new Error(`schema-based mediaInfo.sourceURL's not implemented, got '${
        sourceURI.toString()}'`);
  }
  const authorityConnection = connection.getDependentConnection("authorityUpstream");
  if (!authorityConnection) {
    throw new Error(`OraclePartitionConnection has no authority connection specified ${
        ""} and could not locate local media URL from Scribe`);
  }
  return authorityConnection.getMediaURL(mediaId, actualInfo);
}

export function _prepareBlob (connection: OraclePartitionConnection, content: any,
    mediaInfo: Object, { noRemotePersist }: any = {}):
        { contentId: string, persistProcess: ?Promise<any> } {
  const ret = connection.getScribeConnection().prepareBlob(content, mediaInfo);
  const authorityConnection = !noRemotePersist
      && connection.getDependentConnection("authorityUpstream");
  if (authorityConnection) {
    const authorityMediaInfo = { ...(mediaInfo || {}), blobId: ret.contentId };
    ret.authorityPersistProcess =
        authorityConnection.prepareBlob(ret.buffer, authorityMediaInfo)
            .persistProcess;
  }
  return ret;
}
