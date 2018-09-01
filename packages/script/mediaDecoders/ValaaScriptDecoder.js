// @flow

import { transpileValaaScriptModule, Kuery } from "~/script";

import MediaDecoder from "~/tools/MediaDecoder";

export default class ValaaScriptDecoder extends MediaDecoder {
  static mediaTypes = [
    { type: "application", subtype: "valaascript" },
  ];

  _customVALK: ?Kuery;

  constructor (options: Object = {}) {
    super(options);
    this._customVALK = options.customVALK;
  }

  decode (buffer: ArrayBuffer, { mediaName, partitionName }: Object = {}): any {
    const source = this.stringFromBuffer(buffer);
    return transpileValaaScriptModule(source, {
      sourceInfo: {
        phase: `ValaaScript Media "${mediaName}" as VALK module transpilation`,
        partitionName,
        mediaName,
        source,
        sourceMap: new Map(),
      },
      customVALK: this._customVALK,
    });
  }
}
