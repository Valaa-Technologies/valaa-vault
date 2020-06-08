#!/usr/bin/env vlm

const { extractChoiceName } = require("valma");

exports.vlm = { toolset: "@valos/type-vault" };
exports.command = "generate-domain-summary";
exports.brief = "generate domain summary";
exports.describe = "Generate the domain components summary file for the domain root revdoc";
exports.introduction = ``;

exports.disabled = (yargs) => (!yargs.vlm.getToolConfig(yargs.vlm.toolset, "domain", "inUse")
        ? "@valos/type-vault tool 'domain' is not configured to be inUse"
    : ((yargs.vlm.contextCommand ===
        ".release-vault/.assembled-hooks/00-generate-domain-summary")
            && !yargs.vlm.getToolConfig(yargs.vlm.toolset, "domain", "regenerateOnRelease"))
        ? "@valos/type-vault tool 'domain' is not configured to be regenerated on release"
    : false);

exports.builder = (yargs) => yargs.options({
  "summary-target": {
    type: "string", default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "domain", "summaryTarget"),
    description: "Target domain component summary file",
  },
  summary: {
    type: "object", description: "Preparation summary",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const { workspaceIds } = vlm.getToolConfig(vlm.toolset, "domain") || {};
  if (!workspaceIds) {
    return { success: false, reason: "Invalid @valos/type-vault config" };
  }
  vlm.shell.mkdir("-p", vlm.path.dirname(yargv["summary-target"]));
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
  const types = await _invokeAndFilter("PVDI",
      ".select/.type/{,.domain/*/,.domain/@*/*/}*",
      name => (extractChoiceName(name, ".select/.type") || "<invalid>"));
  const allConstaints =
      `{,.domain/*/,.domain/@*/*/}{,.type/*/,.type/@*/*/}{,.package/*/,.package/@*/*/}`;
  const toolsets = await _invokeAndFilter("PVDI",
      `.select/.toolsets/${allConstaints}**/*`,
      name => (extractChoiceName(name, ".select/.toolsets") || "<invalid>"));
  const tools = await _invokeAndFilter("PVDI",
      `.select/.tools/${allConstaints}**/*`,
      name => (extractChoiceName(name, ".select/.tools") || "<invalid>"));
  const commands = await _invokeAndFilter("PVDI", "*");
  const summary = { workspaces, types, toolsets, tools, commands };
  await vlm.shell.ShellString(JSON.stringify(summary, null, 2)).to(yargv["summary-target"]);
  await vlm.execute([`git add`, yargv["summary-target"]]);
  return {
    domain: vlm.getValOSConfig("domain"),
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
