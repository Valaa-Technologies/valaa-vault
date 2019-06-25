#!/usr/bin/env vlm

exports.command = "init";
exports.describe = "Initialize the current directory as a ValOS repository from scratch";
exports.introduction = `${exports.describe}.

This process will walk you through creating and configuring a new
valma repository in the current working directory from scratch.

Valma init has following interactive phases:
1. Initialization of package.json via 'yarn init'
2. Configuration of repository valos.type and .domain via 'vlm .configure/.valos-stanza'
3. Addition of new known workshops via 'yarn add -W --dev'
4. Selection of in-use toolsets from available toolsets via 'vlm .configure/.select-toolsets'
5. Configuration of in-use toolsets and tools via 'vlm configure'`;

exports.disabled = (yargs) => yargs.vlm.getToolsetsConfig()
    && "Already initialized (toolsets.json exists)";
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all config of this workspace.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  vlm.speak(exports.introduction.match(/[^\n]*\n(.*)/)[1]);
  const tellIfNoReconfigure = !yargv.reconfigure ? ["(no --reconfigure given)"] : [];

  return await _initPackageJSON()
      && await _selectValOSTypeAndDomain()
      && await _addInitialValmaDevDependencies()
      && _configure();

  async function _initPackageJSON () {
    while (yargv.reconfigure || !vlm.packageConfig) {
      const choices = (vlm.packageConfig ? ["Skip", "reconfigure"] : ["Initialize"])
          .concat(["help", "quit"]);
      const answer = await vlm.inquire([{
        message: `${vlm.packageConfig ? "Reconfigure the existing" : "Initialize"
            } package.json with 'yarn init'?`,
        type: "list", name: "choice", default: choices[0], choices,
      }]);
      if (answer.choice === "Skip") break;
      if (answer.choice === "quit") return false;
      if (answer.choice === "help") {
        vlm.speak();
        vlm.info("repository initialization",
`This phase uses '${vlm.theme.executable("yarn init")}' to initialize package.json via a series of
interactive questions.
ValOS repositories use yarn extensively for version, dependency and
script management; ${vlm.theme.path("package.json")} is the central package configuration
file for yarn (and also for npm, which yarn is based on).
`);
        continue;
      }
      let vaultConfig = await vlm.tryReadFile(vlm.path.join("..", "..", "package.json"));
      if (vaultConfig !== undefined) {
        // rather brittle name default. Only works for workspaces
        // precisely two nestings under a vault package.json (which is
        // vast majority of them though).
        vaultConfig = JSON.parse(vaultConfig);
        const parts = vlm.path.resolve().split("/").slice(-2);
        let isPrivate = true;
        let publishConfigLine = "";
        let name = vaultConfig.name;
        if (name[name.length - 1] !== "/") name += "_";
        if (parts[0] === "packages") {
          parts.shift();
          isPrivate = false;
          publishConfigLine = `,
  "publishConfig": {
    "access": "${(await vlm.inquireConfirm(
        "Is this a 'public' published package? ('n' for 'restricted')")) ? "public" : "restricted"}"
  }`;
        } else if (parts[0][parts[0].length - 1] === "s") parts[0] = parts[0].slice(0, -1);
        vlm.shell.ShellString(
`{
  "name": "${name}${parts.join("_")}",
  "version": "${vaultConfig.version}",
  "author": "${vaultConfig.author}",
  "license": "${vaultConfig.license}",
  "private": ${isPrivate ? "true" : "false"}${
  publishConfigLine}
}`).to("package.json");
      }
      return vlm.interact("yarn init");
    }
    vlm.info(`Skipped '${vlm.theme.executable("yarn init")}'.`, ...tellIfNoReconfigure);
    return true;
  }

  async function _selectValOSTypeAndDomain () {
    let justConfigured = false;
    while (yargv.reconfigure || !vlm.packageConfig.valos || justConfigured) {
      const choices = (justConfigured ? ["Confirm", "reconfigure"]
              : vlm.packageConfig.valos ? ["Skip", "reconfigure"] : ["Initialize"])
          .concat(["help", "quit"]);
      const answer = await vlm.inquire([{
        message: !vlm.packageConfig.valos
            ? "Initialize repository valos stanza type and domain?"
            : `${justConfigured ? "Confirm selection or reconfigure" : "Reconfigure"
                } valos stanza: ${JSON.stringify({ ...vlm.packageConfig.valos })}?`,
        type: "list", name: "choice", default: choices[0], choices,
      }]);
      if (answer.choice === "Skip") break;
      if (answer.choice === "quit") return false;
      if (answer.choice === "help") {
        vlm.speak();
        vlm.speak(await vlm.invoke(".configure/.valos-stanza", ["--show-introduction"]));
        vlm.speak();
        continue;
      }
      if (answer.choice === "Confirm") return true;
      vlm.reconfigure = yargv.reconfigure;
      await vlm.invoke(".configure/.valos-stanza", { reconfigure: yargv.reconfigure });
      justConfigured = true;
    }
    vlm.info("Skipped repository valos type and domain configure.", ...tellIfNoReconfigure);
    return true;
  }

  async function _addInitialValmaDevDependencies () {
    const yarnAdd = "yarn add -W --dev";
    const coloredYarnAdd = vlm.theme.executable(yarnAdd);
    let wasError;
    const wasInitial = !vlm.packageConfig.devDependencies;
    while (yargv.reconfigure || wasInitial) {
      const choices = vlm.packageConfig.devDependencies
          ? ["Skip", "yes", "help", "quit"]
          : ["Yes", "skip", "help", "quit"];
      let answer = await vlm.inquire([{
        message: wasError
            ? "Retry adding workshops (or direct toolsets) as devDependencies?"
            : `${vlm.theme.executable("yarn add")} ${
                vlm.packageConfig.devDependencies ? "more" : "initial"
              } workshops (or direct toolsets) as devDependencies?`,
        type: "list", name: "choice", default: choices[0], choices,
      }]);
      wasError = false;
      if (answer.choice === "Skip" || answer.choice === "skip") break;
      if (answer.choice === "quit") return false;
      if (answer.choice === "help") {
        vlm.speak();
        vlm.info("workshop registration",
`This phase uses '${coloredYarnAdd}' to add workshops as devDependencies.
This makes the toolsets in those workshops to be immediately available
for the listings in following phases.
`);
        continue;
      }
      answer = await vlm.inquire([{
        type: "input", name: "devDependencies",
        message: `enter a space-separated list of workshops for '${coloredYarnAdd}':\n`,
      }]);
      if (!answer || !answer.devDependencies) {
        vlm.info(`No devDependencies provided, skipping workshop registration phase`);
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
    vlm.info(`Skipped '${coloredYarnAdd}'.`, ...tellIfNoReconfigure);
    return true;
  }

  async function _configure () {
    while (yargv.reconfigure || !vlm.getToolsetsConfig()) {
      const choices = (vlm.getToolsetsConfig() ? ["Skip", "reconfigure"] : ["Configure"])
          .concat(["help", "quit"]);
      const answer = await vlm.inquire([{
        message: `${vlm.getToolsetsConfig() ? "Reconfigure" : "Configure"} repository with '${
            vlm.theme.command("vlm configure")}'?`,
        type: "list", name: "choice", default: choices[0], choices,
      }]);
      if (answer.choice === "Skip") break;
      if (answer.choice === "quit") return false;
      if (answer.choice === "help") {
        vlm.speak();
        vlm.speak(await vlm.invoke("configure", ["--show-introduction"]));
        vlm.speak();
        continue;
      }
      return vlm.invoke("configure", { reconfigure: yargv.reconfigure });
    }
    vlm.info("Skipped 'vlm configure'.", ...tellIfNoReconfigure);
    return true;
  }
};
