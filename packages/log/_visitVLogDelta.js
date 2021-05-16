
const { wrapError } = require("@valos/tools");

module.exports = {
  visitVLogDelta,
  relativePlotFromDeltaRef,
  relativePlotFromAbsolute,
  absolutePlotFromRelative,
};

function visitVLogDelta (delta, stack) {
  const resourcesDelta = delta["&/"];
  if (!resourcesDelta) throw new Error("VLog delta is missing global resources section '&/'");
  const visitorStack = Object.create(stack);
  visitorStack.resourcePlot = [1];
  _visitSubResources(visitorStack, resourcesDelta, stack.mutableRoot);
}

function _visitSubResources (stack, subResourceDeltas, mutableParentResource) {
  const subIds = Object.keys(subResourceDeltas);
  if (!subIds.length) {
    throw new Error(`Invalid empty ${
        stack.resourcePlot.length === 1
            ? "global resources "
            : `${stack.resourcePlot.length - 1}-order sub-`
      }graph "${stack.resourcePlot.join("/")}" delta object`);
  }
  const subStack = Object.create(stack);
  subStack.graphPlot = stack.resourcePlot;
  subStack.mutableGraph = subStack.mutateSubGraph
      && subStack.mutateSubGraph(mutableParentResource, subStack.graphPlot);
  for (const subId of subIds.sort()) {
    const subResourceDelta = subResourceDeltas[subId];
    try {
      const key = _validateSubResourceKey(subId, subStack.iriLookup);
      subStack.resourcePlot = subStack.graphPlot.concat(key);
      const mutableSubResource = subStack.mutateSubResource
          && subStack.mutateSubResource(subStack.mutableGraph || mutableParentResource, key);

      _visitDeltaResource(
          subStack, subResourceDelta, subId, mutableSubResource, key, subResourceDeltas);
    } catch (error) {
      throw wrapError(error, 1, `_visitSubResources["${subId}"]`,
          "\n\tresource plot:", stack.resourcePlot,
          "\n\tgraph plot:", subStack.graphPlot,
      );
    }
  }
}

function _validateSubResourceKey (key, iriLookup) {
  if (key[key.length - 1] !== ":") {
    throw new Error(`Invalid sub-resource key "${key}": doesn't terminate in ":"`);
  }
  const ret = key.slice(0, -1);
  if (ret === "--") return removalGraphNameSymbol;
  const num = _tryParseResourceIndex(ret, iriLookup);
  if (num !== undefined) return num;
  throw new Error(`Invalid sub-resource key "${key}": not a valid IRI index nor "--"`);
}

  }
}

function _visitDeltaResource (stack, delta, deltaKey, mutableTarget
    /* , targetKey, parentResourcesDelta */) {
  if (delta["@context"]) {
    throw new Error("@context not allowed for log deltas");
  }
  if (delta["&-"]) {
    _visitProperties(stack, mutableTarget, delta["&-"], stack.removalVisitors);
  }
  _visitProperties(stack, mutableTarget, delta, stack.upsertVisitors);
  const subGraph = delta["&/"] || delta["!/"];
  if (subGraph) {
    if (delta["&/"] && stack.graphPlot.length > 1) {
      throw new Error(`Invalid sub-graph "&/" term at delta object ${stack.resourcePlot.join("/")
          }: second-order (and deeper) sub-graphs must use "!/"`);
    }
    if (delta["!/"] && stack.graphPlot.length <= 1) {
      throw new Error(`Invalid sub-graph "!/" term at delta object ${stack.resourcePlot.join("/")
          }: only second-order (and deeper) sub-graphs can use "!/"`);
    }
    _visitSubResources(stack, subGraph, mutableTarget);
  }
  return mutableTarget;
}

function _visitProperties (stack, mutableResource, propertiesDelta, visitors) {
  if (!visitors) return;
  for (const [name, deltaValue] of Object.entries(propertiesDelta)) {
    let propertyVisitor = visitors.forNodeTerm[name];
    let expandedName = name;
    if (propertyVisitor === undefined) {
      const colonIndex = name.indexOf(":");
      if (colonIndex !== -1) {
        expandedName = [name.slice(0, colonIndex), name.slice(colonIndex + 1)];
        propertyVisitor = visitors.forNamespaceTerm[expandedName[0]];
        // TODO(iridian, 2021-03): Add support and validation for custom chronicle namespaces
      }
      if (propertyVisitor === undefined) {
        propertyVisitor = visitors.defaultVisitor;
      }
    }
    if (!propertyVisitor) continue;
    if (mutableResource) {
      mutableResource[name] = propertyVisitor
          .call(stack, mutableResource[name], deltaValue, expandedName, mutableResource);
    } else {
      propertyVisitor.call(stack, undefined, deltaValue, expandedName, mutableResource);
    }
  }
}

