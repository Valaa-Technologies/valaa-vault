
const { default: patchWith } = require("@valos/tools/patchWith");
const { mutateVState, baseContext, referenceArrayTag } = require("@valos/state");
const { V } = require("@valos/space/ontology");

module.exports = {
  applyVLogDelta,
};

function applyVLogDelta (currentVState, vlogEvent) {
  const mutable = mutateVState(currentVState);
  return patchWith(mutable, vlogEvent, {
    mutable, preExtend: _delegatePreExtend, keyPath: [],
  });
}

// Set up handlers and lookups

const _customPreHandlers = {
  "/": _subResourcePreHandle,
  ".": _directManipulationForbidden,
  "-E": _directManipulationForbidden,
  "-R": _directManipulationForbidden,
  "-M": _directManipulationForbidden,
  "-out": _directManipulationForbidden,
  "-in": _directManipulationForbidden,
};

const _vlogTerms = {};

for (const [term, expansions] of Object.entries(baseContext)) {
  _vlogTerms[expansions["@id"]] = term;
}

for (const [term, expansion] of Object.entries(baseContext)) {
  const id = expansion["@id"];
  if (!id) continue;
  const definition = V.vocabulary[id.slice(2)];
  if (!definition) {
    console.log("no definition for:", id, "in V.vocabulary:", Object.keys(V.vocabulary));
  }
  const aliases = [id].concat(_recurseSubProperties(definition) || []);
  let reverseTerms;
  const coupling = definition["VState:coupledToField"];
  if (coupling) {
    reverseTerms = [coupling].concat(_recurseSubProperties(V.vocabulary[coupling.slice(2)] || []));
    for (const reverseTerm of reverseTerms) {
      if (_vlogTerms[reverseTerm]) reverseTerms.push(_vlogTerms[reverseTerm]);
    }
  }
  if (_customPreHandlers[term] === undefined) {
    _customPreHandlers[term] = _createPreHandler(
        term, expansion, definition,
        expansion["@type"] === "@id", expansion["@container"] === undefined, aliases, reverseTerms);
  }
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

// Extenders

function _delegatePreExtend (target_, patch, key, parentTarget, parentPatch) {
  if ((key == null) || (typeof key === "number")) {
    return undefined;
  }
  let target = target_;
  if (key === "@context") {
    if (this.keyPath.length === 1) {
      this.extend(parentTarget[referenceArrayTag], patch[0], 1, target, patch);
    }
    // Discard all direct @context modifications.
    return target || this.returnUndefined;
  }
  if (target && (typeof target === "object") && !Object.hasOwnProperty.call(parentTarget, key)) {
    // Ensure that the updated target is a new object.
    target = Object.create(target);
  }
  const customPreHandle = _customPreHandlers[key];
  if (customPreHandle !== undefined) {
    return customPreHandle.call(this, target, patch, key, parentTarget, parentPatch);
  }

  if (this.keyPath[this.keyPath.length - 2] === "/") {
    const keySteps = key.split(/(\/)/);
    this.selfId = (keySteps.length === 1) && (this.keyPath.length === 2)
        ? key
        : `_:${this.keyPath.join("").slice(1)}`;
    _patchSubResource(this, parentTarget, keySteps, patch);
    return parentTarget[keySteps[0]];
  }

  const colonIndex = key.indexOf(":");
  if (colonIndex === -1) {
    return _basicPropertyPreHandle.apply(this, target, patch, key, parentTarget, parentPatch);
  }
  const namespace = key.slice(0, colonIndex);
  const namespacePreHandle = _namespacePreHandlers[namespace] || _unknownNamespacePreHandle;
  return namespacePreHandle.call(
      this, target, patch, namespace, key.slice(colonIndex + 1), parentTarget, parentPatch);
}

function _directManipulationForbidden (target, patch, key) {
  throw new Error(`Cannot manipulate term "${key}" directly`);
}

function _subResourcePreHandle (target, patch, keyInParent, parentTarget) {
  if (this.keyPath.length === 1) return undefined;
  const subThis = Object.create(this);
  _emitParentContextBase(this, parentTarget);
  subThis.selfBase = this.keyPath.join("").slice(1);
  return subThis.extend(target, patch);
}

function _createPreHandler (term, expansion, definition, isId, isSingular, aliases, reverseTerms) {
  if (isSingular) {
    return _preHandlePatchEntry;
  }
  return function _preHandleMultiEntry (target, patch, keyInParent, parentTarget, parentPatch) {
    for (const patchEntry of patch) {
      _preHandlePatchEntry(target, patchEntry, keyInParent, parentTarget, parentPatch);
    }
  };

  function _preHandlePatchEntry (target, patchEntry, keyInParent, parentTarget) {
    const selfId = this.selfId;
    const remoteId = isId ? patchEntry
        : patchEntry["@id"] ? patchEntry["@id"].slice(0, -1)
        : undefined;
    if (aliases) {
      for (const alias of aliases) {
        if (isSingular) parentTarget[alias] = remoteId || patchEntry;
        else throw new Error("multi-alias not implemented");
      }
    }
    if (reverseTerms) {
      const subPatcher = Object.create(this);
      subPatcher.keyPath = ["/"];
      const resource = _obtainSubObject(subPatcher, this.mutable["/"],
          remoteId[0] !== "_" ? [remoteId] : remoteId.slice(2).split(/(\/)/));
      for (const reverseTerm of reverseTerms) {
        const reverseArray = resource[reverseTerm] || (resource[reverseTerm] = []);
        if (!reverseArray.includes(selfId)) reverseArray.push(selfId);
      }
    }
  }
}

function _basicPropertyPreHandle (target, patch) {
  // Always fully overwrite property values
  return patch;
}

const _namespacePreHandlers = {
  V (target, patch, prefix, suffix) {
    if (!V.vocabulary[suffix]) throw new Error(`Invalid V namespace property "${suffix}"`);
    return undefined;
  },
};

function _unknownNamespacePreHandle (target, patch) { return patch; }

function _patchSubResource (patcher, target, subResourcePath, patch) {
  const subPatcher = Object.create(patcher);
  subPatcher.keyPath = patcher.keyPath.slice(0, -1);
  subPatcher.extend(_obtainSubObject(subPatcher, target, subResourcePath), patch);
}

function _obtainSubObject (patcher, parent, subResourcePath) {
  let current = parent;
  for (const step of subResourcePath) {
    patcher.keyPath.push(step);
    const inner = current[step];
    if (!inner) {
      current = _createSubObject(patcher, current, step);
    } else if (Object.hasOwnProperty.call(current, step)) {
      current = inner;
    } else {
      // Ensure that the updated target is a new object.
      current = current[step] = Object.create(inner);
    }
  }
  return current;
}

function _createSubObject (patcher, parent, step) {
  const ret = parent[step] = Object.create(null);
  const keyPath = patcher.keyPath;
  if (step === "/") {
    _emitParentContextBase(patcher, parent);
  } else if (keyPath.length === 4) {
    ret[".G"] = step;
  } else if (keyPath.length > 4) {
    ret[".G"] = `_:${keyPath.slice(3).join("")}`;
  }
  return ret;
}

function _emitParentContextBase (patcher, parent) {
  const parentContext = parent["@context"] || (parent["@context"] = {});
  console.log("Emitting @base:", patcher.keyPath);
  parentContext["@base"] = `${patcher.keyPath[patcher.keyPath.length - 2]}/`;
}
