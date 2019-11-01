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
    if (paramElement[1]) validateContextTerm(paramElement[1]);
    const value = mintParamValue(paramElement[2]);
    ret = !paramElement[1] ? `:${value}`
        : !value ? `$${paramElement[1]}`
        : `$${paramElement[1]}:${value}`;
  } else {
    throw new Error(`Invalid paramElement #${index}: expected first array entry to be "$" or "@"`);
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
  const isVRId = (typeof element === "string") ? (element[1] === "$")
      : Array.isArray(element) ? (element[1][0] === "$")
      : undefined;
  if (isVRId === undefined) {
    throw new Error(`Invalid vpath: must be a string or Array with length > 1`);
  }
  return isVRId
      ? validateVRId(element)
      : validateVerbs(element);
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
          ? ["$", "", expandedParam[0]]
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
    throw new Error(`Invalid context-term: doesn't match rule${
      ""} ALPHA [ 0*30unreserved-nt ( ALPHA / DIGIT ) ]`);
  }
  return str;
}

function validateContextTermNS (str) {
  if (typeof str !== "string") throw new Error("Invalid context-term-ns: not a string");
  if (!str.match(/[a-zA-Z]([a-zA-Z0-9\-_.]{0,30}[a-zA-Z0-9])?/)) {
    throw new Error(`Invalid context-term: doesn't match rule${
      ""} ALPHA [ 0*30unreserved-nt ( ALPHA / DIGIT ) ]`);
  }
  return str;
}

