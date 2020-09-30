#!/usr/bin/env vlm

const { updateConfigurableSideEffects } = require("valma");

exports.command = "init";
exports.describe = "Initialize the current directory as a ValOS workspace from scratch";
exports.introduction = `
This command will interactively create and configure a new valma ${
  ""}workspace in the current working directory from scratch.

Valma init has following interactive phases:
1. Initialization of package.json via 'yarn init'
2. Configuration of workspace valos.type and .domain via 'vlm .configure/.valos-stanza'
3. Addition of new known domains via 'yarn add --dev (-W)'
4. Selection of in-use toolsets from available toolsets via 'vlm select-toolsets'
5. Configuration of in-use toolsets and tools via 'vlm configure'`;

exports.disabled = (yargs) => {
  try {
    const packageJSON = require(yargs.vlm.path.join(process.cwd(), "package"));
    if ((packageJSON || {}).valos !== undefined) {
      return "Already initialized (package.json:valos section exists)";
    }
  } catch (error) { /* */ }
  return false;
};
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all config of this workspace.",
  },
  "default-tags": {
    description: `Custom default package tags lookup (by package prefix) for new packages.`,
  },
  breakdown: {
    type: "boolean", description: "Show full breakdown of the init process even if successful.",
  },
  namespace: {
    type: "string",
    description:
`Explicit namespace of the package name.
Defaults to surrounding vault namespace and then to the selected domain namespace`,
  },
  description: {
    type: "string", description: "Initial description of the package.",
  },
  "new-domain": {
    type: "string", description: "The name of a new domain that this vault introduces.",
  },
  valos: {
    type: "object", description: "Initial package.json valos stanza.",
  },
  repository: {
    type: "string", description: "Initial repository of the package.",
  },
  devDependencies: {
    type: "string", array: true,
    description: "List of initial devDependencies entries.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if (!yargv.valos) {
    vlm.speak(exports.introduction.match(/[^\n]*\n(.*)/)[1]);
  }
  const tellIfNoReconfigure = !yargv.reconfigure ? ["(no --reconfigure given)"] : [];

  let defaultTags = yargv["default-tags"];
  if (typeof defaultTags === "string") defaultTags = { "": defaultTags };
  if (defaultTags) vlm.defaultTags = { ...(vlm.defaultTags || {}), ...defaultTags };

  let packageJSON;
  try {
    packageJSON = require(vlm.path.join(process.cwd(), "package"));
  } catch (error) { /* */ }
  const isInitial = !packageJSON;
  const ret_ = { success: true };
  if (isInitial) {
    Object.assign(ret_, await _createDefaultPackageJSON(yargv.valos || {}));
    if (!ret_.success) return ret_;
    Object.assign(ret_, await _initPackageJSON());
    if (!ret_.success) return ret_;
    return vlm.interact(["vlm -b init", {
      breakdown: yargv.breakdown,
      "new-domain": ret_.isNewDomain ? ret_.valos.domain : undefined,
      valos: ret_.valos,
      repository: yargv.repository,
      devDependencies: yargv.devDependencies,
      reconfigure: yargv.reconfigure,
    }]);
  }
  if (yargv["new-domain"]) {
    ret_.valos = { domain: yargv["new-domain"], type: "vault" };
  }
  if ((ret_.success !== false) && ((yargv.devDependencies || [])[0] !== false)) {
    Object.assign(ret_, await _addInitialValmaDevDependencies(ret_.newDevDependencies));
  }
  if (ret_.success !== false) {
    Object.assign(ret_, await _selectValOSTypeAndDomain(ret_.valos || yargv.valos));
  }
  if (ret_.success !== false) {
    Object.assign(ret_, await _configure(ret_.isNewDomain));
  }
  return yargv.breakdown || (ret_.success === false) ? ret_ : { success: ret_.success };

  async function _createDefaultPackageJSON (explicitValos) {
    let parentVaultConfig;
    const workspacePath = process.cwd();
    let vaultSubPath;
    for (let vaultPath = workspacePath; ; vaultPath = vlm.path.join(vaultPath, "..")) {
      if (!vaultPath || (vaultPath === vlm.path.sep)) break;
      parentVaultConfig = await vlm.tryReadFile(vlm.path.join(vaultPath, "package.json"));
      if (!parentVaultConfig) continue;
      parentVaultConfig = JSON.parse(parentVaultConfig);
      if (((parentVaultConfig || {}).valos || {}).type === "vault") {
        vaultSubPath = workspacePath.slice(vaultPath.length + 1) // +1 = remove leading "/"
            .split(vlm.path.sep);
        break;
      }
      parentVaultConfig = undefined;
    }
    let namespace = yargv.namespace;
    const ret = { success: true, valos: { ...explicitValos } };
    if (yargv["new-domain"]) {
      ret.valos.domain = yargv["new-domain"];
      ret.valos.type = "vault";
    } else if (parentVaultConfig) {
      if (!namespace) namespace = parentVaultConfig.name.match(/^((@[^/]+)\/)[^/]+$/)[2] || "";
      const vaultDomain = parentVaultConfig.valos.domain;
      if (!ret.valos.domain && await vlm.inquireConfirm(
          `Set '${vaultDomain}' as the valos.domain (based on the vault domain)?`)) {
        ret.valos.domain = vaultDomain;
      }
      if (!ret.valos.type && vaultSubPath[0].endsWith("s") && (vaultSubPath[0] !== "packages")) {
        const typeCandidate = vaultSubPath[0].slice(0, -1);
        if (await vlm.inquireConfirm(
            `Set '${typeCandidate}' as the valos.type (based on the vault workspace directory)?`)) {
          ret.valos.type = typeCandidate;
        }
      }
    } else if (!ret.valos.type && await vlm.inquireConfirm(
        "Set 'vault' as the valos.type (workspace is outside a vault)?")) {
      ret.valos.type = "vault";
    }
    Object.assign(ret, await vlm.invoke(".configure/.valos-stanza", ret.valos));
    if (!ret.success) return ret;

    packageJSON = {
      name: vlm.path.basename(workspacePath),
      version: (parentVaultConfig || {}).version || "0.1.0",
      description: yargv.description || "",
      author: (parentVaultConfig || {}).author || "",
      license: (parentVaultConfig || {}).license || "",
      repository: yargv.repository || (parentVaultConfig || {}).repository || "",
      private: false,
    };
    if (!ret.isNewDomain) {
      ret.newDevDependencies = [ret.valos.domain];
    } else {
      packageJSON.description = `Vault for domain ${ret.valos.domain}`;
    }
    const domainNamespace = ret.valos.domain.split("/")[0];
    if (!namespace && await vlm.inquireConfirm(
        `Set '${domainNamespace}' as the package namespace (based on the domain namespace)?`)) {
      namespace = domainNamespace;
    }
    if (namespace) {
      packageJSON.name = `${namespace}/${packageJSON.name}`;
    }
    if ((ret.valos.type === "vault")
        || !(await vlm.inquireConfirm(`Is this workspace published to a package repository?`))) {
      packageJSON.private = true;
      if (!packageJSON.name.endsWith(`-${ret.valos.type}`)) {
        packageJSON.name = `${packageJSON.name}-${ret.valos.type}`;
      }
    } else {
      packageJSON.publishConfig = {
        access: (await vlm.inquireConfirm(
                "Is this a 'public' published package ('n' for 'restricted')?"))
            ? "public"
            : "restricted",
      };
    }
    vlm.shell.ShellString(JSON.stringify(packageJSON, null, 2))
        .to("package.json");
    return ret;
  }

  async function _initPackageJSON () {
    while (yargv.reconfigure || !packageJSON || isInitial) {
      const choices = (packageJSON && !isInitial ? ["Bypass", "reconfigure"] : ["Initialize"])
          .concat(["help", "quit"]);
      const answer = await vlm.inquire([{
        message: `${packageJSON && !isInitial ? "Reconfigure the existing" : "Initialize"
            } package.json with 'yarn init'?`,
        type: "list", name: "choice", default: choices[0], choices,
      }]);
      if (answer.choice === "Bypass") break;
      if (answer.choice === "quit") return { success: false, reason: answer };
      if (answer.choice === "help") {
        vlm.speak();
        vlm.info("workspace initialization",
`This phase uses '${vlm.theme.executable("yarn init")}' to initialize
package.json via a series of interactive questions.
ValOS workspaces use yarn extensively for version, dependency and
script management; ${vlm.theme.path("package.json")} is the central
package configuration file for yarn (and also for npm, which yarn is
  based on).
`);
        continue;
      }
      if (!(await vlm.interact("yarn init"))) {
        return { success: false, reason: "failed to yarn init" };
      }
      return { success: true };
    }
    vlm.info(`Skipped '${vlm.theme.executable("yarn init")}'.`, ...tellIfNoReconfigure);
    return {};
  }

  async function _selectValOSTypeAndDomain (explicitValos) {
    let justConfigured = false;
    const ret = { success: false };
    while (yargv.reconfigure || !vlm.getValOSConfig() || justConfigured) {
      if (Object.keys(explicitValos || {}).length && (!vlm.getValOSConfig() || yargv.reconfigure)) {
        ret.valos = explicitValos;
        justConfigured = true;
      }
      const choices = (justConfigured
                  ? ["Commit", "reconfigure"]
              : vlm.getValOSConfig()
                  ? ["Bypass", "reconfigure"]
                  : ["Initialize"])
          .concat(["help", "quit"]);
      const answer = await vlm.inquire([{
        message:
            justConfigured
                ? `Commit package.json valos stanza: ${JSON.stringify(ret.valos)}?`
            : vlm.getValOSConfig()
                ? `Reconfigure package.json valos stanza: ${
                    JSON.stringify({ ...vlm.getValOSConfig() })}?`
            : "Initialize package.json valos stanza type and domain?",
        type: "list", name: "choice", default: choices[0], choices,
      }]);
      if (answer.choice === "Bypass") break;
      if (answer.choice === "quit") return Object.assign(ret, { success: false, reason: answer });
      if (answer.choice === "help") {
        vlm.speak();
        vlm.speak(await vlm.invoke(".configure/.valos-stanza", ["--show-introduction"]));
        vlm.speak();
        continue;
      }
      if (answer.choice === "Commit") {
        ret.commitValOS = await vlm.updatePackageConfig({ valos: ret.valos });
        ret.select = {
          domain: !yargv["new-domain"] && await vlm.invoke(`.select/.domain/${ret.valos.domain}`),
          type: await vlm.invoke(`.select/.type/${ret.valos.type}`),
        };
        Object.assign(ret.select,
            await updateConfigurableSideEffects(vlm, ret.select.domain, ret.select.type));
        if (ret.select.success === false) return ret;
        ret.success = true;
        return ret;
      }
      vlm.reconfigure = yargv.reconfigure || (answer.choice === "reconfigure");
      Object.assign(ret,
          await vlm.invoke(".configure/.valos-stanza", { reconfigure: vlm.reconfigure }));
      justConfigured = true;
    }
    vlm.info("Skipped configuring valos type and domain of this workspace.",
        ...tellIfNoReconfigure);
    return ret;
  }

  async function _addInitialValmaDevDependencies (newDevDependencies) {
    const yarnAdd = "yarn add --dev -W";
    const themedYarnAdd = vlm.theme.executable(yarnAdd);
    let wasError;
    const wasInitial = !vlm.getPackageConfig("devDependencies");
    while (yargv.reconfigure || wasInitial) {
      const visibleDomains = await vlm.delegate("vlm -bePVO .select/.domain/{,*/**/}*");
      vlm.info("Visible domains:\n", visibleDomains);
      const choices = ["Bypass", "yes", "help", "quit"];
      let answer = await vlm.inquire([{
        message: wasError
            ? "Retry adding domains (or direct toolsets) as devDependencies?"
            : `${vlm.theme.executable("yarn add")
              } more domains as devDependencies directly to this workspace?`,
        type: "list", name: "choice", default: choices[0], choices,
      }]);
      wasError = false;
      if (answer.choice === "Bypass") break;
      if (answer.choice === "quit") return { success: false, reason: answer };
      if (answer.choice === "help") {
        vlm.speak();
        vlm.info("domain registration",
`This phase uses '${themedYarnAdd}' to add domains as devDependencies.
This makes all the packages, types and toolsets provided by those domains
available for the listings in following phases.
`);
        continue;
      }
      answer = await vlm.inquire([{
        type: "input", name: "devDependencies",
        message: `enter a space-separated list of domains for '${themedYarnAdd}':\n`,
      }]);
      const allNewDevDependencies = [].concat(newDevDependencies || [])
          .concat(((answer && answer.devDependencies) || "").split(" "));
      if (!allNewDevDependencies.length) {
        vlm.info(`No new devDependencies requested, skipping domain registration phase`);
      } else {
        try {
          await vlm.addNewDevDependencies(allNewDevDependencies);
        } catch (error) {
          vlm.speak();
          vlm.exception(error, vlm.theme.executable(yarnAdd, allNewDevDependencies));
          wasError = true;
        }
      }
    }
    vlm.info(`Skipped '${themedYarnAdd}'.`, ...tellIfNoReconfigure);
    return {};
  }

  async function _configure () {
    while (true) { // eslint-disable-line no-constant-condition
      let toolsetsConfig;
      try {
        toolsetsConfig = require(vlm.path.join(process.cwd(), "toolsets"));
        if (toolsetsConfig && !yargv.reconfigure) {
          return {
            success: false,
            reason: "trying to configure an existing toolset without --reconfigure",
          };
        }
      } catch (error) { /* */ }
      const choices = ["Configure", "bypass", "help", "quit"];
      const answer = await vlm.inquire([{
        message: `Configure workspace with '${
            vlm.theme.command("vlm configure", "--reconfigure")}'?`,
        type: "list", name: "choice", choices, default: choices[0],
      }]);
      if (answer.choice === "bypass") break;
      if (answer.choice === "quit") return { success: false, reason: answer };
      if (answer.choice === "help") {
        vlm.speak();
        vlm.speak(await vlm.invoke("configure", ["--show-introduction"]));
        vlm.speak();
        continue;
      }
      // init always reconfigures all configurations
      vlm.reconfigure = true;
      return vlm.invoke("configure", { reconfigure: true });
    }
    vlm.info("Skipped 'vlm configure'.", ...tellIfNoReconfigure);
    return {};
  }
};
