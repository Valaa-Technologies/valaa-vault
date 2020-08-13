const { dumpObject, wrapError } = require("~/tools/wrapError");

const { disjoinVPathOutline, disjoinVPathString } = require("./_sectionOps");

const {
  validateFormatTerm, validateVerbType, validateContextTerm, validateParamValueText,
} = require("./_validateTerminalOps");

module.exports = {
  validateVPathString,
  validateVPath,
  validateVPathSection,
  validateVKeyPath,
  validateFullVPathSection,
  validateVRIDString,
  validateVRID,
  validateVRIDSection,
  validateVVerbs,
  validateVVerbsSection,
  validateVGRID,
  validateVGRIDSection,
  validateFormatTerm,
  validateVVerb,
  validateVVerbSection,
  validateVerbType,
  validateVParam,
  validateVParamSection,
  validateContextTerm,
  validateParamValueText,
};


function validateVPathString (vpath) {
  if ((typeof vpath !== "string") || (vpath[0] !== "@")) {
    throw new Error(`Invalid full vpath: must be a string beginning with "@"`);
  }
  return validateFullVPathSection(disjoinVPathString(vpath), vpath);
}

function validateVRIDString (vrid) {
  if ((typeof vrid !== "string") || (vrid[0] !== "@")) {
    throw new Error(`Invalid full vrid: must be a string beginning with "@"`);
  }
  return validateVRIDSection(disjoinVPathString(vrid), vrid);
}

function validateVPath (vpath) {
  return (typeof vpath !== "string")
      ? validateVPathSection(vpath)
      : validateVPathSection(disjoinVPathString(vpath), vpath);
}

function validateVPathSection (section, source) {
  try {
    const type = section[0];
    if (type[0] !== "@") {
      throw new Error(`Invalid vpath: section type must begin with "@", got "${type}"`);
    }
    if (type[1] === "$") validateVParamSection(section, source);
    else if (type[1] !== "@") validateVVerbSection(section, source);
    else if (type === "@@") validateFullVPathSection(section, source);
    else  throw new Error(`Invalid vpath: invalid section type "${type}"`);
    return section;
  } catch (error) {
    throw wrapError(error, new Error(`During validateVPathSection(${(section || "")[0]})`),
        "\n\tsegment:", ...dumpObject(section),
        "\n\ttemplate:", ...dumpObject(source),
    );
  }
}

function validateVPayloadEntrySection (section) {
  if (typeof section !== "string") {
    validateVPath(section);
  }
  return section;
}

function validateVKeyPath (vkey, value) {
  disjoinVPathOutline(value, vkey);
  return value;
}

function validateFullVPathSection (section, source) {
  try {
    if (section.length > 2) {
      throw new Error(`Invalid full vpath: section must be an array with at most two entries`);
    }
    const [type, vsteps] = section;
    if (type !== "@@") {
      throw new Error(`Invalid full vpath: expected "@@" as section type, got "${type}"`);
    }
    if (vsteps !== undefined) {
      if (!Array.isArray(vsteps) || (vsteps.length < 2)) {
        throw new Error(
            `Invalid full vpath: section payload must be an array with two or more entries`);
      }
      vsteps.forEach(validateVPayloadEntrySection);
    }
    return source || section;
  } catch (error) {
    throw wrapError(error, new Error(`During validateFullVPathSection(${(section || "")[0]})`),
        "\n\tsegment:", ...dumpObject(section),
        "\n\ttemplate:", ...dumpObject(source),
    );
  }
}

function validateVRID (vrid) {
  return (typeof vrid !== "string")
      ? validateVRIDSection(vrid)
      : validateVRIDSection(disjoinVPathString(vrid), vrid);
}

function validateVRIDSection (section, source) {
  try {
    if (section.length !== 2) {
      throw new Error(`Invalid vrid: section must be an array with exactly two entries`);
    }
    const [type, vsteps] = section;
    if (type !== "@@") {
      return validateVGRIDSection(section, source);
    }
    if (!Array.isArray(vsteps)) {
      throw new Error(`Invalid vrid: section vsteps must be an array`);
    }
    vsteps.forEach((e, i) => (!i
        ? validateVGRIDSection // first
        : validateVVerbSection // vrid steps must be fully qualified vverbs (unlike for vpaths).
    )(e));
    return source || section;
  } catch (error) {
    throw wrapError(error, new Error(`During validateVRIDSection(${(section || "")[0]})`),
        "\n\tsegment:", ...dumpObject(section),
        "\n\ttemplate:", ...dumpObject(source),
    );
  }
}

