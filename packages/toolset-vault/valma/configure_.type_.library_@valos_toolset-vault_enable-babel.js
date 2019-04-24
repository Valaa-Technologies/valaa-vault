exports.command = ".configure/.type/.library/@valos/toolset-vault/enable-babel";
exports.describe =
    "Configure a vault library workspace to be transpiled using vault babel.config.js";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "library");
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: `Reconfigure '${exports.command}' config of this workspace.`,
  },
  "enable-babel": {
    type: "boolean", description: "enable babel transpilation for this library",
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
