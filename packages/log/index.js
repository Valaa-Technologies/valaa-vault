const { default: patchWith } = require("@valos/tools/patchWith");
const { mutateVState, baseStateContext, referenceArrayTag } = require("@valos/state");
const { V } = require("@valos/space/ontology");
const { VState } = require("@valos/state/ontology");
const { wrapError } = require("@valos/tools");

module.exports = {
  baseLogContext: {
    ...baseStateContext,
    "&~": {
      "@base": "urn:valos:chronicle:0/",
      "@id": "VState:logicalResources", "@type": "@id", "@container": "@id",
    },
  },
  applyVLogDelta (currentVState, vlogEvent) {
    const mutableState = mutateVState(currentVState);
    _patchURITerms(mutableState, vlogEvent);
    return patchWith(mutableState, vlogEvent, {
      keyPath: [],
      deleteUndefined: true,
      iterableToArray: "reduce",
      iterableToOther: "reduce",
      basePlot: [],
      originPlot: [],
      preApplyPatch: _patchStateResource,
    });
  },
};

/*
   ####   ######   #####  #    #  #####
  #       #          #    #    #  #    #
   ####   #####      #    #    #  #    #
       #  #          #    #    #  #####
  #    #  #          #    #    #  #
   ####   ######     #     ####   #
*/

const ontologies = { V, VState };

const _nodeTermUpserters = {
  // Ignore all direct @context modifications.
  // @base has already been resolved by _patchDeltaNode (as it
  // needs to be resolved before other entries)
  // TODO(iridian, 2021-03): Validate @context and reject all unsupported fields.
  "@context": null,
  "&~": null,
  "&_": null,
  "&-": null,
  "~P": _patchRejectForbiddenDirectManipulation,
  "~E": _patchRejectForbiddenDirectManipulation,
  "~R": _patchRejectForbiddenDirectManipulation,
  "~M": _patchRejectForbiddenDirectManipulation,
  "-hasI": _patchRejectForbiddenDirectManipulation,
  "-hasG": _patchRejectForbiddenDirectManipulation,
  "-out": _patchRejectForbiddenDirectManipulation,
  "-in": _patchRejectForbiddenDirectManipulation,
};

const _nodeTermRemovers = {
  "@context": null,
  "&~": null,
  "&_": null,
  "&-": null,
};

function _patchRejectForbiddenDirectManipulation (stack, target, delta, key) {
  throw new Error(`Cannot apply a patch to term "${key}" directly ${
      ""}(only via its linked/coupled properties)`);
}

const _vlogTermById = {};

for (const [term, expansion] of Object.entries(baseStateContext)) {
  if (!expansion["@id"]) continue;
  _vlogTermById[expansion["@id"]] = term;
}

for (const [term, expansion] of Object.entries(baseStateContext)) {
  if (term[0] === "@") continue;
  const id = expansion["@id"];
  if (!id) continue;
  const definition = _getDefinitionOf(id);
  const aliases = [id].concat(_recurseSubProperties(definition) || []);
  const coupledTerms = _getReverseTermsOf(definition["VState:coupledToField"]);
  const linkedTerms = _getReverseTermsOf(definition["VState:linkedToField"]);
  if (_nodeTermUpserters[term] === undefined) {
    _nodeTermUpserters[term] = _createStandardTermPatcher(term, {
      expansion, definition,
      isId: expansion["@type"] === "@id",
      isSingular: expansion["@container"] === undefined,
      aliases, coupledTerms, linkedTerms,
    });
  }
  if (_nodeTermRemovers[term] === undefined) {
    _nodeTermRemovers[term] = _createStandardTermPatcher(term, {
      expansion, definition,
      isId: expansion["@type"] === "@id",
      isSingular: expansion["@container"] === undefined,
      isRemover: true,
      aliases, coupledTerms, linkedTerms,
    });
  }
}

function _getDefinitionOf (id) {
  const [namespace, suffix] = id.split(":");
  const definition = ((ontologies[namespace] || {}).vocabulary || {})[suffix];
  if (definition) return definition;
  console.log("No definition for:", id, `in namespace ${namespace}:`,
      ...(!ontologies[namespace]
          ? ["<no such ontology>"]
          : Object.keys((ontologies[namespace] || {}).vocabulary)));
  throw new Error(`No definition for ${id} in namespace ${namespace}`);
}

