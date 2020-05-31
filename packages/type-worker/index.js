module.exports = {
  updateSpindleAsWorkerTool,
};

function updateSpindleAsWorkerTool (vlm, spindle, inUse) {
  // Add/remove the web API spindle to type-worker config
  const workerToolsetSpindles = vlm.getToolsetConfig(
      "@valos/type-worker", "commands", "perspire", "options", "spindles") || [];
  if (inUse && !workerToolsetSpindles.includes(spindle)) {
    console.log("Updating perspire options spindles:");
    vlm.updateToolsetConfig("@valos/type-worker",
        { commands: { perspire: { options: { spindles: [spindle] } } } });
    console.log("Updated perspire options spindles:",
        vlm.getToolsetConfig("@valos/type-worker", "commands", "perspire"));
  } else if (!inUse && (workerToolsetSpindles.includes(spindle))) {
    vlm.warn(`When stowing toolset ${spindle}, removing the spindle '${spindle
        }' from '@valos/type-worker' perspire spindles is not implemented yet.`,
        "Please remove the spindle manually");
    // TODO(iridian, 2019-02): Removing values using the updateToolsetConfig is not implemented yet.
  }
}
