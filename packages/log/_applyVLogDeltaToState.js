const { V } = require("@valos/space/ontology");

const { mutateVState, baseStateContext, iriLookupTag, eventCountTag } = require("@valos/state");
const { VState } = require("@valos/state/ontology");

const { visitVLogDelta, appendToPlot, relativeIdFromOriginPlot } = require("./_visitVLogDelta");

module.exports = {
  applyVLogDeltaToState,
};

function applyVLogDeltaToState (currentVState, vlogDelta, stack = null) {
  const mutableState = mutateVState(currentVState);
  const refIndexDelta = (vlogDelta["@context"] || [])[0];
  if (refIndexDelta) {
    Object.assign(mutableState[iriLookupTag], refIndexDelta);
  }
  const applyStack = Object.assign(Object.create(stack), {
    // apply opts
    mutableGlobalResources: _mutateSubGraph(mutableState, undefined, "state"),
    // visitor opts
    iriLookup: mutableState[iriLookupTag],
    mutableGlobal,
    mutateTargetResource: _mutateTargetResource,
    removalVisitors: _removalVisitors,
    upsertVisitors: _upsertVisitors,
    // patch opts
    deleteUndefined: true,
    iterableToArray: "reduce",
    iterableToOther: "reduce",
  });

  visitVLogDelta(vlogDelta, applyStack);

  return mutableGlobal;

  function _mutateTargetResource (targetPlot, interimContainer, interimIndex) {
    return _mutateDeepSubResource(
        interimContainer
            ? _mutateSubs(interimContainer, targetPlot[interimIndex - 1])
            : applyStack.mutableGlobalResources,
        targetPlot, interimIndex);
  }
}

/*
 #####   #####    ####   #####   ######  #####    #####     #    ######   ####
 #    #  #    #  #    #  #    #  #       #    #     #       #    #       #
 #    #  #    #  #    #  #    #  #####   #    #     #       #    #####    ####
 #####   #####   #    #  #####   #       #####      #       #    #            #
 #       #   #   #    #  #       #       #   #      #       #    #       #    #
 #       #    #   ####   #       ######  #    #     #       #    ######   ####
*/

// Setup

const ontologies = { V, VState };

const _nodeTermUpserters = {
  // Ignore all direct @context modifications.
  // @base has already been resolved by _patchDeltaNode (as it
  // needs to be resolved before other entries)
  // TODO(iridian, 2021-03): Validate @context and reject all unsupported fields.
  "@context": null,
  "&/": null,
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
  "&-": null,
};

const _namespaceTermUpserters = {
  V (currentValue, deltaValue, [, suffix]) {
    if (!V.vocabulary[suffix]) throw new Error(`Invalid V namespace property "${suffix}"`);
    return deltaValue;
  },
};

const _namespaceTermRemovers = {
  V (currentValue, deletedValue, [, suffix]) {
    if (!V.vocabulary[suffix]) throw new Error(`Invalid V namespace property "${suffix}"`);
    if (currentValue !== deletedValue) {
      throw new Error(`Cannot remove V namespace property "${
          suffix}": existing value differs from expected delete value`);
    }
    return undefined;
  },
};

const _removalVisitors = {
  forNodeTerm: _nodeTermRemovers,
  forNamespaceTerm: _namespaceTermRemovers,
  defaultVisitor: _removeGenericProperty,
};

const _upsertVisitors = {
  forNodeTerm: _nodeTermUpserters,
  forNamespaceTerm: _namespaceTermUpserters,
  defaultVisitor: _upsertGenericProperty,
};

