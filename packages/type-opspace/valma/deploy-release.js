#!/usr/bin/env vlm

// 'deploy' first so tab-completion is instant. Everything else 'release' first so build and
// deploy commands get listed next to each other.
exports.vlm = { toolset: "@valos/type-opspace" };
exports.command = "deploy-release [toolsetGlob]";
exports.describe = "Deploy previously built releases to their deployment targets";
exports.introduction =
`This command is second part of the two-part deployment with
build-release building the release.`;

exports.builder = (yargs) => yargs.options({
  source: {
    type: "string", default: "dist/release",
    description: `Source release path from where to deploy the releases. ${
        ""}Each release in this directory will be removed after a successful deployment.`,
  },
  prerelease: {
    type: "boolean", default: false,
    description: "allow prerelease deployments",
  }
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const packageConfig = vlm.packageConfig;
  const releasePath = yargv.source;

  if (!yargv.prerelease && (packageConfig.version.indexOf("-prerelease") !== -1)) {
    throw new Error(`deploy-release: cannot deploy a release with a '-prerelease' version${
        ""} (provide '--prerelease' option to override).`);
  }

  if (!vlm.shell.test("-d", releasePath)) {
    throw new Error(`deploy-release: cannot find a release build for version '${
        vlm.theme.version(packageConfig.version)}' version in "${
          vlm.theme.path(releasePath)}".`);
  }

  vlm.info(`Deploying ${vlm.theme.package(packageConfig.name)}@${
      vlm.theme.version(packageConfig.version)}`, "from", vlm.theme.path(releasePath));

  vlm.releasePath = yargv.source;

  return [].concat(...[].concat(await vlm.invoke(`.release-deploy/${yargv.toolsetGlob || "**/*"}`,
      [{ source: releasePath }, ...yargv._]))).filter(e => (e !== undefined));
};
