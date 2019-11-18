const { dumpObject, wrapError } = require("../../tools/wrapError");
const {
  validateVerbType, validateContextTerm, validateParamValueText,
} = require("./_validateTerminalOps");

module.exports = {
  expandVPath,
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
  return _appendVObject(["-", [":"]], entry);
}

function _appendVRest (target, rest, initial) {
  if (rest === undefined) return target;
  if ((rest === null) || (typeof rest !== "object")) {
    target.push([":", rest]);
  } else if (!Array.isArray(rest)) {
    _appendVObject(target, rest);
  } else if ((initial === 0) && (typeof rest[0] === "string")) {
    target.push(expandVPath(rest));
  } else {
    for (let i = initial; i !== rest.length; ++i) {
      const entry = rest[i];
      if ((entry === null) || (typeof entry !== "object")) {
        target.push([":", entry]);
      } else if (!Array.isArray(entry)) {
        target.push(_appendVObject(["-", [":"]], entry));
      } else {
        target.push(expandVPath(entry));
      }
    }
  }
  return target;
}

function _appendVObject (target, vobject) {
  for (const key of Object.keys(vobject).sort()) {
    const parts = key.split(/(@|\$|:)/);
    target.push(_appendVRest(
        (parts.length === 1)
            ? [".", [":", parts[0]]]
            : _expandVPathStringParts(parts.filter(e => e)),
        vobject[key],
        0));
  }
  return target;
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
      let verbValue;
      if (segment[i] === "$") {
        if (segment[i + 2] === ":") {
          nested = segment.splice(i, 4);
          nested.splice(2, 1);
          verbValue = nested[2];
        } else if (segment[i + 1] === ":") {
          nested = segment.splice(i, 3);
          nested.shift();
          verbValue = nested[1];
        } else {
          nested = segment.splice(i, 2);
          if (nested.length === 1) nested[0] = ":";
        }
      } else if (segment[i] === ":") {
        nested = segment.splice(i, 2);
        verbValue = nested[1];
      } else continue;
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
