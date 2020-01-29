exports.vlm = { toolset: "@valos/type-vault" };
exports.command = ".configure/.type/.library/.select/@valos/type-vault/enable-babel";
exports.describe = "Select the workspace to be transpiled using vault babel.config.js";
exports.introduction =
`This toolset enables babel transpilation for a library workspace
when 'vlm assemble-packages' is executed in the surrounding vault
workspace.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "library")
    && `Workspace is not a library`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: `Reconfigure '${exports.command}' config of this workspace.`,
  },
  "enable-babel": {
    description: "Enable babel transpilation for this library",
    interactive: { type: "confirm", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
  },
});

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  if (yargv["enable-babel"]) {
    vlm.shell.ShellString(
      `// This file exists so that vlm assemble-packages triggers babel
// transpilation for this module.
// Options here are merged on top of root babel.config.js
module.exports = {};
`).to("babel.config.js");
  } else if (yargv["enable-babel"] === false) {
    vlm.shell.rm("babel.config.js");
  }
};