function validateVVerbs (verbs) {
  return (typeof verbs !== "string")
      ? validateVVerbsSection(verbs)
      : validateVVerbsSection(disjoinVPathString(verbs), verbs);
}

function validateVVerbsSection (section, source) {
  try {
    if (section.length > 2) {
      throw new Error(`Invalid vverbs: section must be an array with at most two entries`);
    }
    const [type, vsteps] = section;
    if (type !== "@@") {
      return validateVVerbSection(section, source);
    }
    if (vsteps !== undefined) {
      if ((!Array.isArray(vsteps) || !vsteps.length)) {
        throw new Error(
            `Invalid vverbs section: payload must be undefined or a non-empty steps array`);
      }
      vsteps.forEach(validateVPayloadEntrySection);
    }
    return source || section;
  } catch (error) {
    throw wrapError(error, new Error(`During validateVVerbsSection(${(section || "")[0]})`),
        "\n\tsegment:", ...dumpObject(section),
        "\n\ttemplate:", ...dumpObject(source),
    );
  }
}

function validateVGRID (vgrid) {
  return (typeof vgrid !== "string")
      ? validateVGRIDSection(vgrid)
      : validateVGRIDSection(disjoinVPathString(vgrid), vgrid);
}

function validateVGRIDSection (section, source) {
  try {
    if (section.length !== 2) {
      throw new Error(`Invalid vgrid: section must be an array with exactly two entries`);
    }
    const [type, payload] = section;
    if (type === "@") { // multiparam vgrid
      if (!Array.isArray(payload)) {
        throw new Error(`Invalid vgrid: multi-param section payload must be an array`);
      }
      payload.forEach((e, i) => (!i
          ? validateVGRIDSection
          : validateVPayloadEntrySection)(e));
    } else if (type.slice(0, 2) === "@$") {
      validateFormatTerm(type.slice(2));
    } else {
      throw new Error(`Invalid vgrid: expected "@$" as section type, got "${type}"`);
    }
    return source || section;
  } catch (error) {
    throw wrapError(error, new Error(`During validateVGRIDSection(${(section || "")[0]})`),
        "\n\tsegment:", ...dumpObject(section),
        "\n\ttemplate:", ...dumpObject(source),
    );
  }
}

function validateVVerb (verb) {
  return (typeof verb !== "string")
      ? validateVVerbSection(verb)
      : validateVVerbSection(disjoinVPathString(verb), verb);
}

function validateVVerbSection (section, source) {
  try {
    if (section.length > 2) {
      throw new Error(`Invalid vverb: section must be an array with at most two entries`);
    }
    const [verbType, vparams] = section;
    if (verbType[0] !== "@") {
      throw new Error(
          `Invalid vverb: section verb type must begin with "@", got "${verbType}"`);
    }
    validateVerbType(verbType.slice(1));
    if (vparams !== undefined) {
      if (!Array.isArray(vparams) || !vparams.length) {
        throw new Error(
          `Invalid vverb section: payload must be undefined or a non-empty vparams array`);
      }
      vparams.forEach(validateVPayloadEntrySection);
    }
    return source || section;
  } catch (error) {
    throw wrapError(error, new Error(`During validateVVerbSection(${(section || "")[0]})`),
        "\n\tsegment:", ...dumpObject(section),
        "\n\ttemplate:", ...dumpObject(source),
    );
  }
}

function validateVParam (vparam) {
  return (typeof vparam !== "string")
      ? validateVParamSection(vparam)
      : validateVParamSection(disjoinVPathString(vparam), vparam);
}

function validateVParamSection (section, source) {
  try {
    if (section.length > 2) {
      throw new Error(`Invalid vparam: section must be an array with at most two entries`);
    }
    const [contextTerm, paramValue] = section;
    if ((typeof contextTerm !== "string") || (contextTerm.slice(0, 2) !== "@$")) {
      throw new Error(`Invalid vparam: section context term must be a "@$"-prefixed string, got${
        (typeof contextTerm !== "string")
            ? ` non-string type ${typeof contextTerm}`
            : `: "${contextTerm}"`
      }"`);
    }
    if (contextTerm !== "@$") validateContextTerm(contextTerm.slice(2));
    if (paramValue !== undefined && (typeof paramValue !== "string")) {
      if (Array.isArray(paramValue)) {
        validateFullVPathSection(paramValue);
      } else {
        throw new Error(`Invalid vparam:${
          ""} param-value must be undefined, string or an array containing a section full vpath`);
      }
    }
    return source || section;
  } catch (error) {
    throw wrapError(error, new Error(`During validateVParamSection(${(section || "")[0]})`),
        "\n\tsegment:", ...dumpObject(section),
        "\n\ttemplate:", ...dumpObject(source),
    );
  }
}
