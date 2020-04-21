const {
  formVPath,
  conjoinVPath, conjoinVPathSection,
  disjoinVPath, disjoinVPathString, disjoinVPathOutline,
} = require("./_sectionOps");
const {
  validateVPath, validateVPathSection, validateVKeyPath,
  validateFullVPath, validateFullVPathSection,
  validateVRID, validateVRIDSection, validateVVerbs, validateVVerbsSection,
  validateVGRID, validateVGRIDSection, validateFormatTerm,
  validateVVerb, validateVVerbSection, validateVerbType,
  validateVParam, validateVParamSection, validateContextTerm, validateParamValueText
} = require("./_validateOps");
const { cementVPath, extendTrack } = require("./_cementOps");
const { coerceAsVRID } = require("./_coerceOps");

module.exports = {
  conjoinVPath,
  conjoinVPathSection,
  disjoinVPath,
  disjoinVPathOutline,
  disjoinVPathString,
  formVPath,
  validateVPath,
  validateVPathSection,
  validateVKeyPath,
  validateFullVPath,
  validateFullVPathSection,
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
  cementVPath,
  extendTrack,
  coerceAsVRID,
};
