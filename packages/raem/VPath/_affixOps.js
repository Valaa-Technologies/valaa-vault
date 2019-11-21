const { dumpObject, wrapError } = require("../../tools/wrapError");

module.exports = { affixVPath };

function affixVPath (vp, contextLookup = {}, contextState, componentType, index) {
  let expandedVPath = vp;
  try {
    if (vp === undefined) throw new Error("Cannot affix undefined vpath");
    if (!componentType || (componentType === "@")) {
      if (!Array.isArray(vp)) return (typeof vp === "string") ? vp : ["§'", vp];
      if (vp.length === 1) return ["§->", null];
    } else if (!Array.isArray(vp) || (vp[0] === "@")) {
      expandedVPath = [":", vp];
    }
    const elementType = expandedVPath[0];
    const affix = _affixersByType[elementType];
    if (affix) {
      return affix(expandedVPath, contextLookup, contextState, componentType || elementType);
    }
    if (elementType[0] === "!") {
      expandedVPath[0] = `§${elementType.slice(1)}`;
      return _affixRest(expandedVPath, contextLookup, contextState, "!", 1);
    }
    throw new Error(`unrecognized verb type: ${JSON.stringify(elementType)}`);
  } catch (error) {
    throw wrapError(error,
        new Error(
            `During affixVPath(#${index} of a parent '${componentType}'-type component)`),
        "\n\texpandedVPath:", ...dumpObject(expandedVPath),
        "\n\tcomponentType:", ...dumpObject(componentType));
  }
}

