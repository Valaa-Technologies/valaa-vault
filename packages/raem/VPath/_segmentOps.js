const { dumpObject, wrapError } = require("../../tools/wrapError");
const {
  validateVerbType, validateContextTerm, validateParamValueText,
} = require("./_validateTerminalOps");

module.exports = {
  segmentVPath,
  segmentVKeyPath,
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
function segmentVPath (vpathStringOrArray) {
  const vpath = (typeof vpathStringOrArray === "string") ? [vpathStringOrArray]
      : Array.isArray(vpathStringOrArray) ? vpathStringOrArray
      : undefined;
  try {
    if (vpath === undefined) throw new Error("vpath must be a valid string or a segment array");
    return segmentVKeyPath(null, vpath);
  } catch (error) {
    throw wrapError(error, new Error("During segmentVPath"),
        "\n\tvpath:", ...dumpObject(vpath));
  }
}

function segmentVKeyPath (vkey, vpath) {
  let segments;
  let containerType;
  if (vkey === null) {
    segments = ["@"];
    containerType = null;
  } else {
    segments = (vkey === "@" || vkey === ":"  || vkey === "$") ? [vkey]
        : (_segmentVPathString(vkey) || [".", [":", vkey]]);
    containerType = segments[0];
  }
  if (vpath === undefined) return segments;
  const vpathSegment = _segmentEntryOf(vpath, containerType);
  if ((vkey === null) && (vpathSegment[0] === "@")) return vpathSegment;
  if (vpathSegment[0] !== null) segments.push(vpathSegment);
  else segments.push(...vpathSegment.slice(1));
  return segments;
}

function _segmentEntryOf (entry, targetType) {
  try {
    const segment
        = (entry === undefined)
            ? [":"]
        : (entry == null) || (typeof entry !== "object")
            ? [":", entry]
        : Array.isArray(entry)
            ? _segmentArrayAsEntryOf(entry, targetType)
        : Object.entries(entry).sort().reduce((target, [key, value]) => {
          target.push(_asEntryOf("-", segmentVKeyPath(key, value)));
          return target;
        }, ["-", [":"]]);
    const ret = _asEntryOf(targetType, segment);
    return ret;
  } catch (error) {
    throw wrapError(error, new Error(`During _segmentEntryOf("${targetType}")`),
        "\n\tentry:", ...dumpObject(entry));
  }
}

function _asEntryOf (containerType, segment) {
  const type = segment[0];
  switch (containerType) {
  default:
    // entry of verb: wrap others verbs in vpath
    if ((type === "$") || (type === ":")) break;
  case ":": // eslint-disable-line no-fallthrough
    // param value: convert into vpath or primitive value
    if (type === ":") return segment[1];
    if (type !== "@") return ["@", segment];
    break;
  case null: // eslint-disable-line no-fallthrough
    if (type === "@") segment[0] = null;
    break;
  case "": // Top-level context: convert into vpath
  case "@": // vpath entry: convert into verb
    if (type === "@") return [":", segment];
    if (type === null) segment[0] = "@";
    break;
  case "$": // context-term: forbidden - this must always be string
    throw new Error("Cannot use vpath as context-term");
  }
  return segment;
}

/* array can have following contexts:
 * - target[0] === "@": entry of an explicit top-level vpath.
 *   Do split-segmentation. Entries are verbs or optionally contextual params.
 * - target[0] === "": entry of an implicit array vpath.
 *   No split-segmentation. ALL entries are non-contextual params.
 * - otherwise a verb/vgrid param.
 *   Do split-segmentation. VPaths are wrapped in non-contextual params.
 */
function _segmentArrayAsEntryOf (array, containerType) {
  let i, segment;
  try {
    if (array[0] === ":") {
      return _extendVParamWithValue([":"], array, 1);
    }
    if (array[0] === "$") {
      return _extendVParamWithValue(
          (array[1] == null || array[1] === "")
              ? [":"]
              : ["$", validateContextTerm(array[1])],
          array, 2);
    }
    i = 1;
    segment = (array[0] === "@")
            ? ["@"]
        : ((containerType === "") || (typeof array[0] !== "string"))
            ? (i--) && [containerType && ""]
        : _segmentVPathString(array[0])
            || (((containerType === "@") || (containerType === null))
                ? [validateVerbType(array[0])]
                : (i--) && [""]);
    for (; i !== array.length; ++i) {
      const entrySegment = _segmentEntryOf(array[i], segment[0]);
      if (entrySegment[0] !== null) segment.push(entrySegment);
      else segment.push(...entrySegment.slice(1));
    }
    if (segment[0] === "") segment[0] = "@";
    return segment;
  } catch (error) {
    throw wrapError(error,
        new Error(`During _segmentArrayAsEntryOf(containerType = "${containerType}")`),
        "\n\tparts:", ...dumpObject(array),
        ...(i === undefined ? [] : [
          `\n\tarray[${i}]:`, ...dumpObject(array[i]),
          "\n\tsegment:", ...dumpObject(segment),
        ]),
    );
  }
}

function _extendVParamWithValue (vparam, parts, initial) {
  if (parts.length > initial + 1) {
    throw new Error(`Invalid "${parts[0]}" vparam: expected max ${initial + 1} parts, got ${
      parts.length}`);
  }
  const entry = parts[initial];
  if (entry !== undefined) {
    vparam.push(((entry == null) || (typeof entry !== "object"))
        ? entry
        : segmentVPath(entry));
  }
  return vparam;
}

const _opIdOf = { "": 1, "@": 2, $: 4, ":": 5 };
const _opName = [null, "eof", "vpath", "verb", "context term", "value"];

function _segmentVPathString (vpath) {
  const ops = [
    null,
    _eof,
    _recurseIntoVPath,
    _recurseIntoVerb,
    _recurseIntoContextVParam,
    _recurseIntoVParamValue,
  ];
  let i = -1, nextOpId;
  const firstOp = _advance();
  const ret = ops[nextOpId]();
  if ((firstOp === 3) && (ret.length === 1)) return undefined;
  if (i !== vpath.length) {
    throw new Error(`Invalid vpath: expected eof at pos ${i}, got: "${vpath[i]}"`);
  }
  return ret;
  function _advance () {
    return (nextOpId = (_opIdOf[vpath[++i] || ""]) || 3);
  }
  function _eof () { return undefined; }
  function _recurseIntoVPath () {
    const vpathSegment = ["@"];
    const opening = i;
    while (_advance() === 3 || (nextOpId === 4 && (vpathSegment.length === 1))) {
      vpathSegment.push(ops[nextOpId]());
      if (nextOpId !== 2) {
        throw new Error(`Invalid vpath at pos ${i}: expected a closing "@" (for opening "@" at ${
          opening}), got: "${vpath[i]}"`);
      }
    }
    return vpathSegment;
  }
  function _recurseIntoVerb () {
    const verbSegment = [_extractLiteral(3)];
    while (nextOpId >= 4) verbSegment.push(ops[nextOpId]());
    return verbSegment;
  }
  function _recurseIntoContextVParam () {
    _advance();
    const vparamSegment = ["$", _extractLiteral(4)];
    if (nextOpId !== 5) {
      throw new Error(`Invalid vparam at pos ${i
        }: expected ":" (context term must always be followed by value), got: "${vpath[i]}"`);
    }
    return _recurseIntoVParamValue(vparamSegment);
  }
  function _recurseIntoVParamValue (vparamSegment = [":"]) {
    let value;
    if (_advance() === 2) {
      value = _recurseIntoVPath();
    } else {
      value = _extractLiteral(5);
      if (!value) {
        if (vpath[i] !== "$") {
          throw new Error(`Invalid vparam value at pos ${i
            }: expected value character or "$" for empty string, got: "${vpath[i]}"`);
        }
        _advance();
      }
    }
    vparamSegment.push(value);
    return vparamSegment;
  }
  function _extractLiteral (literalType) {
    const literalBegin = i;
    let hasEscapes = false;
    for (; nextOpId === 3; _advance()) {
      if (vpath[i] === "%") {
        if (literalType !== 5) {
          throw new Error(`Invalid ${_opName[literalType]} literal at pos ${
            i}: "%"; only vparam values can contain escaped characters`);
        }
        hasEscapes = true;
      }
    }
    const literal = vpath.substring(literalBegin, i);
    return (literalType === 3) ? validateVerbType(literal)
        : (literalType === 4) ? validateContextTerm(literal)
        : hasEscapes ? decodeURIComponent(literal)
        : literal;
  }
}
