const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-library", tool: "enable-bable" };
exports.command = ".select/.tools/.package/@valos/type-library/enable-babel";
exports.describe = "Transpile all library files using the vault babel.config.js";
exports.introduction =
`This tool enables babel transpilation for a library workspace when
'vlm assemble-packages' is executed in the surrounding vault workspace.`;

exports.disabled = (yargs) => typeToolset.checkToolSelectorDisabled(yargs.vlm, exports,
    { name: exports.vlm.toolset });

exports.builder = (yargs) => yargs.options({
  "enable-babel": {
    description: "Enable babel transpilation for this library",
    interactive: answers => ({
      type: "confirm", when: answers.reconfigure ? "always" : "if-undefined",
    }),
  },
  reconfigure: {
    alias: "r", type: "boolean",
    description: `Reconfigure '${exports.command}' config of this workspace.`,
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
