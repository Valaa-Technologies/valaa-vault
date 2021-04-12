
const { default: patchWith } = require("@valos/tools/patchWith");
const { mutateVState, baseContext, referenceArrayTag, baseStateContext } = require("@valos/state");
const { V } = require("@valos/space/ontology");
const { VState } = require("@valos/state/ontology");

module.exports = {
  baseLogContext: {
    ...baseStateContext,
    "@base": "urn:valos:chronicle:0/",
  },
  applyVLogDelta (currentVState, vlogEvent) {
    const mutableState = mutateVState(currentVState);
    _patchURITerms(mutableState, vlogEvent);
    return patchWith(mutableState, vlogEvent, {
      keyPath: [],
      deleteUndefined: true,
      iterableToArray: "reduce",
      iterableToOther: "reduce",
      basePlot: ["0"],
      logicalPlot: [],
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
  "&+": null,
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
  "&+": null,
  "&-": null,
};

function _patchRejectForbiddenDirectManipulation (stack, target, delta, key) {
  throw new Error(`Cannot apply a patch to term "${key}" directly ${
      ""}(only via its linked/coupled properties)`);
}

const _vlogTermById = {};

for (const [term, expansion] of Object.entries(baseContext)) {
  if (!expansion["@id"]) continue;
  _vlogTermById[expansion["@id"]] = term;
}

for (const [term, expansion] of Object.entries(baseContext)) {
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
  let subsDelta;
  let stack = this;
  const isTopLevel = (deltaKey === undefined);
  if (isTopLevel) {
    subsDelta = delta["&~"];
    // The entry patch call onto the "global void" resource.
    if (!subsDelta) throw new Error("VLog event is missing global '&+' resource delta section");
    this.mutableRootResources = _mutateSubs(mutableTarget);
  } else {
    subsDelta = delta["&+"];
    const base = (context || {})["@base"] || "";
    const removalsDelta = delta["&-"];

    if (base) {
      stack = Object.create(this);
      stack.basePlot = _joinBaseContextPlot(this.basePlot, base);
      console.log("  Adjusting @context @base:", base, "as plot:", stack.basePlot,
          "from:", deltaKey, "to:", key);
    }
    if (removalsDelta) {
      _processProperties(stack, mutableTarget, removalsDelta, true);
    }
    _processProperties(stack, mutableTarget, delta);
  }
  if (subsDelta) {
    _processSubs(stack, mutableTarget, subsDelta, isTopLevel);
  }
  return mutableTarget;
}

function _processSubs (stack, parentTarget, subsDelta, isTopLevel) {
  const basePlot = stack.basePlot;
  const mutableRootResources = stack.mutableRootResources;
  const parentLogicalPlot = stack.logicalPlot;
  const parentOriginPlot = stack.originPlot;
  const parentOriginId = parentOriginPlot.join("/");

  const entryKeys = Object.keys(subsDelta);
  entryKeys.sort();
  if (!entryKeys.length) {
    throw new Error(`Invalid empty "&+" sub-resource delta for "${stack.logicalPlot.join("/")}"`);
  }

  let mutableSubs;
  for (const logicalSteps of entryKeys) {
    const resourceDelta = subsDelta[logicalSteps];
    const logicalPlot = stack.logicalPlot = _joinTargetPlot(basePlot, logicalSteps);

    // TODO(iridian, 2021-03): Maybe the leeway for different @base
    // values in the delta JSON-LD is not ideal? We could avoid having
    // to have these validations here if the @base was strictly fixed
    // and mandatory.
    let i = 0;
    for (; i !== parentLogicalPlot.length; ++i) {
      if (logicalPlot[i] !== parentLogicalPlot[i]) {
        throw new Error(`Invalid vplot "${logicalSteps
            }": step #${i} mismatch; resulting logical plot "${logicalPlot.join("/")
            }" is not a descendant of the parent plot "${parentLogicalPlot.join("/")}"`);
      }
    }
    if (i >= logicalPlot.length) {
      throw new Error(`Invalid vplot "${logicalSteps}": length of resulting logical plot "${
          logicalPlot.join("/")}" is shorter and thus not a descendant of the parent plot "${
          parentLogicalPlot.join("/")}"`);
    }

    const rootOriginId = _rootOriginIdFromLogicalPlot(
        mutableRootResources, logicalPlot, i, parentOriginId);
    let originSubPlot = stack.originPlot = rootOriginId.split("/");
    let originParentSubs = mutableRootResources;
    if (parentOriginId && rootOriginId.startsWith(parentOriginId)) {
      originSubPlot = originSubPlot.slice(parentOriginPlot.length);
      if (!mutableSubs) {
        mutableSubs = _mutateSubs(parentTarget, parentLogicalPlot[parentLogicalPlot.length - 1]);
      }
      originParentSubs = mutableSubs;
    }
    const { mutableResource, prevStep, parentSubs } =
        _mutateDeepSubResource(originParentSubs, originSubPlot);
    stack.patch(mutableResource, resourceDelta, prevStep, parentSubs, logicalSteps, subsDelta);
  }
  return mutableSubs;
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
    const targetRootPlot = _rootOriginIdFromRelativeId(
        stack.mutableRootResources, stack.basePlot, id).split("/");
    const originRelativeId = _originIdFromRootPlot(stack.originPlot, targetRootPlot, id[0] === "/");
    return { "@id": originRelativeId };
  }
  return deltaValue;
}

function _removeGenericProperty () {
  throw new Error("Generic term removal not implemented");
}

function _createStandardTermPatcher (term, {
  expansion, definition, isId, isSingular, isRemover, aliases, coupledTerms, linkedTerms,
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
    const remoteRootPlot = _rootOriginIdFromRelativeId(
        stack.mutableRootResources, stack.basePlot, deltaEntry).split("/");
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
          _mutateDeepSubResource(stack.mutableRootResources, remoteRootPlot);
      const reverseSelfId = _originIdFromRootPlot(remoteRootPlot, stack.originPlot);
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


function _joinTargetPlot (basePlot, plotString) {
  if (plotString[0] === "/") {
    throw new Error(`Invalid vplot id "${plotString}": target ids must be relative`);
  }
  // Allow root resource reference as "../0" (as it could not be
  // referred to otherwise from initial base plot ["0"]), deny all
  // other plots containing "..".
  // Eventually this syntax will allow for adopting orphaned resources.
  if ((plotString === "../0") && (basePlot.length === 1)) return ["0"];
  return _joinPlot(basePlot, plotString, "target ids");
}

function _joinBaseContextPlot (basePlot, plotString) {
  if (plotString[plotString.length - 1] !== "/") {
    throw new Error(`Invalid @context @base entry "${plotString}", must end with "/"`);
  }
  return _joinPlot(basePlot, plotString.slice(0, -1), "@context @base");
}

function _joinPlot (basePlot, plotString, noDotsName) {
  const relativePlot = plotString.split("/");
  if ((relativePlot.length > 1) && relativePlot[relativePlot.length - 1] === "") {
    throw new Error(`Invalid local id "${plotString}": must not end with "/"`);
  }
  const isAbsolute = relativePlot[0] === "";
  const ret = isAbsolute ? relativePlot.slice(1) : basePlot.concat(relativePlot);
  for (let i = 0; i < ret.length;) {
    const step = ret[i];
    if ((step !== ".") && (step !== "..")) {
      ++i;
    } else if (noDotsName || isAbsolute) {
      throw new Error(`Invalid local id "${
          plotString}": ${noDotsName || "absolute vplot"} cannot contain "." or ".."`);
    } else if (step === ".") {
      ret.splice(i, 1);
    } else if (i === 0) {
      throw new Error(`Invalid local id "${plotString}": cannot move up from root`);
    } else {
      ret.splice(i - 1, 2);
      --i;
    }
  }
  return ret;
}

function _getOwnerValue (object) {
  return object["V:owner"]
      || object[".E~"] || object[".R~"] || object[".src~"]  || object[".tgt~"] || "";
}

function _rootOriginIdFromRelativeId (rootResources, basePlot, plotString) {
  return _rootOriginIdFromLogicalPlot(rootResources, _joinPlot(basePlot, plotString), 0, "");
}

function _rootOriginIdFromLogicalPlot (
    rootResources, logicalPlot, initialStepIndex, initialOriginId) {
  let currentOriginId = initialOriginId;
  let i = initialStepIndex;
  for (; i < logicalPlot.length; ++i) {
    const logicalStep = logicalPlot[i];
    const globalResource = rootResources[logicalStep];
    if (globalResource) {
      currentOriginId = (currentOriginId === _getOwnerValue(globalResource))
          ? logicalStep
          : `${currentOriginId}/${logicalStep}`;
    } else if (i + 1 < logicalPlot.length) {
      throw new Error(`No origin resource "${logicalStep}" in state for sub-plot "${
        logicalPlot.join("/")}" step #${i}`);
    } else {
      currentOriginId = logicalStep;
      // subStack.validateCreateGlobalLogicalPlot = logicalPlot;
      /*
      const currentLogicalOwnerId = logicalPlot.slice(0, -1).join("/");
      const patchOwnerLogicalId = _joinPlot(this.basePlot,
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
  if (isAbsolute) return `/${rootPlot.join("/")}`;
  let i = 0;
  const maxLen = originPlot.length && (originPlot.length - 1);
  for (; i !== maxLen; ++i) if (originPlot[i] !== rootPlot[i]) break;
  if (i === rootPlot.length) --i; // "" -> "../x"
  return `${"../".repeat(maxLen - i)}${rootPlot.slice(i).join("/")}`;
}

/*
  ####    #####    ##     #####  ######
 #          #     #  #      #    #
  ####      #    #    #     #    #####
      #     #    ######     #    #
 #    #     #    #    #     #    #
  ####      #    #    #     #    ######
*/

function _mutateDeepSubResource (initialParentSubs, subResourcePlot) {
  let parentSubs = initialParentSubs;
  let prevStep, mutableResource;
  if (!Array.isArray(subResourcePlot) || !subResourcePlot[0]) {
    throw new Error(`Invalid subResourcePlot, array with non-empty first item expected, got: "${
        String(subResourcePlot)}"`);
  }
  for (let i = 0; i !== subResourcePlot.length; ++i) {
    if (prevStep) parentSubs = _mutateSubs(mutableResource, prevStep);
    mutableResource = _mutateSubResource(parentSubs, prevStep = subResourcePlot[i]);
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

function _mutateSubs (targetResource, localId) {
  if (localId) _emitParentContextBase(targetResource, localId);
  return _mutateStateObject(targetResource["&+"] || null, "&+", targetResource);
}

function _emitParentContextBase (parent, id) {
  const newBase = `${id}/`;
  if (!parent["@context"]) parent["@context"] = { "@base": newBase };
  else if (parent["@context"]["@base"] !== newBase) {
    throw new Error(`Invalid existing @context: expected "@base": "${newBase}", got: "${
        parent["@context"]["@base"]}"`);
  }
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
