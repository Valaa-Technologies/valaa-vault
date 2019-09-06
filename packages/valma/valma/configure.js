#!/usr/bin/env vlm

exports.command = "configure [toolsetGlob]";
exports.describe = "Configure the current ValOS workspace and its toolsets";
exports.introduction =
`Allows grabbing and stowing of available toolsets and their tools and
then invokes all in-use toolset configure commands.`;

exports.disabled = (yargs) => !yargs.vlm.getValOSConfig()
    && "No package.json valos stanza found (run 'vlm init')";
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all config of this workspace.",
  },
  domain: {
    type: "boolean", default: true,
    description: "(re)configure all domain settings.",
  },
  type: {
    type: "boolean", default: true,
    description: "(re)configure all type settings.",
  },
  breakdown: {
    type: "boolean", description: "Show full breakdown of the init process even if successful.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  vlm.reconfigure = yargv.reconfigure;
  const valos = vlm.getValOSConfig();
  if (!valos || !valos.type || !valos.domain) {
    throw new Error("valma-configure: current directory is not a valos workspace; "
        + "no package.json with valos stanza with both type and domain set"
        + "(maybe run 'vlm init' to initialize?)");
  }
  if (!vlm.getToolsetsConfig()) vlm.updateToolsetsConfig({});
  const rest = [{ reconfigure: yargv.reconfigure }, ...yargv._];

  const ret = {
    success: false,
    domain: !yargv.domain ? [] : [await vlm.invoke(`.configure/.domain/${valos.domain}`, rest)],
    type: !yargv.type ? [] : [await vlm.invoke(`.configure/.type/${valos.type}`, rest)],
  };
  Object.assign(ret, await updateResultSideEffects(vlm, ret.domain[0], ret.type[0]));
  if (ret.success === false) return ret;

  if (yargv.domain) {
    ret.domain.push(...await vlm.invoke(`.configure/.domain/.${valos.domain}/**/*`, rest));
  }
  if (yargv.type) {
    ret.type.push(...await vlm.invoke(`.configure/.type/.${valos.type}/**/*`, rest));
  }
  Object.assign(ret, await updateResultSideEffects(
      vlm, ...ret.domain.slice(1), ...ret.type.slice(1)));
  if (ret.success === false) return ret;

  if (!yargv.toolsetGlob) {
    ret.selectToolsets = await vlm.invoke(`.configure/.select-toolsets`, rest);
    if (ret.selectToolsets.success === false) ret.success = false;
  } else {
    ret.toolsetsConfigures = await vlm.invoke(
        `.configure/{.domain/.${valos.domain}/,.type/.${valos.type}/,}.toolset/${
          yargv.toolsetGlob || ""}{*/**/,}*`,
        rest);
    Object.assign(ret, await updateResultSideEffects(vlm, ...ret.toolsetsConfigures));
  }
  return yargv.breakdown || (ret.success === false) ? ret : { success: ret.success };
};

exports.updateResultSideEffects = updateResultSideEffects;
exports.yarnAddNewDevDependencies = yarnAddNewDevDependencies;

async function updateResultSideEffects (vlm, ...results) {
  const resultBreakdown = {};

  const devDependencies = Object.assign({}, ...results.map(r => (r || {}).devDependencies || {}));
  const newDevDependencies = await yarnAddNewDevDependencies(vlm, devDependencies);
  if (newDevDependencies) resultBreakdown.newDevDependencies = newDevDependencies;

  results.forEach(r => (r || {}).toolsetsUpdate && vlm.updateToolsetsConfig(r.toolsetsUpdate));
  resultBreakdown.success = results.reduce((a, r) => a && ((r || {}).success !== false), true);
  return resultBreakdown;
}

async function yarnAddNewDevDependencies (vlm, candidateDevDependencies) {
  const { valos, dependencies, devDependencies } = vlm.packageConfig;
  const newDevDependencies = Object.entries(candidateDevDependencies)
      .filter(([name, newVersion]) => {
        if (!newVersion) return false;
        const currentVersion = (dependencies || {})[name] || (devDependencies || {})[name];
        if (!currentVersion) return true;
        if (newVersion === true) return false;
        return newVersion !== currentVersion;
      })
      .map(([name, newVersion]) => (newVersion === true ? name : `${name}@${newVersion}`));
  if (!newDevDependencies.length) return undefined;
  await vlm.interact([`yarn add --dev${valos.type === "vault" ? [" -W"] : ""}`,
      ...newDevDependencies]);
  return newDevDependencies;
}
