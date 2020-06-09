const typeToolset = require("@valos/type-toolset");

exports.vlm = { tool: "copy-template-files" };
exports.command = ".select/.tools/copy-template-files";
exports.brief = "select tool 'copy-template-files'";
exports.describe = "Copy toolset template files to the workspace";
exports.introduction = `${exports.describe}.

When selected for a toolset this tool will copy all template files from
the toolset package templates/ sub-directory to the current workspace.
`;

exports.disabled = (yargs) => {
  const vlm = yargs.vlm;
  const disabled = typeToolset.checkToolSelectorDisabled(vlm, exports);
  if (disabled) return disabled;
  const packagePath = require.resolve(vlm.path.join(vlm.toolset, "package"));
  return !vlm.shell.test("-d", vlm.path.join(vlm.path.dirname(packagePath), "templates"))
      && "Toolset doesn't have templates/ sub-directory";
};
exports.builder = (yargs) => yargs.options({});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolset = yargv.toolset || vlm.toolset;
  const packagePath = require.resolve(vlm.path.join(vlm.toolset, "package"));
  const templates = vlm.path.join(vlm.path.dirname(packagePath), "templates/{.,}*");
  vlm.info(`Copying workspace files from toolset '${vlm.theme.package(toolset)}' templates at:`,
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");
};
