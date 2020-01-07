// @flow

import MediaDecoder from "~/tools/MediaDecoder";
import { mergeDeepWith } from "~/tools/mergeDeep";
import { arrayFromAny, FabricEventTarget } from "~/tools";

export default class DecoderArray extends FabricEventTarget {
  _decodersByType: ?{ [string]: { [string]: Object } };

  constructor (options: Object = {}) {
    super(options.name, options.verbosity,
        options.logger || (options.fallbackArray && options.fallbackArray.getLogger()));
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

  findDecoder (type: string, subtype: string) {
    if (this._decodersByType) {
      // Find by exact match first
      const ret = this._findByTypeAndSubType(type, subtype)
      // Find by main type match second
          || this._findByTypeAndSubType(type, "")
      // Find by subtype match third
          || this._findByTypeAndSubType("", subtype)
      // Find by generic matchers the last
          || this._findByTypeAndSubType("", "");
      if (ret) return ret;
    }
    // Delegate to the next circle in line to see if any of those can decode this media type
    return (this._fallbackArray && this._fallbackArray.findDecoder(type, subtype));
  }

  _findByTypeAndSubType (type: string, subtype: string) {
    for (const decodersBySubType of arrayFromAny(this._decodersByType[type] || undefined)) {
      for (const decoder of arrayFromAny(decodersBySubType[subtype] || undefined)) {
        if (decoder.canDecode(type, subtype)) return decoder;
      }
    }
    return undefined;
  }
}
