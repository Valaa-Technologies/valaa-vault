const { qualifiedNamesOf } = require("~/tools/namespace");

const { dumpObject, wrapError } = require("~/tools/wrapError");
const isSymbol = require("~/tools/isSymbol").default;

const {
  validateVerbType, validateContextTerm, validateParamValueText, validateOutlineParamValueText
} = require("./_validateTerminalOps");

module.exports = {
  formVPath,
  conjoinVPath,
  conjoinVPathSection,
  disjoinVPath,
  disjoinVPathString,
  disjoinVPathOutline,
};

function formVPath (...steps) {
  const section = disjoinVPathOutline(steps.map(step => [].concat(step)), "@@");
  const ret = conjoinVPath(section);
  // console.log("formVPath(", ...steps, ") -> ", ...section, " -> ", ret);
  return ret;
}

function conjoinVPath (section) {
  const ret = conjoinVPathSection(section);
  return ret[0] !== "$" ? `${ret}@@` : `@${ret}@@`;
}

function disjoinVPath (vpath: string | Array) {
  const ret = (typeof vpath === "string")
      ? disjoinVPathString(vpath)
      : disjoinVPathOutline(vpath, "@@");
  // console.log("disjoinVPath(", ...dumpObject(vpath), ":", ...dumpObject(ret));
  return ret;
}

/**
 * Return a vpath section string.
 * A vpath section string for non-vparam sections is equal to the full
 * vpath string without the cap string "@@" at the end.
 * A vpath section string for vparam sections is the same but also
 * without the leading "@".
 */
function conjoinVPathSection (section) {
  let type = section[0];
  const payload = section[1];
  try {
    if (type[1] === "$") {
      return (payload === undefined) ? type.slice(1)
          : `${type.slice(1)}.${typeof payload === "string"
              ? encodeURIComponent(payload)
              : conjoinVPath(payload)}`;
    }
    if (type === "@@") type = "";
    if (payload === undefined) return type;
    const retParts = Array(payload.length + 1);
    retParts[0] = type;
    for (let i = 0; i !== payload.length; ++i) {
      const entry = payload[i];
      let entryString;
      if (typeof entry === "string") {
        entryString = `$.${encodeURIComponent(entry)}`;
      } else if (entry === true) {
        entryString = "$t";
      } else if (entry === false) {
        entryString = "$f";
      } else if (entry === null) {
        entryString = "$n";
      } else if ((typeof entry === "number") && Number.isInteger(entry)) {
        entryString = `$d.${String(entry)}`;
      } else if (!Array.isArray(entry)) {
        throw new Error(`Invalid vpath section payload entry: type ${typeof entry
            } not allowed ${typeof entry === "number" ? "(value is not an integer)" : ""}`);
      } else {
        const differentiator = entry[0][1];
        entryString = conjoinVPathSection(entry);
        if (differentiator !== "$") {
          retParts[i + 1] = type
                  ? `$.${entryString}@@`  // verbs and vpaths must be embedded and capped in verbs
              : differentiator === "@"
                  ? `@$.${entryString}@@` // vpaths must be prefixed, embedded and capped in vpaths
                  : entryString;          // verbs can be used as-is in vpaths
          continue;
        }
      }
      retParts[i + 1] = type
          ? entryString        // vparams can be used as-is in verbs
          : `@${entryString}`; // vparams (ie. vgrids) need to be prefixed in vpaths
    }
    return retParts.join("");
  } catch (error) {
    let actualError = error;
    if (!Array.isArray(section)) {
      actualError = new Error("Section is not an array");
    } else if ((type[1] !== "$") && (section[1] !== undefined) && !Array.isArray(section[1])) {
      actualError = new Error(
        `${type ? "vpath" : "vstep"} section payload is not undefined or an array`);
    }
    throw wrapError(actualError, new Error(`During conjoinVPathSection(${type})`),
        "\n\tsection:", ...dumpObject(section));
  }
}