function _patchRejectForbiddenDirectManipulation (target, delta, key) {
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
    _nodeTermUpserters[term] = _createStandardTermVisitor(term, {
      expansion, definition,
      isId: expansion["@type"] === "@id",
      isSingular: expansion["@container"] === undefined,
      aliases, coupledTerms, linkedTerms,
    });
  }
  if (_nodeTermRemovers[term] === undefined) {
    _nodeTermRemovers[term] = _createStandardTermVisitor(term, {
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
  console.warn("No definition for:", id, `in namespace ${namespace}:`,
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

function _upsertGenericProperty (currentValue, deltaValue) {
  const id = (deltaValue != null) && deltaValue["@id"];
  if (id) {
    const targetRootPlot = appendToPlot([], id);
    const originRelativeId = relativeIdFromOriginPlot(
        this.originPlot, targetRootPlot, id[0] === "/");
    return { "@id": originRelativeId };
  }
  return deltaValue;
}

function _removeGenericProperty () {
  throw new Error("Generic term removal not implemented");
}

function _createStandardTermVisitor (term, {
  /* expansion, definition, */ isId, isSingular, isRemover, aliases, coupledTerms, linkedTerms,
}) {
  const patchSingular = isId ? _patchIdEntry : _patchLiteralEntry;
  const updateContainerEntry = isRemover ? _removeContainerEntry : _addContainerEntry;
  if (isSingular) {
    return patchSingular;
  }
  return function _patchMultiEntry (currentValue, deltaValue, targetKey, mutableParent) {
    for (const deltaEntry of deltaValue) {
      patchSingular.call(this, currentValue, deltaEntry, targetKey, mutableParent);
    }
  };

  function _patchLiteralEntry (currentValue, deltaEntry) {
    if ((deltaEntry != null) && deltaEntry["@id"]) {
      throw new Error(`Cannot assign an id to non-id term "${term}"`);
    }
    return deltaEntry;
  }

  function _patchIdEntry (currentValue, deltaEntry, targetKey, mutableParent) {
    // const remoteOriginId = rootOriginIdFromRelativeId(this.mutableGlobalResources, deltaEntry);
    // _resourcePlotFromString(remoteOriginId);
    const remoteRootPlot = appendToPlot([], deltaEntry);
    let remoteId = relativeIdFromOriginPlot(this.originPlot, remoteRootPlot, deltaEntry[0] === "/");
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
      const mutableRemoteResource = _mutateDeepSubResource(
            this.mutableGlobalResources, remoteRootPlot);
      const reverseSelfId = relativeIdFromOriginPlot(remoteRootPlot, this.originPlot);
      /*
      console.log("Adding reverse to", remoteRootPlot, ":", reverseSelfId,
          "\n\tstack.basePlot/deltaEntry:", this.basePlot, deltaEntry,
          "\n\tremoteOriginId:", remoteOriginId,
          "\n\tstack.originPlot:", this.originPlot);
      */
      for (const reverseTerm of (coupledTerms || [])) {
        updateContainerEntry(mutableRemoteResource, reverseTerm, reverseSelfId);
      }
      for (const reverseTerm of (linkedTerms || [])) {
        updateContainerEntry(mutableRemoteResource, reverseTerm, reverseSelfId);
      }
    }
    return remoteId;
  }
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
  let key, mutableResource;
  if (!Array.isArray(subResourcePlot) || !subResourcePlot[firstIndex]) {
    throw new Error(`Invalid subResourcePlot, array with non-empty items expected, got: "${
        String(subResourcePlot)}"`);
  }
  for (let i = firstIndex; i !== subResourcePlot.length; ++i) {
    if (key) parentSubs = _mutateSubs(mutableResource, subResourcePlot[i - 1]);
    key = `${subResourcePlot[i]}/`;
    mutableResource = parentSubs[key];
    if (!mutableResource || !Object.hasOwnProperty.call(parentSubs, key)) {
      mutableResource = parentSubs[key] = Object.create(mutableResource || null);
    }
  }
  return mutableResource;
}

function _mutateSubs (mutableResource, parentLocalStep, subsKey = "&_") {
  if (Object.hasOwnProperty.call(mutableResource, subsKey)) {
    return mutableResource[subsKey];
  }
  if (parentLocalStep) {
    if (!mutableResource["@context"]) {
      mutableResource["@context"] = { "@base": `${parentLocalStep}/` };
    } else if (mutableResource["@context"]["@base"] !== `${parentLocalStep}/`) {
      throw new Error(`Invalid existing @context: expected "@base" to be "${
          parentLocalStep}", got: "${mutableResource["@context"]["@base"]}"`);
    }
  }
  return _mutateStateObject(mutableResource[subsKey] || null, subsKey, mutableResource);
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

/*
function _getOwnerValue (object) {
  return object["V:owner"]
      || object[".E~"] || object[".R~"] || object[".src~"]  || object[".tgt~"] || "";
}
*/
