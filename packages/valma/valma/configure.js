const { updateConfigurableSideEffects } = require("valma");

exports.command = "configure [toolsetGlob]";
exports.describe = "Configure the current ValOS workspace type, domain and all configurables";
exports.introduction =
`Configures type and domain, selects and stows toolsets, tools and
other  configurables and finally configures them.`;

exports.disabled = (yargs) => !yargs.vlm.getValOSConfig()
    && "No package.json valos stanza found (run 'vlm init')";
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all configurations of this workspace.",
  },
  "default-tags": {
    description: `Custom default package tags lookup (by package prefix) for new packages.`,
  },
  domain: {
    type: "boolean", default: true,
    description: "(re)configure all domain settings.",
  },
  type: {
    type: "boolean", default: true,
    description: "(re)configure all type settings.",
  },
  breakdown: {
    type: "boolean", description: "Show full breakdown of the init process even if successful.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  vlm.reconfigure = yargv.reconfigure;
  const { name, valos: { domain, type } = {} } = vlm.getPackageConfig();
  if (!name || !type || !domain) {
    throw new Error("vlm configure: current directory is not a valos workspace; "
        + "no package.json with valos stanza with both type and domain set"
        + "(maybe run 'vlm init' to initialize?)");
  }
  if (!vlm.getToolsetsConfig()) vlm.updateToolsetsConfig({});

  let defaultTags = yargv["default-tags"];
  if (typeof defaultTags === "string") defaultTags = { "": defaultTags };
  if (defaultTags) vlm.defaultTags = { ...(vlm.defaultTags || {}), ...defaultTags };

  const rest = [{ reconfigure: yargv.reconfigure }, ...yargv._];

  const ret = {
    success: false,
    domain: !yargv.domain ? [] : [await vlm.invoke(`.configure/.domain/${valos.domain}`, rest)],
    type: !yargv.type ? [] : [await vlm.invoke(`.configure/.type/${valos.type}`, rest)],
  };
  Object.assign(ret, await updateConfigurableSideEffects(vlm, ret.domain[0], ret.type[0]));
  if (ret.success === false) return ret;
  const selectorGlob = toSelectorGlob({ domain, type, name });
  ret.toolsetConfigures = await vlm.invoke(
      `.configure/.toolsets/${selectorGlob}${yargv.toolsetGlob || "*"}/**/*`,
      rest);
  Object.assign(ret, await updateConfigurableSideEffects(vlm, ...ret.toolsetConfigures));

  if (!yargv.toolsetGlob) {
    ret.mainConfigures = await vlm.invoke(`.configure/${selectorGlob}**/*`, rest);
    Object.assign(ret, await updateConfigurableSideEffects(vlm, ...ret.mainConfigures));
    if (ret.success === false) return ret;
  }
  return (yargv.breakdown || (ret.success === false))
      ? ret
      : { success: ret.success };
};
