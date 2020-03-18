const { wrapError } = require("../../tools/wrapError");
const {
  validateVPath, validateVGRID, validateVerb, validateFormatTerm, validateVerbType,
  validateContextTerm,
} = require("./_validateOps");

module.exports = {
  formVPath,
  formVGRID,
  formVerb,
  formParam,
  formParamValue,
};

function formVPath (...stepsOrVPaths) {
  return `${stepsOrVPaths.map((step, index) => _formVStep(step, index)).join("")}@@`;
}

function _formVStep (segment, index) {
  try {
    let ret;
    if (segment[0] === "@") {
      if (typeof segment === "string") ret = validateVPath(segment, index).slice(0, -2);
      else if (Array.isArray(segment)) ret = formVPath(...segment).slice(0, -2);
    } else if (segment[0] === "$") { // works both for arrays and strings
      // VGRID
      if (typeof segment === "string") ret = `@${validateVGRID(segment)}`;
      else if (Array.isArray(segment)) ret = `@${formVGRID(...segment.slice(1))}`;
    } else if (segment[0] !== "$.") {
      // verb
      if (typeof segment === "string") ret = `@${validateVerb(segment, index)}`;
      else if (Array.isArray(segment)) ret = `@${formVerb(...segment)}`;
    } else {
      throw new Error(`Invalid step #${index} while forming VPath: step cannot begin with '$.'`);
    }
    if (ret === undefined) {
      throw new Error(`Invalid step #${index} while forming VPath:${
        ""} expected string or an Array`);
    }
    if (index && (ret[1] === "$")) {
      throw new Error(`Invalid non-first step #${index} while forming VPath:${
        ""} expected verb, got VGRID instead`);
    }
    return ret;
  } catch (error) {
    throw wrapError(error, new Error(`While forming VPath step #${index}`),
        "\n\tsegment:", segment);
  }
}

function formVGRID (formatTerm, paramElement,
    ...params /* : (string | ["$", string, ?string]) */) {
  validateFormatTerm(formatTerm);
  const paramValue = formParamValue(paramElement);
  if (!paramValue) throw new Error(`Invalid VGRID: param-value missing`);
  return `$${formatTerm}${paramValue}${params.map(formParam).join("")}`;
}

function formVerb (verbType, ...params /* : (string | ["$", string, ?string])[] */) {
  validateVerbType(verbType);
  return `${verbType}${params.map(formParam).join("")}`;
}

function formParam (paramElement /* : (string | ["$", string, ?string]) */, index) {
  if ((typeof paramElement === "string") || (paramElement[0] === "@")) {
    return `$${formParamValue(paramElement)}`;
  }
  if (!Array.isArray(paramElement)) {
    throw new Error(`Invalid paramElement #${index}: expected a string or a param Array`);
  }
  if (paramElement[0] === "$") {
    validateContextTerm(paramElement[1]);
    return `$${paramElement[1]}${formParamValue(paramElement[2])}`;
  }
  if (paramElement[0] === "$.") return `$${formParamValue(paramElement[1])}`;
  throw new Error(`Invalid paramElement #${
      index}: expected first array entry to be "@", "$" or "$."`);
}

function formParamValue (value) {
  if ((value === undefined) || (value === "")) return "";
  if (typeof value === "string") return `.${encodeURIComponent(value)}`;
  if (value === null) throw new Error(`Invalid param-value: null`);
  if (!Array.isArray(value)) throw new Error(`Invalid param-value with type ${typeof value}`);
  if (value[0] !== "@") {
    throw new Error(`Invalid param-value: VPath segment must begin with "@"`);
  }
  return `.${formVPath(...value.slice(1))}`;
}
