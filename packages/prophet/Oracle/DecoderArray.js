// @flow

import type { MediaInfo } from "~/prophet/api/Prophet";

import MediaDecoder from "~/tools/MediaDecoder";
import { mergeDeepWith } from "~/tools/mergeDeep";
import { arrayFromAny, LogEventGenerator } from "~/tools";

export default class DecoderArray extends LogEventGenerator {
  _decodersByType: ?{ [string]: { [string]: Object } };

  constructor (options: Object = {}) {
    if (!options.logger && options.fallbackArray) {
      options.logger = options.fallbackArray.getLogger();
    }
    super(options);
    this._fallbackArray = options.fallbackArray;
  }

  addDecoder (decoder: MediaDecoder) {
    try {
      mergeDeepWith(this._decodersByType || (this._decodersByType = {}),
          decoder.getByMediaTypeLookup(),
          (targetEntry, sourceEntry) => ((Array.isArray(targetEntry) || Array.isArray(sourceEntry))
              ? arrayFromAny(targetEntry).concat(arrayFromAny(sourceEntry))
              : undefined));
    } catch (error) {
      throw this.wrapErrorEvent(error, "addDecoder(", decoder, ")");
    }
  }

  findDecoder (mediaInfo: MediaInfo) {
    if (this._decodersByType) {
      // Find by exact match first
      const ret = this._findByTypeAndSubType(mediaInfo, mediaInfo.type, mediaInfo.subtype)
      // Find by main type match second
          || this._findByTypeAndSubType(mediaInfo, mediaInfo.type, "")
      // Find by subtype match third
          || this._findByTypeAndSubType(mediaInfo, "", mediaInfo.subtype)
      // Find by generic matchers the last
          || this._findByTypeAndSubType(mediaInfo, "", "");
      if (ret) return ret;
    }
    // Delegate to the next circle in line to see if they can decode this media type
    return (this._fallbackArray && this._fallbackArray.findDecoder(mediaInfo));
  }

  _findByTypeAndSubType (mediaInfo: MediaInfo, type: string, subtype: string) {
    for (const decodersBySubType of arrayFromAny(this._decodersByType[type] || undefined)) {
      for (const decoder of arrayFromAny(decodersBySubType[subtype] || undefined)) {
        if (decoder.canDecode(mediaInfo)) return decoder;
      }
    }
    return undefined;
  }
}
