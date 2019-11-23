const { dumpObject, wrapError } = require("../../tools/wrapError");

module.exports = { cementVPath };

function cementVPath (vpath, { context = {}, contextState, componentType, index } = {}) {
  return _cementVPath(vpath, context, contextState, componentType, index);
}

function _cementVPath (vpath, context = {}, contextState, componentType, index) {
  let expandedVPath = vpath;
  try {
    if (vpath === undefined) throw new Error("Cannot cement undefined vpath");
    if (!componentType || (componentType === "@")) {
      if (!Array.isArray(vpath)) return (typeof vpath === "string") ? vpath : ["§'", vpath];
      if (vpath.length === 1) return ["§->", null];
    } else if (!Array.isArray(vpath) || (vpath[0] === "@")) {
      expandedVPath = [":", vpath];
    }
    const elementType = expandedVPath[0];
    const cement = _cementersByType[elementType];
    if (cement) {
      return cement(expandedVPath, context, contextState, componentType || elementType);
    }
    if (elementType[0] === "!") {
      expandedVPath[0] = `§${elementType.slice(1)}`;
      return _cementRest(expandedVPath, context, contextState, "!", 1);
    }
    throw new Error(`unrecognized verb type: ${JSON.stringify(elementType)}`);
  } catch (error) {
    throw wrapError(error,
        new Error(
            `During _cementVPath(#${index} of a parent '${componentType}'-type component)`),
        "\n\texpandedVPath:", ...dumpObject(expandedVPath),
        "\n\tcomponentType:", ...dumpObject(componentType));
  }
}