function _getReverseTermsOf (couplingOrLinkingId) {
  if (!couplingOrLinkingId) return undefined;
  const definition = _getDefinitionOf(couplingOrLinkingId);
  const reverseTerms = [couplingOrLinkingId].concat(_recurseSubProperties(definition));
  for (const reverseTerm of reverseTerms) {
    if (_vlogTermById[reverseTerm]) reverseTerms.push(_vlogTermById[reverseTerm]);
  }
  return reverseTerms;
}

function _recurseSubProperties (definition, ret = []) {
  const subProperties = (definition || {})["rdfs:subPropertyOf"];
  for (const subProperty of [].concat(subProperties || [])) {
    if (ret.indexOf(subProperty) === -1) ret.push(subProperty);
    if (!subProperty.startsWith("V:")) continue;
    _recurseSubProperties(V.vocabulary[subProperty.slice(2)], ret);
  }
  return ret;
}

/*
 #####     ##     #####   ####   #    #  ######  #####    ####
 #    #   #  #      #    #    #  #    #  #       #    #  #
 #    #  #    #     #    #       ######  #####   #    #   ####
 #####   ######     #    #       #    #  #       #####        #
 #       #    #     #    #    #  #    #  #       #   #   #    #
 #       #    #     #     ####   #    #  ######  #    #   ####
*/

function _patchURITerms (mutableState, vlogEvent) {
  const uriTerms = (vlogEvent["@context"] || [])[0];
  if (uriTerms) {
    Object.assign(mutableState[referenceArrayTag], uriTerms);
  }
}

function _patchStateResource (mutableTarget, delta, key, parentTarget, deltaKey) {
  const context = delta["@context"];
  if (deltaKey === undefined) {
    // Top level delta.
    if (!delta["&~"]) throw new Error("VLog event is missing global resource delta section '&~'");
    this.mutableGlobalResources = _mutateSubs(mutableTarget, undefined, "&^");
    _processGlobalResourcesDelta(this, delta["&~"], this.mutableGlobalResources);
  } else if (context) {
    throw new Error("@context not allowed for log events");
  } else {
    if (delta["&-"]) _processProperties(this, mutableTarget, delta["&-"], true);
    _processProperties(this, mutableTarget, delta);
    if (delta["&_"]) {
      if (this.originPlot.length !== 1) {
        throw new Error(
            `Nested sub-resources not allowed in deltas ('&_' present in sub-resource </${
                this.originPlot.join("/")}/>)`);
      }
      _processSubResourcesDelta(
          this, delta["&_"], _mutateSubs(mutableTarget, `${this.originPlot[0]}/`));
    }
  }
  return mutableTarget;
}

function _processGlobalResourcesDelta (stack, resourcesDelta, originParentSubs) {
  const resourceKeys = Object.keys(resourcesDelta);
  resourceKeys.sort();
  if (!resourceKeys.length) throw new Error(`Invalid empty "&~" global resources delta`);
  for (const logicalStepsString of resourceKeys) {
    const globalResourceDelta = resourcesDelta[logicalStepsString];
    let rootOriginId, originSubPlot;
    try {
      const logicalPlot = _joinResourcesPlot(["0"], logicalStepsString);
      // validate logical plot
      /*
      let i = 0;
      for (; i !== parentLogicalPlot.length; ++i) {
        if (logicalPlot[i] !== parentLogicalPlot[i]) {
          throw new Error(`Invalid vplot "${logicalStepsString
              }": step #${i} mismatch; resulting logical plot "${logicalPlot.join("/")
              }" is not a descendant of the parent plot "${parentLogicalPlot.join("/")}"`);
        }
      }
      if (i >= logicalPlot.length) {
        throw new Error(`Invalid vplot "${logicalStepsString}": length of resulting logical plot "${
            logicalPlot.join("/")}" is shorter and thus not a descendant of the parent plot "${
            parentLogicalPlot.join("/")}"`);
      }
      */
      originSubPlot = stack.originPlot = logicalPlot.slice(-1);
      const globalStep = `${originSubPlot[0]}/`;
      stack.patch(_mutateSubResource(originParentSubs, globalStep),
          globalResourceDelta, globalStep, originParentSubs, logicalStepsString, resourcesDelta);
    } catch (error) {
      throw wrapError(error, 1, `_processGlobalResourcesDelta["${logicalStepsString}"]`,
          "\n\trootOriginId:", rootOriginId,
          "\n\toriginSubPlot:", originSubPlot,
      );
    }
  }
  return originParentSubs;
}

