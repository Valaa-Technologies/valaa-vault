// @flow

import { addSourceEntryInfo, addStackFrameToError } from "~/raem/VALK/StackTrace";

import JSXDecoder from "~/inspire/mediaDecoders/JSXDecoder";
import VALEK from "~/engine/VALEK";

import { transpileValoscriptBody } from "~/script";

export default class VSXDecoder extends JSXDecoder {
  static mediaTypes = [
    { type: "text", subtype: "vsx" },
  ];

  static columnOffset = -1;

  _transpilationCache = {};

  _getJSXTransformOptions (sourceInfo?: Object): Object {
    const ret = super._getJSXTransformOptions(sourceInfo);
    if (sourceInfo) {
      sourceInfo.kueries = [];
      ret.transformExpressionText = (embeddedSource: any, start: any = {}, end: any = {}) => {
        sourceInfo.kueries.push(
            this._transpileEmbeddedValoscript(embeddedSource, sourceInfo, { start, end }));
        return `__kueries[${sourceInfo.kueries.length - 1}]`;
      };
    }
    return ret;
  }

  _createDecodeScope (sourceInfo: Object): Object {
    const ret = super._createDecodeScope(sourceInfo);
    ret.__kueries = sourceInfo.kueries;
    return ret;
  }

  _transpileEmbeddedValoscript (embeddedSource: string, topLevelSourceInfo: Object, loc: Object) {
    const sourceInfo = Object.create(topLevelSourceInfo);
    try {
      sourceInfo.phase = `inline VS transpilation at ${loc.start.line}:${loc.start.column} in ${
          sourceInfo.phaseBase}`;
      sourceInfo.sourceMap = new Map();
      const kuery = transpileValoscriptBody(`(${embeddedSource})`,
          { customVALK: VALEK, sourceInfo, cache: this._transpilationCache });
      sourceInfo.phase = `inline VS run at ${loc.start.line}:${loc.start.column} in ${
          sourceInfo.phaseBase}`;
      sourceInfo.sourceMap = new Map(sourceInfo.sourceMap); // prevent cache corruption
      return super._addKuerySourceInfo(kuery, sourceInfo, loc);
    } catch (error) {
      const origin = new Error(`_transpileEmbeddedValoscript(${sourceInfo.phaseBase})`);
      throw addStackFrameToError(
          this.wrapErrorEvent(error, 1, origin, "\n\tsourceInfo:", sourceInfo),
          addSourceEntryInfo(sourceInfo, {}, { loc }),
          sourceInfo, origin);
    } finally {
      for (const [entrySource, entryInfo] of sourceInfo.sourceMap) {
        addSourceEntryInfo(topLevelSourceInfo, entrySource, entryInfo);
      }
    }
  }
}