function disjoinVPathOutline (value, vkey) {
  let valueSection = value, entries;
  try {
    // console.log("disjoinVPathSection in", value, vkey);
    switch (typeof value) {
    case "undefined":
      if ((vkey == null) || (vkey === "@@")) return ["@$"];
      if (vkey[0] !== "@") return ["@.", [vkey]];
      if ((vkey[1] === "$") && !vkey.includes(".")) return [vkey];
      if (vkey[1] !== "@") return disjoinVPathString(vkey, { i: -1, outlineSuffixes: [] });
      break;
    case "number":
      if (!Number.isInteger(value)) valueSection = ["@$number", JSON.stringify(value)];
    case "boolean": // eslint-disable-line no-fallthrough
    case "string":
      break;
    case "symbol":
    case "object": // eslint-disable-line no-fallthrough
      if (value === null) break;
      if (isSymbol(value)) {
        const qualifiedName = qualifiedNamesOf(value);
        if (!qualifiedName) {
          throw new Error(`Unrecognized non-namespace symbol: ${String(qualifiedName)}`);
        }
        return [`@$${qualifiedName[0]}`, qualifiedName[1]];
      }
      if (Array.isArray(value)) {
        const first = value[0];
        if ((typeof first === "string") && (first[0] === "@")) {
          entries = [];
          for (let i = 1; i !== value.length; ++i) {
            const entry = value[i];
            const entrySection = disjoinVPathOutline(entry, "@@");
            if (entrySection && (entrySection[0] === "@@") && ((entry[0] || "")[0] !== "@")) {
              entries.push(...entrySection[1]);
            } else {
              entries.push(entrySection);
            }
          }
          valueSection = _assembleSection(first, entries);
          entries = undefined;
          break;
        }
        entries = value.map(e => disjoinVPathOutline(e));
        valueSection = ["@-"];
      } else if (Object.getPrototypeOf(value) === Object.prototype) {
        const sortedKeys = Object.keys(value).sort();
        entries = sortedKeys.map(k => disjoinVPathOutline(value[k], k));
        valueSection = ["@+"];
      } else {
        throw new Error(`Cannot disjoin complex value type "${
          (value.constructor || "").name || value.name || typeof value}"`);
      }
      if (entries.length) valueSection.push(entries);
      break;
    default: // eslint-disable-line no-fallthrough
      throw new Error(`Cannot disjoin unrecognized type "${
        (value.constructor || "").name || value.name || typeof value}"`);
    }
    // console.log("disjoinVPathSection interim", value, vkey,
    //    "->", ...dumpObject(valueSection), ...dumpObject(entries));
    if (vkey == null) return valueSection;
    if (vkey[0] !== "@") return ["@.", [vkey, valueSection]];
    return _assembleSection(vkey, entries || [valueSection]);
  } catch (error) {
    throw wrapError(error, new Error(`disjoinVPathOutline(${vkey})`),
        "\n\tvalue:", ...dumpObject(value),
        "\n\tvkey:", ...dumpObject(vkey),
        "\n\tvpayload:", ...dumpObject(entries));
  }
}

function _assembleSection (vkey, entries) {
  if (vkey[1] !== "@") {
    return disjoinVPathString(vkey, { i: -1, outlineSuffixes: entries });
  }
  if (vkey.length !== 2) {
    throw new Error(`Invalid vpath vkey; "@@" mustn't be followed by chars, got: "${vkey}"`);
  }
  return !entries.length ? ["@@"] : (entries.length === 1) ? entries[0] : ["@@", entries];
}

function disjoinVPathString (vpath, stack = { i: -1 }) {
  try {
    if (typeof vpath !== "string") {
      throw new Error(`Can't section invalid vpath: expected string, got ${typeof vpath}`);
    }
    stack.vpath = vpath;
    const ret = _classOps[_advance(stack)](stack);
    if (stack.i !== vpath.length) {
      throw new Error(`Invalid VPath: expected eof at pos ${stack.i}, got: "${
          vpath[stack.i]}", of vpath: "${vpath}"`);
    }
    if (stack.outlineSuffixes && stack.outlineSuffixes.length) {
      throw new Error(`Failed to section VPath: not all outlineSuffixes were consumed`);
    }
    return ret;
  } catch (error) {
    throw wrapError(error, new Error("During disjoinVPathString"),
        "\n\tvpath:", ...dumpObject(vpath),
        "\n\tstack:", ...dumpObject(stack));
  }
}

function _advance (stack) {
  return (stack.lookahead = (_classOf[stack.vpath[++stack.i] || ""]) || _restClass);
}

const _eofClass = 1;
const _vpathClass = 2;
const _vparamClass = 3;
const _shorthandVParamClass = 4;
const _escapeClass = 5;
const _dotClass = 6;
const _vgridTypeClass = 7;
const _restClass = 8;
const _classOf = {
  "": 1,
  "@": _vpathClass,
  $: _vparamClass,
  ":": _shorthandVParamClass,
  "%": _escapeClass,
  ".": _dotClass,
  "~": _vgridTypeClass,
};

const _verbTypeMinClass = _dotClass;
const _valueMinClass = _escapeClass;
const _termMinClass = _vgridTypeClass;

// function _isVerbClass (classId) { return classId >= _vparamClass; }
const _className = [null, "eof", "vpath", "verb", "context term", "value"];

const _classOps = [
  null,
  _eof,
  _recurseIntoVPath,
  _recurseIntoVParam,
  _recurseIntoShorthandVParam,
  _invalidEscape,
  _recurseIntoVStep,
  _recurseIntoVStep,
  _recurseIntoVStep,
];

function _eof () { return undefined; }