function _processSubResourcesDelta (stack, resourcesDelta, originParentSubs) {
  const parentOriginPlot = stack.originPlot;
  const resourceKeys = Object.keys(resourcesDelta);
  resourceKeys.sort();
  if (!resourceKeys.length) {
    throw new Error(`Invalid empty "&_" sub-resources delta for "${parentOriginPlot.join("/")}"`);
  }
  for (const subResourceStepsString of resourceKeys) {
    const subResourceDelta = resourcesDelta[subResourceStepsString];
    let mutableResource, prevStep, parentSubs;
    try {
      const originPlot = stack.originPlot = _joinResourcesPlot([], subResourceStepsString);
      if (originPlot[0] !== parentOriginPlot[0]) {
        throw new Error(`Invalid sub-resource "${subResourceStepsString}" is not a child of "${
            parentOriginPlot[0]}/"`);
      }
      ({ mutableResource, prevStep, parentSubs } =
          _mutateDeepSubResource(originParentSubs, originPlot, 1));
      stack.patch(mutableResource, subResourceDelta,
          prevStep, parentSubs, subResourceStepsString, resourcesDelta);
    } catch (error) {
      throw wrapError(error, 1, `_processSubResourcesDelta["${subResourceStepsString}"]`,
          "\n\tparentOriginPlot:", parentOriginPlot,
          "\n\tprevStep:", prevStep,
      );
    }
  }
  return originParentSubs;
}

function _processProperties (stack, mutableResource, propertiesDelta, isRemoval) {
  for (const [name, deltaValue] of Object.entries(propertiesDelta)) {
    let patcher = (isRemoval ? _nodeTermRemovers : _nodeTermUpserters)[name];
    let expandedName = name;
    if (patcher === undefined) {
      const colonIndex = name.indexOf(":");
      if (colonIndex !== -1) {
        expandedName = [name.slice(0, colonIndex), name.slice(colonIndex + 1)];
        patcher = (isRemoval ? _namespaceTermRemovers : _namespaceTermUpserters)[expandedName[0]];
        // TODO(iridian, 2021-03): Add support and validation for custom chronicle namespaces
      }
      if (patcher === undefined) {
        patcher = isRemoval ? _removeGenericProperty : _upsertGenericProperty;
      }
    }
    if (patcher) {
      mutableResource[name] =
          patcher(stack, mutableResource[name], deltaValue, expandedName, mutableResource);
    }
  }
}

function _upsertGenericProperty (stack, currentValue, deltaValue) {
  const id = (deltaValue != null) && deltaValue["@id"];
  if (id) {
    const targetRootPlot = _resourcePlotFromString(
        _rootOriginIdFromRelativeId(stack.mutableGlobalResources, stack.basePlot, id));
    const originRelativeId = _originIdFromRootPlot(stack.originPlot, targetRootPlot, id[0] === "/");
    return { "@id": originRelativeId };
  }
  return deltaValue;
}

function _removeGenericProperty () {
  throw new Error("Generic term removal not implemented");
}

function _createStandardTermPatcher (term, {
  /* expansion, definition, */ isId, isSingular, isRemover, aliases, coupledTerms, linkedTerms,
}) {
  const patchSingular = isId ? _patchIdEntry : _patchLiteralEntry;
  const updateContainerEntry = isRemover ? _removeContainerEntry : _addContainerEntry;
  if (isSingular) {
    return patchSingular;
  }
  return function _patchMultiEntry (stack, currentValue, deltaValue, targetKey, mutableParent) {
    for (const deltaEntry of deltaValue) {
      patchSingular(stack, currentValue, deltaEntry, targetKey, mutableParent);
    }
  };

  function _patchLiteralEntry (stack, currentValue, deltaEntry) {
    if ((deltaEntry != null) && deltaEntry["@id"]) {
      throw new Error(`Cannot assign an id to non-id term "${term}"`);
    }
    return deltaEntry;
  }

  function _patchIdEntry (stack, currentValue, deltaEntry, targetKey, mutableParent) {
    const remoteOriginId = _rootOriginIdFromRelativeId(
        stack.mutableGlobalResources, stack.basePlot, deltaEntry);
    const remoteRootPlot = _resourcePlotFromString(remoteOriginId);
    let remoteId = _originIdFromRootPlot(stack.originPlot, remoteRootPlot, deltaEntry[0] === "/");
    if (isRemover) {
      if (!isSingular) {
        const afterSuccessfulRemoval = _removeContainerEntry(mutableParent, targetKey, remoteId);
        const removals = _mutateStateObject(mutableParent["&-"] || null, "&-", mutableParent);
        _addContainerEntry(removals, targetKey, remoteId);
        return afterSuccessfulRemoval || currentValue; // Do not remove couplings
      }
      if (remoteId === undefined) {
        return null;
      }
      if (remoteId !== currentValue) {
        throw new Error(`Mismatch between current value "${currentValue}" and removed value "${
          remoteId}"`);
      } else {
        remoteId = undefined;
      }
    }
    if (aliases) {
      for (const alias of aliases) {
        if (isSingular) mutableParent[alias] = remoteId;
        else throw new Error("multi-alias not implemented");
      }
    }
    if (coupledTerms || linkedTerms) {
      const { mutableResource } =
          _mutateDeepSubResource(stack.mutableGlobalResources, remoteRootPlot);
      const reverseSelfId = _originIdFromRootPlot(remoteRootPlot, stack.originPlot);
      /*
      console.log("Adding reverse to", remoteRootPlot, ":", reverseSelfId,
          "\n\tstack.basePlot/deltaEntry:", stack.basePlot, deltaEntry,
          "\n\tremoteOriginId:", remoteOriginId,
          "\n\tstack.originPlot:", stack.originPlot);
      */
      for (const reverseTerm of (coupledTerms || [])) {
        updateContainerEntry(mutableResource, reverseTerm, reverseSelfId);
      }
      for (const reverseTerm of (linkedTerms || [])) {
        updateContainerEntry(mutableResource, reverseTerm, reverseSelfId);
      }
    }
    return remoteId;
  }
}

