// @flow

import { transpileValoscriptModule, Kuery } from "~/script";

import MediaDecoder from "~/tools/MediaDecoder";

export default class ValoscriptDecoder extends MediaDecoder {
  static mediaTypes = [
    { type: "application", subtype: "valoscript" },
    { type: "application", subtype: "valaascript" },
  ];

  _customVALK: ?Kuery;
  _transpilationCache: {};

  constructor (options: Object = {}) {
    super(options);
    this._customVALK = options.customVALK;
  }

  decode (buffer: ArrayBuffer, { mediaName, partitionName, contentHash }: Object = {}): any {
    const source = this.stringFromBuffer(buffer);
    return transpileValoscriptModule(source, {
      customVALK: this._customVALK,
      cache: this._transpilationCache,
      sourceInfo: {
        phase: `valoscript Media "${mediaName}" as VALK module transpilation`,
        partitionName,
        mediaName,
        source,
        contentHash,
        sourceMap: new Map(),
      },
    });
  }
}
