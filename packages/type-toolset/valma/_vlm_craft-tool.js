const { draftSelectToolCommand, createConfigureToolCommand, createStatusToolCommand } =
    require("@valos/type-toolset");

let typeOpspace;

exports.command = "craft-tool [toolName]";
exports.brief = "craft a tool";
exports.describe = "Craft a new tool and its commands into this workspace";
exports.introduction =
`Creates new selector, configure, status and/or release sub-commands
into the current workspace with the given tool name and toolset
restrictor.

The tool name is either a flat string or a namespaced package name. If
no tool name is given the current workspace name is used by default.

The toolset restrictor is a combination of type, domain and/or
workspace name that is matched against the toolset package.
If the tool is crafted into a toolset workspace (ie. one which has
@valos/type-toolset selected as a toolset) then this toolset is used as
the restrictor by default.


Tools are smallest building block of valma commands. Unlike toolsets
which must always be packages in their own right, a tool is just
a command with a meaningfully structured name. This provides their
placement a great deal of flexibility and allows them to be used as
a genuinely light-weight implementation detail and an integration glue.

1. After a tool sub-command is crafted and exported by a package, and
2. the corresponding primary command (select, status etc.) is invoked
3. inside some workspace that can see the exported tool sub-command, and
4. that uses a toolset matching the restrictor of the tool sub-command,
5. then the tool sub-command is invoked, using
6. the toolset configuration tool subsection from that workspace.

A complex toolset restrictor allows enabling the tool to all toolsets
of a specific domain and/or to all toolsets of a specific type (as not
all toolsets have 'toolset' as their type, ie. 'web-spindle' and 'type'
are two examples of such types).

The placement of tool command scripts themselves is not tied to the
toolset restrictor.
The typical case has a toolset to export its own tools also, but
it might just as well be that some package is specifically created to
act as a tool for some existing toolset. Here then the craft-tool is
invoked inside the tool package and the existing toolset is explicitly
specified for it.

Finally there are the tools with generic type/domain-based toolset
restrictions: these kind of tools are typically exported by domain
packages as they provide generic hooks.

`;

exports.disabled = (yargs) => !yargs.vlm.getPackageConfig();
exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  if (!typeOpspace) {
    try {
      typeOpspace = require("@valos/type-opspace");
    } catch (error) { /* */ }
  }
  return yargs.options({
    toolset: {
      type: "string",
      description: `Restrict the tool to a specific toolset.`,
      interactive: {
        type: "input", when: "if-undefined",
        default: vlm.getToolsetConfig("@valos/type-toolset") && vlm.getPackageConfig("name"),
      },
      causes: ["no-domain", "no-type"],
    },
    domain: {
      type: "string", description: "Restrict the tool to toolsets of a specific domain",
      interactive: { type: "input", when: "if-undefined", default: vlm.getValOSConfig("domain") },
      causes: ["no-toolset"],
    },
    type: {
      type: "string", description: "Restrict the tool to toolsets of a specific type",
      interactive: { type: "input", when: "if-undefined" },
      causes: ["no-toolset"],
    },
    local: {
      type: "boolean",
      description: "The tool is not exported ie. is visible only to this workspace itself",
    },
    describe: {
      type: "string", description: "Describe the tool with a single line for selectors",
      interactive: {
        type: "input", when: "if-undefined", default: vlm.getPackageConfig("description"),
      },
      causes: ["select"],
    },
    selectable: {
      type: "any", description: "Make the tool selectable and stowable",
      interactive: { type: "confirm", when: "if-undefined", default: true },
    },
    configurable: {
      type: "any", description: "Draft the tool configure command template",
      interactive: { type: "confirm", when: "if-undefined", default: true },
    },
    statusable: {
      type: "any", description: "Draft the tool status sub-command templates",
      interactive: { type: "confirm", when: "if-undefined", default: false },
    },
    releasable: {
      type: "any",
      description: `Draft the tool build and deploy release sub-commands${
        typeOpspace
            ? ` (@valos/type-opspace required)`
            : ` (@valos/type-opspace found)`}`,
      interactive: {
        type: "confirm", when: "if-undefined", default: !!typeOpspace,
      },
    },
  });
};

exports.handler = async (yargv) => {
  // Example template which displays the command name itself and package name where it is ran
  // Only enabled inside package
  const vlm = yargv.vlm;

  const toolName = yargv.toolName;
  const restrictor = { domain: yargv.domain, type: yargv.type, workspace: yargv.toolset };
  if (yargv.selectable) {
    await draftSelectToolCommand(vlm, toolName, restrictor, { describe: yargv.describe });
  }
  if (yargv.configurable) {
    await createConfigureToolCommand(vlm, toolName, restrictor);
  }
  if (yargv.statusable) {
    await createStatusToolCommand(vlm, toolName, restrictor);
  }
  if (yargv.releasable) {
    if (!typeOpspace) {
      throw new Error(`--release requested but can't find toolset package @valos/type-opspace${
        ""} in current workspace context`);
    }
    const { draftBuildToolCommand, draftDeployToolCommand } = typeOpspace;
    await draftBuildToolCommand(vlm, toolName, restrictor);
    await draftDeployToolCommand(vlm, toolName, restrictor);
  }
  return { success: true };
};
