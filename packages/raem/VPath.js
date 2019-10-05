// @flow

export function mintFullVrid (...segments) {
  const first = segments[0];
  if (first[0] !== "$") {
    return `@${segments.map(s => mintVerb(...s)).join("")}`;
  }
  validateContextTerm(first[1]);
  validateVerbValue(first[3]);
  return `@${first.join("")}${segments.slice(1).map(s => mintVerb(...s)).join("")}`;
}

export function mintVerb (type, ...params: (string | [string, string])[]) {
  validateVerbTypeTerm(type);
  return `${type}${params.map(mintParam).join()}`;
}

export function mintParam (paramElement: ["$" | ":", string, ?":", ?string],
    index = "(standalone)") {
  validateVerbParamElement(paramElement);
  const value = paramElement[paramElement.length - 1];
  return `${paramElement.slice(0, paramElement.length - 1).join("")}${
    Array.isArray(value) ? mintFullVrid(value) : encodeURIComponent(value)}`;
}

export function validateVerbsVrid (verbs) {
  const vpathArray = expandVPath(verbs);
  if (vpathArray[0] !== "@") {
    throw new Error(`Invalid non-vgrid vpath: expected "@" as first entry`);
  }
  validateVerb(vpathArray[1], 0);
}

export function validateVerb (verb, index) {
  const verbElement = expandVPath(verb);
  const verbType = verbElement[0];
  if (typeof verbType !== "string" || verbType === "@" || verbType === "$" || verbType === ":") {
    throw new Error(`Invalid verb-type: expected non-("@"|"$"|":") string`);
  }
  const [, type, body] = verb.match(/([^$:])+\$[^$]*\$([^$])+/) || [];
  if (type && body) return;
  throw new Error(`Invalid verb${index === undefined ? "" : ` at #${index}`}: '${verb}'`);
}

export function validateVerbParamElement (element: any[]) {
  if (!Array.isArray(element)) throw new Error(`Invalid verb-param: expected an array`);
  if (element[0] === "$") {
    if (element.length !== 4) {
      throw new Error(`Invalid verb-param: expected length 4 with leading "$", got length ${
        element.length}`);
    }
    validateContextTerm(element[1]);
  } else if (element[0] !== ":") {
    throw new Error(`Invalid verb-param: expected leading ":" or "$", got ${element[0]}`);
  } else if (element.length !== 2) {
    throw new Error(`Invalid verb-param: expected length 2 with leading ":", got length ${
      element.length}`);
  }
  const value = element[element.length - 1];
  if (typeof value === "string") validateVerbValue();
  else validateFullVridElement(value);
}

export function validateContextTerm (str) {
  if (typeof str !== "string") throw new Error("Invalid context-term: not a string");
  if (!str.match(/[a-zA-Z]([a-zA-Z0-9\-_.]{0,30}[a-zA-Z0-9])?/)) {
    throw new Error(`Invalid context-term: doesn't match rule${
      ""} ALPHA [ 0*30unreserved-nt ( ALPHA / DIGIT ) ]`);
  }
}

export function validateVerbTypeTerm (str) {
  if (typeof str !== "string") throw new Error("Invalid verb-type: not a string");
  if (!str.match(/[a-zA-Z0-9\-_.~!*'()]+/)) {
    throw new Error(`invalid verb-type: doesn't match rule${
      ""} 1*(ALPHA / DIGIT / "-" / "_" / "." / "~" / "!" / "*" / "'" / "(" / ")")`);
  }
}

export function validateVerbValue (str) {
  if (typeof str !== "string") throw new Error("Invalid verb-value: not a string");
  if (!str.match(/([a-zA-Z0-9\-_.~!*'()]|%[0-9a-fA-F]{2})+/)) {
    throw new Error(`invalid verb-value: doesn't match rule${
      ""} 1*("%" HEXDIG HEXDIG |${
      ""} ALPHA / DIGIT / "-" / "_" / "." / "~" / "!" / "*" / "'" / "(" / ")")`);
  }
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
export function expandVPath (vpath) {
  const vpathArray = [];
  for (const part of Array.isArray(vpath) ? vpath : [vpath]) {
    if (Array.isArray(part)) {
      vpathArray.push(expandVPath(part));
    } else if (typeof part === "string"
        && (part !== "") && (part !== "@") && (part !== "$") && (part !== ":")) {
      vpathArray.push(...part.split(/(@|\$|:)/).filter(e => e !== ""));
    } else {
      vpathArray.push(part);
    }
  }
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
        segment.splice(2, 1); // drop the ":"
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
  for (let i = initial; i !== segment.length; ++i) {
    let nested;
    if (segment[i] === "$") {
      if (segment[i + 2] !== ":") {
        nested = segment.splice(i, 2);
      } else {
        nested = segment.splice(i, 4);
        nested.splice(2, 1);
      }
      validateContextTerm(nested[1]);
    } else if (segment[i] === ":") {
      nested = ["$", "", segment[i + 1]];
      segment.splice(i, 2);
    } else continue;
    const verbValue = nested[2];
    if (typeof verbValue === "string") {
      validateVerbValue(verbValue);
      nested[2] = decodeURIComponent(verbValue);
    } else if (verbValue != null && (!Array.isArray(verbValue) || (verbValue[0] !== "@"))) {
      throw new Error(`Invalid embedded verb-param:${
        ""} must be a vpath element array (ie. must have "@" as first entry)`);
    }
    segment.splice(i, 0, nested);
  }
}
