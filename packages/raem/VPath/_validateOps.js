const { dumpObject, wrapError } = require("../../tools/wrapError");
const { segmentVPath, segmentVKeyPath } = require("./_segmentOps");

const {
  validateFormatTerm, validateVerbType, validateContextTerm, validateContextTermNS,
  validateParamValueText,
} = require("./_validateTerminalOps");

module.exports = {
  validateVPath,
  validateVKeyPath,
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
};

function validateVPath (element) {
  segmentVPath(element);
  return element;
}

function validateVKeyPath (vkey, value) {
  segmentVKeyPath(vkey, value);
  return value;
}

function validateFullVPath (element) {
  const segmentedVPath = segmentVPath(element);
  if (segmentedVPath[0] !== "@") {
    throw new Error(`Invalid vpath: expected "@" as element type, got "${segmentedVPath[0]}"`);
  }
  return element;
}

function validateVRId (element) {
  const [firstEntry, vgrid, ...verbs] = segmentVPath(element);
  if (firstEntry !== "@") {
    throw new Error(`Invalid vrid: expected "@" as first entry`);
  }
  validateVGRId(vgrid);
  verbs.forEach(validateVerb);
  return element;
}

function validateVerbs (element) {
  const [firstEntry, ...verbs] = segmentVPath(element);
  if (firstEntry !== "@") {
    throw new Error(`Invalid verbs: expected "@" as first entry`);
  }
  verbs.forEach(validateVerb);
  return element;
}

function validateVGRId (element) {
  const [firstEntry, formatTerm, paramValue, ...params] = segmentVPath(element);
  if (firstEntry !== "$") {
    throw new Error(`Invalid vgrid: expected "$" as first entry`);
  }
  validateFormatTerm(formatTerm);
  validateParamValueText(paramValue);
  params.forEach(validateVParam);
  return element;
}

function validateVerb (element) {
  const [verbType, ...params] = segmentVPath(element);
  validateVerbType(verbType);
  params.forEach(validateVParam);
  return element;
}

function validateVParam (element) {
  const expandedParam = (typeof element !== "string") ? element : segmentVPath(element);
  const [firstEntry, contextTerm, paramValue] =
      ((expandedParam.length === 1) || (expandedParam[0] !== "$"))
          ? [":", expandedParam[0]]
          : expandedParam;
  try {
    if (contextTerm !== undefined) {
      if (typeof contextTerm !== "string") {
        throw new Error(`Invalid vparam: expected context-term to be undefined or a string`);
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
