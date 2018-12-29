// @flow

import css from "jss-css/lib/css";

import MediaDecoder from "~/tools/MediaDecoder";

export default class CSSDecoder extends MediaDecoder {
  static mediaTypes = [
    { type: "text", subtype: "css" },
    { subtype: "css" },
  ];

  decode (buffer: ArrayBuffer): any {
    const source = this.stringFromBuffer(buffer);
    return css`${source}`;
  }
}
