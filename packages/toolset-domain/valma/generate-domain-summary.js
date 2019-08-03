#!/usr/bin/env vlm

exports.vlm = { toolset: "@valos/toolset-domain" };
exports.command = "generate-domain-summary";
exports.brief = "";
exports.describe = "Generate the domain components summary file for the domain root revdoc";
exports.introduction = ``;

exports.disabled = (yargs) => (!yargs.vlm.getToolConfig(yargs.vlm.toolset, "summary", "inUse")
        ? "@valos/toolset-domain tool 'summary' is not configured to be inUse"
    : ((yargs.vlm.commandName ===
        ".release-vault/.prepared-hooks/00-generate-domain-summary")
            && !yargs.vlm.getToolConfig(yargs.vlm.toolset, "summary", "regenerateOnRelease"))
        ? "@valos/toolset-domain tool 'summary' is not configured to be regenerated on release"
    : false);

exports.builder = (yargs) => yargs.options({
  target: {
    type: "string", default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "summary", "target"),
    description: "Target for domain component summary",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const { domain, workspaceIds } = vlm.getToolsetConfig(vlm.toolset) || {};
  if (!domain || !workspaceIds) {
    return { success: false, reason: "Invalid @valos/toolset-domain config" };
  }
  vlm.shell.mkdir("-p", vlm.path.dirname(yargv.target));
  const workspaces = {};
  Object.entries(workspaceIds).forEach(([name, requireId]) => {
    const {
      version, valos, description, homepage, license, repository,
    } = require(vlm.path.join(
        requireId.slice(0, 2) !== "./" ? "" : process.cwd(), requireId, "package")) || {};
    if (!valos) return;
    const byType = workspaces[valos.type] || (workspaces[valos.type] = {});
    byType[name] = { version, description, homepage: homepage || valos.docs, license, repository };
  });
  const types = await _invokeAndFilter("PVDI", ".configure/.type/*",
      name => name.slice(".configure/.type/".length));
  const toolsets = await _invokeAndFilter("PVDI", ".configure/{,.*/{,.*,**}/}.select/**/*",
      name => name.match(/.select\/(.*)$/)[1]);
  const tools = await _invokeAndFilter("PVDI", ".configure/{,.*/{,.*,**}/}.tools/.select/**/*",
      name => name.match(/.configure\/\.(.*)\/.tools\/.select\/(.*)$/).slice(1, 3).join("#"));
  const commands = await _invokeAndFilter("PVDI", "*");
  const summary = { workspaces, types, toolsets, tools, commands };
  await vlm.shell.ShellString(JSON.stringify(summary, null, 2)).to(yargv.target);
  return {
    domain,
    workspaces: Object.keys(workspaceIds),
    success: `Generated a summary of ${
      Object.keys(workspaceIds).length} workspaces of ${
      Object.keys(summary.workspaces).length} types, ${
      Object.keys(summary.types).length} types, ${
      Object.keys(summary.toolsets).length} toolsets, ${
      Object.keys(summary.tools).length} tools and ${
      Object.keys(summary.commands).length} commands`,
  };
  async function _invokeAndFilter (columns, command,
      convertName = name => name, convertEntry = entry => entry) {
    const ret = {};
    Object.entries(await vlm.delegate(`vlm -de${columns} --json ${command}`, { stdout: "json" }))
        .forEach(([name, entry]) => {
      if ((name !== "...") && workspaceIds[entry.package]) {
        ret[convertName(name, entry)] = convertEntry(entry, name);
      }
    });
    return ret;
  }
};
