#!/usr/bin/env vlm

exports.command = "init";
exports.describe = "Initialize the current directory as a ValOS workspace from scratch";
exports.introduction =
`This command will interactively walk through the process of creating
and configuring a new valma workspace in the current working directory
from scratch.

Valma init has following interactive phases:
1. Initialization of package.json via 'yarn init'
2. Configuration of workspace valos.type and .domain via 'vlm .configure/.valos-stanza'
3. Addition of new known domains via 'yarn add --dev (-W)'
4. Selection of in-use toolsets from available toolsets via 'vlm .configure/.select-toolsets'
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
  breakdown: {
    type: "boolean", description: "Show full breakdown of the init process even if successful.",
  },
  description: {
    type: "string", description: "Initial description of the package.",
  },
  valos: {
    type: "object", description: "Initial package.json valos stanza.",
  },
  devDependencies: {
    type: "string", array: true,
    description: "List of initial devDependencies entries.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  vlm.speak(exports.introduction.match(/[^\n]*\n(.*)/)[1]);
  const tellIfNoReconfigure = !yargv.reconfigure ? ["(no --reconfigure given)"] : [];

  let packageJSON;
  try { packageJSON = require(vlm.path.join(process.cwd(), "package")); } catch (error) { /* */ }
  const ret_ = { success: true };
  Object.assign(await _initPackageJSON());
  if (ret_.success === false) return ret_;
  if (!packageJSON) {
    return vlm.interact(["vlm init", {
      breakdown: yargv.breakdown, devDependencies: yargv.devDependencies, valos: yargv.valos,
    }]);
  }
  if ((ret_.success !== false) && ((yargv.devDependencies || [])[0] !== false)) {
    Object.assign(ret_, await _addInitialValmaDevDependencies());
  }
  if (ret_.success !== false) Object.assign(ret_, await _selectValOSTypeAndDomain());
  if (ret_.success !== false) Object.assign(ret_, await _configure());
  return yargv.breakdown || (ret_.success === false) ? ret_ : { success: ret_.success };

  async function _initPackageJSON () {
    while (yargv.reconfigure || !packageJSON) {
      const choices = (packageJSON ? ["Bypass", "reconfigure"] : ["Initialize"])
          .concat(["help", "quit"]);
      const answer = await vlm.inquire([{
        message: `${packageJSON ? "Reconfigure the existing" : "Initialize"
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
      await _updatePackageWithVaultDefaults();
      return { success: await vlm.interact("yarn init") || true };
    }
    vlm.info(`Skipped '${vlm.theme.executable("yarn init")}'.`, ...tellIfNoReconfigure);
    return {};
  }

  async function _updatePackageWithVaultDefaults () {
    let vaultConfig;
    let candidatePath = process.cwd();
    do {
      candidatePath = vlm.path.join(candidatePath, "..");
      vaultConfig = await vlm.tryReadFile(vlm.path.join(candidatePath, "package.json"));
      if (vaultConfig !== undefined) {
        vaultConfig = JSON.parse(vaultConfig);
        if (((vaultConfig || {}).valos || {}).type === "vault") {
          // rather brittle name default. Only works for workspaces
          // precisely two nestings under a vault package.json (which is
          // vast majority of them though).
          const parts = vlm.path.resolve().split("/").slice(-2);
          let isPrivate = true;
          let publishConfigLine = "";
          if (parts[0] === "packages") {
            parts.shift();
            isPrivate = false;
            publishConfigLine = `,
"publishConfig": {
  "access": "${(await vlm.inquireConfirm(
      "Is this a 'public' published package? ('n' for 'restricted')")) ? "public" : "restricted"}"
}`;
          } else if (parts[0][parts[0].length - 1] === "s") parts[0] = parts[0].slice(0, -1);
          const workspacePrefix = ((vaultConfig || {}).valos || {}).workspacePrefix
              || `${vaultConfig.name.split("/")[0]}/`;
          vlm.shell.ShellString(
`{
"name": "${workspacePrefix}${parts.join("-")}",
"version": "${vaultConfig.version}",
"description": ${JSON.stringify(yargv.description || "")},
"author": "${vaultConfig.author}",
"license": "${vaultConfig.license}",
"private": ${isPrivate ? "true" : "false"}${
publishConfigLine}
}`).to("package.json");
          return;
        }
      }
    } while (candidatePath && (candidatePath !== "/"));
  }

  async function _selectValOSTypeAndDomain () {
    let justConfigured = false;
    const ret = {};
    while (yargv.reconfigure || !vlm.packageConfig.valos || justConfigured) {
      if (Object.keys(yargv.valos || {}).length
          && (!vlm.packageConfig.valos || yargv.reconfigure)) {
        await vlm.updatePackageConfig({ valos: yargv.valos });
      }
      const choices = (justConfigured ? ["Confirm", "reconfigure"]
              : vlm.packageConfig.valos ? ["Bypass", "reconfigure"] : ["Initialize"])
          .concat(["help", "quit"]);
      const answer = await vlm.inquire([{
        message: !vlm.packageConfig.valos
            ? "Initialize workspace valos stanza type and domain?"
            : `${justConfigured ? "Confirm" : "Reconfigure"
                } valos stanza: ${JSON.stringify({ ...vlm.packageConfig.valos })}?`,
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
      if (answer.choice === "Confirm") return ret;
      vlm.reconfigure = yargv.reconfigure || (answer.choice === "reconfigure");
      ret.stanza = await vlm.invoke(".configure/.valos-stanza", { reconfigure: vlm.reconfigure });
      justConfigured = true;
    }
    vlm.info("Skipped configuring valos type and domain of this workspace.",
        ...tellIfNoReconfigure);
    return ret;
  }

  async function _addInitialValmaDevDependencies () {
    const yarnAdd = "yarn add --dev -W";
    const themedYarnAdd = vlm.theme.executable(yarnAdd);
    let wasError;
    const wasInitial = !vlm.packageConfig.devDependencies;
    while (yargv.reconfigure || wasInitial) {
      const visibleDomains = await vlm.delegate("vlm -ePVO .configure/.domain/{,*/**/}*");
      vlm.info("Visible domains:\n", visibleDomains);
      const choices = vlm.packageConfig.devDependencies
          ? ["Bypass", "yes", "help", "quit"]
          : ["Yes", "bypass", "help", "quit"];
      let answer = await vlm.inquire([{
        message: wasError
            ? "Retry adding domains (or direct toolsets) as devDependencies?"
            : `${vlm.theme.executable("yarn add")
              } more domains as devDependencies directly to this workspace?`,
        type: "list", name: "choice", default: choices[0], choices,
      }]);
      wasError = false;
      if (answer.choice === "Bypass" || answer.choice === "bypass") break;
      if (answer.choice === "quit") return { success: false, reason: answer };
      if (answer.choice === "help") {
        vlm.speak();
        vlm.info("domain registration",
`This phase uses '${themedYarnAdd}' to add domains as devDependencies.
This makes the domains, types and toolsets provided by those domains
available for the listings in following phases.
`);
        continue;
      }
      answer = await vlm.inquire([{
        type: "input", name: "devDependencies",
        message: `enter a space-separated list of domains for '${themedYarnAdd}':\n`,
      }]);
      if (!answer || !answer.devDependencies) {
        vlm.info(`No devDependencies provided, skipping domain registration phase`);
      } else {
        try {
          await vlm.interact(["yarn add -W --dev", answer.devDependencies]);
        } catch (error) {
          vlm.speak();
          vlm.exception(error, vlm.theme.executable(yarnAdd, answer.devDependencies));
          wasError = true;
        }
      }
    }
    vlm.info(`Skipped '${themedYarnAdd}'.`, ...tellIfNoReconfigure);
    return {};
  }

  async function _configure () {
    while (yargv.reconfigure || !vlm.getToolsetsConfig()) {
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
      const choices = (toolsetsConfig ? ["Bypass", "reconfigure"] : ["Configure"])
          .concat(["help", "quit"]);
      const answer = await vlm.inquire([{
        message: `${toolsetsConfig ? "Reconfigure" : "Configure"} workspace with '${
            vlm.theme.command("vlm configure")}'?`,
        type: "list", name: "choice", default: choices[0], choices,
      }]);
      if (answer.choice === "Bypass") break;
      if (answer.choice === "quit") return { success: false, reason: answer };
      if (answer.choice === "help") {
        vlm.speak();
        vlm.speak(await vlm.invoke("configure", ["--show-introduction"]));
        vlm.speak();
        continue;
      }
      vlm.reconfigure = yargv.reconfigure || (answer.choice === "reconfigure");
      return vlm.invoke("configure", {
        reconfigure: vlm.reconfigure,
        domain: !(ret_.stanza || {}).newDomain,
      });
    }
    vlm.info("Skipped 'vlm configure'.", ...tellIfNoReconfigure);
    return {};
  }
};
