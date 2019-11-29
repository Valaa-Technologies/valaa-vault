const { dumpObject, wrapError } = require("../../tools/wrapError");

module.exports = { cementVPath };

function cementVPath (vpath, stack /* : { context: Obje, contextState, isPluralHead } */ = {}) {
  if (!stack.context) stack.context = {};
  return _cementVPath(stack, vpath, stack.componentType || "@", stack.index);
}

function _cementVPath (stack, vpath, componentType, index) {
  let segmentedVPath = vpath;
  try {
    if (vpath === undefined) throw new Error("Cannot cement undefined vpath");
    if (componentType === "@") {
      if (!Array.isArray(vpath)) return (typeof vpath === "string") ? vpath : ["§'", vpath];
      if (vpath.length === 1) return ["§->", null];
    } else if (!Array.isArray(vpath) || (vpath[0] === "@")) {
      segmentedVPath = [":", vpath];
    }
    const elementType = segmentedVPath[0];
    const cementer = _cementersByType[elementType];
    if (cementer) {
      return cementer(stack, segmentedVPath, componentType);
    }
    if (elementType[0] === "!") {
      segmentedVPath[0] = `§${elementType.slice(1)}`;
      return _cementRest(stack, segmentedVPath, "!", 1);
    }
    throw new Error(`unrecognized verb type: ${JSON.stringify(elementType)}`);
  } catch (error) {
    throw wrapError(error,
        new Error(
            `During _cementVPath(#${index} of a parent '${componentType}'-type component)`),
        "\n\tsegmentedVPath:", ...dumpObject(segmentedVPath),
        "\n\tcomponentType:", ...dumpObject(componentType));
  }
}

function _cementRest (stack, segmentedVPath, componentType, initial) {
  for (let i = initial; i !== segmentedVPath.length; ++i) {
    segmentedVPath[i] = _cementVPath(Object.create(stack), segmentedVPath[i], componentType, i);
  }
  return segmentedVPath;
}

const _singularLookup = {
  ".S.!": ["§.", "owner"],
  ".O.": ["§.", "value"],
  ".S-!": ["§.", "owner"],
  ".O-": ["§.", "rawId"],
  ".S'!": ["§.", "owner"],
  ".O'": ["§.", "content"],
  ".S*": ["§.", "source"],
  ".O*": ["§.", "target"],
  ".S*~": ["§.", "source"],
  ".O*~": ["§.", "target"],
  ".S*!": ["§.", "source"],
  ".O*!": ["§.", "target"],
};

const _pluralLookup = {
  "-": "unnamedOwnlings", // "entities",
  "'": "unnamedOwnlings", // "medias",
  "*": "relations",
  "*out": "relations",
  "*in": "incomingRelations",
  "*out~": "relations",
  "*in~": "incomingRelations",
};


const _cementersByType = {
  "@": _cementStatements,
  "": _invalidCementHead,
  $: _cementVParam,
  ":": _cementContextlessVParam,
  _: function _cementSubspace () {
    throw new Error("Cannot cement subspace selector: not implemented");
  },
  "!": _cementComputation,
  "!'": _cementQuotation,
  ...(Object.keys(_singularLookup)
      .reduce((a, p) => { a[p] = _cementSingularProperty; return a; }, {})),
  ...(Object.keys(_pluralLookup)
      .reduce((a, p) => { a[p] = _cementPluralProperty; return a; }, {})),
  ".": _cementProperty,
  "-": _cementNamedCollection,
  "'": _cementNamedCollection,
  "*": _cementNamedCollection,
};

function _invalidCementHead () {
  throw new Error(`Cannot cement: invalid VPath with "" as first entry`);
}

function _cementStatements (stack, segmentedVPath) {
  if (segmentedVPath.length === 2) {
    return _cementVPath(stack, segmentedVPath[1], "@", 1);
  }
  const fullPath = ["§->"];
  for (let i = 1; i !== segmentedVPath.length; ++i) {
    if (segmentedVPath[i][0] !== ":") {
      fullPath.push(_cementVPath(stack, segmentedVPath[i], "@", i));
    } else {
      const arrayPath = ["§[]"];
      do {
        arrayPath.push(_maybeEscapedCement(segmentedVPath[i])
            || _cementVPath(stack, segmentedVPath[i], "*", i));
      } while ((++i !== segmentedVPath.length) && (segmentedVPath[i][0] === ":"));
      fullPath.push(arrayPath);
      --i;
      stack.isPluralHead = true;
    }
  }
  return (fullPath.length === 2) ? fullPath[1] : fullPath;
}

