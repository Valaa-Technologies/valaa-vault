const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-vault", tool: "domain" };
exports.command = ".select/.tools/.workspace/@valos/type-vault/domain";
exports.brief = "select domain management";
exports.describe = "Setup a type-domain package for curating the domain of this vault";
exports.introduction =
`This type-vault tool enables the domain management and (re)generation
of docs/index.html domain summary revdoc document.`;

exports.disabled = (yargs) => typeToolset.checkToolSelectorDisabled(yargs.vlm, exports,
    { workspace: exports.vlm.toolset });

exports.builder = (yargs) => yargs.options({
  "regenerate-on-release": {
    default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "domain", "regenerateOnRelease"),
    description: "Regenerate domain summary revdoc on each vault (pre)release",
    interactive: answers => ({
      type: "confirm", when: answers.reconfigure ? "always" : "if-undefined",
    }),
  },
  "summary-target": {
    type: "string",
    default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "domain", "summaryTarget")
        || `packages/${yargs.vlm.getValOSConfig("domain")
            .split(yargs.vlm.getValOSConfig("prefix") || "/")[1] || "REPLACEME"}/summary.json`,
    description: "Target domain summary JSON path",
    interactive: answers => ({
      type: "confirm", when: answers.reconfigure ? "always" : "if-undefined",
    }),
  },
  ...typeToolset.createConfigureToolOptions(yargs.vlm, exports),
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const domain = vlm.getValOSConfig("domain");
  const { repository } = vlm.getPackageConfig();
  const domainLocal = domain.split("/")[1];
  const domainWorkspacePath = vlm.path.join(process.cwd(), "packages", domainLocal);
  if (!vlm.shell.test("-d", domainWorkspacePath) &&
      await vlm.inquireConfirm(`Create domain workspace ${vlm.theme.package(domain)} at ${
          vlm.theme.path(domainWorkspacePath)}?`)) {
    vlm.shell.mkdir("-p", domainWorkspacePath);
    vlm.shell.pushd(domainWorkspacePath);
    await vlm.invoke(`init`, {
      description: `The domain '${domain}'`,
      valos: { type: "domain", domain },
      repository,
      devDependencies: false,
    });
    await vlm.interact([`vlm draft-command`, {
      filename: `select_domain__${domainLocal}.js`,
      export: true,
      template: false,
      brief: `select ${domain} domain`,
      describe: `[Edit a single-line domain description that'll be visible in vlm init selectors]`,
      introduction:
`[Edit a longer description that is shown to an ops user once they have
preliminarily selected the domain during 'vlm init']`,

      disabled: `(yargs) => false`,

      builder: `(yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure '${domain}' domain for this workspace.",
  },
})`,
      handler: `() => ({ success: true })`,
    }, `.select/.domain/${domain}`]);
    vlm.shell.popd();
  }
  return {
    command: exports.command,
    toolsetsUpdate: { [yargv.vlm.toolset]: { tools: { domain: {
      inUse: true,
      regenerateOnRelease: yargv["regenerate-on-release"] || false,
      summaryTarget: yargv["summary-target"] || "",
    } } } },
  };
};
