const { dumpObject, wrapError } = require("../../tools/wrapError");

module.exports = { cementVPath, extendTrack };

function extendTrack (target, extension) {
  if (target[0] !== "§->" || !Array.isArray(extension) || extension[0] !== "§->") {
    target.push(extension);
  } else target.push(...extension.slice(1));
}

function cementVPath (vpathSection,
    stack /* : { context: Object, contextState, isPluralHead } */ = {}) {
  if (!stack.context) stack.context = {};
  return _cementSection(
      stack, vpathSection, stack.parentSection || ["@@", [vpathSection]], stack.index || 0);
}

function _cementSection (stack, section, parentSection, index) {
  const inferredSection = Array.isArray(section) ? section : ["@$", section];
  const sectionType = inferredSection[0];
  try {
    // console.log("cementSection:", ...dumpObject(section), "#", index, "of", parentSection);
    if (section === undefined) throw new Error("Cannot cement undefined section");
    let cementer = _cementersByType[inferredSection[0]];
    if (!cementer) {
      if (sectionType[1] === "$") cementer = _cementVParam;
      if (sectionType[1] === "!") cementer = _cementVALKComputation;
    }
    if (!cementer) throw new Error(`Cannot cement unrecognized section type: ${sectionType}`);
    const ret = cementer(stack, inferredSection, parentSection, index);
    // console.log("cementSection:", ...dumpObject(section),
    //    "\n\tret:", ...dumpObject(ret));
    return ret;
  } catch (error) {
    throw wrapError(error, new Error(`During _cementSection(${sectionType})`),
        "\n\tsection:", ...dumpObject(section),
        `\n\tentry #${index} of parent section:`, ...dumpObject(parentSection));
  }
}

function _cementGenericPayload (stack, section, track, initial = 0) {
  if (Array.isArray(section[1])) {
    const sequentialStack = (track[0] === "§->") && stack;
    for (let i = initial; i < section[1].length; ++i) {
      extendTrack(track, _cementSection(
          sequentialStack || Object.create(stack), section[1][i], section, i));
    }
  } else if (section[1] !== undefined) {
    throw new Error(`Invalid payload: undefined or array expected, got ${section == null ? section
        : section.name || (section.constructor || "").name || typeof section}`);
  }
  return track;
}

const _singularLookup = {
  "@.S.": ["§.", "owner"],
  "@.O.": ["§.", "value"],
  "@.S+": ["§.", "owner"],
  "@.O+": ["§.", "rawId"],
  "@.S~": ["§.", "owner"],
  "@.O~": ["§.", "content"],
  "@.S-": ["§.", "source"],
  "@.O-": ["§.", "target"],
  "@.S--": ["§.", "source"],
  "@.O--": ["§.", "target"],
  "@.S---": ["§.", "source"],
  "@.O---": ["§.", "target"],
};

const _pluralLookup = {
  "@+": "entities",
  "@~": "medias",
  "@-": "relations",
  "@-out": "relations",
  "@-in": "incomingRelations",
  "@-out-": "relations",
  "@-in-": "incomingRelations",
  "@-out--": "relations",
  "@-in--": "incomingRelations",
};


const _cementersByType = {
  "": _invalidCementHead,
  "@@": _cementStatements,
  "@": _cementVGRID,
  "@$": _cementContextlessVParam,
  "@!": _cementComputation,
  "@!'": _cementQuotation,
  "@_": function _cementSubspace () {
    throw new Error("Cannot cement subspace selector: not implemented");
  },
  ...(Object.keys(_singularLookup)
      .reduce((a, p) => { a[p] = _cementSingularProperty; return a; }, {})),
  ...(Object.keys(_pluralLookup)
      .reduce((a, p) => { a[p] = _cementPluralProperty; return a; }, {})),
  "@.": _cementProperty,
  "@+": _cementCollection,
  "@-": _cementCollection,
  "@~": _cementCollection,
};

function _invalidCementHead (stack, [sectionType]) {
  throw new Error(`Cannot cement: invalid section with "${sectionType}" as section type`);
}

function _cementStatements (stack, section) {
  return _cementGenericPayload(stack, section, ["§->"]);
}

function _cementVGRID (/* stack, [sectionType, payload], parentSection, index */) {
  throw new Error("CementVGRID not implemented yet");
}

function _cementContextlessVParam (stack, section, parentSection) {
  const value = section[1];
  if (value === undefined) return ["§void"];
  if ((value !== null) && (typeof value === "object")) {
    return _cementSection(stack, value, section, null);
  }
  switch (parentSection[0]) {
  case "@": // VGRID
    return ["§ref", value];
  case "@!": // trivial accessor valk entry
    return value;
  case "@.": // eslint-disable-line no-fallthrough
    if (parentSection[1].length === 1) return ["§..", value];
  default: // eslint-disable-line no-fallthrough
    break;
  }
  return ["§'", value];
}

