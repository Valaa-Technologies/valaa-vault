const { formVPath, formVGRId, formVerb, formParam, formParamValue } = require("./_formOps");
const { segmentVPath, segmentVKeyPath } = require("./_segmentOps");
const {
  validateVPath, validateVKeyPath, validateFullVPath,
  validateVRId, validateVerbs, validateVGRId,
  validateFormatTerm, validateVerb, validateVerbType, validateVParam,
  validateContextTerm, validateContextTermNS, validateParamValueText
} = require("./_validateOps");
const { cementVPath, extendVAKON } = require("./_cementOps");
const { coerceAsVRId } = require("./_coerceOps");

module.exports = {
  formVPath,
  formVGRId,
  formVerb,
  formParam,
  formParamValue,
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
  segmentVPath,
  segmentVKeyPath,
  cementVPath,
  extendVAKON,
  coerceAsVRId,
};
