#!/usr/bin/env vlm

// 'publish' first so tab-completion is instant. Everything else 'package' first so assemble and
// publish commands get listed next to each other.
exports.vlm = { toolset: "@valos/toolset-vault" };
exports.command = "publish-packages";
exports.describe = "Publish package assemblies to their registries";
exports.introduction = `${exports.describe}.`;

exports.builder = (yargs) => yargs.options({
  source: {
    type: "string", default: "dist/packages",
    description: `Source directory for the package assemblies that are to be published.`
  },
  "delete-published": {
    type: "boolean", default: true,
    description: `Delete successfully published package assemblies.`,
  },
  publisher: {
    type: "string", default: "npm",
    description: `The command used to publish individual packages assemblies.`,
  },
  tag: {
    type: "string",
    description: `A --tag option which is forwarded to the publisher command.`,
  },
});

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  const assemblyGlobs = yargv._.length ? yargv._ : [""];
  const assemblyPaths = assemblyGlobs.reduce((paths, glob) => {
    const pathListing = vlm.shell.find(vlm.path.join(
        yargv.source, !glob ? "**" : vlm.path.join("**", glob, "**"), "package.json"));
    return pathListing.code ? paths : paths.concat(
        ...pathListing.map(p => !p.includes("node_modules") && p.match(/(.*)\/package.json/)[1])
            .filter(p => p && !paths.includes(p)));
  }, []);
  if (yargv.publisher) {
    const nameRegex = new RegExp(`^${yargv.source}/(.*)$`);
    vlm.info(`Publishing ${assemblyPaths.length} package assemblies (via globs '${
            vlm.theme.argument(assemblyGlobs.join("', '"))}') using '${
            vlm.theme.executable(yargv.publisher)}':\n\t`,
        vlm.theme.package(...assemblyPaths.map(p => p.match(nameRegex)[1])));
    for (const packagePath of assemblyPaths) {
      const executable = `${yargv.publisher} publish ${
        yargv.tag ? `--tag ${yargv.tag} ` : ""}${packagePath}`;
      const publishResult = vlm.shell.exec(executable);
      if (!publishResult.code && packagePath) {
        vlm.info(`Successfully published with '${vlm.theme.executable(executable)}'`);
        if (yargv.deletePublished) {
          vlm.info("\tremoving the package assembly");
          vlm.shell.rm("-rf", packagePath);
        }
      } else {
        vlm.error(`Error during '${vlm.theme.executable(executable)}':`,
            publishResult.code, publishResult);
      }
    }
  }
};
