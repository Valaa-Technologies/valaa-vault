// @flow

import type { MediaInfo } from "@valos/sourcerer";
import { hash40FromHexSHA512 } from "@valos/security/hash";
import { debugObjectType, dumpObject, FabricEventTarget } from "@valos/tools";

/**
 * This class is repsonsible for uploads and downloads to a valosp
 * bvob storage backend. It keeps track of local uploads and can let
 * other parts of the system know when an upload is in progress for
 * a given bvob.
 */
export default class ValOSPRemoteStorageAPI extends FabricEventTarget {
  _uploadedContentHashes: Object = {};
  _pendingOctetStreamDownloads: Object = {};

  constructor (authority, authorityConfig) {
    super(authority, undefined, authorityConfig.name);
    this.logEvent(1, () => [
      `Creating valosp bvob storage provider for <${authorityConfig.authorityURI}>`,
    ]);
  }

  downloadBvobsContents (connection, mediaInfos: MediaInfo[]): any {
    return mediaInfos.map(mediaInfo => {
      const asURL = mediaInfo.asURL && "URL";
      const mediaName = mediaInfo.name ? `media '${mediaInfo.name}'` : "unnamed media";
      const whileTrying = `while trying to fetch ${mediaName} ${asURL || "content"}`;
      const contextName = new Error(`downloadBvobsContents(${mediaName})`);
      const contentHash = mediaInfo.contentHash.length === 40
          ? mediaInfo.contentHash
          : hash40FromHexSHA512(mediaInfo.contentHash);
      const contentType = mediaInfo.contentType
          || mediaInfo.mime
          || ((mediaInfo.type && mediaInfo.subtype) && `${mediaInfo.type}/${mediaInfo.subtype}`);

      const bvobURL = `${connection.getValOSPChronicleURL()}~bvob!${contentHash}/`;

      let options;
      try {
        if (!contentHash) {
          throw new Error(`requestMediaContent.contentHash missing ${whileTrying}`);
        }
        if (asURL && !contentType) {
          throw new Error(`getMediaURL.mime (or type/subtype or contentType) missing`);
        }

        const isShareable = !asURL
            && ((contentType === undefined) || (contentType !== "application/octet-stream"));
        const pendingDownload = isShareable && this._pendingOctetStreamDownloads[contentHash];
        if (pendingDownload) return pendingDownload;
        if (pendingDownload === null) {
          this.warnEvent(1, () => [
            `RE-GET for ${mediaName} bvob content:`, contentHash, ": request has been done before",
          ]);
        }

        options = {
          method: "GET",
          mode: "cors",
          headers: {
            "Content-Type": contentType,
            "Content-Disposition":
                ((mediaInfo.contentDisposition === "attachment") && mediaInfo.name)
                ? `attachment; filename*=UTF-8''${_encodeRFC5987ValueChars(mediaInfo.name)}`
                : mediaInfo.contentDisposition,
            "Content-Encoding": mediaInfo.contentEncoding,
            "Content-Language": mediaInfo.contentLanguage,
          },
        };

        this.logEvent(2, () => [
          `GET ${mediaName} bvob content:`, contentHash, "from", bvobURL,
          "with options", ...dumpObject(options),
        ]);

        if (asURL) {
          let ret;
          for (const [headerName, headerValue] of Object.entries(options.headers)) {
            if (headerValue != null) {
              ret = `${ret || bvobURL}{!ret ? "?" : "&"}${headerName}=${headerValue}`;
            }
          }
          return ret || bvobURL;
        }

        const ret = fetch(bvobURL, options)
            .then(response => {
              if (!response.ok) {
                throw new Error(`Received non-ok status ${response.status} while downloading bvob`);
              }
              return response.body.arrayBuffer();
            })
            .catch(onError.bind(this));

        if (isShareable) {
          this._pendingOctetStreamDownloads[contentHash] = ret;
          ret.finally(() => {
            // Only deduplicate downloads for their duration
            this._pendingOctetStreamDownloads[contentHash] = null;
          });
        }

        return ret;
      } catch (error) { onError.call(this, error); }
      return undefined;
      function onError (error) {
        const wrappedError = this.wrapErrorEvent(error, contextName, whileTrying,
            "\n\tfrom:", bvobURL,
            "\n\tmediaInfo:", ...dumpObject(mediaInfo),
            "\n\toutgoing options:", ...dumpObject(options),
        );
        this.outputErrorEvent(error);
        throw wrappedError;
      }
    });
  }

  /**
   *
   *
   * @param {*}                   connection
   * @param {string}              contentHash
   * @param {(?ArrayBuffer | () => Promise<ArrayBuffer>)} content
   * @param {string}              mediaName informative name for the bvob origin
   * @memberof ValOSPRemoteStorageAPI
   */
  uploadBvobContent (connection,
      contentHash_: string,
      content: ?ArrayBuffer | () => Promise<ArrayBuffer>,
      mediaName: string): ?string | Promise<?string> {
    const contentHash = contentHash_.length === 40
        ? contentHash_
        : hash40FromHexSHA512(contentHash_);
    const alreadyUploadedPromiseToHash = this._uploadedContentHashes[contentHash];
    if (alreadyUploadedPromiseToHash) return alreadyUploadedPromiseToHash;
    if (!content) return { contentHash };

    const bvobURL = `${connection.getValOSPChronicleURL()}~bvob!${contentHash}/`;
    const contextName = new Error(`uploadBvobContent(${contentHash}, ${mediaName})`);
    return (this._uploadedContentHashes[contentHash] = (async () => {
      const options = {
        method: "POST",
        mode: "cors",
      };
      try {
        let actualContent = (typeof content === "function") ? await content() : content;
        if (ArrayBuffer.isView(actualContent)) actualContent = actualContent.buffer;
        else if (!(actualContent instanceof ArrayBuffer)) {
// TODO(iridian, 2021-03): Implement support for streaming uploads for
// both node and browser contexts. However this requires work on Scribe
// as well, as the current Scribe backend (IndexedDB) is not tailored
// towards streaming reads.
          throw new Error(`Invalid bvob content type; expected ArrayBuffer, instead got: ${
            debugObjectType(actualContent)}`);
        }
        this.logEvent(2, () => [
          `POST ${mediaName} bvob arraybuffer content with hash:`, contentHash,
          "\n\toptions:", ...dumpObject(options)
        ]);

        options.body = new FormData();
        options.body.append("file", new Blob([actualContent]));

        const result = await fetch(bvobURL, options);
        if (!result.ok) {
          throw new Error(`Received non-ok status ${result.status} while uploading bvob`);
        }
        return (this._uploadedContentHashes[contentHash] = contentHash);
      } catch (error) {
        delete this._uploadedContentHashes[contentHash];
        throw this.wrapErrorEvent(error, contextName,
          "\n\tbvobURL:", bvobURL,
          "\n\tcontentHash:", contentHash,
        );
      }
    })());
  }
}

// eslint-disable-next-line max-len
// as per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
function _encodeRFC5987ValueChars (str) {
  return encodeURIComponent(str)
      .replace(/['()]/g, escape)
      .replace(/\*/g, "%2A")
      .replace(/%(?:7C|60|5E)/g, unescape);
}
