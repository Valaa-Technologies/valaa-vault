// @flow

const { dumpObject, wrapError } = require("../tools/wrapError");

module.exports = {
  mintVPath,
  mintVGRId,
  mintVerb,
  mintParam,
  mintParamValue,
  expandVPath,
  validateVPath,
  validateFullVPath,
  validateVRId,
  validateVerbs,
  validateVGRId,
  validateFormatTerm,
  validateVerb,
  validateVerbType,
  validateVParam,
  validateContextTerm,
  validateContextTermNS,
  validateParamValueText,
  bindExpandedVPath,
};

function mintVPath (...segments) {
  return `@${segments.map(_mintVPathSegment).join("@")}@`;
}

function _mintVPathSegment (segment, index) {
  try {
    if (typeof segment === "string") {
      return segment[0] === "$"
          ? validateVGRId(segment)
          : validateVerb(segment, index);
    }
    if (!Array.isArray(segment)) {
      throw new Error(`Invalid segment #${index} while minting: must be a string or Array, got ${
        typeof segment}`);
    }
    if (segment[0] !== "$") {
      // verb
      return mintVerb(...segment);
    }
    // vgrid
    if (index) {
      throw new Error(`Invalid segment #${index} while minting:${
        ""} expected verb (is not first segment), got vgrid ("$" as first segment element)`);
    }
    return mintVGRId(...segment.slice(1));
  } catch (error) {
    throw wrapError(error, new Error(`While minting VPath segment #${index}`),
        "\n\tsegment:", segment);
  }
}

function mintVGRId (formatTerm, paramElement,
    ...params /* : (string | ["$", string, ?string]) */) {
  validateFormatTerm(formatTerm);
  const paramValue = mintParamValue(paramElement);
  if (!paramValue) throw new Error(`Invalid vgrid: param-value missing`);
  return `$${formatTerm}:${paramValue}${params.map(mintParam).join("")}`;
}

function mintVerb (verbType, ...params /* : (string | ["$", string, ?string])[] */) {
  validateVerbType(verbType);
  return `${verbType}${params.map(mintParam).join("")}`;
}

function mintParam (paramElement /* : (string | ["$", string, ?string]) */, index, params) {
  let ret;
  if ((typeof paramElement === "string") || (paramElement[0] === "@")) {
    ret = `:${mintParamValue(paramElement)}`;
  } else if (!Array.isArray(paramElement)) {
    throw new Error(`Invalid paramElement #${index}: expected a string or a param Array`);
  } else if (paramElement[0] === "$") {
    validateContextTerm(paramElement[1]);
    const value = mintParamValue(paramElement[2]);
    ret = !value ? `$${paramElement[1]}`
        : `$${paramElement[1]}:${value}`;
  } else if (paramElement[0] === ":") {
    ret = `:${mintParamValue(paramElement[1])}`;
  } else {
    throw new Error(`Invalid paramElement #${index}: expected first array entry to be "@", "$" or ":"`);
  }
  if ((ret[0] !== "$") && index) {
    const prevParam = params[index - 1];
    if ((typeof prevParam !== "string") && (prevParam[0] === "$") && !prevParam[2]) {
      return `$${ret}`;
    }
  }
  return ret;
}

function mintParamValue (value) {
  if ((value === undefined) || (value === "")) return value;
  if (typeof value === "string") return encodeURIComponent(value);
  if (value === null) throw new Error(`Invalid param-value null`);
  if (!Array.isArray(value)) throw new Error(`Invalid param-value with type ${typeof value}`);
  if (value[0] !== "@") {
    throw new Error(`Invalid param-value: expanded vpath production must begin with "@"`);
  }
  return mintVPath(...value.slice(1));
}

function validateVPath (element) {
  expandVPath(element);
  return element;
}

function validateFullVPath (element) {
  const expandedVPath = expandVPath(element);
  if (expandedVPath[0] !== "@") {
    throw new Error(`Invalid vpath: expected "@" as element type, got "${expandedVPath[0]}"`);
  }
  return element;
}

