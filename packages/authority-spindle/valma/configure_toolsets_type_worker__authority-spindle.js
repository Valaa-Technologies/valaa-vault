const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/authority-spindle" };
exports.command = ".configure/.toolsets/.type/worker/@valos/authority-spindle";
exports.brief = "configure toolset";
exports.describe = "Configure the toolset '@valos/authority-spindle' within the current workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => typeToolset.checkToolsetDisabled(yargs.vlm, exports);
exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset) || {};
  return yargs.options({
    "authority-uri": {
      type: "string", default: (toolsetConfig || {}).authorityURI,
      description: "The authority valosp URI.",
      interactive: {
        when: "if-undefined",
        confirm: candidateAuthorityURI => {
          if (!candidateAuthorityURI) return true;
          const matcher = "^valosp\\:\\/\\/.*/$";
          if (candidateAuthorityURI.match(new RegExp(matcher))) return true;
          vlm.warn(vlm.theme.bold(`Invalid authority valosp URI <${candidateAuthorityURI}>`),
              `: does not match regex "${matcher}"`);
          return false;
        },
      },
    },
    ...typeToolset.createConfigureToolsetOptions(yargs.vlm, exports),
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset) || {};
  const toolsetConfigUpdate = {
    ...toolsetConfig,
    authorityURI: yargv["authority-uri"],
  };
  // Construct a toolset config update or exit.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const selectionResult = await typeToolset.configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return { success: true, ...selectionResult };
};