const _namespaceTermUpserters = {
  V (stack, currentValue, deltaValue, [, suffix]) {
    if (!V.vocabulary[suffix]) throw new Error(`Invalid V namespace property "${suffix}"`);
    return deltaValue;
  },
};

const _namespaceTermRemovers = {
  V (stack, currentValue, deletedValue, [, suffix]) {
    if (!V.vocabulary[suffix]) throw new Error(`Invalid V namespace property "${suffix}"`);
    if (currentValue !== deletedValue) {
      throw new Error(`Cannot remove V namespace property "${
          suffix}": existing value differs from expected delete value`);
    }
    return undefined;
  },
};

/*
 #    #   #####     #    #
 #    #     #       #    #
 #    #     #       #    #
 #    #     #       #    #
 #    #     #       #    #
  ####      #       #    ######
*/

function _joinResourcesPlot (targetPlot, plotString) {
  if (plotString[0] === "/") {
    throw new Error(`Invalid vplot "${plotString}": delta resource plots must be relative`);
  }
  return _joinPlot(targetPlot, plotString,
      targetPlot.length ? "logical plot" : "sub-resource plot");
}

function _joinPlot (targetPlot, plotString, noDotsName) {
  const relativePlot = _resourcePlotFromString(plotString);
  const isAbsolute = (relativePlot[0] === "");
  const ret = isAbsolute ? [] : targetPlot;
  for (let i = isAbsolute ? 1 : 0; i < relativePlot.length; ++i) {
    const step = relativePlot[i];
    if ((step !== ".") && (step !== "..")) {
      ret.push(step);
    } else if (noDotsName || isAbsolute) {
      throw new Error(`Invalid local id "${
          plotString}": ${noDotsName || "absolute vplot"} cannot contain "." or ".."`);
    } else if (step === ".") {
      continue;
    } else if (ret.length === 0) {
      throw new Error(`Invalid local id "${plotString}": cannot move up from root`);
    } else {
      ret.pop();
    }
  }
  return ret;
}

function _resourcePlotFromString (plotString) {
  if (plotString === "") return [];
  const ret = plotString.split("/");
  if (ret.pop() !== "") {
    throw new Error(`Invalid resource plot "${plotString}": must terminate in "/"`);
  }
  return ret;
}

function _getOwnerValue (object) {
  return object["V:owner"]
      || object[".E~"] || object[".R~"] || object[".src~"]  || object[".tgt~"] || "";
}

function _rootOriginIdFromRelativeId (rootResources, basePlot, plotString) {
  return _rootOriginIdFromLogicalPlot(rootResources,
      _joinPlot(basePlot.slice(), plotString), 0, "");
}

