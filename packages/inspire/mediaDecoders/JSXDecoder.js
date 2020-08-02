// @flow

import React from "react";

import { addSourceEntryInfo, addStackFrameToError, SourceInfoTag } from "~/raem/VALK/StackTrace";

import VALEK, { Kuery, EngineKuery, VS, IsLiveTag } from "~/engine/VALEK";

import UIComponent, { LENS } from "~/inspire/ui/UIComponent";
import { ValensPropsTag, tryCreateValensArgs } from "~/inspire/ui/UIComponent/Valens";
import vidgets from "~/inspire/ui";
import Valoscope from "~/inspire/ui/Valoscope";
import Lens from "~/inspire/valosheath/valos/Lens";
import _jsxTransformFromString from "~/inspire/mediaDecoders/_jsxTransformFromString";

import { ScopeAccessesTag } from "~/script/VALSK";

import MediaDecoder from "~/tools/MediaDecoder";
import notThatSafeEval from "~/tools/notThatSafeEval";
import { dumpObject } from "~/tools";
import Valens from "../ui/UIComponent/Valens";

export default class JSXDecoder extends MediaDecoder {
  static mediaTypes = [
    { type: "text", subtype: "jsx" },
  ];

  static columnOffset = 0;

  constructor (options) {
    super(options);
    this._gatewayDiscourse = options.gateway.discourse;
  }

  decode (buffer: ArrayBuffer, { chronicleName, mediaName }: Object = {}): any {
    if (!buffer) return null;
    const sourceInfo: Object = {
      chronicleName,
      mediaName,
      phaseBase: `'${mediaName}'/'${chronicleName}' as ${this.type}/${this.subtype}`,
      phase: undefined,
      sourceMap: new Map(),
    };
    try {
      const originalSource = this.stringFromBuffer(buffer);
      sourceInfo.source = `<UIComponent>${originalSource}</UIComponent>`;
      sourceInfo.phase = `decode-jsx-transform phase of ${sourceInfo.phaseBase}`;
      try {
        sourceInfo.jsxTransformedSource = _jsxTransformFromString(sourceInfo.source,
          this._getJSXTransformOptions(sourceInfo));
      } catch (error) {
        if (!error.column || !error.lineNumber) throw error;
        sourceInfo.source = originalSource;
        const loc = {
          start: { line: error.lineNumber - 1, column: error.column - 1 }, // 3?
          end: { line: error.lineNumber - 1, column: error.column },
        };
        throw addStackFrameToError(error, addSourceEntryInfo(sourceInfo, {}, { loc }), sourceInfo);
      }
      return this._decodeIntoIntegrator(sourceInfo, sourceInfo.jsxTransformedSource);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `decode(${sourceInfo.phaseBase})`,
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
      const rootElementBindKeys = notThatSafeEval(scope, `return ${transformedSource}`);
      // Note: keys that start with '-' are treated as autogenerated. All other keys are considered
      // as custom user provided keys. For example lens instances use custom keys to store
      // themselves inside parent instance owner properties.
      const rootChildrenMeta = this._createChildrenMeta();
      delete sourceInfo.currentLoc;
      const integrator = rootElementBindKeys(
          encodeURIComponent(sourceInfo.mediaName), rootChildrenMeta);
      sourceInfo.phase = `run phase of ${sourceInfo.phaseBase}`;
      return integrator;
    } catch (error) {
      const wrappedError = this.wrapErrorEvent(error, 1,
          `_decodeIntoIntegrator(${sourceInfo.phaseBase}):`,
          "\n\tsourceInfo:", sourceInfo);
      if (!sourceInfo || !error.column || !error.lineNumber) throw wrappedError;
      const loc = {
        start: { line: error.lineNumber, column: error.column - 1 }, // 3?
        end: { line: error.lineNumber, column: error.column },
      };
      throw addStackFrameToError(wrappedError,
          addSourceEntryInfo(sourceInfo, {}, { loc }),
          sourceInfo);
    }
  }

