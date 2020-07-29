// @flow

import type { VALKOptions } from "~/raem/VALK";
import { SourceInfoTag } from "~/raem/VALK/StackTrace";

import { addExportsContainerToScope } from "~/script";

import { MediaInfo } from "~/sourcerer/api/types";

import Vrapper from "~/engine/Vrapper";
import VALEK, { Kuery } from "~/engine/VALEK";

import { dumpObject } from "~/tools";

/**
 * Integrates the given context-free, shared decoding of some Media into the runtime context
 * of given vScope resource and returns the result.
 *
 * There are three different alternatives for integrating content into the runtime environment:
 * 1. Kuery integration: when the intepretation defines toVAKON it is considered to be a kuery
 *    and is valked against the vScope as head and vScope.lexicalContext() as the valk scope.
 * 2. native integration: when the decoding is a native function, it is called with the
 *    vScope.getHostGlobal() as the first argument.
 * 3. decoding mutabilization: deep copy of the immutable decoding allows users to
 *    modify the integrated content
 * 4. no integration: otherwise the integration process is a no-op.
 *
 * @param {*} decoding
 * @param {Vrapper} vScope
 * @param {{ type: string, subtype: string }} mediaInfo
 * @param {VALKOptions} options
 * @returns
 *
 * @memberof Engine
 */
export default function integrateDecoding (decodedContent: any, vScope: Vrapper,
    mediaInfo: MediaInfo, options: VALKOptions) {
  try {
    return (typeof decodedContent === "function")
            ? _integrateNative(decodedContent, vScope, mediaInfo, options)
        : (decodedContent instanceof Kuery)
            ? _integrateKuery(decodedContent, vScope, mediaInfo, options)
        : decodedContent;
  } catch (error) {
    throw vScope.wrapErrorEvent(error, 1, () => [
      `integrateDecoding(${mediaInfo.name})`,
      "\n\tdecodedContent:", ...dumpObject({ decodedContent }),
      "\n\tvScope:", ...dumpObject(vScope),
      "\n\tmediaInfo:", ...dumpObject(mediaInfo),
    ]);
  }
}

function _integrateNative (native: Function, vScope: Vrapper, mediaInfo: MediaInfo,
    options: VALKOptions) {
  const scope = (vScope && vScope.getHostGlobal()) || {};
  scope.require = _require.bind(null, vScope, options);
  return native(scope, mediaInfo, options);
}

function _integrateKuery (moduleKuery: Kuery, vScope: Vrapper, mediaInfo: MediaInfo,
    options: VALKOptions = {}) {
  const scopeName = vScope.hasInterface("Discoverable")
      && vScope.step("name", Object.create(options));
  const scopeDescriptor = scopeName ? `in Scope '${scopeName}'` : "in unnamed Scope";
  const sourceInfo = moduleKuery[SourceInfoTag] && {
    ...moduleKuery[SourceInfoTag],
    phase: `valoscript module "${mediaInfo.name}" integration ${scopeDescriptor}`,
  };
  options.scope = Object.create(vScope.getValospaceScope(options, moduleKuery, "integrateKuery"));
  const moduleExports = addExportsContainerToScope(options.scope);
  options.scope.require = _require.bind(null, vScope, options);
  const moduleResult = vScope.step(moduleKuery, Object.create(options));
  // Any function captures by the vScope.get will hold the Valker and
  // thus sourceInfo, and use its phase information during subsequent
  // calls. Update it to "runtime".
  sourceInfo.phase = `VALK runtime (within VS module "${mediaInfo.name}" ${scopeDescriptor})`;
  if (!Object.keys(moduleExports).length) {
    // TODO(iridian): This feels a bit shady, maybe the transpileValoscriptModule could tell us
    // if there were no exports in the module?
    moduleExports.default = moduleResult;
  }
  return moduleExports;
}

function _require (vScope: Vrapper, options: Object, importPath: string) {
  let steps: string[];
  let head = vScope;
  let nextHead;
  let i = 0;
  try {
    steps = importPath.split("/");
    const scopeKey = steps[0];
    if ((scopeKey !== ".") && (scopeKey !== "..")) {
      nextHead = head.step(VALEK.identifierValue(scopeKey), Object.create(options));
      if (steps.length === 1) {
        return (nextHead instanceof Vrapper)
            ? nextHead.extractValue(options)
            : nextHead;
      }
      if (!(nextHead instanceof Vrapper)) {
        throw new Error(`Could not find a Resource at initial import scope lookup for '${
            scopeKey}' (with path "${steps.slice(1).join("/")}" still remaining)`);
      }
      head = nextHead;
      i = 1;
    } // else as the first step is either "." or ".." just start from beginning with i === 0
    for (; i + 1 /* terminate one before end */ < steps.length; ++i) {
      const ownlingName = steps[i];
      if (ownlingName === ".") continue;
      if (ownlingName === "..") {
        nextHead = head.step(VALEK.toField("owner"), Object.create(options));
        if (!(nextHead instanceof Vrapper)) {
          throw new Error(`Could not find an owner Resource at import step '..' (with path "${
              steps.slice(i).join("/")}" still remaining)`);
        }
      } else {
        nextHead = head.step(VALEK.toField("unnamedOwnlings")
                .filter(VALEK.isOfType("Entity").and(VALEK.hasName(ownlingName))).toIndex(0),
            Object.create(options));
        if (!(nextHead instanceof Vrapper)) {
          throw new Error(`Could not find an ownling Entity at import step '${ownlingName
              }' (with path "${steps.slice(i).join("/")}" still remaining)`);
        }
      }
      head = nextHead;
    }
    const mediaOrPropertyName = steps[steps.length - 1];
    nextHead = head.step(VALEK.toField("unnamedOwnlings")
            .filter(VALEK.isOfType("Media").and(VALEK.hasName(mediaOrPropertyName))).toIndex(0),
        Object.create(options));
    if (nextHead) {
      return nextHead.extractValue(Object.create(options), head);
    }
    nextHead = head.step(VALEK.propertyValue(mediaOrPropertyName), Object.create(options));
    if ((nextHead instanceof Vrapper)
        && (nextHead.getTypeName(Object.create(options)) === "Media")) {
      // can't provide head as explicit owner as the property might refer outside of the head.
      return nextHead.extractValue(options);
    }
    return nextHead;
  } catch (error) {
    throw vScope.wrapErrorEvent(error, 1, () => [
      `require("${importPath}")`,
      "\n\tcurrent head:", ...dumpObject(head),
      "\n\tcurrent step:", steps[i],
      "\n\tnext head candidate:", ...dumpObject(nextHead),
      "\n\tscope resource:", ...dumpObject(vScope),
    ]);
  }
}
