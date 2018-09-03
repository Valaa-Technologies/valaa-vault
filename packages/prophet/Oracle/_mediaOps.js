// @flow

import { createValaaURI } from "~/raem/ValaaURI";
import { VRef } from "~/raem/ValaaReference";

import type { MediaInfo } from "~/prophet/api/Prophet";
import PartitionConnection from "~/prophet/api/PartitionConnection";

import OraclePartitionConnection from "./OraclePartitionConnection";

export function _requestMediaContents (connection: OraclePartitionConnection,
    mediaInfos: MediaInfo[]): any {
  return mediaInfos.map(mediaInfo => {
    if (!mediaInfo.bvobId && !(mediaInfo.asLocalURL && mediaInfo.sourceURL)) return undefined;
    const ret = PartitionConnection.prototype.requestMediaContents.call(connection, [mediaInfo])[0];
    if (ret !== undefined) return ret;
    if (!mediaInfo.bvobId) {
      const sourceURI = createValaaURI(mediaInfo.sourceURL);
      if (mediaInfo.asLocalURL) {
        if (sourceURI.protocol === "http:" || sourceURI.protocol === "https:") {
          return mediaInfo.sourceURL;
        }
        // TODO(iridian): Implement schema-based request forwarding to remote authorities
        throw new Error(`schema-based mediaInfo.sourceURL's not implemented, got '${
            sourceURI.toString()}'`);
      }
      // TODO(iridian): Implement schema-based request forwarding to authorities
      // TODO(iridian): Implement straight mediaInfo.sourceURL retrieval if the field is
      // present, using mediaInfo.type/subtype as the request ContentType.
      throw new Error(`direct retrieval not implemented for mediaInfo.sourceURL '${
          sourceURI.toString()}'`);
    }
    if (mediaInfo.asLocalURL) {
      const authorityConnection = connection.getDependentConnection("authorityUpstream");
      if (!authorityConnection) {
        throw new Error(`OraclePartitionConnection has no authority connection specified ${
            ""} and could not locate local media URL from Scribe`);
      }
      return authorityConnection.requestMediaContents([mediaInfo])[0];
    }
    const retrieveMediaContent = connection.getRetrieveMediaContent();
    if (!retrieveMediaContent) {
      throw new Error(`Could not locate media content in Scribe and ${
        ""}no OraclePartitionConnection._(override)retrieveMediaContent is defined`);
    }
    return retrieveMediaContent(mediaInfo.mediaId, mediaInfo);
  });
}

export function _prepareBvob (connection: OraclePartitionConnection, content: any,
    mediaInfo: Object, { remotePersist }: any = {}):
        { contentId: string, persistProcess: ?Promise<any> } {
  const ret = connection.getScribeConnection().prepareBvob(content, mediaInfo);
  const authorityConnection = (remotePersist !== false)
      && connection.getDependentConnection("authorityUpstream");
  if (authorityConnection) {
    const authorityMediaInfo = { ...(mediaInfo || {}), bvobId: ret.contentId };
    ret.authorityPersistProcess =
        authorityConnection.prepareBvob(ret.buffer, authorityMediaInfo)
            .persistProcess;
  }
  return ret;
}
