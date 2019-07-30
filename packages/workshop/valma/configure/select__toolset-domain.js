exports.vlm = { toolset: "@valos/toolset-domain" };
exports.command = ".configure/.select/@valos/toolset-domain";
exports.brief = "select toolset";
exports.describe =
    "Select and configure 'toolset-domain' for the current vault or workshop workspace";
const enabledTypes = ["vault", "workshop"];
exports.introduction =
`This workspace type provides configuration template and commands for
managing a ValOS domain.

The toolset 'toolset-domain' is selectable by '${enabledTypes.join("', '")}' workspaces.`;

exports.disabled = (yargs) => !enabledTypes.includes(yargs.vlm.getValOSConfig("type"))
    && `Workspace is not '${enabledTypes.join("', '")}' (is ${yargs.vlm.getValOSConfig("type")})`;
exports.builder = (yargs) => yargs.options({
  ...yargs.vlm.createConfigureToolsetOptions(exports, { toolSelectorName: null }),
  domain: {
    type: "string", default: yargs.vlm.getValOSConfig("domain") || undefined,
    interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
    description: "The target domain to manage.",
  },
});

exports.handler = (yargv) => ({
  success: true,
  devDependencies: { [yargv.vlm.toolset]: true },
  toolsetsUpdate: { [yargv.vlm.toolset]: { inUse: true, domain: yargv.domain } },
});
