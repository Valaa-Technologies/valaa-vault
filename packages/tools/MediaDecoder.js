// @flow

import { LogEventGenerator } from "~/tools/Logger";
import { utf8StringFromArrayBuffer } from "~/tools/textEncoding";

/**
 * Defines media decoder interface.
 * All media decoders must return the same decoded representation for the same incoming buffer, as
 * the result will get cached.
 */
export default class MediaDecoder extends LogEventGenerator {
  static mediaTypes: Object[] = [];

  _lookup: { [string]: { [string]: Object | Object[] } };

  constructor (options: Object = {}) {
    super(options);
    this.mediaTypes = this.constructor.mediaTypes;
    const { type, subtype } = this.mediaTypes[0];
    this.type = type;
    this.subtype = subtype;
    if (!options.name && this.mediaTypes.length) {
      this.setName(`Decoder(${type}/${subtype})`);
    }
    this._lookup = Object.freeze(this._prepareMediaTypeLookup());
  }

  getByMediaTypeLookup () { return this._lookup; }

  canDecode ({ type, subtype }: Object): boolean {
    if (!this.mediaTypes.length) {
      throw new Error(`${this.constructor.name}.canDecode must be implemented if no ${
          this.constructor.name}.mediaTypes are specified`);
    }
    const major = this._lookup[type] || this._lookup[""];
    return major && !!(major[subtype] || major[""]);
  }


  /**
   * Decodes the buffer based on the decoding semantics of this decoder and returns the decoded
   * representation.
   *
   * mediaName and partitionName shall be used for diagnostics purposes only, as the same content
   * associated with different medias in different partitions are allowed to reuse the decoded
   * representation. In case of such cache hits decode() will never get called with the different
   * media/partitionNames.
   *
   * @param {ArrayBuffer} buffer
   * @param {Object} [{ mediaName, partitionName }={}]
   * @returns {*}
   *
   * @memberof MediaDecoder
   */
  decode (buffer: ArrayBuffer, { mediaName, partitionName }: Object = {}): any {
    throw new Error(`${this.constructor.name}.decode not implemented, when trying to decode${
        ""} '${mediaName}' in '${partitionName}`);
  }

  stringFromBuffer (buffer: ArrayBuffer) {
    // TODO(iridian): Lock down and document the character encoding practices for medias
    // or figure out whether encoding sniffing is feasible:
    // https://html.spec.whatwg.org/multipage/parsing.html#determining-the-character-encoding ?
    // There's also an rfc on this: https://tools.ietf.org/html/rfc6657
    return utf8StringFromArrayBuffer(buffer);
  }

  _prepareMediaTypeLookup () {
    if (!this.mediaTypes.length) return { "": { "": [this] } };
    const ret = {};
    for (const mediaType of this.mediaTypes) {
      const bySub = (ret[mediaType.type || ""] = (ret[mediaType.type || ""] || {}));
      (bySub[mediaType.subtype || ""] = (bySub[mediaType.subtype || ""] || [this]));
    }
    return ret;
  }
}
