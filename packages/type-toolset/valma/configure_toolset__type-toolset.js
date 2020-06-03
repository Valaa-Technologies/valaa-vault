const { listMatchingConfigurableChoices, inquireConfigurableName } = require("valma");
const {
  createConfigureToolsetOptions, configureToolSelection,
  createConfigureToolsetCommand, createSelectToolsetCommand, createStatusToolsetCommand,
} = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-toolset" };
exports.command = ".configure/.toolset/@valos/type-toolset";
exports.brief = "configure toolset";
exports.describe = "Configure the toolset 'type-toolset' within the current workspace";
exports.introduction = `${exports.describe}.

As a toolset this script is automatically called by configure.`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && `Toolset '${yargs.vlm.toolset}' not in use`;

exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  const workspaceName = vlm.getPackageConfig("name");
  return yargs.options({
    ...createConfigureToolsetOptions(yargs.vlm, exports),
    restrict: {
      type: "string",
      description: `Restrict toolset '${workspaceName
          }' availability to a particular valos type (clear for no restriction):`,
      interactive: async () => ({
        type: "list", when: vlm.reconfigure ? "always" : "if-undefined", pageSize: 10,
        choices: [].concat(
            {
              name: "<none>", value: undefined,
              description: `<make '${workspaceName}' selectable by all workspaces>`,
            },
            await listMatchingConfigurableChoices(vlm, "type"),
            {
              name: "<custom type>", value: "<custom type>",
              description: "<enter a custom type restriction>",
            }),
        confirm: (...rest) =>
            inquireConfigurableName(vlm, "type", "custom type restriction", ...rest),
      }),
    },
    selectable: {
      type: "any", default: true,
      description: `Make toolset ${workspaceName}' selectable and stowable (falsy for always-on):`,
      interactive: { type: "confirm", when: vlm.reconfigure ? "always" : "if-undefined" },
    },
    brief: {
      type: "string",
      description: "A brief two-three word description of this toolset",
    },
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;

  // const toolsetConfig = vlm.getToolsetConfig(vlm.toolset) || {};
  const toolsetConfigUpdate = {}; // Construct a toolset config update or bail out.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const selectionResult = await configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);

  const fullName = vlm.packageConfig.name;
  const simpleName = fullName.match(/([^/]*)$/)[1];
  const restrict = ((yargv.restrict !== "<none>") && yargv.restrict) || "";
  const restrictToTypeGlob = restrict ? `.type/.${restrict}/` : "";
  await createConfigureToolsetCommand(vlm, fullName, simpleName, yargv.brief);
  if (yargv.selectable) {
    await createSelectToolsetCommand(vlm, fullName, simpleName,
        vlm.packageConfig.valos.domain, restrict, restrictToTypeGlob);
  }
  if (await vlm.inquireConfirm("Create toolset status sub-command skeleton?")) {
    await createStatusToolsetCommand(vlm, fullName,
        `${restrict ? `${restrict}_` : ""}_toolset__${simpleName}`,
        `${restrictToTypeGlob}40-toolsets/`);
  }
  if ((restrict === "opspace") && await vlm.inquireConfirm(
      "Create opspace toolset (build|deploy)-release sub-command skeletons?")) {
    // TODO(iridian, 2020-05): There are some dependency issues here.
    // In principle type-toolset should not know about type-opspace as
    // opspaces build on top of toolset functionality.
    const { createReleaseToolsetCommand } = require("@valos/type-opspace");
    await createReleaseToolsetCommand(vlm, fullName, simpleName, "build");
    await createReleaseToolsetCommand(vlm, fullName, simpleName, "deploy");
  }
  return { success: true, ...selectionResult };
};
