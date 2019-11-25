const { dumpObject, wrapError } = require("../../tools/wrapError");
const {
  validateVerbType, validateContextTerm, validateParamValueText,
} = require("./_validateTerminalOps");

module.exports = {
  expandVPath,
  expandVKeyPath,
};

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
function expandVPath (vpathStringOrArray) {
  const vpath = (typeof vpathStringOrArray === "string") ? [vpathStringOrArray]
      : Array.isArray(vpathStringOrArray) ? vpathStringOrArray
      : undefined;
  try {
    if (vpath === undefined) throw new Error("vpath must be a valid string or an expandable array");
    return expandVKeyPath(null, vpath);
  } catch (error) {
    throw wrapError(error, new Error("During expandVPath"),
        "\n\tvpath:", ...dumpObject(vpath));
  }
}

function expandVKeyPath (vkey, vpath) {
  let expansion;
  let containerType;
  if (vkey === null) {
    expansion = ["@"];
    containerType = null;
  } else {
    const keyParts = vkey.split(/(@|\$|:)/);
    expansion = (keyParts.length === 1)
            ? [".", [":", keyParts[0]]]
        : keyParts.length === 3
            ? [keyParts[1]]
        : _expandVPathStringParts(keyParts.filter(e => e));
    containerType = expansion[0];
  }
  if (vpath === undefined) return expansion;
  const pathExpansion = _expandEntryOf(containerType, vpath);
  if ((vkey === null) && (pathExpansion[0] === "@")) return pathExpansion;
  if (pathExpansion[0] !== null) expansion.push(pathExpansion);
  else expansion.push(...pathExpansion.slice(1));
  return expansion;
}

function _expandEntryOf (targetType, entry) {
  try {
    const expansion
        = (entry === undefined)
            ? [":"]
        : (entry == null) || (typeof entry !== "object")
            ? [":", entry]
        : Array.isArray(entry)
            ? _expandArrayOf(targetType, entry)
        : Object.entries(entry).sort().reduce((target, [key, value]) => {
          target.push(_asEntryOf("-", expandVKeyPath(key, value)));
          return target;
        }, ["-", [":"]]);
    const ret = _asEntryOf(targetType, expansion);
    return ret;
  } catch (error) {
    throw wrapError(error, new Error(`During _expandEntryOf("${targetType}")`),
        "\n\tentry:", ...dumpObject(entry));
  }
}

function _asEntryOf (containerType, expanded) {
  const type = expanded[0];
  switch (containerType) {
  default:
    // entry of verb: wrap others verbs in vpath
    if ((type === "$") || (type === ":")) break;
  case ":": // eslint-disable-line no-fallthrough
    // param value: convert into vpath or primitive value
    if (type === ":") return expanded[1];
    if (type !== "@") return ["@", expanded];
    break;
  case null: // eslint-disable-line no-fallthrough
    if (type === "@") expanded[0] = null;
    break;
  case "": // Top-level context: convert into vpath
  case "@": // vpath entry: convert into verb
    if (type === "@") return [":", expanded];
    if (type === null) expanded[0] = "@";
    break;
  case "$": // context-term: forbidden - this must always be string
    throw new Error("Cannot use vpath as context-term");
  }
  return expanded;
}

/* expandArray can have following contexts:
 * - target[0] === "@": entry of an explicit top-level vpath.
 *   Split-expansion. Entries are verbs or optionally contextual params.
 * - target[0] === "": entry of an implicit array vpath.
 *   No split-expansion. ALL entries are non-contextual params.
 * - otherwise a verb/vgrid param.
 *   Split-expansion. VPaths are wrapped in non-contextual params.
 */
function _expandArrayOf (containerType, parts) {
  let i, expandedArray;
  try {
    if (parts[0] === ":") {
      return _expandVParamWithValue([":"], parts, 1);
    }
    if (parts[0] === "$") {
      return _expandVParamWithValue(
          (parts[1] == null || parts[1] === "")
              ? [":"]
              : ["$", validateContextTerm(parts[1])],
          parts, 2);
    }
    i = 1;
    if (parts[0] === "@") {
      expandedArray = ["@"];
    } else if ((containerType === "") || (typeof parts[0] !== "string")) {
      expandedArray = [containerType && ""];
      --i;
    } else {
      const maybeSplitParts = parts[0].split(/(@|\$|:)/).filter(e => e);
      expandedArray =
          (maybeSplitParts.length > 1)
              ? _expandVPathStringParts(maybeSplitParts)
          : ((containerType === "@") || (containerType === null))
              ? [validateVerbType(maybeSplitParts[0])]
          : ((i--) && [""]);
    }
    for (; i !== parts.length; ++i) {
      const expandedPart = _expandEntryOf(expandedArray[0], parts[i]);
      if (expandedPart[0] !== null) expandedArray.push(expandedPart);
      else expandedArray.push(...expandedPart.slice(1));
    }
    if (expandedArray[0] === "") expandedArray[0] = "@";
    return expandedArray;
  } catch (error) {
    throw wrapError(error, new Error(`During _expandArrayOf(targetType = "${containerType}")`),
        "\n\tparts:", ...dumpObject(parts),
        ...(i === undefined ? [] : [
          `\n\tpart[${i}]:`, ...dumpObject(parts[i]),
          "\n\texpandedArray:", ...dumpObject(expandedArray),
        ]),
    );
  }
}

function _expandVParamWithValue (vparam, parts, initial) {
  if (parts.length > initial + 1) {
    throw new Error(`Invalid "${parts[0]}" vparam: expected max ${initial + 1} parts, got ${
      parts.length}`);
  }
  const entry = parts[initial];
  if (entry !== undefined) {
    vparam.push(((entry == null) || (typeof entry !== "object"))
        ? entry
        : expandVPath(entry));
  }
  return vparam;
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
      let paramValue;
      if (segment[i] === "$") {
        validateContextTerm(segment[i + 1]);
        if (segment[i + 2] !== ":") {
          throw new Error(`vparam context-term must be followed by ":"`);
        }
        nested = segment.splice(i, 4);
        paramValue = nested[3];
        nested.splice(2, 1);
      } else if (segment[i] === ":") {
        nested = segment.splice(i, 2);
        paramValue = nested[1];
      } else continue;
      if (paramValue === undefined) throw new Error("Missing vparam vparam-value");
      if (paramValue === "$") {
        nested.pop();
      } else if (typeof paramValue === "string") {
        validateParamValueText(paramValue);
        nested[nested.length - 1] = decodeURIComponent(paramValue);
      } else if (paramValue != null) {
        if (Array.isArray(paramValue)) {
          if (paramValue[0] !== "@") {
            validateVerbType(paramValue[0]);
          }
        }
      }
      segment.splice(i, 0, nested);
    }
  } catch (error) {
    throw wrapError(error, new Error(`While nesting segment #${i}`),
        "\n\tnested:", nested,
        "\n\tsegment:", segment);
  }
}
