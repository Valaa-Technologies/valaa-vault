exports.command = ".configure/.type/tool";
exports.describe = "Initialize tool workspace";
exports.introduction = `${exports.describe}.

Tools are a toolset implementation detail. A tool is similar to
a toolset in that it can have its own workspace specific
configurations. A tool differs from a toolset in that it cannot be
standalone; it doesn't appear in listings, its always part of one or
more toolsets and its toolsets.json config stanzas are placed under
its parent toolset stanzas.

The main case for tools and toolsets separation came from the release
deployment system of opspaces, where the modularity and granular
semantic versioning of tool packages allows for more efficient and
robust deployments.

Tool workspaces allows splitting complex toolsets into separate
tools with different deployment logic. Infrastructure code which
changes rarily can be placed under tool packages with naive
deployment logic which relies on the tool package version number only.
Frequently changing configs can be managed by the toolset workspace
itself but even it can then use tool workspaces to source in
commands and other resources to help with the deployment management.

Additionally because the tool configuration is always inside its
parent toolset config this allows the same tool be used by several
different toolsets in a single workspace. Because of this all tool
commands must have an option for '--toolset=<@scope/toolsetname>' which
uses yargs.vlm.toolset as its default value.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "tool")
    && `Workspace is not a 'tool' (is '${yargs.vlm.getValOSConfig("type")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'tool' configurations of this workspace.",
  },
  brief: {
    type: "string", description: "A brief two-three word description of this tool",
  },
});

exports.handler = async (yargv) => {
  const {
    createConfigureCommand, createStatusSubCommand, createReleaseSubCommand
  } = require("./toolset");
  const vlm = yargv.vlm;
  const simpleName = vlm.packageConfig.name.match(/([^/]*)$/)[1];
  await createConfigureCommand(vlm, "tool", vlm.packageConfig.name, simpleName, yargv.brief);
  if (await vlm.inquireConfirm("Create tool status sub-command skeleton?")) {
    await createStatusSubCommand(vlm, "tool", vlm.packageConfig.name, simpleName, ".tool/");
  }
  if (await vlm.inquireConfirm("Create tool build and deploy release sub-commands?")) {
    await createReleaseSubCommand(vlm, "tool", vlm.packageConfig.name, simpleName, "build");
    await createReleaseSubCommand(vlm, "tool", vlm.packageConfig.name, simpleName, "deploy");
  }
  return { success: true };
};
