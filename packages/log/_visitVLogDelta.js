
const { wrapError } = require("@valos/tools");

module.exports = {
  visitVLogDelta,
  appendToResourcePlot,
  appendToPlot,
  relativeIdFromOriginPlot,
};

function visitVLogDelta (delta, stack) {
  const resourcesDelta = delta["&/"];
  if (!resourcesDelta) throw new Error("VLog delta is missing global resources section '&/'");
  const visitorStack = Object.create(stack);
  visitorStack.originPlot = [];
  // Top level delta.
  _visitDeltaGlobalResources(visitorStack, resourcesDelta);
}

function _visitDeltaGlobalResources (stack, globalResourceDeltas) {
  const globalResourceKeys = Object.keys(globalResourceDeltas);
  if (!globalResourceKeys.length) throw new Error(`Invalid empty "&~" global resources delta`);
  for (const logicalStepsString of globalResourceKeys.sort()) {
    const globalResourceDelta = globalResourceDeltas[logicalStepsString];
    let logicalPlot, globalPlot;
    try {
      logicalPlot = appendToResourcePlot(["0"], logicalStepsString);
      globalPlot = stack.originPlot = [logicalPlot[logicalPlot.length - 1]];
      if (stack.validateGlobalResource) stack.validateGlobalResourcePlot(logicalPlot);
      const mutableResource = stack.mutateTargetResource
          && stack.mutateTargetResource(globalPlot);
      _visitDeltaResource(stack, globalResourceDelta, logicalStepsString,
          mutableResource, globalPlot[0], globalResourceDeltas);
    } catch (error) {
      throw wrapError(error, 1, `_visitDeltaGlobalResources["${logicalStepsString}"]`,
          "\n\tlogicalPlot:", logicalPlot,
          "\n\tglobalPlot:", globalPlot,
      );
    }
  }
}

function _visitDeltaSubResources (stack, subResourceDeltas, mutableParentResource) {
  const parentOriginPlot = stack.originPlot;
  const subResourceKeys = Object.keys(subResourceDeltas);
  if (!subResourceKeys.length) throw new Error(`Invalid empty "&_" sub-resources delta`);
  for (const subResourcePlotString of subResourceKeys.sort()) {
    const subResourceDelta = subResourceDeltas[subResourcePlotString];
    try {
      const originPlot = stack.originPlot = appendToResourcePlot([], subResourcePlotString);
      if (originPlot[0] !== parentOriginPlot[0]) {
        throw new Error(`Invalid sub-resource "${subResourcePlotString}" is not a child of "${
            parentOriginPlot[0]}/"`);
      }
      const mutableSubResource = stack.mutateTargetResource
          && stack.mutateTargetResource(originPlot, mutableParentResource, 1);
      _visitDeltaResource(stack, subResourceDelta, subResourcePlotString,
          mutableSubResource, originPlot[originPlot.length - 1], subResourceDeltas);
    } catch (error) {
      throw wrapError(error, 1, `_visitDeltaSubResources["${subResourcePlotString}"]`,
          "\n\torigin plot:", stack.originPlot,
          "\n\tparentOriginPlot:", parentOriginPlot,
      );
    }
  }
}

// validate logical plot to be appropriate
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

function _visitDeltaResource (stack, delta, deltaKey, mutableTarget
    /* , targetKey, parentResourcesDelta */) {
  if (delta["@context"]) {
    throw new Error("@context not allowed for log deltas");
  }
  if (delta["&-"]) {
    _visitProperties(stack, mutableTarget, delta["&-"], stack.removalVisitors);
  }
  _visitProperties(stack, mutableTarget, delta, stack.upsertVisitors);
  if (delta["&_"]) {
    if (stack.originPlot.length !== 1) {
      throw new Error(
          `Nested sub-resources not allowed in deltas ('&_' present in sub-resource </${
              stack.originPlot.join("/")}/>)`);
    }
    _visitDeltaSubResources(stack, delta["&_"], mutableTarget);
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

function appendToResourcePlot (resourcePlot, subPlotString) {
  if (subPlotString[0] === "/") {
    throw new Error(`Invalid vplot "${subPlotString}": resource sub-plots must be relative`);
  }
  return appendToPlot(resourcePlot, subPlotString,
      resourcePlot.length ? "logical resource plot" : "sub-resource plot");
}

function appendToPlot (targetPlot, subPlotString, noDotsAllowedReason) {
  const relativePlot = subPlotString.split("/");
  if (relativePlot.pop() !== "") { // Has correct semantics for "" -split> [""] -pop> [] also.
    throw new Error(`Invalid resource plot "${subPlotString}": must terminate in "/"`);
  }
  const isAbsolute = (relativePlot[0] === "");
  const ret = isAbsolute ? [] : targetPlot;
  for (let i = isAbsolute ? 1 : 0; i < relativePlot.length; ++i) {
    const step = relativePlot[i];
    if ((step !== ".") && (step !== "..")) {
      ret.push(step);
    } else if (noDotsAllowedReason || isAbsolute) {
      throw new Error(`Invalid local id "${
          subPlotString}": ${noDotsAllowedReason || "absolute vplot"} cannot contain "." or ".."`);
    } else if (step === ".") {
      continue;
    } else if (ret.length === 0) {
      throw new Error(`Invalid local id "${subPlotString}": cannot move up from root`);
    } else {
      ret.pop();
    }
  }
  return ret;
}

// Ignores the last entry of originPlot. The relative base of resources
// is their parent origin plot.
function relativeIdFromOriginPlot (originPlot, relativeBasePlot, isAbsolute) {
  if (isAbsolute) return `/${relativeBasePlot.join("/")}/`;
  let i = 0;
  const maxLen = originPlot.length - 1;
  for (; i !== maxLen; ++i) if (originPlot[i] !== relativeBasePlot[i]) break;
  const plotSuffix = relativeBasePlot.length === i ? "" : `${relativeBasePlot.slice(i).join("/")}/`;
  return `${"../".repeat(maxLen - i)}${plotSuffix}`;
}
