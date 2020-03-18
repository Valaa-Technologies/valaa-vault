const { formVPath, formVGRID, formVerb, formParam, formParamValue } = require("./_formOps");
const { segmentVPath, segmentVKeyPath } = require("./_segmentOps");
const {
  validateVPath, validateVKeyPath, validateFullVPath,
  validateVRID, validateVerbs, validateVGRID,
  validateFormatTerm, validateVerb, validateVerbType, validateVParam,
  validateContextTerm, validateParamValueText
} = require("./_validateOps");
const { cementVPath, extendVAKON } = require("./_cementOps");
const { coerceAsVRID } = require("./_coerceOps");

module.exports = {
  formVPath,
  formVGRID,
  formVerb,
  formParam,
  formParamValue,
  validateVPath,
  validateVKeyPath,
  validateFullVPath,
  validateVRID,
  validateVerbs,
  validateVGRID,
  validateFormatTerm,
  validateVerb,
  validateVerbType,
  validateVParam,
  validateContextTerm,
  validateParamValueText,
  segmentVPath,
  segmentVKeyPath,
  cementVPath,
  extendVAKON,
  coerceAsVRID,
};