function _cementContextlessVParam (stack, segmentedVPath, componentType) {
  return _cementVParam(
      stack, ["$", "", segmentedVPath[1]], (componentType === "@") ? ":" : componentType);
}

function _cementVParam (stack, segmentedVPath, componentType) {
  let cemented;
  const contextTerm = segmentedVPath[1];
  const termContext = stack.context[contextTerm];
  if (!contextTerm) {
    cemented = (segmentedVPath[2] === undefined)
            ? ["§void"]
        : (componentType === ":")
            && ((segmentedVPath[2] === null) || (typeof segmentedVPath[2] !== "object"))
            ? ["§'", segmentedVPath[2]]
            : _cementVPath(stack, segmentedVPath[2], "@");
    if (Array.isArray(cemented)) return cemented;
  } else if (!termContext) {
    throw new Error(`Cannot cement param: unrecognized context term '${contextTerm}'`);
    // return ["§'", segmentedVPath];
  } else {
    const cementedParamValue = segmentedVPath[2]
        && _cementVPath(stack, segmentedVPath[2], "@");
    if (typeof termContext === "function") cemented = termContext;
    if (typeof cementedParamValue === "string") {
      if (cemented === undefined) cemented = (termContext.symbolFor || {})[cementedParamValue];
      if (cemented === undefined) cemented = (termContext.stepsFor || {})[cementedParamValue];
    }
    if ((cemented === undefined) && termContext.steps) {
      cemented = (typeof termContext.steps === "function")
              ? termContext.steps(stack.contextState, cementedParamValue, contextTerm)
          : (cementedParamValue !== undefined)
              ? [...termContext.steps, cementedParamValue]
              : [...termContext.steps];
    }
    if (cemented == null) {
      throw new Error(`Cannot cement param context term '${contextTerm}' value ${
          typeof cementedParamValue === "string"
              ? `'${cementedParamValue}'`
              : `with type ${typeof cementedParamValue}`}: ${
          cemented === null ? "explicitly disabled" : "undefined"}`);
    }
    if (typeof cemented === "function") {
      cemented = cemented(stack.contextState, cementedParamValue, contextTerm, componentType);
    }
    if (typeof cemented !== "string") return cemented;
  }
  switch (componentType) {
  case "@":
    // vgrid
    return ["§ref", cemented];
  case "!0": // first entry of a trivial resource valk
    return ["§$", cemented];
  case "!*":
    return ["§..", cemented]; // subsequent entries of trivial resource valk
  default: // eslint-disable-line no-fallthrough
    return cemented;
  }
}

function _cementComputation (stack, segmentedVPath) {
  const computationType = segmentedVPath[0];
  const first = _cementVPath(stack, segmentedVPath[1], "!0", 1);
  if (segmentedVPath.length === 2) return first;
  if (first[0] === "§$") {
    segmentedVPath[0] = "§->";
    segmentedVPath[1] = first;
    return _cementRest(stack, segmentedVPath, "!*", 2);
  }
  segmentedVPath.splice(0, 2, ...first);
  return _cementRest(stack, segmentedVPath, computationType, first.length);
}

function _cementQuotation (stack, segmentedVPath, componentType, index) {
  segmentedVPath[0] = "!";
  return ["§'", _cementVPath(stack, segmentedVPath, componentType, index)];
}

function _cementProperty (stack, segmentedVPath, componentType) {
  // ref("@valos/raem/VPath#section_structured_scope_cementProperty")
  const first = _cementVPath(stack, segmentedVPath[1], ".", 1);
  if (segmentedVPath.length <= 2) {
    if (componentType !== "-") {
      const ret = Array.isArray(first) ? first : ["§..", first];
      return ((componentType === "@") && stack.isPluralHead)
          ? ["§map", ret] : ret;
    }
    if (typeof first !== "string") {
      throw new Error("Cannot cement object property: non-string name not supported");
    }
    return [first, ["§'", ["@", [".", [":", first]]]]];
  }
  if (componentType === "-") {
    if (segmentedVPath.length > 3) {
      throw new Error("Cannot cement object property: multi-param property verbs not supported");
    }
    return [first, _maybeEscapedCement(segmentedVPath[2])
        || _cementVPath(stack, segmentedVPath[2], ".", 2)];
  }
  const rest = _cementRest(stack, segmentedVPath, ".", 2);
  const setter = [first, rest];
  if ((rest.length === 3)
      && ((rest[2] == null) || (rest[2] && rest[2][0] !== "§.<-"))) {
    setter[1] = rest[2];
  } else {
    rest[0] = "§{}";
    rest.splice(1, 1);
    _flattenObjectSetters(rest);
  }
  return ["§.<-", setter];
}