  _createDecodeScope (sourceInfo: Object) {
    return {
      LENS,
      VS,
      VALK: VALEK,
      kuery: (kuery: EngineKuery = VALEK.head()) =>
          ({ kuery: (kuery instanceof Kuery) ? kuery : VALEK.to(kuery) }),
      addSourceInfo: (embeddedContent, startLine, startColumn, endLine, endColumn) => {
        sourceInfo.currentLoc = {
          start: { line: startLine, column: startColumn },
          end: { line: endLine, column: endColumn },
        };
        return this._addKuerySourceInfo(
            embeddedContent, sourceInfo, sourceInfo.currentLoc);
      },
      spread: (...rest) => Object.assign(...rest),
      createElement: (type, props, ...restChildren) => {
        const self = this;
        const loc = sourceInfo.currentLoc || { start: {} }; // does not work yet
        _recurseWithKeys._isKeyRecurser = true;
        return _recurseWithKeys;
        function _recurseWithKeys (parentKey: string, parentChildrenMeta: Object) {
          try {
            return self._createKeyedElement(
              sourceInfo, loc, type, props, restChildren, parentKey, parentChildrenMeta);
          } catch (error) {
            throw self.wrapErrorEvent(error, 0, () => [
              new Error(`_createKeyedElement(${parentKey})`),
              "\n\ttype:", ...dumpObject(type),
              "\n\tprops:", ...dumpObject(props),
              "\n\trestChildren:", ...dumpObject(restChildren),
            ]);
          }
        }
      },
    };
  }

  _addKuerySourceInfo (embeddedContent: any, outerSourceInfo: Object, loc: Object) {
    if (typeof embeddedContent !== "object" || embeddedContent === null) return embeddedContent;
    if (!(embeddedContent instanceof Kuery)) {
      const entries = Array.isArray(embeddedContent) ? embeddedContent
          : (Object.getPrototypeOf(embeddedContent) === Object.prototype)
              ? Object.values(embeddedContent)
              : [];
      entries.forEach(entry => this._addKuerySourceInfo(entry, outerSourceInfo, loc));
      return embeddedContent;
    }
    const sourceInfo: any = embeddedContent[SourceInfoTag];
    if (!sourceInfo) {
      addSourceEntryInfo(outerSourceInfo, embeddedContent.toVAKON(), { loc: { ...loc } });
    } else {
      for (const [key, entry] of sourceInfo.sourceMap) {
        const subLoc = { start: { ...entry.loc.start }, end: { ...entry.loc.end } };
        if (subLoc.start.line === 1) {
          subLoc.start.column += loc.start.column + this.constructor.columnOffset;
        }
        if (subLoc.end.line === 1) {
          subLoc.end.column += loc.start.column + this.constructor.columnOffset;
        }
        subLoc.start.line += loc.start.line - 1;
        subLoc.end.line += loc.start.line - 1;
        addSourceEntryInfo(outerSourceInfo, key, { ...entry, loc: subLoc });
      }
    }
    embeddedContent[SourceInfoTag] = outerSourceInfo;
    return embeddedContent;
  }

  static _nameAbbreviations = {
    div: "d",
    span: "s",
    UIComponent: "UIC",
    Valoscope: "VSC",
    Valens: "VLE",
  };