function _rootOriginIdFromLogicalPlot (
    rootResources, logicalPlot, initialStepIndex, initialOriginId) {
  let currentOriginId = initialOriginId;
  let i = initialStepIndex;
  for (; i < logicalPlot.length; ++i) {
    const logicalStep = `${logicalPlot[i]}/`;
    const globalResource = rootResources[logicalStep];
    if (globalResource) {
      currentOriginId = (currentOriginId === _getOwnerValue(globalResource))
          ? logicalStep
          : `${currentOriginId}${logicalStep}`;
    } else if (i + 1 < logicalPlot.length) {
      throw new Error(`No origin resource "${logicalStep}" in state for sub-plot "${
        logicalPlot.join("/")}" step #${i}`);
    } else {
      currentOriginId = logicalStep;
      // subStack.validateCreateGlobalLogicalPlot = logicalPlot;
      /*
      const currentLogicalOwnerId = logicalPlot.slice(0, -1).join("/");
      const patchOwnerLogicalId = _joinPlot(this.basePlot.slice(),
          _getOwnerValue(Array.isArray(resourceDelta) ? resourceDelta[0] : resourceDelta));
      isOwnerGlobal = (currentLogicalOwnerId === patchOwnerLogicalId);
      console.log("isOwnerGlobal of local:", logicalStep, i, logicalSteps, isOwnerGlobal,
          currentLogicalOwnerId, patchOwnerLogicalId);
      */
    }
  }
  return currentOriginId;
}

// Ignores the last entry of originPlot. The relative base of resources
// is their parent origin plot.
function _originIdFromRootPlot (originPlot, rootPlot, isAbsolute) {
  if (isAbsolute) return `/${rootPlot.join("/")}/`;
  let i = 0;
  const maxLen = originPlot.length - 1;
  for (; i !== maxLen; ++i) if (originPlot[i] !== rootPlot[i]) break;
  const plotSuffix = rootPlot.length === i ? "" : `${rootPlot.slice(i).join("/")}/`;
  return `${"../".repeat(maxLen - i)}${plotSuffix}`;
}

/*
  ####    #####    ##     #####  ######
 #          #     #  #      #    #
  ####      #    #    #     #    #####
      #     #    ######     #    #
 #    #     #    #    #     #    #
  ####      #    #    #     #    ######
*/

function _mutateDeepSubResource (initialParentSubs, subResourcePlot, firstIndex = 0) {
  let parentSubs = initialParentSubs;
  let prevStep, mutableResource;
  if (!Array.isArray(subResourcePlot) || !subResourcePlot[0]) {
    throw new Error(`Invalid subResourcePlot, array with non-empty first item expected, got: "${
        String(subResourcePlot)}"`);
  }
  for (let i = firstIndex; i !== subResourcePlot.length; ++i) {
    if (prevStep) parentSubs = _mutateSubs(mutableResource, prevStep);
    prevStep = `${subResourcePlot[i]}/`;
    mutableResource = _mutateSubResource(parentSubs, prevStep);
  }
  return { mutableResource, parentSubs, prevStep };
}

function _mutateSubResource (mutableSubs, childStep) {
  if (childStep[0] === "/") {
    throw new Error(`Invalid sub-resource vplot: "${childStep}": cannot be a root reference`);
  }
  const subResource = mutableSubs[childStep];
  return (subResource && Object.hasOwnProperty.call(mutableSubs, childStep))
      ? subResource
      : (mutableSubs[childStep] = Object.create(subResource || null));
}

function _mutateSubs (targetResource, parentLocalStep, subsKey = "&_") {
  if (parentLocalStep) {
    if (!targetResource["@context"]) targetResource["@context"] = { "@base": parentLocalStep };
    else if (targetResource["@context"]["@base"] !== parentLocalStep) {
      throw new Error(`Invalid existing @context: expected "@base" to be "${
          parentLocalStep}", got: "${targetResource["@context"]["@base"]}"`);
    }
  }
  return _mutateStateObject(targetResource[subsKey] || null, subsKey, targetResource);
}

function _mutateStateObject (maybeObject, keyInParent, parent) {
  if (Object.hasOwnProperty.call(parent, keyInParent)) {
    return maybeObject;
  }
  // Ensure that the updated target is a new object.
  return parent[keyInParent] = Object.create(maybeObject);
}

function _addContainerEntry (mutableResource, containerName, value) {
  const container = mutableResource[containerName] || (mutableResource[containerName] = []);
  if (!container.includes(value)) container.push(value);
}

function _removeContainerEntry (mutableResource, containerName, value) {
  const container = mutableResource[containerName];
  if (!container) return undefined;
  const index = container.indexOf(value);
  if (index === -1) return undefined;
  container.splice(index, 1);
  return container;
}