function _maybeEscapedCement (entry) {
  if ((entry[0] === ":") && ((entry[1] === null) || (typeof entry[1] !== "object"))) {
    return entry[1];
  }
  let verb = entry;
  if (entry[0] === "@") {
    if ((verb.length > 1) && !verb.find((e, i) => i && e[0] !== ":")) return undefined;
    if (entry.length === 2) verb = entry[1];
  }
  if ((verb[0] === "-") || (verb[0][0] === "!")) return undefined;
  return ["§'", entry];
}

function _flattenObjectSetters (setters) {
  for (let i = 1; i !== setters.length; ++i) {
    if ((setters[i] == null) || (setters[i][0] !== "§.<-")) {
      throw wrapError(
          new Error(`Cannot cement object property setter: property verb can only have more than${
            ""} one param if they're all nested properties`),
          new Error("During _cementProperty"),
          `\n\tsetters[${i}]:`, dumpObject(setters[i]),
          `\n\tsetters:`, dumpObject(setters),
      );
    }
    setters[i] = setters[i][1];
  }
}

function _cementNamedCollection (stack, segmentedVPath) {
  const collectionType = segmentedVPath[0];
  const nameParam = _tryAsNameParam(segmentedVPath[1]);
  const paramStack = Object.create(stack);
  paramStack.isPluralHead = paramStack.isPluralHead;
  const byNameSelector = (nameParam != null)
      && _cementPluralProperty(stack, segmentedVPath, collectionType);
  if (byNameSelector && segmentedVPath.length <= 2) return byNameSelector;
  stack.isPluralHead = (collectionType[0] === "*");
  segmentedVPath.splice(0, 2, stack.isPluralHead ? "§[]" : "§{}");
  if (segmentedVPath.length > 1) {
    if (stack.isPluralHead) _cementRest(paramStack, segmentedVPath, "*", 1);
    else {
      for (let i = 1; i !== segmentedVPath.length; ++i) {
        if (segmentedVPath[i][0] !== "@") {
          throw new Error(`Cannot cement named dictionary '${
            collectionType}': non-vpath params not supported`);
        }
        if ((segmentedVPath[i].length !== 2) || (segmentedVPath[i][1][0] !== ".")) {
          throw new Error(`Cannot cement named dictionary '${
            collectionType}': each param must be a path containing a single property verb`);
        }
        segmentedVPath[i] = _cementVPath(paramStack, segmentedVPath[i][1], "-", i);
      }
    }
  }
  // if (!isSequence) _flattenObjectSetters(cementedCollection);
  return !byNameSelector
          ? segmentedVPath
      : stack.isPluralHead
          ? ["§concat", byNameSelector, segmentedVPath]
          : ["§append", ["§{}"], byNameSelector, segmentedVPath];
}

function _tryAsNameParam (vparam) {
  if (Array.isArray(vparam) && ((vparam[0] === "$") || (vparam[0] === ":"))
      && !vparam[1] && !vparam[2]) return null;
  return vparam;
}

function _cementSingularProperty (stack, segmentedVPath) {
  // ref("@valos/raem/VPath#section_structured_object_value")
  const selector = _singularLookup[segmentedVPath[0]];
  if (selector === undefined) {
    throw new Error(`Cannot cement singular '${segmentedVPath[0]}': undefined property`);
  }
  if (segmentedVPath.length > 1) {
    throw new Error(
        `Cannot cement singular '${segmentedVPath[0]}': multi-param selectors not allowed`);
  }
  return selector;
}

function _cementPluralProperty (stack, segmentedVPath) {
  // ref("@valos/raem/VPath#section_structured_relation")
  const field = _pluralLookup[segmentedVPath[0]];
  if (field === undefined) {
    throw new Error(`Cannot cement plural '${segmentedVPath[0]}': undefined property`);
  }
  if (segmentedVPath.length > 2) {
    throw new Error(`Cannot cement plural '${field}': multi-param selectors not allowed`);
  }
  stack.isPluralHead = (segmentedVPath[0][0] === "*");
  return ["§->", false, field, false,
    ..._filterByFieldValue("name", _cementVPath(stack, segmentedVPath[1], "!")),
    ...(stack.isPluralHead ? [] : [false, 0])
  ];
}

function _filterByFieldValue (fieldName, requiredValue) {
  return (typeof requiredValue !== "object")
      ? [
        ["§filter", ["§===", ["§.", fieldName], requiredValue]]
      ]
      : [
        ["§$<-", ["requiredValue", requiredValue]],
        ["§filter", ["§===", ["§.", fieldName], ["§$", "requiredValue"]]],
      ];
}