function _affixRest (expandedVPath, contextLookup, contextState, componentType, initial) {
  for (let i = initial; i !== expandedVPath.length; ++i) {
    expandedVPath[i] = affixVPath(expandedVPath[i], contextLookup, contextState,
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


const _affixersByType = {
  "@": _affixStatements,
  "": _invalidAffixHead,
  $: _affixVParam,
  ":": _affixContextlessVParam,
  _: function _affixSubspace () {
    throw new Error("subspace elector affixer not implemented");
  },
  "!": _affixComputation,
  "!'": _affixQuotation,
  ...(Object.keys(_singularLookup)
      .reduce((a, p) => { a[p] = _affixSingularProperty; return a; }, {})),
  ...(Object.keys(_pluralLookup)
      .reduce((a, p) => { a[p] = _affixPluralProperty; return a; }, {})),
  ".": _affixProperty,
  "-": _affixNamedCollection,
  "'": _affixNamedCollection,
  "*": _affixNamedCollection,
};

function _invalidAffixHead () {
  throw new Error(`Invalid expanded VPath head: ":" and "" can't appear as first entries`);
}

function _affixStatements (expandedVPath, contextLookup, contextState) {
  if (expandedVPath.length === 2) {
    return affixVPath(expandedVPath[1], contextLookup, contextState, "@", 1);
  }
  const fullPath = ["§->"];
  for (let i = 1; i !== expandedVPath.length; ++i) {
    const entry = expandedVPath[i];
    if (entry[0] !== ":") {
      fullPath.push(affixVPath(expandedVPath[i], contextLookup, contextState, "@", i));
    } else {
      const arrayPath = ["§[]"];
      do {
        arrayPath.push(affixVPath(expandedVPath[i], contextLookup, contextState, "*", i));
      } while ((++i !== expandedVPath.length) && (expandedVPath[i][0] === ":"));
      fullPath.push(arrayPath);
      --i;
    }
  }
  return (fullPath.length === 2) ? fullPath[1] : fullPath;
}

function _affixContextlessVParam (expandedVPath, contextLookup, contextState, componentType) {
  return _affixVParam(["$", "", expandedVPath[1]], contextLookup, contextState,
      (componentType === "@") ? ":" : componentType);
}

function _affixVParam (expandedVPath, contextLookup, contextState, componentType) {
  let value;
  const contextTerm = expandedVPath[1];
  const context = contextLookup[contextTerm];
  if (!contextTerm) {
    value = expandedVPath[2]
        && affixVPath(expandedVPath[2], contextLookup, contextState);
    if (Array.isArray(value)) return value;
  } else if (!context) {
    return ["§'", expandedVPath];
  } else {
    const affixedValue = expandedVPath[2]
        && affixVPath(expandedVPath[2], contextLookup, contextState);
    if (typeof context === "function") value = context;
    if (typeof affixedValue === "string") {
      if (value === undefined) value = (context.symbolFor || {})[affixedValue];
      if (value === undefined) value = (context.stepsFor || {})[affixedValue];
    }
    if ((value === undefined) && context.steps) {
      value = (typeof context.steps !== "function")
          ? [...context.steps, affixedValue]
          : context.steps(contextState, affixedValue, contextTerm);
    }
    if (value == null) {
      throw new Error(`VParam non-trivial context '${contextTerm}' value ${
        value === null ? "disabled" : "not found"}`);
    }
    if (typeof value === "function") {
      value = value(contextState, affixedValue, contextTerm, componentType);
    }
    if (Array.isArray(value)) return value;
  }
  switch (componentType) {
  case "@":
    // vgrid
    return ["§ref", value];
  case "!0": // first entry of a trivial resource valk
    return ["§$", value];
  case "!*":
    return ["§..", value]; // subsequent entries of trivial resource valk
  default: // eslint-disable-line no-fallthrough
    return value;
  }
}

function _affixComputation (expandedVPath, contextLookup, contextState) {
  const computationType = expandedVPath[0];
  const first = affixVPath(expandedVPath[1], contextLookup, contextState, "!0", 1);
  if (expandedVPath.length === 2) return first;
  if (first[0] === "§$") {
    expandedVPath[0] = "§->";
    expandedVPath[1] = first;
    return _affixRest(expandedVPath, contextLookup, contextState, "!*", 2);
  }
  expandedVPath.splice(0, 2, ...first);
  return _affixRest(expandedVPath, contextLookup, contextState, computationType, first.length);
}

function _affixQuotation (expandedVPath) {
  expandedVPath[0] = "§'";
  return expandedVPath;
}

function _affixProperty (expandedVPath, contextLookup, contextState, componentType) {
  // ref("@valos/raem/VPath#section_structured_scope_affixProperty")
  const first = affixVPath(expandedVPath[1], contextLookup, contextState, ".", 1);
  if (expandedVPath.length <= 2) return ["§..", first];
  const rest = _affixRest(expandedVPath, contextLookup, contextState, ".", 2);
  const setter = [first, rest];
  if (rest.length === 3 && ((rest[2] == null) || (rest[2] && rest[2][0] !== "§.<-"))) {
    setter[1] = rest[2];
  } else {
    rest[0] = "§{}";
    rest.splice(1, 1);
    _flattenObjectSetters(rest);
  }
  return componentType === "-" ? setter : ["§.<-", setter];
}

function _affixNamedCollection (expandedVPath, contextLookup, contextState) {
  const collectionType = expandedVPath[0];
  const nameParam = _tryAsNameParam(expandedVPath[1]);
  const nameSelector = (nameParam != null)
      && _affixPluralProperty(expandedVPath, contextLookup, contextState, collectionType);
  if (nameSelector && expandedVPath.length <= 2) return nameSelector;
  let isSequence;
  if (collectionType[0] === "*") isSequence = true;
  else if (collectionType[0] !== "-") {
    throw new Error(`Unrecognized named collection verb type ${collectionType
        } (must begin with "-" or "*")`);
  }
  if (expandedVPath.length > 2) {
    _affixRest(expandedVPath, contextLookup, contextState, isSequence ? "*" : "-", 2);
  }
  expandedVPath.splice(0, 2, isSequence ? "§[]" : "§{}");
  if (!isSequence) _flattenObjectSetters(expandedVPath);
  return !nameSelector ? expandedVPath
      : isSequence ? ["§concat", nameSelector, expandedVPath]
      : ["§append", ["§{}"], nameSelector, expandedVPath];
}

function _flattenObjectSetters (setters) {
  for (let i = 1; i !== setters.length; ++i) {
    if ((setters[i] == null) || (setters[i][0] !== "§.<-")) {
      throw wrapError(
          new Error(
              "Property verb can only have more than one param if they're all nested properties"),
          new Error("During _affixProperty"),
          `\n\tsetters[${i}]:`, dumpObject(setters[i]),
          `\n\tsetters:`, dumpObject(setters),
        );
    }
    setters[i] = setters[i][1];
  }
}

function _tryAsNameParam (vparam) {
  if (Array.isArray(vparam) && ((vparam[0] === "$") || (vparam[0] === ":"))
      && !vparam[1] && !vparam[2]) return null;
  return vparam;
}

function _affixSingularProperty (expandedVPath) {
  // ref("@valos/raem/VPath#section_structured_object_value")
  const selector = _singularLookup[expandedVPath[0]];
  if (expandedVPath.length > 1) {
    throw new Error(`multi-param '${expandedVPath[0]}' selectors not allowed`);
  }
  return selector;
}

function _affixPluralProperty (expandedVPath, contextLookup, contextState) {
  // ref("@valos/raem/VPath#section_structured_relation")
  const field = _pluralLookup[expandedVPath[0]];
  if (expandedVPath.length > 2) {
    throw new Error(`multi-param '${field}' selectors not allowed`);
  }
  return ["§->", false, field,
    ..._filterByFieldValue("name",
        affixVPath(expandedVPath[1], contextLookup, contextState)),
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
