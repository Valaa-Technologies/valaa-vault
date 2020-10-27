const {
  formVPlot,
  conjoinVPlot, conjoinVPlotSection,
  disjoinVPlot, disjoinVPlotString, disjoinVPlotOutline,
} = require("./_sectionOps");
const {
  validateVPlot, validateVPlotSection, validateVKeyPath,
  validateVPlotString, validateFullVPlotSection,
  validateVRIDString, validateVRID, validateVRIDSection, validateVVerbs, validateVVerbsSection,
  validateVGRID, validateVGRIDSection, validateFormatTerm,
  validateVVerb, validateVVerbSection, validateVerbType,
  validateVParam, validateVParamSection, validateContextTerm, validateParamValueText
} = require("./_validateOps");
const { cementVPlot, extendTrack } = require("./_cementOps");
const { coerceAsVRID } = require("./_coerceOps");

module.exports = {
  conjoinVPlot,
  conjoinVPlotSection,
  disjoinVPlot,
  disjoinVPlotOutline,
  disjoinVPlotString,
  formVPlot,
  validateVPlotString,
  validateVPlot,
  validateVPlotSection,
  validateVKeyPath,
  validateFullVPlotSection,
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
  cementVPlot,
  extendTrack,
  coerceAsVRID,
};
