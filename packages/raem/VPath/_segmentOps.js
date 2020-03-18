const { dumpObject, wrapError } = require("../../tools/wrapError");
const {
  validateFormatTerm, validateVerbType, validateContextTerm, validateParamValueText,
} = require("./_validateTerminalOps");

module.exports = {
  segmentVPath,
  segmentVKeyPath,
};

/**
 * Parse a given VPath into a nested array structure.
 *
 * This documentation section is OUTDATED.
 *
 * This nested array has following constraints:
 * 1. All the nested entries are either arrays, non-empty strings, or
 * 1.1. If the given VPath is an array VRID with embedded non-string,
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
function segmentVPath (vpath) {
  const actualVPath = (typeof vpath === "string") ? [vpath]
      : Array.isArray(vpath) ? vpath
      : undefined;
  try {
    if (actualVPath === undefined) {
      throw new Error("segmentVPath.vpath must be a valid string or a segment array");
    }
    return segmentVKeyPath(null, actualVPath);
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
    segments = (vkey === "@" || vkey === "$." || vkey === "$")
        ? [vkey]
        : (_segmentVPathString(vkey) || [".", ["$.", vkey]]);
    containerType = segments[0];
  }
  if (vpath === undefined) return segments;
  const vpathSegment = _segmentEntryOf(containerType, vpath);
  if ((vkey === null) && (vpathSegment[0] === "@")) return vpathSegment;
  if (vpathSegment[0] !== null) segments.push(vpathSegment);
  else segments.push(...vpathSegment.slice(1));
  return segments;
}

function _segmentEntryOf (targetType, entry) {
  try {
    const segmentedEntry
        = (entry === undefined)
            ? ["$"]
        : (entry == null) || (typeof entry !== "object")
            ? ["$.", entry]
        : Array.isArray(entry)
            ? _segmentArrayEntryOf(targetType, entry)
            : _segmentObjectEntryOf(targetType, entry);
    const ret = _simplifyAsEntryOf(targetType, segmentedEntry);
    return ret;
  } catch (error) {
    throw wrapError(error, new Error(`During _segmentEntryOf("${targetType}")`),
        "\n\tentry:", ...dumpObject(entry));
  }
}

function _segmentObjectEntryOf (targetType, objectEntry) {
  const ret = ["+", ["$"]];
  for (const [key, value] of Object.entries(objectEntry)) {
    ret.push(_simplifyAsEntryOf("+", segmentVKeyPath(key, value)));
  }
  return ret;
}

function _simplifyAsEntryOf (containerType, segment) {
  const type = segment[0];
  switch (containerType) {
  default:
    // entry of verb: wrap others verbs in vpath
    if (type === "$" || type === "$.") break;
  case "$.": // eslint-disable-line no-fallthrough
    // param value: convert into vpath or primitive value
    if (type === "$.") return segment[1];
    if (type !== "@") return ["@", segment];
    break;
  case null: // eslint-disable-line no-fallthrough
    if (type === "@") segment[0] = null;
    break;
  case "": // Top-level context: convert into vpath
  case "@": // vpath entry: convert into verb
    if (type === "@") return ["$.", segment];
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
function _segmentArrayEntryOf (containerType, arrayEntry) {
  let i, segment;
  try {
    if (arrayEntry[0] === "$.") {
      if (arrayEntry[1] === undefined) {
        throw Error(`Invalid vparam: expected a value for segment '$.', got ${arrayEntry[1]}`);
      }
      return _extendVParamWithValue(["$."], arrayEntry, 1);
    }
    if (arrayEntry[0] === "$") {
      return _extendVParamWithValue(
          (arrayEntry[1] == null || arrayEntry[1] === "")
              ? ["$"]
              : ["$", validateContextTerm(arrayEntry[1])],
          arrayEntry, 2);
    }
    i = 1;
    segment = (arrayEntry[0] === "@")
            ? ["@"]
        : ((containerType === "") || (typeof arrayEntry[0] !== "string"))
            ? (i--) && [containerType && ""]
        : _segmentVPathString(arrayEntry[0])
            || (((containerType === "@") || (containerType === null))
                ? [validateVerbType(arrayEntry[0])]
                : (i--) && [""]);
    for (; i !== arrayEntry.length; ++i) {
      const entrySegment = _segmentEntryOf(segment[0], arrayEntry[i]);
      if (entrySegment[0] !== null) segment.push(entrySegment);
      else segment.push(...entrySegment.slice(1));
    }
    if (segment[0] === "") segment[0] = "@";
    return segment;
  } catch (error) {
    throw wrapError(error,
        new Error(`During _segmentArrayEntryOf(containerType = "${containerType}")`),
        "\n\tparts:", ...dumpObject(arrayEntry),
        ...(i === undefined ? [] : [
          `\n\tarrayEntry[${i}]:`, ...dumpObject(arrayEntry[i]),
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

const _vpathClass = 2;
const _vparamClass = 3;
const _escapeClass = 4;
const _dotClass = 5;
const _restClass = 6;
const _classOf = { "": 1, "@": _vpathClass, $: _vparamClass, "%": _escapeClass, ".": _dotClass };

function _isVerbClass (classId) { return classId >= 5; }
const _className = [null, "eof", "vpath", "verb", "context term", "value"];

function _segmentVPathString (vpath) {
  const classOps = [
    null,
    _eof,
    _recurseIntoVPath,
    _recurseIntoVParam,
    _invalidEscape,
    _recurseIntoVerb,
    _recurseIntoVerb,
  ];
  let i = -1, lookaheadClass;
  const firstOp = _advance();
  const ret = classOps[lookaheadClass]();
  if (_isVerbClass(firstOp) && (ret.length === 1)) return undefined;
  if (i !== vpath.length) {
    throw new Error(`Invalid VPath: expected eof at pos ${i}, got: "${
        vpath[i]}", of vpath: "${vpath}"`);
  }
  return ret;
  function _advance () { return (lookaheadClass = (_classOf[vpath[++i] || ""]) || _restClass); }
  function _eof () { return undefined; }
  function _recurseIntoVPath () {
    const vpathSegment = ["@"];
    let openerPos = i;
    let closerFailure;
    if (_advance() === _vparamClass) {
      vpathSegment.push(_recurseIntoVGRID());
      if (lookaheadClass !== _vpathClass) closerFailure = "vgrid";
      else _advance();
    }
    for (; _isVerbClass(lookaheadClass); _advance()) {
      openerPos = i;
      vpathSegment.push(_recurseIntoVerb());
      if (lookaheadClass !== _vpathClass) { closerFailure = "vstep"; break; }
    }
    if (lookaheadClass !== _vpathClass) {
      throw new Error(`Invalid vpath char "${vpath[i]}" at pos ${
          i}: expected a closing "@" for the ${closerFailure || "vpath"} opened at ${
            openerPos} (of vpath: "${vpath}")`);
    }
    _advance();
    return vpathSegment;
  }
  function _invalidEscape () {
    throw new Error(`Invalid ${_className[lookaheadClass]} literal char "%" at pos ${
      i}: only vparam values can contain escaped characters`);
  }
  function _recurseIntoVerb () {
    const verbSegment = [validateVerbType(_extractLiteral(_dotClass))];
    while (lookaheadClass === _vparamClass) verbSegment.push(_recurseIntoVParam());
    return verbSegment;
  }
  function _recurseIntoVGRID () {
    _advance();
    const vgridSegment = ["$", validateFormatTerm(_extractLiteral(_restClass))];
    if (lookaheadClass !== _dotClass) {
      throw new Error(`Invalid vgrid char "${vpath[i]}" at pos ${
          i}: expected vgrid value separator "." (of vpath: "${vpath}")`);
    }
    vgridSegment.push((_advance() === _vpathClass)
        ? _recurseIntoVPath()
        : validateParamValueText(_extractLiteral(_escapeClass)));
    return vgridSegment;
  }
  function _recurseIntoVParam () {
    _advance();
    const vparamSegment = (lookaheadClass < _dotClass) ? ["$"]
        : (lookaheadClass === _dotClass) ? ["$."]
        : ["$", validateContextTerm(_extractLiteral(_restClass))]; // can push lookahead to dotClass
    if (lookaheadClass === _dotClass) {
      vparamSegment.push((_advance() === _vpathClass)
          ? _recurseIntoVPath()
          : validateParamValueText(_extractLiteral(_escapeClass)));
    }
    return vparamSegment;
  }
  function _extractLiteral (minimumClass) {
    const literalBegin = i;
    let hasEscapes = false;
    for (; lookaheadClass >= minimumClass; _advance()) {
      if (lookaheadClass === _escapeClass) hasEscapes = true;
    }
    if (lookaheadClass === _escapeClass) _invalidEscape();
    const literal = vpath.substring(literalBegin, i);
    // TODO(iridian, 2019-11): Could validate on the fly.
    return hasEscapes ? decodeURIComponent(literal) : literal;
  }
}
