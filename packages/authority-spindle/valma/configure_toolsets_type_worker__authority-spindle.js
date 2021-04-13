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
      interactive: () => {
        const { address, port } = vlm.getToolsetConfig("@valos/web-spindle");
        const project = vlm.getPackageConfig("name").match(/([^/-]+)(-worker)?$/)[1];
        return {
          when: "if-undefined",
          default: `valosp://${address}${port === 443 ? "" : `:${port}`}/${project}/`,
          confirm: candidateAuthorityURI => {
            if (!candidateAuthorityURI) return true;
            const matcher = "^valosp\\:\\/\\/.*/$";
            if (candidateAuthorityURI.match(new RegExp(matcher))) return true;
            vlm.warn(vlm.theme.bold(`Invalid authority valosp URI <${candidateAuthorityURI}>`),
                `: does not match regex "${matcher}"`);
            return false;
          },
        };
      },
    },
    description: {
      type: "string", default: (toolsetConfig || {}).description,
      description: "Short description for the public authority config",
      interactive: answers => ({
        type: "input", when: answers.reconfigure ? "always" : "if-undefined",
        default: vlm.getPackageConfig("description"),
      }),
    },
    ...typeToolset.createConfigureToolsetOptions(yargs.vlm, exports),
  });
};

exports.handler = async (yargv) => {
  const { encodeVPlotValue } = require("@valos/sourcerer/tools/event-version-0.3");
  const vlm = yargv.vlm;
  // const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset) || {};
  const authorityURI = yargv["authority-uri"];
  const toolsetConfigUpdate = {
    authorityURI,
    description: yargv.description,
    configDiscoveryRouteURL: `/~aur!${encodeVPlotValue(authorityURI)}/.authorityConfig/`,
  };
  // Construct a toolset config update or exit.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);

  vlm.updateFileConfig("revelation_web-spindle.json", ["prefixes", authorityURI],
      { "!!!": "./revelation_web-prefix_authority" });

  await require("@valos/type-worker")
      .updateSpindleAsWorkerTool(vlm, vlm.toolset, true);

  const selectionResult = await typeToolset.configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return { success: true, ...selectionResult };
};
