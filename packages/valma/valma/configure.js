#!/usr/bin/env vlm

exports.command = "configure [toolsetGlob]";
exports.describe = "Configure the current valaa repository and its toolsets";
exports.introduction = `${exports.describe}.

Invokes all the in-use toolset configure commands.`;

exports.disabled = (yargs) => !yargs.vlm.getPackageConfig("valaa");
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all configurations.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const valaa = vlm.getPackageConfig("valaa");
  if (!valaa || !valaa.type || !valaa.domain) {
    throw new Error("valma-configure: current directory is not a valaa repository; "
        + "no package.json with valaa stanza with both type and domain set"
        + "(maybe run 'vlm init' to initialize?)");
  }
  if (!vlm.getToolsetsConfig()) {
    vlm.updateToolsetsConfig({});
  }

  const rest = [{ reconfigure: yargv.reconfigure }, ...yargv._];

  if (!yargv.toolsetGlob) {
    await vlm.invoke(`.configure/.domain/${valaa.domain}`, rest);
    await vlm.invoke(`.configure/.type/${valaa.type}`, rest);
    await vlm.interact("yarn install");
    await vlm.invoke(`.configure/.select-toolsets`, rest);
  }
  return vlm.invoke(`.configure/{.domain/.${valaa.domain}/,.type/.${valaa.type}/,}.toolset/${
      yargv.toolsetGlob || ""}{*/**/,}*`, rest);
};
