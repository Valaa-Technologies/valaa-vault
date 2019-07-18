#!/usr/bin/env vlm

exports.command = "configure [toolsetGlob]";
exports.describe = "Configure the current ValOS workspace and its toolsets";
exports.introduction = `${exports.describe}.

Invokes all in-use toolset configure commands.`;

exports.disabled = (yargs) => !yargs.vlm.getValOSConfig()
    && "No package.json valos stanza found (run 'vlm init')";
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all config of this workspace.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const valos = vlm.getValOSConfig();
  if (!valos || !valos.type || !valos.domain) {
    throw new Error("valma-configure: current directory is not a valos workspace; "
        + "no package.json with valos stanza with both type and domain set"
        + "(maybe run 'vlm init' to initialize?)");
  }
  if (!vlm.getToolsetsConfig()) {
    vlm.updateToolsetsConfig({});
  }

  const rest = [{ reconfigure: yargv.reconfigure }, ...yargv._];
  await vlm.invoke(`.configure/.domain/${valos.domain}`, rest);
  await vlm.invoke(`.configure/.type/${valos.type}`, rest);
  await vlm.invoke(`.configure/.domain/.${valos.domain}/**/*`, rest);
  await vlm.invoke(`.configure/.type/.${valos.type}/**/*`, rest);
  await vlm.interact("yarn install");

  if (!yargv.toolsetGlob) {
    await vlm.invoke(`.configure/.select-toolsets`, rest);
  } else {
    await vlm.invoke(`.configure/{.domain/.${valos.domain}/,.type/.${valos.type}/,
      }.toolset/${yargv.toolsetGlob || ""}{*/**/,}*`, rest);
  }
  return {};
};
