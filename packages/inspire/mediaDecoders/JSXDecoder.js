// @flow

import React from "react";

import { addStackFrameToError, SourceInfoTag } from "~/raem/VALK/StackTrace";

import VALEK, { Kuery, EngineKuery, VS } from "~/engine/VALEK";

import { LENS } from "~/inspire/ui/UIComponent";
import vidgets from "~/inspire/ui";
import ValaaScope from "~/inspire/ui/ValaaScope";
import _jsxTransformFromString from "~/inspire/mediaDecoders/_jsxTransformFromString";

import MediaDecoder from "~/tools/MediaDecoder";
import notThatSafeEval from "~/tools/notThatSafeEval";
import { dumpObject, wrapError } from "~/tools";

export default class JSXDecoder extends MediaDecoder {
  static mediaTypes = [
    { type: "text", subtype: "jsx" },
  ];

  static columnOffset = 0;

  decode (buffer: ArrayBuffer, { partitionName, mediaName }: Object = {}): any {
    if (!buffer) return null;
    const sourceInfo: Object = {
      partitionName,
      mediaName,
      phaseBase: `'${mediaName}'/'${partitionName}' as ${this.type}/${this.subtype}`,
      phase: undefined,
      sourceMap: new Map(),
    };
    try {
      sourceInfo.source = `<UIComponent>${this.stringFromBuffer(buffer)}</UIComponent>`;
      sourceInfo.phase = `decode-jsx-transform phase of ${sourceInfo.phaseBase}`;
      sourceInfo.jsxTransformedSource = _jsxTransformFromString(sourceInfo.source,
          this._getJSXTransformOptions(sourceInfo));
      return this._decodeIntoIntegrator(sourceInfo, sourceInfo.jsxTransformedSource);
    } catch (error) {
      throw this.wrapErrorEvent(error, `decode(${sourceInfo.phaseBase})`,
          "\n\tsource:", sourceInfo.source);
    }
  }

  _getJSXTransformOptions (sourceInfo?: Object): Object {
    const ret = {
      factory: "createElement",
      spreadFn: "spread",
      unknownTagsAsString: true,
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

  _decodeIntoIntegrator (topLevelSourceInfo: Object, transformedSource: string) {
    const sourceInfo = {
      ...topLevelSourceInfo,
    };
    try {
      const scope = this._createDecodeScope(sourceInfo);
      sourceInfo.phase = `decode-eval phase of ${sourceInfo.phaseBase}`;
      const evalResult = notThatSafeEval(scope, `return ${transformedSource}`)(
          sourceInfo.mediaName, {});
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

  _createDecodeScope (sourceInfo: Object) {
    return {
      LENS,
      VS,
      VALK: VALEK,
      kuery: (kuery: EngineKuery = VALEK.head()) =>
          ({ kuery: (kuery instanceof Kuery) ? kuery : VALEK.to(kuery) }),
      addSourceInfo: (embeddedContent, startLine, startColumn, endLine, endColumn) =>
        this._addKuerySourceInfo(embeddedContent, sourceInfo,
            { line: startLine, column: startColumn }, { line: endLine, column: endColumn }),
      spread: (...rest) => Object.assign(...rest),
      createElement: (type, props, ...rest) => (parentKey: string, parentNameIndices: Object) => {
        const props_ = props || {};
        let hasComplexType = false;
        let isInstanceLensType = false;
        let actualType = type;
        let name;
        if (typeof type !== "string") name = type.name; // builtin react components
        else { // lowercase = builtin elements, uppercase = vidgets and instance lenses
          name = type;
          if (type[0] !== type[0].toLowerCase()) {
            hasComplexType = true;
            isInstanceLensType = !vidgets[type];
            actualType = vidgets[type] || ValaaScope;
          }
        }
        if (props_.class) {
          props_.className = props_.class;
          delete props_.class;
        }
        if (!props_.key) {
          props_.key = `${typeof parentKey === "string" ? parentKey : "kuery"}-${name}#${
              (parentNameIndices[name] = (parentNameIndices[name] || 0) + 1) - 1}`;
        }
        const hasComplexProps = Object.values(props_)
            .find((value => (value != null)
                && ((typeof value === "object") || (typeof value === "function"))));
        let hasComplexChildren = false;
        const nameIndices = {};
        const firstPassChildren = [].concat(...rest).map((child: any) => {
          if (typeof child !== "function") return child;
          const childWithKey = child(actualType.isUIComponent ? "" : props_.key, nameIndices);
          if (typeof childWithKey === "function") hasComplexChildren = true;
          return childWithKey;
        });
        if (!hasComplexType && !hasComplexProps && !hasComplexChildren) {
          return React.createElement(type, props_,
              ...(firstPassChildren.length ? [firstPassChildren] : []));
        }

        if (props_.key instanceof Kuery || actualType.isUIComponent) {
          props_.elementKey = props_.key;
          if (props_.key instanceof Kuery) delete props_.key;
        }

        if (actualType.isUIComponent && !props_.elementKey) props_.elementKey = props_.key;
        return (integrationHostGlobal: Object, mediaInfo: Object) => {
          try {
            const lexicalScope = integrationHostGlobal.Valaa;
            const actualProps = (!hasComplexProps && !isInstanceLensType) ? props_ : { ...props_ };
            if (isInstanceLensType) {
              actualProps.instanceLensPrototype =
                  VALEK.fromValue(lexicalScope).propertyValue(type);
              if (!lexicalScope[type]) {
                throw new Error(
                    `Cannot find instance lens prototype '${type}' from integration scope`);
              }
              console.warn("instanceLensPrototype:", type, lexicalScope,
                  actualProps.instanceLensPrototype);
            }
            const actualChildren = !hasComplexChildren ? firstPassChildren
                : firstPassChildren.map(child => (typeof child !== "function"
                    ? child : child(integrationHostGlobal, mediaInfo)));
            const elementWOSourceInfo = React.createElement(
                actualType, actualProps, ...(actualChildren.length ? [actualChildren] : []));
            const ret = Object.create( // unfreeze-hack so that we can write the _sourceInfo
                Object.getPrototypeOf(elementWOSourceInfo),
                Object.getOwnPropertyDescriptors(elementWOSourceInfo));
            ret._sourceInfo = sourceInfo;
            return ret;
          } catch (error) {
            throw wrapError(error, `During ${sourceInfo.mediaName} integration, with`,
                "\n\tintegrationHostGlobal:", ...dumpObject(integrationHostGlobal),
            );
          }
        };
      },
    };
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
