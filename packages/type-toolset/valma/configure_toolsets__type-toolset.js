const { createChooseMatchingOption } = require("valma");
const {
  checkToolsetDisabled, createConfigureToolsetOptions, configureToolSelection,
  draftConfigureToolsetCommand, draftSelectToolsetCommand, draftStatusToolsetCommand,
} = require("@valos/type-toolset");

let typeOpspace;

exports.vlm = { toolset: "@valos/type-toolset" };
exports.command = ".configure/.toolsets/@valos/type-toolset";
exports.brief = "configure toolset";
exports.describe = "Configure the toolset 'type-toolset' within the current workspace";
exports.introduction = `${exports.describe}.

As a toolset this script is automatically called by configure.`;

exports.disabled = (yargs) => checkToolsetDisabled(yargs.vlm, exports);

exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  const name = vlm.getPackageConfig("name");
  if (!typeOpspace) {
    try {
      typeOpspace = require("@valos/type-opspace");
    } catch (error) { /* */ }
  }
  return yargs.options({
    "restrict-domain": createChooseMatchingOption(vlm, ".select/.domain", vlm.getPackageConfig(), {
      choiceBrief: `toolset valos.domain restriction`,
      enableDisabled: true,
      prependChoices: [
        {
          name: "<none>", value: undefined,
          description: `<allow be '${name}' selectable by workspaces of all domains>`,
          confirm: false,
        },
        {
          name: "<custom glob>", value: "<custom glob>",
          description: "<enter a custom glob domain restriction>",
        },
      ],
      allowGlob: true,
    }),
    "restrict-type": createChooseMatchingOption(vlm, ".select/.type", vlm.getPackageConfig(), {
      choiceBrief: `toolset valos.type restriction`,
      enableDisabled: true,
      prependChoices: [
        {
          name: "<none>", value: undefined,
          description: `<allow be '${name}' selectable by all workspace types>`,
          confirm: false,
        },
        {
          name: "<custom glob>", value: "<custom glob>",
          description: "<enter a custom glob type restriction>",
        },
      ],
      allowGlob: true,
    }),
    brief: {
      type: "string",
      description: "A brief two-three word description of this toolset",
    },
    describe: {
      type: "string", description: "Describe the toolset with a single line for selectors",
      interactive: answers => ({
        type: "input",
        when: answers.reconfigure ? "always" : "if-undefined",
        default: vlm.getPackageConfig("description"),
      }),
    },
    selectable: {
      type: "any",
      description: `Make toolset '${name}' selectable and stowable (falsy for always-on)`,
      interactive: answers => ({
        type: "confirm",
        when: answers.reconfigure ? "always" : "if-undefined",
        default: true,
      }),
    },
    configurable: {
      type: "any",
      description: `Draft the configure command template for the toolset '${name}'`,
      interactive: answers => ({
        type: "confirm",
        when: answers.reconfigure ? "always" : "if-undefined",
        default: true,
      }),
    },
    statusable: {
      type: "any",
      description: `Draft the status sub-command template for the toolset '${name}'`,
      interactive: answers => ({
        type: "confirm", when: answers.reconfigure ? "always" : "if-undefined",
        default: false,
      }),
    },
    releasable: {
      type: "any",
      description: `Draft the (build|deploy)-release sub-command skeletons for the toolset '${name
          }'\n\t--restrict-type should be 'opspace' and @valos/type-opspace is required${
              typeOpspace ? ` (found)` : ` (not found in current workspace)`}`,
      interactive: answers => ({
        type: "confirm",
        when: answers.reconfigure ? "always" : "if-undefined",
        default: (answers["restrict-type"] === "opspace"),
        confirm: value => {
          if (!value || typeOpspace) return true;
          this.warn(`Cannot find required toolset package ${
              vlm.theme.package("@valos/type-opspace")} in the current workspace context`);
          return false;
        },
      }),
    },
    ...createConfigureToolsetOptions(yargs.vlm, exports),
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;

  const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset) || {};
  const toolsetConfigUpdate = { ...toolsetConfig };
  // Construct a toolset config update or bail out.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const ret = {
    tools: await configureToolSelection(vlm, vlm.toolset, yargv.reconfigure, yargv.tools),
  };
  if (!(ret.tools || {}).success) return { ...ret, success: false };

  const toolsetName = vlm.getPackageConfig("name");
  const restriction = { type: yargv["restrict-type"], domain: yargv["restrict-domain"] };
  if (yargv.selectable) {
    await draftSelectToolsetCommand(vlm, toolsetName, restriction, { describe: yargv.describe });
  }
  if (yargv.configurable) {
    await draftConfigureToolsetCommand(vlm, toolsetName, restriction);
  }
  if (yargv.statusable) {
    await draftStatusToolsetCommand(vlm, toolsetName, restriction);
  }
  if (yargv.releasable) {
    // TODO(iridian, 2020-05): There are some dependency issues here.
    // In principle type-toolset should not know about type-opspace as
    // opspaces build on top of toolset functionality.
    if (!typeOpspace) {
      throw new Error(`--releasable requested but can't find toolset package @valos/type-opspace${
        ""} in current workspace context`);
    }
    const { draftBuildToolsetCommand, draftDeployToolsetCommand } = typeOpspace;
    await draftBuildToolsetCommand(vlm, toolsetName, restriction);
    await draftDeployToolsetCommand(vlm, toolsetName, restriction);
  }
  return ret;
};
