exports.command = ".configure/.type/tool";
exports.describe = "Configure a Valma tool repository";
exports.introduction = `${exports.describe}.

Tools are a toolset implementation detail. A tool is similar to
a toolset in that it can have its own repository specific
configurations. A tool differs from a toolset in that it cannot be
standalone; it doesn't appear in listings, its always part of one or
more toolsets and its toolsets.json config stanzas are placed under
its parent toolset stanzas.

The main case for tools and toolsets separation came from the release
deployment system of autholleries, where the modularity and granular
semantic versioning of tool packages allows for more efficient and
robust deployments.

A monolithic toolset with complex configurations and infrastructure
code with a naive deployment logic would trigger code deployments even
if only a single configuration flag changed. Developing efficient
deployment logic on the other hand is error prone and not robust.

Tool repositories allows splitting complex toolsets into separate
tools with different deployment logic. Infrastructure code which
changes rarily can be placed in tool repositorires with naive
deployment logic which relies on the tool version number only.
Frequently changing configs can be managed by the toolset repository
itself but even it can then use tool repositories to source in
commands and other resources to help with the deployment management.

Additionally because the tool configuration is always inside its
parent toolset config this allows the same tool be used by several
different toolsets in a single repository. Because of this all tool
commands must have an option for '--toolset=@myscope/mytoolset' which
uses yargs.vlm.toolset as its default value.`;

exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'tool' type configurations of this repository.",
  },
  brief: {
    type: "string", description: "A brief two-three word description of this tool",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const simpleName = vlm.packageConfig.name.match(/([^/]*)$/)[1];
  await vlm.invoke("create-command", [`.configure/.tool/${vlm.packageConfig.name}`, {
    filename: `configure_tool__${simpleName}.js`,
    brief: `${yargv.brief || "simple"} configure`,
    header: `const toolName = "${vlm.packageConfig.name}";\n\n`,
    describe: `Configure this tool package within the given toolset configuration`,

    introduction:
`As a tool this script is not automatically called. The toolset or tool
which directly depends on this tool must explicit call this command.`,

    builder: `(yargs) => yargs.options({
  toolset: yargs.vlm.createStandardToolsetOption(
      "The target toolset to add a configuration for this tool."),
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure tool ${simpleName} configuration for the given toolset",
  },
});`,
    handler: `(yargv) => {
const vlm = yargv.vlm;
const toolConfig = vlm.getToolConfig(yargv.toolset, toolName) || {};
// Construct a tool config update or bail out.
const configUpdate = {};
vlm.updateToolConfig(yargv.toolset, toolName, configUpdate);
};
`,
  }]);
  return vlm.invoke(`.configure/.type/.tool/**/*`, { reconfigure: yargv.reconfigure });
};
