#!/usr/bin/env vlm

// 'build' first so tab-completion is instant. Everything else 'release' first so build and
// deploy commands get listed next to each other.
exports.vlm = { toolset: "@valos/type-opspace" };
exports.command = "build-release [toolsetGlob]";
exports.describe = "Build a new release of this opspace";
exports.introduction =
`This command prepares, builds and tests a new opspace release locally
without making external changes. This forms the first part of the
opspace deployment process. The second half is \`deploy-release\` which
performs the actual deployment process.

This command resolves a local 'releasePath' for the build and then
invokes all release-build sub-commands as follows:

vlm .release-build/\${toolsetGlob || "**/*"} --target=\${releasePath} \${rest}

These sub-commands (which can be local opspace commands or commands
provided by opspace toolset dependencies) then (re)build the actual
build artifacts under the target path.
`;

exports.builder = (yargs) => yargs.options({
  target: {
    type: "string", default: "dist/release",
    description: "Target release path for building the release"
  },
  source: {
    type: "string", default: "packages",
    description: "Relative lerna packages source directory for sourcing the packages"
  },
  force: {
    type: "boolean", description: "Allow the build of already deployed versions",
  },
  overwrite: {
    type: "boolean", description: "Allow overwrititing existing local build files",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const packageConfig = vlm.packageConfig;
  const releasePath = yargv.target;

  if (!yargv.overwrite && vlm.shell.test("-d", releasePath)) {
    if (packageConfig.version.indexOf("-prerelease") !== -1) {
      vlm.warn("Removing an existing prerelease build target:", vlm.theme.path(releasePath),
      // Carefully refers to how overwrite will remove target even for non-prerelease builds
          `(carefully provide '${vlm.theme.argument("--overwrite")}' to prevent remove)`);
      vlm.shell.rm("-rf", releasePath);
    } else {
      throw new Error(`build-release: existing build for non-prerelease version ${
        packageConfig.version} found at ${vlm.theme.path(releasePath)}. Bump the version number?`);
    }
  }

  vlm.shell.mkdir("-p", releasePath);

  vlm.info("Building version", vlm.theme.version(packageConfig.version), "of",
      vlm.theme.package(packageConfig.name), "into", vlm.theme.path(releasePath));

  vlm.releasePath = releasePath;

  return vlm.invoke(`.release-build/${yargv.toolsetGlob || "**/*"}`,
      [{ target: releasePath, force: yargv.force }, ...yargv._]);
};