function _recurseIntoVPath (stack) {
  const vsteps = [];
  let openerPos = stack.i;
  let closerFailure;
  _advance(stack);
  for (; stack.lookahead > _vpathClass; _advance(stack)) {
    openerPos = stack.i;
    vsteps.push(_recurseIntoVStep(stack));
    if (stack.lookahead !== _vpathClass) { closerFailure = "vstep"; break; }
  }
  if (stack.lookahead === _vpathClass) {
    _advance(stack);
  } else if ((stack.lookahead !== _eofClass) || !stack.outlineSuffixes) {
    throw new Error(`Invalid vpath char "${stack.vpath[stack.i]}" at pos ${
      stack.i}: expected a closing "@" for the ${closerFailure || "vpath"} opened at ${
      openerPos} (of vpath: "${stack.vpath}")`);
  } else if (stack.outlineSuffixes.length) {
    vsteps.push(...stack.outlineSuffixes);
    stack.outlineSuffixes = []; // apply only once
  }
  return (vsteps.length === 0) ? ["@@"]
      : (vsteps.length === 1) ? vsteps[0]
      : ["@@", vsteps];
}

function _invalidEscape (stack) {
  throw new Error(`Invalid ${_className[stack.lookahead]} literal char "%" at pos ${
    stack.i}: only vparam values can contain escaped characters`);
}

function _recurseIntoVStep (stack) {
  const stepType = (stack.lookahead === _vparamClass || stack.lookahead === _shorthandVParamClass)
      ? ""
      : _extractLiteral(stack, _verbTypeMinClass, validateVerbType);
  const vparams = [];
  while (true) { // eslint-disable-line no-constant-condition
    if (stack.lookahead === _shorthandVParamClass) vparams.push(_recurseIntoShorthandVParam(stack));
    else if (stack.lookahead === _vparamClass) vparams.push(_recurseIntoVParam(stack));
    else break;
  }
  if ((stack.lookahead === _eofClass) && stack.outlineSuffixes && stack.outlineSuffixes.length) {
    vparams.push(...stack.outlineSuffixes);
    stack.outlineSuffixes = [];
  }
  return vparams.length === 0
          ? [`@${stepType}`]
      : (!stepType && (vparams.length === 1))
          ? vparams[0]
          : [`@${stepType}`, vparams];
}

function _recurseIntoShorthandVParam (stack) {
  if (!stack.outlineSuffixes) {
    throw new Error(`Invalid vpath char ":" at pos ${
      stack.i}: only vpath outlines can contain the contextless shorthand vparam`);
  }
  if (_advance(stack) >= _valueMinClass) {
    return _extractLiteral(stack, _valueMinClass, validateOutlineParamValueText);
  }
  if (stack.lookahead === _vpathClass) {
    return _recurseIntoVPath(stack);
  }
  if ((stack.lookahead === _eofClass) && stack.outlineSuffixes.length) {
    return stack.outlineSuffixes.shift();
  }
  throw new Error(`Invalid shorthand vparam-value char "${stack.vpath[stack.i]}" at pos ${stack.i
      }: expected vvalue (of vpath: "${stack.vpath}")`);
}

function _recurseIntoVParam (stack) {
  _advance(stack);
  const segmentTypeClass = stack.lookahead;
  const segmentType = (segmentTypeClass > _dotClass)
      && `@$${_extractLiteral(stack, _termMinClass, validateContextTerm)}`;
  let value;
  const shouldHaveValue = (stack.lookahead === _dotClass);
  if (shouldHaveValue) {
    _advance(stack);
    if (stack.lookahead === _vpathClass) {
      value = _recurseIntoVPath(stack);
    } else if (stack.lookahead >= _valueMinClass) {
      value = _extractLiteral(stack, _valueMinClass, validateParamValueText);
    }
  }
  if (value === undefined) {
    if ((stack.lookahead === _eofClass) && stack.outlineSuffixes && stack.outlineSuffixes.length) {
      value = stack.outlineSuffixes.shift();
    } else if (shouldHaveValue || (segmentTypeClass === _vgridTypeClass)) {
      throw new Error(`Invalid ${segmentTypeClass === _vgridTypeClass ? "vgrid" : "vparam-value"
        } char "${stack.vpath[stack.i]}" at pos ${stack.i
        }: expected vvalue (of vpath: "${stack.vpath}")`);
    } else {
      return !segmentType ? ["@$"] // undefined
          : segmentType === "@$t" ? true
          : segmentType === "@$f" ? false
          : segmentType === "@$n" ? null
          : [segmentType];
    }
  }
  if (!segmentType) return value;
  if (segmentType === "@$d" && value.match(/^-?([1-9][0-9]*|0)$/)) {
    const maybeSafe = Number.parseInt(value, 10);
    if ((maybeSafe >= Number.MIN_SAFE_INTEGER) && (maybeSafe <= Number.MAX_SAFE_INTEGER)) {
      return maybeSafe;
    }
  }
  return [segmentType, value];
}

function _extractLiteral (stack, minimumClass, stringValidator) {
  const literalBegin = stack.i;
  let hasEscapes = false;
  for (; stack.lookahead >= minimumClass; _advance(stack)) {
    if (stack.lookahead === _escapeClass) hasEscapes = true;
  }
  if (stack.lookahead === _escapeClass) _invalidEscape(stack);
  const literal = stringValidator(stack.vpath.substring(literalBegin, stack.i));
  // TODO(iridian, 2019-11): Could validate on the fly.
  return hasEscapes ? decodeURIComponent(literal) : literal;
}
