// @flow

import { transpileValoscriptModule, Kuery } from "~/script";

import MediaDecoder from "~/tools/MediaDecoder";

export default class ValoscriptDecoder extends MediaDecoder {
  static mediaTypes = [
    { type: "application", subtype: "valoscript" },
    { type: "application", subtype: "valaascript" },
  ];

  _customVALK: ?Kuery;

  constructor (options: Object = {}) {
    super(options);
    this._customVALK = options.customVALK;
  }

  decode (buffer: ArrayBuffer, { mediaName, partitionName }: Object = {}): any {
    const source = this.stringFromBuffer(buffer);
    return transpileValoscriptModule(source, {
      customVALK: this._customVALK,
      sourceInfo: {
        phase: `valoscript Media "${mediaName}" as VALK module transpilation`,
        partitionName,
        mediaName,
        source,
        sourceMap: new Map(),
      },
    });
  }
}