function _cementRest (expandedVPath, context, contextState, componentType, initial) {
  for (let i = initial; i !== expandedVPath.length; ++i) {
    expandedVPath[i] = _cementVPath(expandedVPath[i], context, contextState,
        componentType, i);
  }
  return expandedVPath;
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

function _cementStatements (expandedVPath, context, contextState) {
  if (expandedVPath.length === 2) {
    return _cementVPath(expandedVPath[1], context, contextState, "@", 1);
  }
  const fullPath = ["§->"];
  for (let i = 1; i !== expandedVPath.length; ++i) {
    if (expandedVPath[i][0] !== ":") {
      fullPath.push(_cementVPath(expandedVPath[i], context, contextState, "@", i));
    } else {
      const arrayPath = ["§[]"];
      do {
        arrayPath.push(_maybeEscapeCement(expandedVPath[i])
            || _cementVPath(expandedVPath[i], context, contextState, "*", i));
      } while ((++i !== expandedVPath.length) && (expandedVPath[i][0] === ":"));
      fullPath.push(arrayPath);
      --i;
    }
  }
  return (fullPath.length === 2) ? fullPath[1] : fullPath;
}

function _cementContextlessVParam (expandedVPath, context, contextState, componentType) {
  return _cementVParam(["$", "", expandedVPath[1]], context, contextState,
      (componentType === "@") ? ":" : componentType);
}

function _cementVParam (expandedVPath, context, contextState, componentType) {
  let cemented;
  const contextTerm = expandedVPath[1];
  const termContext = context[contextTerm];
  if (!contextTerm) {
    cemented = expandedVPath[2]
        && _cementVPath(expandedVPath[2], context, contextState);
    if (Array.isArray(cemented)) return cemented;
  } else if (!termContext) {
    throw new Error(`Cannot cement param: unrecognized context term '${contextTerm}'`);
    // return ["§'", expandedVPath];
  } else {
    const cementedParamValue = expandedVPath[2]
        && _cementVPath(expandedVPath[2], context, contextState);
    if (typeof termContext === "function") cemented = termContext;
    if (typeof cementedParamValue === "string") {
      if (cemented === undefined) cemented = (termContext.symbolFor || {})[cementedParamValue];
      if (cemented === undefined) cemented = (termContext.stepsFor || {})[cementedParamValue];
    }
    if ((cemented === undefined) && termContext.steps) {
      cemented = (typeof termContext.steps === "function")
          ? termContext.steps(contextState, cementedParamValue, contextTerm)
          : cementedParamValue !== undefined ? [...termContext.steps, cementedParamValue]
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
      cemented = cemented(contextState, cementedParamValue, contextTerm, componentType);
    }
    if (Array.isArray(cemented)) return cemented;
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

function _cementComputation (expandedVPath, context, contextState) {
  const computationType = expandedVPath[0];
  const first = _cementVPath(expandedVPath[1], context, contextState, "!0", 1);
  if (expandedVPath.length === 2) return first;
  if (first[0] === "§$") {
    expandedVPath[0] = "§->";
    expandedVPath[1] = first;
    return _cementRest(expandedVPath, context, contextState, "!*", 2);
  }
  expandedVPath.splice(0, 2, ...first);
  return _cementRest(expandedVPath, context, contextState, computationType, first.length);
}

function _cementQuotation (expandedVPath) {
  expandedVPath[0] = "§'";
  return expandedVPath;
}

function _cementProperty (expandedVPath, context, contextState, componentType) {
  // ref("@valos/raem/VPath#section_structured_scope_cementProperty")
  const first = _cementVPath(expandedVPath[1], context, contextState, ".", 1);
  if (expandedVPath.length <= 2) {
    if (componentType !== "-") return ["§..", first];
    if (typeof first !== "string") {
      throw new Error("Cannot cement object property: non-string name not supported");
    }
    return [
      first,
      ["§'", ["@", [".", [":", first]]]]];
  }
  if (componentType === "-") {
    if (expandedVPath.length > 3) {
      throw new Error("Cannot cement object property: multi-param property verbs not supported");
    }
    return [first, _maybeEscapeCement(expandedVPath[2])
        || _cementVPath(expandedVPath[2], context, contextState, ".", 2)];
  }
  const rest = _cementRest(expandedVPath, context, contextState, ".", 2);
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

function _maybeEscapeCement (entry) {
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

function _cementNamedCollection (expandedVPath, context, contextState) {
  const collectionType = expandedVPath[0];
  const nameParam = _tryAsNameParam(expandedVPath[1]);
  const nameSelector = (nameParam != null)
      && _cementPluralProperty(expandedVPath, context, contextState, collectionType);
  if (nameSelector && expandedVPath.length <= 2) return nameSelector;
  let isSequence;
  if (collectionType[0] === "*") isSequence = true;
  else if (collectionType[0] !== "-") {
    throw new Error(`Cannot cement named collection: unrecognized verb type '${
      collectionType}' (collection verb types must begin with "-" or "*")`);
  }
  expandedVPath.splice(0, 2, isSequence ? "§[]" : "§{}");
  if (expandedVPath.length > 1) {
    if (isSequence) _cementRest(expandedVPath, context, contextState, "*", 1);
    else {
      for (let i = 1; i !== expandedVPath.length; ++i) {
        if (expandedVPath[i][0] !== "@") {
          throw new Error(`Cannot cement named dictionary '${
            collectionType}': non-vpath params not supported`);
        }
        if ((expandedVPath[i].length !== 2) || (expandedVPath[i][1][0] !== ".")) {
          throw new Error(`Cannot cement named dictionary '${
            collectionType}': each param must be a path containing a single property verb`);
        }
        expandedVPath[i] = _cementVPath(expandedVPath[i][1], context, contextState, "-", i);
      }
    }
  }
  // if (!isSequence) _flattenObjectSetters(cementedCollection);
  return !nameSelector ? expandedVPath
      : isSequence ? ["§concat", nameSelector, expandedVPath]
      : ["§append", ["§{}"], nameSelector, expandedVPath];
}

function _tryAsNameParam (vparam) {
  if (Array.isArray(vparam) && ((vparam[0] === "$") || (vparam[0] === ":"))
      && !vparam[1] && !vparam[2]) return null;
  return vparam;
}

function _cementSingularProperty (expandedVPath) {
  // ref("@valos/raem/VPath#section_structured_object_value")
  const selector = _singularLookup[expandedVPath[0]];
  if (selector === undefined) {
    throw new Error(`Cannot cement singular '${expandedVPath[0]}': undefined property`);
  }
  if (expandedVPath.length > 1) {
    throw new Error(`Cannot cement singular '${expandedVPath[0]}': multi-param selectors not allowed`);
  }
  return selector;
}

function _cementPluralProperty (expandedVPath, context, contextState) {
  // ref("@valos/raem/VPath#section_structured_relation")
  const field = _pluralLookup[expandedVPath[0]];
  if (field === undefined) {
    throw new Error(`Cannot cement singular '${expandedVPath[0]}': undefined property`);
  }
  if (expandedVPath.length > 2) {
    throw new Error(`Cannot cement plural '${field}': multi-param selectors not allowed`);
  }
  return ["§->", false, field,
    ..._filterByFieldValue("name",
        _cementVPath(expandedVPath[1], context, contextState)),
  ];
}

function _filterByFieldValue (fieldName, requiredValue) {
  return (typeof requiredValue !== "object")
      ? [
        ["§filter", ["§===", fieldName, requiredValue]]
      ]
      : [
        ["§$<-", "requiredValue", requiredValue],
        ["§filter", ["§===", fieldName, ["§$", "requiredValue"]]],
      ];
}