  _createKeyedElement (sourceInfo, loc, type, props, restChildren, parentKey, parentChildrenMeta) {
    let actualType = type;
    let name;
    let isInstanceLens = false;
    if (typeof type !== "string") {
      name = type.name; // builtin react components
    } else {
      name = type; // lowercase names are builtin elements
      if (type[0] !== type[0].toLowerCase()) {
        // uppercase are vidgets and instance lenses, always ui components
        isInstanceLens = !vidgets[type];
        actualType = vidgets[type] || Valoscope;
      }
    }
    const children = [].concat(...restChildren);
    if ((actualType === UIComponent)
        && (children.length === 1)
        && (!props || (Object.keys(props).length === 0))) {
      const shortCircuit = _maybeRecurseWithKey(children[0], parentKey, parentChildrenMeta);
      if (React.isValidElement(shortCircuit)) return shortCircuit;
    }
    const elementPrefix = JSXDecoder._nameAbbreviations[name] || name;
    const elementIndex = (parentChildrenMeta.nameIndices[name] =
      (parentChildrenMeta.nameIndices[name] || 0) + 1) - 1;
    const elementKey = `${elementPrefix}(${elementIndex})`;
    const lexicalName = `${parentKey || ""}-${elementKey}`;

    let decodedType = actualType;
    let decodedProps;
    let propsMeta;
    if (props || isInstanceLens) {
      propsMeta = this._createPropsMeta(sourceInfo, loc, props || {}, name,
          isInstanceLens, actualType.isUIComponent, lexicalName);
      ([decodedType, decodedProps] =
          tryCreateValensArgs(
              actualType, Object.entries(propsMeta.decodedElementProps), lexicalName)
          || [actualType, propsMeta.decodedElementProps]);
    }
    if (parentChildrenMeta.totalCount > 1) {
      if (!decodedProps) decodedProps = {};
      if (!decodedProps.key) decodedProps.key = elementKey;
    }

    const childrenMeta = this._createChildrenMeta(children, lexicalName);
    const decodedChildrenArgs = !childrenMeta.decodedChildren ? [] : [childrenMeta.decodedChildren];

    if (!childrenMeta.hasIntegrators) {
      if (childrenMeta.hasKueries) {
        parentChildrenMeta.hasKueries = true;
        Object.assign(parentChildrenMeta.scopeAccesses
            || (parentChildrenMeta.scopeAccesses = {}), childrenMeta.scopeAccesses);
      }
      return _injectSourceInfoTag(
          React.createElement(decodedType, decodedProps, ...decodedChildrenArgs),
          sourceInfo);
    }

    function _elementIntegrator (integrationHostGlobal: Object) {
      try {
        const integrationFabricScope = integrationHostGlobal.valos;
        let integratedProps;
        const vIntegrator = integrationFabricScope.this;
        /*
        if (isInstanceLens) {
          integratedProps.instanceLensPrototype =
              VALEK.fromValue(integrationFabricScope).propertyValue(type);
          if (!integrationFabricScope[type]) {
            throw new Error(`Cannot find lens instance prototype by name '${type
                }' from integration scope of ${vIntegrator.debugId()}`);
          }
        }
        */
        const integrateableKueries = propsMeta && propsMeta.integrateableKueries;
        if (integrateableKueries) {
          integratedProps = { ...decodedProps };
          if (decodedType === Valens) {
            integratedProps.elementPropsSeq = [...decodedProps.elementPropsSeq];
            for (const [propName, propKuery] of integrateableKueries) {
              integratedProps.elementPropsSeq.push([propName, vIntegrator.step(propKuery)]);
            }
          } else {
            for (const [propName, propKuery] of integrateableKueries) {
              integratedProps[propName] = vIntegrator.step(propKuery);
            }
          }
        }
        const integratedChildrenArgs = !childrenMeta.hasIntegrators
            ? decodedChildrenArgs
            : [decodedChildrenArgs[0].map(child =>
                _maybeIntegrate(child, integrationHostGlobal))];
        return _injectSourceInfoTag(
            React.createElement(
                decodedType,
                integratedProps || decodedProps,
                ...integratedChildrenArgs),
            sourceInfo);
      } catch (error) {
        throw this.wrapErrorEvent(error, 1, () => [
          `createDecodeScope/${sourceInfo.mediaName} integration`,
          "\n\tintegrationHostGlobal:", ...dumpObject(integrationHostGlobal),
        ]);
      }
    }
    _elementIntegrator._isIntegrator = true;
    return _elementIntegrator;
  }

  _createChildrenMeta (children, parentKey) {
    const ret = {
      hasIntegrators: false, hasKueries: false, totalCount: (children && children.length) || 0,
      scopeAccesses: {}, nameIndices: {},
    };
    ret.decodedChildren = children && children.length && children.map(child =>
        _extractMetaOfValueInto(
            _maybeRecurseWithKey(child, parentKey, ret),
            ret,
            this._gatewayDiscourse));
    return ret;
  }