function _cementVParam (stack, [sectionType, payload], parentSection, index) {
  const contextTerm = sectionType.slice(2);
  const termContext = stack.context[contextTerm];
  if (!termContext) {
    throw new Error(`Cannot cement param: unrecognized context term '${contextTerm}'`);
  }
  const valueTrack = !Array.isArray(payload) ? payload : _cementSection(stack, payload, "@@");
  let track;
  if (typeof termContext === "function") track = termContext;
  else if (typeof valueTrack === "string") {
    if (track === undefined) track = (termContext.symbolFor || {})[valueTrack];
    if (track === undefined) track = (termContext.stepsFor || {})[valueTrack];
    if (track) track = [...track]; // copy
  }
  if ((track === undefined) && termContext.steps) {
    track = (typeof termContext.steps === "function")
            ? termContext.steps(stack.contextState, valueTrack, contextTerm, parentSection, index)
        : (valueTrack !== undefined)
            ? [...termContext.steps, valueTrack]
            : [...termContext.steps];
  }
  if (track == null) {
    throw new Error(`Cannot cement param context term '${contextTerm}' value ${
        typeof valueTrack === "string" ? `"${valueTrack}"` : `with type ${typeof valueTrack}`}: ${
        track === null ? "explicitly disabled by a context rule" : "undefined"}`);
  }
  if (typeof track === "function") {
    track = track(stack.contextState, valueTrack, contextTerm, parentSection, index);
  }
  if (typeof track !== "string") return track;
  switch (parentSection[0]) {
  case "@":
    // VGRID
    return ["§ref", track];
  case "@!": // trivial accessor valk entry
    return !index ? ["§$", track] : ["§..", track];
  case "@.":
    if (parentSection[1].length === 1) return ["§..", track];
  default: // eslint-disable-line no-fallthrough
    return track;
  }
}

function _cementVALKComputation (stack, section) {
  stack.isPluralHead = false;
  return _cementGenericPayload(stack, section, [`§${section[0].slice(2)}`]);
}

function _cementComputation (stack, section) {
  const payload = section[1];
  if (!payload || !payload.length) return ["§$"];
  let track = _cementSection(stack, payload[0], section, 0);
  const accessorStack = (typeof track === "string") && stack;
  if (accessorStack) {
    track = ["§$", track];
    accessorStack.isPluralHead = false; // Naively assume all scope variables are singular.
  }
  if (payload.length === 1) return track;
  if (track[0] === "§$") track = ["§->", track];
  for (let i = 1; i !== payload.length; ++i) {
    const stage = _cementSection(accessorStack || Object.create(stack), payload[i], section, i);
    extendTrack(track, accessorStack && ((typeof stage === "string") || (payload[i][0][1] === "!"))
        ? ["§..", stage]
        : stage);
  }
  return track;
}

function _cementQuotation (stack, section) {
  return ["§'", ["!", section[1]]];
}

function _cementProperty (stack, section, parentSection) {
  // ref("@valos/raem/VPath#section_structured_scope_cementProperty")
  const payload = section[1];
  if (!payload) throw new Error("Missing property payload");
  const firstTrack = _cementSection(stack, payload[0], section, 0);
  if (parentSection[0] === "@+") {
    // Object initializer.
    if (payload.length > 2) {
      throw new Error(`Cannot cement property: multi-param properties not supported`);
    }
    const propertyName = firstTrack[1];
    if ((typeof propertyName !== "string") && (payload.length === 1)) {
      throw new Error("Cannot cement property forwarder: non-string name not supported");
    }
    const propertyValue = (payload.length === 1)
        ? ["§'", ["@.", [propertyName]]]
        : _maybeEscapedSection(payload[1])
            || _cementSection(stack, payload[1], section, 1);
    return [propertyName, propertyValue];
  }
  if (payload.length === 1) {
    // Property access.
    return ((parentSection[0] !== "@@") || !stack.isPluralHead) ? firstTrack : ["§map", firstTrack];
  }
  if (payload.length === 2) {
    // Property value-setter.
    return ["§.<-", [firstTrack, _cementSection(stack, payload[1], section, 1)]];
  }
  // Property object-value-setter
  throw new Error("Cannot cement property object-value: not implemented");
  /*
  const rest = _cementGenericPayload(stack, section, [], 1);
  const setter = [first, rest];
  if ((rest.length === 3) && ((rest[2] == null) || (rest[2] && rest[2][0] !== "§.<-"))) {
    setter[1] = rest[2];
  } else {
    rest[0] = "§{}";
    rest.splice(1, 1);
    _flattenObjectSetters(rest);
  }
  return ["§.<-", setter];
  */
}

