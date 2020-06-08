exports.command = ".select/.type/tool";
exports.describe = "'tool' workspace type is deprecated";
exports.introduction =
`Tools are a toolset implementation detail. A tool is similar to
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
    && `Workspace is not a tool`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'tool' configurations of this workspace.",
  },
});

exports.handler = async (yargv) => ({
  craftTool: await yargv.vlm.invoke("craft-tool", [
    {},
    yargv.vlm.getPackageConfig("name"),
  ]),
  success: true,
});