function validateParamValueText (str) {
  if (typeof str !== "string") throw new Error("Invalid param-value: not a string");
  if (!str.match(/([a-zA-Z0-9\-_.~!*'()]|%[0-9a-fA-F]{2})+/)) {
    throw new Error(`invalid param-value: doesn't match rule${
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
  if (Array.isArray(vpath) && (vpath[0] === "@" || vpath[0] === "$" || !vpath[0].match(/[$:]/))) {
    // already an expanded vpath element.
    // Only re-expand possibly flattened sub-elements.
    return vpath.map(e => ((typeof e === "string") ? e : expandVPath(e)));
  }
  const vpathArray = [];
  (Array.isArray(vpath) ? vpath : [vpath]).forEach((part, index) => {
    if (Array.isArray(part)) {
      if (index === 0) vpathArray.push("@");
      vpathArray.push(expandVPath(part));
    } else if (!index && (typeof part === "string")
        && (part !== "") && (part !== "@") && (part !== "$") && (part !== ":")) {
      vpathArray.push(...part.split(/(@|\$|:)/).filter(e => e !== ""));
    } else {
      vpathArray.push(part);
    }
  });
  return _nestAll(vpathArray);
}

function _nestAll (vpathArray, start = 0) {
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
      vpathArray.splice(i, 0, _nestAll(vpathArray, i));
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
    _nestSegment(vpathArray);
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
          nested[1] = "";
        } else {
          nested = segment.splice(i, 2);
        }
      } else if (segment[i] === ":") {
        nested = ["$", "", segment[i + 1]];
        segment.splice(i, 2);
      } else continue;
      const verbValue = nested[2];
      if (typeof verbValue === "string") {
        validateParamValueText(verbValue);
        nested[2] = decodeURIComponent(verbValue);
      } else if (verbValue != null) {
        if (Array.isArray(verbValue)) {
          if (verbValue[0] !== "@") {
            validateVerbType(verbValue[0]);
          }
        }
      }
      if (nested[1] !== "") {
        validateContextTerm(nested[1]);
      } else {
        nested = nested[2];
      }
      segment.splice(i, 0, nested);
    }
  } catch (error) {
    throw wrapError(error, new Error(`While nesting segment #${i}`),
        "\n\tnested:", nested,
        "\n\tsegment:", segment);
  }
}


const fieldLookup = {
  "-": "unnamedOwnlings", // "entities",
  "'": "unnamedOwnlings", // "medias",
  "*": "relations",
  "*out": "relations",
  "*in": "incomingRelations",
  "*out~": "relations",
  "*in~": "incomingRelations",
};

const objectLookup = {
  ".o.": "value",
  ".o-": "owner", // "entities",
  ".o'": "content", // "medias",
  ".o*": "target",
  ".s*": "source",
  ".o*~": "target",
  ".s*~": "source",
};

/* eslint-disable complexity */

function bindExpandedVPath (vp, contextLookup = {}, contextState, containerType = "@"
    /* , containerIndex = 0 */) {
  let expandedVPath = vp;
  if (containerType === "@") {
    if (!Array.isArray(vp)) return vp;
  } else if (!Array.isArray(vp) || (vp[0] === "@")) {
    expandedVPath = ["$", "", vp];
  }
  let type = expandedVPath[0];
  let i = 1;
  switch (type) {
  case "@":
    if (expandedVPath.length === 2) {
      return bindExpandedVPath(expandedVPath[1], contextLookup, contextState, "@", 1);
    }
    expandedVPath[0] = "§->";
    break;
  case "":
  case ":":
    throw new Error(`Invalid expanded VPath head: ":" and "" can't appear as first entries`);
  case "$": { // eslint-disable-line no-fallthrough
    let value = bindExpandedVPath(expandedVPath[2], contextLookup, contextState);
    let contextValue;
    const contextTerm = expandedVPath[1];
    if (contextTerm) {
      const context = contextLookup[contextTerm];
      if (context) {
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
      } else {
        expandedVPath[0] = "§:";
        expandedVPath[2] = value;
        value = expandedVPath;
      }
    }
    switch (containerType) {
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
  case "~":
    // ref("@valos/raem/VPath#section_structured_subspace_selector")
    throw new Error("subspace selector not implemented");
  case ".":
    // ref("@valos/raem/VPath#section_structured_scope_property")
    if (expandedVPath.length <= 2) {
      return bindExpandedVPath(expandedVPath[1], contextLookup, contextState, ".", 1);
    }
    expandedVPath[0] = "§->";
    break;
  case "*":
    expandedVPath[0] = "§[]";
    break;
  case "-":
    // ref("@valos/raem/VPath#section_structured_entity")
  case "'": // eslint-disable-line no-fallthrough
    // ref("@valos/raem/VPath#section_structured_media")
  case "*in": // eslint-disable-line no-fallthrough
  case "*out": // eslint-disable-line no-fallthrough
  case "*in~": // eslint-disable-line no-fallthrough
  case "*out~": { // eslint-disable-line no-fallthrough
    // ref("@valos/raem/VPath#section_structured_relation")
    const field = fieldLookup[type];
    if (expandedVPath.length > 2) {
      throw new Error(`multi-param '${field}' selectors not allowed`);
    }
    return ["§->", field,
      ..._filterByFieldValue("name",
          bindExpandedVPath(expandedVPath[1], contextLookup, contextState, type, 1)),
    ];
  }
  case ".o.":
  case ".o-":
  case ".o'":
  case ".o*":
  case ".s*":
  case ".o*~":
  case ".s*~": {
    const object = objectLookup[type];
    // ref("@valos/raem/VPath#section_structured_object_value")
    return [
      "§->",
      ..._filterByFieldValue(object,
          bindExpandedVPath(expandedVPath[1], contextLookup, contextState)),
    ];
  }
  case "!": {
    const first = bindExpandedVPath(expandedVPath[1], contextLookup, contextState, "!0", 1);
    if (expandedVPath.length === 2) return first;
    if (first[0] === "§$") {
      expandedVPath[0] = "§->";
      expandedVPath[1] = first;
      type = ".";
      i = 2;
    } else {
      expandedVPath.splice(0, 2, ...first);
      i = first.length;
    }
    break;
  }
  default:
    if (type[0] === "!") expandedVPath[0] = `§${type.slice(1)}`;
    else throw new Error(`unrecognized verb type: ${JSON.stringify(type)}`);
    break;
  }
  for (; i !== expandedVPath.length; ++i) {
    expandedVPath[i] = bindExpandedVPath(expandedVPath[i], contextLookup, contextState, type, i);
  }
  return expandedVPath;
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
