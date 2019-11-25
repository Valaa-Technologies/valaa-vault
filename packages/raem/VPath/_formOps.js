const { wrapError } = require("../../tools/wrapError");
const {
  validateVGRId, validateVerb, validateFormatTerm, validateVerbType, validateContextTerm,
} = require("./_validateOps");

module.exports = {
  formVPath,
  formVGRId,
  formVerb,
  formParam,
  formParamValue,
};

function formVPath (...segments) {
  return `@${segments.map(_formVPathSegment).join("@")}@`;
}

function _formVPathSegment (segment, index) {
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
      return formVerb(...segment);
    }
    // vgrid
    if (index) {
      throw new Error(`Invalid segment #${index} while minting:${
        ""} expected verb (is not first segment), got vgrid ("$" as first segment element)`);
    }
    return formVGRId(...segment.slice(1));
  } catch (error) {
    throw wrapError(error, new Error(`While minting VPath segment #${index}`),
        "\n\tsegment:", segment);
  }
}

function formVGRId (formatTerm, paramElement,
    ...params /* : (string | ["$", string, ?string]) */) {
  validateFormatTerm(formatTerm);
  const paramValue = formParamValue(paramElement);
  if (paramValue === "$") throw new Error(`Invalid vgrid: param-value missing`);
  return `$${formatTerm}:${paramValue}${params.map(formParam).join("")}`;
}

function formVerb (verbType, ...params /* : (string | ["$", string, ?string])[] */) {
  validateVerbType(verbType);
  return `${verbType}${params.map(formParam).join("")}`;
}

function formParam (paramElement /* : (string | ["$", string, ?string]) */, index, params) {
  let ret;
  if ((typeof paramElement === "string") || (paramElement[0] === "@")) {
    return `:${formParamValue(paramElement)}`;
  }
  if (!Array.isArray(paramElement)) {
    throw new Error(`Invalid paramElement #${index}: expected a string or a param Array`);
  }
  if (paramElement[0] === "$") {
    validateContextTerm(paramElement[1]);
    return `$${paramElement[1]}:${formParamValue(paramElement[2])}`;
  }
  if (paramElement[0] === ":") return `:${formParamValue(paramElement[1])}`;
  throw new Error(`Invalid paramElement #${
      index}: expected first array entry to be "@", "$" or ":"`);
}

function formParamValue (value) {
  if ((value === undefined) || (value === "")) return "$";
  if (typeof value === "string") return encodeURIComponent(value);
  if (value === null) throw new Error(`Invalid param-value: null`);
  if (!Array.isArray(value)) throw new Error(`Invalid param-value with type ${typeof value}`);
  if (value[0] !== "@") {
    throw new Error(`Invalid param-value: expanded vpath must begin with "@"`);
  }
  return formVPath(...value.slice(1));
}
