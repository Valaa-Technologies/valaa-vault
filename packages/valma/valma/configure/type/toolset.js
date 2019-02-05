exports.command = ".configure/.type/toolset";
exports.describe = "Configure a Valma toolset repository";
exports.introduction = `${exports.describe}.

A valma toolset is a package which provides various resources for
a depending repository with the ability to have repository specific
configurations in their 'toolsets.json'.
These resources might be new valma commands, file templates,
dependencies to other valma toolsets and tools, to external tools or
to plain javascript libraries; anything that can be expressed in a
package really.

The defining quality of a toolset is its ability to have repository
specific configuration which all toolset commands and even other
javascript files can access to customize their behaviour. Additionally
toolsets appear in configuration listings and can be selectively
enabled or disabled on a repository.

A valma toolsets are added as regular devDependencies and configured
by running 'vlm configure' afterwards.`;

exports.disabled = (yargs) => !yargs.vlm.getPackageConfig("valaa");
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'toolset' type configurations of this repository.",
  },
  restrict: {
    type: "string",
    description: `Restrict this toolset to a particular valaa type (clear for no restriction):`,
    default: yargs.vlm.packageConfig.valaa.domain,
    interactive: { type: "input", when: "always" /* : "if-undefined" */ },
  },
  grabbable: {
    type: "boolean",
    description: `Make this toolset grabbable and stowable (falsy for always-on):`,
    default: true,
    interactive: { type: "confirm", when: "always" /* : "if-undefined" */ },
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const simpleName = vlm.packageConfig.name.match(/([^/]*)$/)[1];
  const commandName = `.configure/${yargv.restrict ? `.type/.${yargv.restrict}/` : ""}${
    yargv.grabbable ? ".toolset/" : ""}${vlm.packageConfig.name}`;
  await vlm.invoke("create-command", [{
    filename: `configure__${yargv.restrict ? yargv.restrict : ""}${
        yargv.grabbable ? "_toolset_" : "_"}_${simpleName}.js`,
    export: true, skeleton: true,
    brief: "toolset configure",
    "exports-vlm": `{ toolset: "${vlm.packageConfig.name}" }`,
    describe: `Configure the toolset '${simpleName}' for the current ${
        yargv.restrict || "repository"}`,

    introduction: yargv.restrict
        ?
`This script makes the toolset '${simpleName}' available for
grabbing by repositories with valaa type '${yargv.restrict}'.`
        :
`This script makes the toolset ${simpleName} available for
grabbing by all repositories.`,

    disabled: `(yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")`,
    builder: `(yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure '${simpleName}' configurations of this repository.",
  },
})`,
  }, commandName]);
  return vlm.invoke(`.configure/.type/.toolset/**/*`, { reconfigure: yargv.reconfigure });
};
