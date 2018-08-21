// @flow

import React from "react";

import { addStackFrameToError, SourceInfoTag } from "~/raem/VALK/StackTrace";

import VALEK, { Kuery, EngineKuery, VS } from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import { LENS } from "~/inspire/ui/UIComponent";
import vidgets from "~/inspire/ui";
import ValaaScope from "~/inspire/ui/ValaaScope";
import _jsxTransformFromString from "~/inspire/mediaDecoders/_jsxTransformFromString";

import MediaDecoder from "~/tools/MediaDecoder";
import notThatSafeEval from "~/tools/notThatSafeEval";

export default class JSXDecoder extends MediaDecoder {
  static mediaTypes = [
    { type: "text", subtype: "jsx" },
  ];

  static columnOffset = 0;

  decode (buffer: ArrayBuffer, { partitionName, mediaName }: Object): any {
    if (!buffer) return null;
    const sourceInfo: Object = {
      partitionName,
      mediaName,
      phaseBase: `'${mediaName}'/'${partitionName}' as ${this.type}/${this.subtype}`,
      phase: undefined,
      sourceMap: new Map(),
    };
    try {
      sourceInfo.source = `(${this.stringFromBuffer(buffer)})`;
      sourceInfo.phase = `jsx-transform phase of ${sourceInfo.phaseBase}`;
      sourceInfo.jsxTransformedSource = _jsxTransformFromString(sourceInfo.source,
          this._getJSXTransformOptions(sourceInfo));
      return this._integrate.bind(this, sourceInfo, sourceInfo.jsxTransformedSource);
    } catch (error) {
      throw this.wrapErrorEvent(error, `decode(${sourceInfo.phaseBase})`,
          "\n\tsource:", sourceInfo.source);
    }
  }

  _integrate (topLevelSourceInfo: Object, transformedSource: string, hostGlobalScope: Object,
      mediaInfo: Object) {
    const sourceInfo = {
      ...topLevelSourceInfo,
      mediaInfo,
    };
    try {
      const scope = this._createScope(hostGlobalScope.Valaa, sourceInfo);
      sourceInfo.phase = `integration phase of ${sourceInfo.phaseBase}`;
      const evalResult = notThatSafeEval(scope, `return ${transformedSource}`);
      sourceInfo.phase = `run phase of ${sourceInfo.phaseBase}`;
      return evalResult;
    } catch (error) {
      const wrappedError = this.wrapErrorEvent(error,
          `_integrate(${sourceInfo.phaseBase}):`,
          "\n\tsourceInfo:", sourceInfo);
      if (!sourceInfo || !error.column || !error.lineNumber) throw wrappedError;
      const loc = {
        start: { line: error.lineNumber, column: error.column - 1 }, // 3?
        end: { line: error.lineNumber, column: error.column },
      };
      const sourceDummy = {};
      sourceInfo.sourceMap.set(sourceDummy, { loc });
      throw addStackFrameToError(wrappedError, sourceDummy, sourceInfo);
    }
  }

  _getJSXTransformOptions (sourceInfo?: Object): Object {
    const ret = {
  //        factory: "() => createElement",
      factory: "createElement",
      spreadFn: "spread",
      unknownTagsAsString: false,
      passUnknownTagsToFactory: true,
      transformExpressionText: undefined,
    };
    if (sourceInfo) {
      ret.transformExpressionText = (text: any, start: { line?: number, column?: number } = {},
          end: { line?: number, column?: number } = {}) =>
              `addSourceInfo(${text}, ${start.line}, ${start.column}, ${end.line}, ${end.column})`;
    }
    return ret;
  }

  _createScope (scope: Object, sourceInfo: Object) {
    const ret = {
      ...vidgets,
      ...scope,
      children: null,
      LENS,
      VS,
      VALK: VALEK,
      createElement: (type, props, ...rest) => {
        const children = [].concat(...rest).map((child: any, index: number) =>
            ((typeof child !== "object" || child === null || !child.type || child.key)
                ? child
                : React.cloneElement(child, {
                  key: `#${index}-`,
                  ...(child.type.isUIComponent ? { elementKey: `#${index}-` } : {}),
                }, child.props.children)));
        const element = (type instanceof Vrapper)
            ? React.createElement(ValaaScope, { ...props, elementPrototype: type },
                  ...(children.length ? [children] : []))
            : React.createElement(type, props, ...(children.length ? [children] : []));
        const elementWithSourceInfo = Object.create(
            Object.getPrototypeOf(element),
            Object.getOwnPropertyDescriptors(element));
        elementWithSourceInfo._sourceInfo = sourceInfo;
        return elementWithSourceInfo;
      },
      addSourceInfo: (embeddedContent, startLine, startColumn, endLine, endColumn) =>
        this._addKuerySourceInfo(embeddedContent, sourceInfo,
            { line: startLine, column: startColumn }, { line: endLine, column: endColumn }),
        // Non-object blockValues lack identity and cannot have any source info associated with them
      spread: (...rest) => Object.assign(...rest),
      kueryTag: (strings, ...values) => (origHead: ?any) => {
        let strBuilder = "";
        for (const [index, str] of strings.entries()) {
          const val = values[index];
          strBuilder += str;
          if (val) strBuilder += typeof val === "function" ? val(origHead) : val;
        }
        return strBuilder;
      },
      get: (kuery: EngineKuery = VALEK.head()) =>
          ((kuery instanceof Kuery) ? kuery : VALEK.to(kuery)),
      kuery: (kuery: EngineKuery = VALEK.head()) =>
          ({ kuery: (kuery instanceof Kuery) ? kuery : VALEK.to(kuery) }),
      event: (eventName: string, { emit = eventName, target = VALEK.fromScope("lensHead") }
          = {}) => ({ [eventName]: target.propertyValue(emit) }),
    };
    delete ret.this;
    return ret;
  }

  _addKuerySourceInfo (embeddedContent: any, outerSourceInfo: Object, start: Object, end: Object) {
    if (typeof embeddedContent !== "object" || embeddedContent === null) return embeddedContent;
    if (!(embeddedContent instanceof Kuery)) {
      const entries = Array.isArray(embeddedContent) ? embeddedContent
          : (Object.getPrototypeOf(embeddedContent) === Object.prototype)
              ? Object.values(embeddedContent)
              : [];
      entries.forEach(entry => this._addKuerySourceInfo(entry, outerSourceInfo, start, end));
      return embeddedContent;
    }
    const sourceInfo: any = embeddedContent[SourceInfoTag];
    if (!sourceInfo) {
      outerSourceInfo.sourceMap.set(embeddedContent.toVAKON(), { loc: { start, end, } });
    } else {
      for (const [key, entry] of sourceInfo.sourceMap) {
        const loc = { start: { ...entry.loc.start }, end: { ...entry.loc.end } };
        if (loc.start.line === 1) {
          loc.start.column += start.column + this.constructor.columnOffset;
        }
        if (loc.end.line === 1) loc.end.column += start.column + this.constructor.columnOffset;
        loc.start.line += start.line - 1;
        loc.end.line += start.line - 1;
        outerSourceInfo.sourceMap.set(key, { ...entry, loc });
      }
    }
    embeddedContent[SourceInfoTag] = outerSourceInfo;
    return embeddedContent;
  }
}