function _maybeEscapedSection (section) {
  let ret;
  if ((section === null) || (typeof section !== "object")) {
    ret = section;
  } else if ((section[0] === "@$") && ((section[1] === null) || (typeof section[1] !== "object"))) {
    ret = section[1];
  } else {
    ret = section;
    if ((section[0] === "@@") && section[1]) {
      const payload = section[1];
      if ((payload.length > 0) && !payload.find(e => (e != null) && e[0] !== "@$")) {
        return undefined;
      }
      if (payload.length === 1) ret = payload[0];
    }
    if ((ret[0] === "@-") || (ret[0] === "@+") || (ret[0] === "@!")) return undefined;
  }
  return (typeof ret !== "object") ? ret : ["§'", ret];
}

/*
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
*/

function _cementCollection (stack, section) {
  const collectionType = section[0];
  const payload = section[1];
  const paramStack = Object.create(stack);
  paramStack.isPluralHead = paramStack.isPluralHead;
  stack.isPluralHead = (collectionType[1] === "-");
  if (payload.length === 0) return [stack.isPluralHead ? "§[]" : "§{}"];

  let selectByNameTrack;
  const nameParam = (collectionType !== "@-") && _tryAsNameParam(payload[0]);
  if (nameParam) {
    selectByNameTrack = _cementPluralProperty(stack, [collectionType.slice(0, 2), [nameParam]]);
    if (payload.length === 1) return selectByNameTrack;
  }
  if (stack.isPluralHead) {
    // sequence selector + value concatenation
    const createSequenceTrack = _cementGenericPayload(
        paramStack, section, ["§[]"], selectByNameTrack ? 1 : 0);
    return !selectByNameTrack
        ? createSequenceTrack
        : ["§concat", selectByNameTrack, createSequenceTrack];
  }
  // singular resource selector (entity, media) + field initializer append
  const initializers = [];
  for (let i = selectByNameTrack ? 1 : 0; i !== payload.length; ++i) {
    const entry = payload[i];
    if (entry[0] !== "@.") {
      throw new Error(`Cannot cement named dictionary '${
        collectionType}': each param must be a property verb ("@."), got: ${entry[0]}`);
    }
    initializers[i] = _cementSection(paramStack, entry, ["@+"], i);
  }
  initializers.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  initializers.unshift("§{}");
  // if (!isSequence) _flattenObjectSetters(cementedCollection);
  return !selectByNameTrack
      ? initializers
      : ["§append", ["§{}"], selectByNameTrack, initializers];
}

function _tryAsNameParam (section) {
  if (typeof section === "string") return section;
  if (Array.isArray(section) && (section[0] === "@$") && typeof section[1] === "string") {
    return section[1];
  }
  return undefined;
}

function _cementSingularProperty (stack, section) {
  // ref("@valos/raem/VPath#section_structured_object_value")
  const selector = _singularLookup[section[0]];
  stack.isPluralHead = false;
  if (selector === undefined) {
    throw new Error(`Cannot cement singular '${section[0]}': undefined property`);
  }
  if ((section[1] || []).length) {
    throw new Error(`Cannot cement singular '${section[0]}': no params allowed`);
  }
  return selector;
}

function _cementPluralProperty (stack, section) {
  // ref("@valos/raem/VPath#section_structured_relation")
  const propertyType = section[0];
  const field = _pluralLookup[propertyType];
  if (field === undefined) {
    throw new Error(`Cannot cement plural '${propertyType}': undefined property`);
  }
  const payload = section[1] || [];
  if (payload.length > 1) {
    throw new Error(`Cannot cement plural '${propertyType}': multi-param selectors not supported`);
  }
  const ret = ["§->", false, field, false];
  if (!payload.length) { // no name fitler
    stack.isPluralHead = true;
  } else {
    const nameTrack = _cementSection(stack, payload[0], section, 0);
    ret.push(..._filterByFieldValue("name", nameTrack));
    stack.isPluralHead = (propertyType[1] === "-");
    if (!stack.isPluralHead) ret.push(false, 0);
  }
  return ret;
}

function _filterByFieldValue (fieldName, requiredValue) {
  const simplified = (requiredValue[0] === "§'") && (typeof requiredValue[1] !== "object")
      ? requiredValue[1] : requiredValue;
  return (typeof simplified !== "object")
      ? [["§filter", ["§===", ["§.", fieldName], simplified]]]
      : [["§$<-", ["pname", simplified]],
          ["§filter", ["§===", ["§.", fieldName], ["§$", "pname"]]]];
}