/*
 #    #   #####     #    #
 #    #     #       #    #
 #    #     #       #    #
 #    #     #       #    #
 #    #     #       #    #
  ####      #       #    ######
*/

function relativePlotFromDeltaRef (deltaRef, basePlot, iriLookup) {
  const steps = _parsePlotFromDeltaRef(deltaRef, iriLookup, undefined, true);
  if ((typeof steps[0] === "string") && steps[0].endsWith(":")) return steps; // absolute
  return relativePlotFromAbsolute(steps, basePlot);
}

function relativePlotFromAbsolute (absolutePlot, rebasePlot) {
  let i = 0;
  for (; i !== rebasePlot.length; ++i) {
    const absoluteStep = absolutePlot[i];
    if (absoluteStep !== rebasePlot[i]) {
      // Second step is the global resource which must also differ in
      // order for a relative plot to be formed.
      if (i < 2) return absolutePlot;
      const ret = absolutePlot.slice(i);
      ret.unshift(i - rebasePlot.length);
      return ret;
    }
  }
  return (i + 1 === absolutePlot.length) ? absolutePlot[i] : absolutePlot.slice(i);
}

function absolutePlotFromRelative (relativePlot, basePlot) {
  if (Array.isArray(relativePlot)) {
    const first = relativePlot[0];
    if (typeof first === "string") {
      if (first.endsWith(":")) return relativePlot; // was in fact absolute plot already
    } else if (first < 0) {
      return basePlot.slice(0, first).concat(relativePlot.slice(1));
    }
  }
  return basePlot.concat(relativePlot);
}

function _parsePlotFromDeltaRef (deltaRef, iriLookup, requiredIRIIndexError, allowPrefixedInitial) {
  if (typeof deltaRef !== "string") {
    throw new Error(`Invalid plot: expected type string, got: ${typeof deltaRef}`);
  }
  const steps = deltaRef.split("/");

  const maybePrefixedInitial = allowPrefixedInitial && steps[0].split(":");
  const isPrefixed = maybePrefixedInitial && (maybePrefixedInitial.length === 2);

  if (isPrefixed) {
    if (steps.length === 1) {
      if (maybePrefixedInitial[1]) {
        throw new Error(`Invalid delta reference "${deltaRef}" prefixed entry "${
            steps[0]}" must not have suffix`);
      }
      const entryStepAsIndex = _tryParseResourceIndex(maybePrefixedInitial[0]);
      if (typeof entryStepAsIndex !== "number") {
        throw new Error(`Invalid delta reference "${deltaRef
            }": single-step ref must be a valid IRI index terminated by ":"`);
      }
      return entryStepAsIndex;
    }
    if (maybePrefixedInitial[0] !== "^:") {
      return deltaRef;
    }
  } else if (maybePrefixedInitial && maybePrefixedInitial.length > 2) {
    throw new Error(`Invalid delta deltaRef "${
        deltaRef}": only single ":" allowed in prefixed first step`);
  }

  const last = steps && steps.pop();
  if (last !== "") {
    throw new Error(`Invalid plot "${
        deltaRef}" delta: must be a string plot value and terminate in "/"`);
  }

  for (let i = isPrefixed ? 1 : 0; i !== steps.length; ++i) {
    const iriIndex = _tryParseResourceIndex(steps[i], iriLookup);
    if (iriIndex !== undefined) {
      steps[i] = iriIndex;
    } else if (requiredIRIIndexError) {
      throw new Error(`Invalid ${requiredIRIIndexError} plot "${deltaRef}" step #${i
        }: valid positive integer to IRI index expected, got: "${steps[i]}"`);
    }
  }

  return steps;
}

function _tryParseResourceIndex (integerString, iriLookup) {
  const ret = parseInt(integerString, 10);
  if (String(ret) !== integerString) return undefined;
  if (iriLookup && (iriLookup[ret] === undefined)) return undefined;
  return ret;
}
