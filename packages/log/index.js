
const { default: patchWith } = require("@valos/tools/patchWith");
const { mutateVState, baseContext, referenceArrayTag } = require("@valos/state");
const { V } = require("@valos/space/ontology");
const { VState } = require("@valos/state/ontology");

module.exports = {
  applyVLogDelta (currentVState, vlogEvent) {
    const mutableState = mutateVState(currentVState);

    _patchURITerms(mutableState, vlogEvent);
    return patchWith(mutableState, vlogEvent, {
      keyPath: [],
      deleteUndefined: true,
      iterableToArray: "reduce",
      iterableToOther: "reduce",
      mutableState,
      mutableRootResources: _mutateSubs(mutableState),
      preApplyPatch: _patchDeltaComponent,
      _patchSubs,
      _patchResourceProperty,
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

const _nodeTermPatchers = {
  "@context": _patchContext,
  "&+": _patchSubs,
  "&-": _patchSubRemoval,
  "*P": _patchRejectForbiddenDirectManipulation,
  "*E": _patchRejectForbiddenDirectManipulation,
  "*R": _patchRejectForbiddenDirectManipulation,
  "*M": _patchRejectForbiddenDirectManipulation,
  "-hasI": _patchRejectForbiddenDirectManipulation,
  "-hasG": _patchRejectForbiddenDirectManipulation,
  "-out": _patchRejectForbiddenDirectManipulation,
  "-in": _patchRejectForbiddenDirectManipulation,
};

const _vlogTermById = {};

for (const [term, expansion] of Object.entries(baseContext)) {
  if (!expansion["@id"]) continue;
  _vlogTermById[expansion["@id"]] = term;
}

for (const [term, expansion] of Object.entries(baseContext)) {
  if (term[0] === "@" || _nodeTermPatchers[term]) continue;
  const id = expansion["@id"];
  if (!id) continue;
  const definition = _getDefinitionOf(id);
  const aliases = [id].concat(_recurseSubProperties(definition) || []);
  const coupledTerms = _getReverseTermsOf(definition["VState:coupledToField"]);
  const linkedTerms = _getReverseTermsOf(definition["VState:linkedToField"]);
  _nodeTermPatchers[term] = _createStandardTermPatcher(term, {
    expansion, definition,
    isId: expansion["@type"] === "@id",
    isSingular: expansion["@container"] === undefined,
    aliases, coupledTerms, linkedTerms,
  });
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

function _patchDeltaComponent (target, patch, key, parentTarget, patchKey, parentPatch) {
  if (this.keyPath.length === 0) {
    this.basePlot = [];
    this.logicalPlot = [];
    this.originPlot = [];
    return undefined;
  }
  if (this.keyPath.length === 1) {
    return key !== "&+"
        ? target // Ignore all other root aspects except subresources.
        : this._patchSubs(target, patch, "&+", parentTarget);
  }
  if (this.keyPath[this.keyPath.length - (typeof patchKey !== "number" ? 2 : 3)] === "&+") {
    if (patch["@context"]) {
      const base = (patch["@context"] || {})["@base"] || "";
      const subStack = Object.create(this);
      subStack.basePlot = _joinBaseContextPlot(this.basePlot, base);
      return subStack.applyPatch(target, patch, key, parentTarget, patchKey, parentPatch);
    }
    return undefined;
    // delta node: default patch, as _patchSubs has already mutated the target.
  }
  return this._patchResourceProperty(target, patch, key, parentTarget, patchKey, parentPatch);
}

function _patchSubs (target, patch, targetKey, parentTarget) {
  const subStack = Object.create(this);
  const entryKeys = Object.keys(patch);
  entryKeys.sort();
  if (!entryKeys.length) {
    throw new Error(`Invalid empty "&+" sub-resource patch for "${this.logicalPlot.join("/")}"`);
  }
  const parentLogicalPlot = this.logicalPlot;
  const parentOriginId = this.originPlot.join("/");

  let mutableSubs;
  for (const logicalSteps of entryKeys) {
    const patchEntry = patch[logicalSteps];
    const logicalPlot = subStack.logicalPlot = _joinTargetPlot(this.basePlot, logicalSteps);

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
        this.mutableRootResources, logicalPlot, i, parentOriginId);
    subStack.originPlot = rootOriginId.split("/");

    let originParentSubs, originSubPlot;
    if (!rootOriginId.startsWith(parentOriginId)) {
      originSubPlot = subStack.originPlot;
      originParentSubs = this.mutableRootResources;
    } else {
      originSubPlot = rootOriginId.slice(this.originPlot.length);
      if (!mutableSubs) {
        mutableSubs = _mutateSubs(parentTarget, parentLogicalPlot[parentLogicalPlot.length - 1]);
      }
      originParentSubs = mutableSubs;
    }

    const { mutableResource, prevStep, parentSubs } =
        _mutateDeepSubResource(originParentSubs, originSubPlot);
    subStack.patch(mutableResource, patchEntry, prevStep, parentSubs, logicalSteps, patch);
  }
  return mutableSubs || this.returnUndefined;
}

function _patchContext (currentValue) {
  // Ignore all direct @context modifications.
  // @base has already been resolved by _patchDeltaNode (as it
  // needs to be resolved before other entries)
  // TODO(iridian, 2021-03): Validate @context and reject all unsupported fields.
  return currentValue || this.returnUndefined;
}

function _patchResourceProperty (oldValue, newValue, name, stateNode, patchKey, patchNode) {
  if (typeof name !== "string") {
    throw new Error(`Invalid delta resource property: string expected, got "${name}"`);
  }
  let patchEntry = _nodeTermPatchers[name];
  let actualName = name;
  if (!patchEntry) {
    patchEntry = _patchGenericProperty;
    const colonIndex = name.indexOf(":");
    if (colonIndex !== -1) {
      actualName = [name.slice(0, colonIndex), name.slice(colonIndex + 1)];
      const patchNamespacedProperty = _namespacePatchers[actualName[0]];
      if (patchNamespacedProperty) patchEntry = patchNamespacedProperty;
      // TODO(iridian, 2021-03): Add support and validation for custom chronicle namespaces
    }
  }
  return patchEntry.call(this, oldValue, newValue, actualName, stateNode, patchKey, patchNode);
}

function _patchGenericProperty (target, patch) {
  const id = (patch != null) && patch["@id"];
  if (id) {
    const targetRootPlot = _rootOriginIdFromRelativeId(
        this.mutableRootResources, this.basePlot, id).split("/");
    return {
      "@id": _originIdFromRootPlot(this.originPlot, targetRootPlot, id[0] === "/"),
    };
  }
  return patch;
}

function _patchRejectForbiddenDirectManipulation (target, patch, key) {
  throw new Error(`Cannot apply a patch to term "${key}" directly ${
      ""}(only via its linked/coupled properties)`);
}

function _patchSubRemoval (target, patch, targetKey, parentTarget) {
  throw new Error("subremovals not implemented");
}

function _createStandardTermPatcher (term, {
  expansion, definition, isId, isSingular, aliases, coupledTerms, linkedTerms,
}) {
  const patchSingular = isId ? _patchIdEntry : _patchLiteralEntry;
  if (isSingular) {
    return patchSingular;
  }
  return function _patchMultiEntry (
      target, patch, targetKey, parentTarget, patchKey, parentPatch) {
    for (const patchEntry of patch) {
      patchSingular(target, patchEntry, targetKey, parentTarget, patchKey, parentPatch);
    }
  };

  function _patchLiteralEntry (target, patchEntry, targetKey, parentTarget) {
    if ((patchEntry != null) && patchEntry["@id"]) {
      throw new Error(`Cannot assign an id to non-id term "${term}"`);
    }
    return patchEntry;
  }

  function _patchIdEntry (target, patchEntry, targetKey, parentTarget) {
    const remoteRootPlot = _rootOriginIdFromRelativeId(
        this.mutableRootResources, this.basePlot, patchEntry).split("/");
    const remoteId = _originIdFromRootPlot(this.originPlot, remoteRootPlot, patchEntry[0] === "/");
    if (aliases) {
      for (const alias of aliases) {
        if (isSingular) parentTarget[alias] = remoteId;
        else throw new Error("multi-alias not implemented");
      }
    }
    if (coupledTerms || linkedTerms) {
      const { mutableResource } = _mutateDeepSubResource(this.mutableRootResources, remoteRootPlot);
      const reverseSelfId = _originIdFromRootPlot(remoteRootPlot, this.originPlot);
      for (const reverseTerm of (coupledTerms || [])) {
        _addContainerEntry(mutableResource, reverseTerm, reverseSelfId);
      }
      for (const reverseTerm of (linkedTerms || [])) {
        _addContainerEntry(mutableResource, reverseTerm, reverseSelfId);
      }
    }
    return remoteId;
  }
}

const _namespacePatchers = {
  V (target, patch, [, suffix]) {
    if (!V.vocabulary[suffix]) throw new Error(`Invalid V namespace property "${suffix}"`);
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
    if ((step[i] !== ".") && (step[i] !== "..")) {
      ++i;
    } else if (noDotsName || isAbsolute) {
      throw new Error(`Invalid local id "${
          plotString}": ${noDotsName || "absolute vplot"} cannot contain "." or ".."`);
    } else if (ret[i] === ".") {
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
      || object[".E*"] || object[".R*"] || object[".src*"]  || object[".tgt*"] || "";
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
          _getOwnerValue(Array.isArray(patchEntry) ? patchEntry[0] : patchEntry));
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
  for (let i = 0; i !== subResourcePlot.length; ++i) {
    if (prevStep) parentSubs = _mutateSubs(mutableResource, prevStep);
    mutableResource = _mutateSubResource(parentSubs, prevStep = subResourcePlot[i]);
  }
  return { mutableResource, parentSubs, prevStep };
}

function _mutateSubResource (mutableSubs, childStep) {
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