  _createPropsMeta (
      sourceInfo, loc, parsedProps, elementName, isInstanceLens, isComponentLens, lexicalName) {
    const ret = {
      hasIntegrators: false, hasKueries: false, totalCount: 0,
      scopeAccesses: {}, byNamespace: {}, decodedElementProps: {}, integrateableKueries: [],
    };

    /* eslint-disable prefer-const */
    let {                                           // E  C  I
      key,                                          // ?     WL
      class: class_,                                // D  L  A
      focus, head, array, ref, styleSheet, context, // WL L  WL
      elementKey,                                   // WL WL WL
      vScope, valoscope, valaaScope,                // WL WL WL
      ...restAttrs
    } = parsedProps;

    if (isInstanceLens) {
      ++ret.totalCount;
      restAttrs["$Lens:instanceLensPrototype"] = _getInstanceLensPrototypeKuery(elementName);
    }

    for (const [attrName, aliasOf, shouldWarn, warnMessage] of [
      ["focus", "$Lens:focus"],
      ["head", "$Lens:focus", true],
      ["array", "$Lens:array"],
      ["key", "$Lens:key"],
      ["context", "$Lens:context"],
      ["elementKey", "$Lens:frameKey", true],
      ["class", !isComponentLens ? "className" : "class", false],
      ["styleSheet", "$Lens:styleSheet"],
      ["valoscope", "$Lens:valoscope", true, "direct Lens:<property> notation"],
      ["vScope", "$Lens:valoscope", true, "direct Lens:<property> notation"],
      ["valaaScope", "$Lens:valoscope", true, "direct Lens:<property> notation"],
      ["ref", "$Lens:ref", true],
    ]) {
      if (parsedProps[attrName] === undefined) continue;
      if (shouldWarn || ((shouldWarn !== false) && (!isComponentLens || isInstanceLens))) {
        this.debugEvent(`DEPRECATED: non-namespaced attribute '${attrName}' in favor of ${
            warnMessage || aliasOf.slice(1)} (in ${elementName} at ${lexicalName})`);
      }
      if (restAttrs[aliasOf] !== undefined) {
        throw new Error(`Attribute conflict found; the deprecated non-namespaced attribute '${
            attrName}' would alias to ${aliasOf.slice(1)} which has an existing value "${
            restAttrs[aliasOf]}" (in ${elementName} at ${lexicalName})`);
      }
      ++ret.totalCount;
      restAttrs[aliasOf] = parsedProps[attrName];
    }

    const defaultNamespace = !isComponentLens ? "Element" : !isInstanceLens ? "Lens" : "Frame";
    const flattenedNamespace = !isComponentLens ? "Element" : "Lens";
    for (const [givenName, attr] of Object.entries(restAttrs)) {
      let [, namespace, name] = givenName.match(/^\$([^.]+):(.*)$/)
          || [null, defaultNamespace, givenName];
      const isLiveKuery = namespace.startsWith("live.") ? true
          : namespace.startsWith("static.") ? false
          : undefined;
      if (isLiveKuery !== undefined) namespace = namespace.slice(isLiveKuery ? 5 : 7);
      const namespaceAttrs = ret.byNamespace[namespace] || (ret.byNamespace[namespace] = {});
      if (namespaceAttrs[name] !== undefined) {
        this.debugEvent(`Overriding existing value of attribute ${namespace}:${name
            } by given attribute '${givenName
            }' (likely as a result of two aliased props, in ${elementName} at ${lexicalName})`);
      }
      const decodedValue = namespaceAttrs[name] =
          _extractMetaOfValueInto(attr, ret, this._gatewayDiscourse, isLiveKuery);
      const propName = (namespace === flattenedNamespace) ? name : `$${namespace}.${name}`;
      if ((typeof decodedValue === "function") && decodedValue._isIntegrator) {
        ret.integrateableKueries.push([propName, decodedValue]);
      } else {
        ret.decodedElementProps[propName] = decodedValue;
      }
    }
    return ret;
  }
}

export const integrationFabricScopeTag = Symbol("integrationFabricScope");
const _instanceLensPrototypeKueries = {};

function _getInstanceLensPrototypeKuery (elementName) {
  let ret = _instanceLensPrototypeKueries[elementName];
  if (!ret) {
    ret = _instanceLensPrototypeKueries[elementName] =
        VALEK.fromScope(Lens.integrationScopeResource)
            .propertyValue(elementName)
            .setScopeAccesses({ integrationScopeResource: "read" });
  }
  return ret;
}

function _extractMetaOfValueInto (value, meta, gatewayDiscourse, isLiveIfKuery) {
  let ret = value;
  if (value instanceof Kuery) {
    const scopeAccesses = ret[ScopeAccessesTag];
    if (!scopeAccesses && gatewayDiscourse) {
      ret = gatewayDiscourse.run(null, ret);
      if ((typeof ret === "object") && (ret != null)) {
        Object.freeze(ret);
      }
    } else {
      Object.assign(meta.scopeAccesses || (meta.scopeAccesses = {}), scopeAccesses);
      if (false) {
        ret = function _kueryIntegrator (integrationHostGlobal) {
          return integrationHostGlobal.valos.this.step(ret);
        };
        ret._isIntegrator = true;
      } else {
        meta.hasKueries = true;
        if (isLiveIfKuery !== undefined) {
          ret = Object.create(Object.getPrototypeOf(ret), Object.getOwnPropertyDescriptors(ret));
          ret[IsLiveTag] = isLiveIfKuery;
        }
      }
    }
  }
  if (typeof ret === "function") {
    if (ret._isIntegrator) meta.hasIntegrators = true;
  }
  return ret;
}

function _maybeIntegrate (maybeIntegrator, integrationHostGlobal, mediaInfo) {
  return (typeof maybeIntegrator === "function") && maybeIntegrator._isIntegrator
      ? maybeIntegrator(integrationHostGlobal, mediaInfo)
      : maybeIntegrator;
}

function _maybeRecurseWithKey (maybeRecurser, parentKey, parentChildrenMeta) {
  return (typeof maybeRecurser === "function") && maybeRecurser._isKeyRecurser
      ? maybeRecurser(parentKey, parentChildrenMeta)
      : maybeRecurser;
}

function _injectSourceInfoTag (elementWOSourceInfo, sourceInfo) {
  const ret = Object.create( // unfreeze-hack so that we can write the tags
      Object.getPrototypeOf(elementWOSourceInfo),
      Object.getOwnPropertyDescriptors(elementWOSourceInfo));
  ret[SourceInfoTag] = sourceInfo;
  ret[ValensPropsTag] = null;
  return ret;
}