function validateVRId (element) {
  const [firstEntry, vgrid, ...verbs] = expandVPath(element);
  if (firstEntry !== "@") {
    throw new Error(`Invalid vrid: expected "@" as first entry`);
  }
  validateVGRId(vgrid);
  verbs.forEach(validateVerb);
  return element;
}

function validateVerbs (element) {
  const [firstEntry, ...verbs] = expandVPath(element);
  if (firstEntry !== "@") {
    throw new Error(`Invalid verbs: expected "@" as first entry`);
  }
  verbs.forEach(validateVerb);
  return element;
}

function validateVGRId (element) {
  const [firstEntry, formatTerm, paramValue, ...params] = expandVPath(element);
  if (firstEntry !== "$") {
    throw new Error(`Invalid vgrid: expected "$" as first entry`);
  }
  validateFormatTerm(formatTerm);
  validateParamValueText(paramValue);
  params.forEach(validateVParam);
  return element;
}

function validateFormatTerm (element) {
  return validateContextTerm(element);
}

function validateVerb (element) {
  const [verbType, ...params] = expandVPath(element);
  validateVerbType(verbType);
  params.forEach(validateVParam);
  return element;
}

function validateVerbType (str) {
  if (typeof str !== "string") throw new Error("Invalid verb-type: not a string");
  if (!str.match(/[a-zA-Z0-9\-_.~!*'()]+/)) {
    throw new Error(`Invalid verb-type: doesn't match rule${
      ""} 1*(ALPHA / DIGIT / "-" / "_" / "." / "~" / "!" / "*" / "'" / "(" / ")")`);
  }
  return str;
}

function validateVParam (element) {
  const expandedParam = (typeof element !== "string") ? element : expandVPath(element);
  const [firstEntry, contextTerm, paramValue] =
      ((expandedParam.length === 1) || (expandedParam[0] !== "$"))
          ? [":", expandedParam[0]]
          : expandedParam;
  try {
    if (contextTerm !== undefined) {
      if (typeof contextTerm !== "string") {
        throw new Error(`Invalid vparam: context-term must be undefined or a string`);
      }
      if (contextTerm !== "") validateContextTerm(contextTerm);
    }
    if (paramValue !== undefined) {
      if (typeof paramValue === "string") {
        if (paramValue[0] === "@") validateVPath(paramValue);
        else validateParamValueText(paramValue);
      } else if (Array.isArray(paramValue)) {
        validateVPath(paramValue);
      } else {
        throw new Error(`Invalid vparam:${
          ""} param-value must be undefined, string or an array containing an expanded vpath`);
      }
    }
    return element;
  } catch (error) {
    throw wrapError(error, new Error("During validateVParam()"),
        "\n\telement:", ...dumpObject(element),
        "\n\tfirstEntry:", ...dumpObject(firstEntry),
        "\n\tcontextTerm:", ...dumpObject(contextTerm),
        "\n\tparamValue:", ...dumpObject(paramValue),
    );
  }
}

function validateContextTerm (str) {
  if (typeof str !== "string") throw new Error("Invalid context-term: not a string");
  if (!str.match(/[a-zA-Z][a-zA-Z0-9\-_.]*/)) {
    throw new Error(`Invalid context-term: "${str}" doesn't match rule${
      ""} ALPHA [ 0*30unreserved-nt ( ALPHA / DIGIT ) ]`);
  }
  return str;
}

function validateContextTermNS (str) {
  if (typeof str !== "string") throw new Error("Invalid context-term-ns: not a string");
  if (!str.match(/[a-zA-Z]([a-zA-Z0-9\-_.]{0,30}[a-zA-Z0-9])?/)) {
    throw new Error(`Invalid context-term: "${str}" doesn't match rule${
      ""} ALPHA [ 0*30unreserved-nt ( ALPHA / DIGIT ) ]`);
  }
  return str;
}

function validateParamValueText (str) {
  if (typeof str !== "string") throw new Error("Invalid param-value: not a string");
  if (!str.match(/([a-zA-Z0-9\-_.~!*'()]|%[0-9a-fA-F]{2})+/)) {
    throw new Error(`invalid param-value: "${str}" doesn't match rule${
      ""} 1*("%" HEXDIG HEXDIG |${
      ""} ALPHA / DIGIT / "-" / "_" / "." / "~" / "!" / "*" / "'" / "(" / ")")`);
  }
  return str;
}

/**
 * Parse a given VPath into a nested array structure.
 *
 * This nested array has following constraints:
 * 1. All the nested entries are either arrays, non-empty strings, or
 * 1.1. If the given VPath is an array vrid with embedded non-string,
 *      non-array values then those values appear as-is.
 * 2. Concatenating the nested array strings yields the original VPath.
 *    VPath arrays with embedded values cannot be reconstructed.
 * 3. Each nested array represents some VPath element.
 *    ref("@valos/raem/VPath#section_element")
 * 3. The first and last entry of each element determines its type.
 * 3.1. An element with "@" as the first entry is a 'vpath' element.
 * 3.1.1. All other 'vpath' entries are 'verb' elements, except that:
 * 3.1.2. the second 'vpath' entry can be a 'vgrid' element.
 * 3.2. An element with "$" or ":" as the first and "@" as the last
 *      entry is a 'vgrid' element.
 * 3.3. An element with non-("@"|"$"|":") as the first and "@" as the
 *      last entry is a 'verb' element.
 * 3.3.1. All verb element entries between the first and the last are
 *        'verb-param' elements.
 * 3.4. An element with "$" or ":" as first and non-"@" as the last
 *      entry is a 'verb-param' element.
 * 3.5. An entry that follows an "$" is a 'context-term' string value.
 * 3.6. An entry that follows an ":" is either a 'vgrid-value' or
 *      'verb-value' value depending on whether the containing element
 *      is a 'vgrid' or 'verb-param' element.
 * 3.6.1. A 'vgrid-value' entry is a string.
 * 3.6.2. A 'verb-value' that is a string contains a decoded value.
 *   - all pct-encoded elements are decoded as javascript UCS-2 strings.
 * 3.6.3. A 'verb-value' that is an array is a 'vpath' element.
 *
 * @export
 * @param {*} vpath
 * @returns
 */
function expandVPath (vpath) {
  try {
    if (typeof vpath === "string") return _expandVPathFirstAndRest(vpath, undefined, 0);
    if (Array.isArray(vpath)) return _expandVPathFirstAndRest(vpath[0], vpath, 1);
    throw new Error("Invalid VPath: expected a string or an array");
  } catch (error) {
    throw wrapError(error, new Error("During expandVPath"),
        "\n\tvpath:", ...dumpObject(vpath));
  }
}

function _expandVPathFirstAndRest (first, rest, initial) {
  let ret;
  if (typeof first !== "string") {
    ret = ["@"];
    initial = 0; // eslint-disable-line no-param-reassign
  } else if (first === "@") {
    ret = [first];
  } else if (first === "$" || first === ":") {
    const expandedValue = _expandVParamValue(rest, first, initial);
    ret = [first];
    if (first === "$") ret.push(validateContextTerm(rest[initial]));
    if (expandedValue !== undefined) ret.push(expandedValue);
    return ret;
  } else {
    const parts = first.split(/(@|\$|:)/);
    if (parts.length === 1) {
      validateVerbType(first);
      ret = [first];
    } else {
      ret = _expandVPathStringParts(parts.filter(e => e));
    }
  }
  return _appendVRest(ret, rest, initial);
}

function _expandVParamValue (vparam, type, initial) {
  if (!Array.isArray(vparam)) throw new Error(`Invalid "${type}" vparam: missing parts`);
  const requiredParams = type === "$" ? 2 : 1;
  if (vparam.length - initial > requiredParams) {
    throw new Error(`Invalid "${type}" vparam: expected max ${requiredParams} parts, got ${
        vparam.length - initial}`);
  }
  const entry = vparam[initial + requiredParams - 1];
  if ((entry == null) || (typeof entry !== "object")) return entry;
  if (Array.isArray(entry)) return expandVPath(entry);
  return _appendVObject(["-"], entry);
}

function _appendVRest (target, rest, initial) {
  if (rest === undefined) return target;
  if ((rest === null) || (typeof rest !== "object")) target.push([":", rest]);
  else if (!Array.isArray(rest)) {
    _appendVObject(target, rest);
  } else {
    for (let i = initial; i !== rest.length; ++i) {
      const entry = rest[i];
      if (Array.isArray(entry)) target.push(expandVPath(entry));
      else _appendVRest(target, entry, 0);
    }
  }
  return target;
}

function _appendVObject (target, vobject) {
  for (const key of Object.keys(vobject).sort()) {
    const parts = key.split(/(@|\$|:)/);
    target.push(
        _appendVRest((parts.length === 1)
                ? [".", [":", parts[0]]]
                : _expandVPathStringParts(parts.filter(e => e)),
            vobject[key],
            0));
  }
}

function _expandVPathStringParts (vpathArray, start = 0) {
  let segmentStart = start;
  if (vpathArray[start] === "@") ++segmentStart;
  for (let i = segmentStart; i !== vpathArray.length; ++i) {
    const element = vpathArray[i];
    if (Array.isArray(element)) {
      if (segmentStart !== i) continue;
      if (vpathArray[i + 1] !== "@") {
        throw new Error(`Invalid vpath embedded element at #${i}:${
          ""} expected '@' separator at #${i + 1}`);
      }
      if (element[0] === "@") {
        throw new Error(`Invalid vpath embedded element at #${i}:${
          ""} expected embedded vgrid or verb element (got a vpath beginning with "@")`);
      }
      vpathArray.splice(i + 1, 1);
    } else if ((typeof element !== "string") || (element !== "@")) {
      continue;
    } else if (vpathArray[i - 1] === ":") { // nest deeper, this is a vpath as param-value
      vpathArray.splice(i, 0, _expandVPathStringParts(vpathArray, i));
      continue;
    } else {
      const segment = vpathArray.splice(segmentStart, i + 1 - segmentStart);
      segment.pop();
      if (segment[0] === ":") {
        throw new Error(`Invalid vpath: neither vgrid nor verb cannot begin with ':'`);
      }
      if (segment[0] === "$") { // vgrid
        if (segment[2] !== ":") {
          throw new Error(`Invalid vpath: vgrid must always have a param, expected ':'`);
        }
        segment.splice(2, 1); // drop the ":"
        if (segment.length > 3) _nestSegment(segment, 3);
      } else { // verb
        _nestSegment(segment);
      }
      vpathArray.splice(segmentStart, 0, segment);
    }
    i = ++segmentStart;
    if (i === vpathArray.length) return vpathArray;
    if ((vpathArray[i] === "@") || (vpathArray[i] === "$") || (vpathArray[i] === ":")) {
      return vpathArray.splice(start, i - start);
    }
    --i;
  }
  if (vpathArray[start] !== "@") {
    _nestSegment(vpathArray, start);
    if (vpathArray.length === 1) return vpathArray[0];
  } else if (start) {
    throw new Error(`Invalid vpath element:${
      ""} missing closing "@" (opening "@" is at non-zero location ${start})`);
  }
  return vpathArray;
}

function _nestSegment (segment, initial = 1) {
  let i = initial;
  let nested;
  try {
    for (; i !== segment.length; ++i) {
      if (segment[i] === "$") {
        if (segment[i + 2] === ":") {
          nested = segment.splice(i, 4);
          nested.splice(2, 1);
        } else if (segment[i + 1] === ":") {
          nested = segment.splice(i, 3);
          nested.shift();
        } else {
          nested = segment.splice(i, 2);
        }
      } else if (segment[i] === ":") {
        nested = segment.splice(i, 2);
      } else continue;
      const verbValue = nested[nested.length - 1];
      if (typeof verbValue === "string") {
        validateParamValueText(verbValue);
        nested[nested.length - 1] = decodeURIComponent(verbValue);
      } else if (verbValue != null) {
        if (Array.isArray(verbValue)) {
          if (verbValue[0] !== "@") {
            validateVerbType(verbValue[0]);
          }
        }
      }
      if (nested[0] === "$") {
        validateContextTerm(nested[1]);
      }
      segment.splice(i, 0, nested);
    }
  } catch (error) {
    throw wrapError(error, new Error(`While nesting segment #${i}`),
        "\n\tnested:", nested,
        "\n\tsegment:", segment);
  }
}

function bindExpandedVPath (vp, contextLookup = {}, contextState, componentType) {
  let expandedVPath = vp;
  try {
    if (!componentType || (componentType === "@")) {
      if (!Array.isArray(vp)) return vp;
    } else if (!Array.isArray(vp) || (vp[0] === "@")) {
      expandedVPath = [":", vp];
    }
    const elementType = expandedVPath[0];
    const typeBind = _typeBinders[elementType];
    if (typeBind) {
      return typeBind(expandedVPath, contextLookup, contextState, componentType || elementType);
    }
    if (elementType[0] === "!") {
      expandedVPath[0] = `§${elementType.slice(1)}`;
      return _expandRest(expandedVPath, contextLookup, contextState, "!", 1);
    }
    throw new Error(`unrecognized verb type: ${JSON.stringify(elementType)}`);
  } catch (error) {
    throw wrapError(error, new Error("During bindExpandedVPath"),
        "\n\texpandedVPath:", ...dumpObject(expandedVPath),
        "\n\tcomponentType:", ...dumpObject(componentType));
  }
}

function _expandRest (expandedVPath, contextLookup, contextState, componentType, initial) {
  for (let i = initial; i !== expandedVPath.length; ++i) {
    expandedVPath[i] = bindExpandedVPath(expandedVPath[i], contextLookup, contextState,
        componentType);
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


const _typeBinders = {
  "@": _statements,
  "": _invalidHead,
  $: _vparam,
  ":": _vparamContextLess,
  "!": _computation,
  "~": function _subspace () {
    throw new Error("subspace selector not implemented");
  },
  ...(Object.keys(_singularLookup)
      .reduce((a, p) => { a[p] = _singularProperty; return a; }, {})),
  ...(Object.keys(_pluralLookup)
      .reduce((a, p) => { a[p] = _pluralProperty; return a; }, {})),
  ".": function _property (expandedVPath, contextLookup, contextState, componentType) {
    // ref("@valos/raem/VPath#section_structured_scope_property")
    const first = bindExpandedVPath(expandedVPath[1], contextLookup, contextState,
        componentType || ".");
    if (expandedVPath.length <= 2) return first;
    expandedVPath[0] = "§->";
    expandedVPath[1] = first;
    return _expandRest(expandedVPath, contextLookup, contextState, ".", 2);
  },
  "-": _namedCollection,
  "'": _namedCollection,
  "*": _namedCollection,
};

function _invalidHead () {
  throw new Error(`Invalid expanded VPath head: ":" and "" can't appear as first entries`);
}

function _tryAsNameParam (vparam) {
  if (Array.isArray(vparam) && ((vparam[0] === "$") || (vparam[0] === ":"))
    && !vparam[1] && !vparam[2]) return null;
  return vparam;
}

function _statements (expandedVPath, contextLookup, contextState) {
  if (expandedVPath.length === 2) {
    return bindExpandedVPath(expandedVPath[1], contextLookup, contextState, expandedVPath[0]);
  }
  expandedVPath[0] = "§->";
  return _expandRest(expandedVPath, contextLookup, contextState, ".", 1);
}

function _vparamContextLess (expandedVPath, contextLookup, contextState, componentType) {
  return _vparam(["$", "", expandedVPath[1]], contextLookup, contextState,
      (componentType === "@") ? ":" : componentType);
}

function _vparam (expandedVPath, contextLookup, contextState, componentType) {
  let value = bindExpandedVPath(expandedVPath[2], contextLookup, contextState);
  let contextValue;
  const contextTerm = expandedVPath[1];
  if (contextTerm) {
    const context = contextLookup[contextTerm];
    if (!context) {
      expandedVPath[0] = "§:";
      if (value !== undefined) expandedVPath[2] = value;
      value = expandedVPath;
    } else {
      if (typeof context === "function") contextValue = context;
      if (contextValue == null) contextValue = (context.symbolFor || {})[value];
      if (contextValue == null) contextValue = (context.stepsFor || {})[value];
      if ((contextValue == null) && context.steps) {
        contextValue = [
          ...(typeof context.steps !== "function"
              ? context.steps
              : context.steps(contextState, value, contextTerm)),
          value,
        ];
      }
      if (!contextValue) {
        throw new Error(`Term operation '${value}' ${
            contextValue === false ? "disabled" : "not found"} in the non-trivial context '${
            contextTerm}'`);
      }
      if (typeof contextValue === "function") {
        contextValue = contextValue(contextState, value, contextTerm);
      }
      if (Array.isArray(contextValue)) return contextValue;
      value = contextValue;
      contextValue = null;
    }
  }
  switch (componentType) {
  case "@":
    // vgrid
    return ["§ref", value];
  case "!0": // first entry of a trivial resource valk
    return ["§$", value];
  case ".":
    return ["§..", value]; // valospace native property
  case ":":
  default: // eslint-disable-line no-fallthrough
    return value;
  }
}

function _computation (expandedVPath, contextLookup, contextState) {
  const computationType = expandedVPath[0];
  const first = bindExpandedVPath(expandedVPath[1], contextLookup, contextState, "!0", 1);
  if (expandedVPath.length === 2) return first;
  if (first[0] === "§$") {
    expandedVPath[0] = "§->";
    expandedVPath[1] = first;
    return _expandRest(expandedVPath, contextLookup, contextState, ".", 2);
  }
  expandedVPath.splice(0, 2, ...first);
  return _expandRest(expandedVPath, contextLookup, contextState, computationType, first.length);
}

function _namedCollection (expandedVPath, contextLookup, contextState) {
  const collectionType = expandedVPath[0];
  const nameParam = _tryAsNameParam(expandedVPath[1]);
  const nameSelector = (nameParam != null)
      && _pluralProperty(expandedVPath, contextLookup, contextState, collectionType);
  if (nameSelector && expandedVPath.length <= 2) return nameSelector;
  let isSequence;
  if (collectionType[0] === "*") isSequence = true;
  else if (collectionType[0] !== "-") {
    throw new Error(`Unrecognized named collection verb type ${collectionType
        } (must begin with "-" or "*")`);
  }
  if (expandedVPath.length > 2) {
    _expandRest(expandedVPath, contextLookup, contextState, isSequence ? "*" : "-", 2);
  }
  expandedVPath.splice(0, 2, isSequence ? "§[]" : "§{}");
  return !nameSelector ? expandedVPath
      : isSequence ? ["§concat", nameSelector, expandedVPath]
      : ["§append", ["§{}"], nameSelector, expandedVPath];
}

function _singularProperty (expandedVPath) {
  // ref("@valos/raem/VPath#section_structured_object_value")
  const selector = _singularLookup[expandedVPath[0]];
  if (expandedVPath.length > 1) {
    throw new Error(`multi-param '${expandedVPath[0]}' selectors not allowed`);
  }
  return selector;
}

function _pluralProperty (expandedVPath, contextLookup, contextState) {
  // ref("@valos/raem/VPath#section_structured_relation")
  const field = _pluralLookup[expandedVPath[0]];
  if (expandedVPath.length > 2) {
    throw new Error(`multi-param '${field}' selectors not allowed`);
  }
  return ["§->", false, field,
    ..._filterByFieldValue("name",
        bindExpandedVPath(expandedVPath[1], contextLookup, contextState)),
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
