#!/usr/bin/env vlm

// 'assemble' first so tab-completion is instant. Everything else 'package' first so assemble and
// publish commands get listed next to each other.
exports.vlm = { toolset: "@valos/toolset-vault" };
exports.command = "assemble-packages [packageNameGlobs..]";
exports.describe = "Assemble all current modified vault packages (preparing for publish)";
exports.introduction = `${exports.describe}.

Uses lerna to handle the monorepo sub-packages update detection,
versioning, and git interactions. Configuration for lerna is in
lerna.json: notably the version increase semantics is configured there.

Lerna is not used for constructing the actual packages. This is done by
a flat recursive cp to the target at the moment.

Invokes babel for all projects with babel.config.js in their root. If
the vault has a shared babel.config.js for all packages, a symlink from
this root to each project should be created.

When assembling lerna will automatically update the shared version for
all packages and their cross-dependencies and make a git commit and git
tag for the new version.
This behaviour can be omitted with --no-versioning.

  Iterative development with yalc and publish-packages:

Once a set of packages has been been built to the target, run:

'vlm publish-packages --publisher=yalc'

This will make the package assemblies available in a local yalc
'registry'; see https://github.com/whitecolor/yalc for more details on
how to use such packages by other depending packages. Reassembling
and pushing those changes through yalc to dependents can be done with:

'vlm assemble-packages --reassemble --post-execute="cd $ASSEMBLY_TARGET && yalc push --no-sig"'

This allows packages to be developed iteratively locally while having
other packages depend and be tested against them.
`;

exports.builder = (yargs) => yargs.options({
  target: {
    type: "string", default: "dist/packages",
    description: "Target directory for building the packages (must be empty or not exist)",
  },
  source: {
    type: "string", default: "packages",
    description: "Source packages directory. Must match one lerna.json entry.",
  },
  "babel-target-env": {
    type: "string", default: "package-assemble",
    description: "TARGET_ENV environment variable for the babel builds"
        + " (used for packages with babel configuration in their root)",
  },
  overwrite: {
    type: "boolean",
    description: "Allow overwriting existing builds in the target directory",
  },
  "only-pending": {
    type: "boolean",
    description: `Limit the selection to packages currently existing in the target directory.
Causes --overwrite`,
    causes: ["overwrite"],
  },
  "allow-unchanged": {
    type: "boolean",
    description: "Allows unchanged packages in the selection (default is to exclude them)",
  },
  versioning: {
    type: "any", default: true, choices: [false, true, "amend"],
    description: `Bump the version, make a git commit and a git tag with ${
        yargs.vlm.theme.executable("lerna version")}.
'amend' will amend the most recent commit instead of creating a new one.`,
  },
  assemble: {
    type: "boolean", default: true,
    description: "Actually copy and transpile files to the target",
  },
  reassemble: {
    type: "boolean",
    description: `Reassembles packages pending publication.
Causes --only-pending --overwrite --no-versioning.`,
    causes: ["only-pending", "overwrite", "no-versioning"],
  },
  "post-execute": {
    type: "string", array: true,
    description: `A command to execute after the assembly of each package.
Replaces $ASSEMBLY_TARGET and $PACKAGE_NAME literals with their appropriate values.`,
  },
  "yalc-push": {
    type: "boolean",
    description: `Push assembled libraries to local yalc repository after assembly.
Causes --post-execute="cd $ASSEMBLY_TARGET && yalc push --no-sig"`,
    causes: [`post-execute=cd $ASSEMBLY_TARGET && yalc push --no-sig`],
  },
  "yalc-link": {
    type: "boolean",
    description: `Links assembled libraries from local yalc repository after assembly.
Note: provide --yalc-push before this manually as causes are not transitive yet.
Causes --post-execute="yalc link $PACKAGE_NAME"`,
    // FIXME(iridian, 2019-02): yalc-link should cause yalc-push but
    // causes are (quite inappropriately and surprisingly) not transitive yet.
    causes: [`post-execute=yalc link $PACKAGE_NAME`],
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const publishDist = yargv.target;
  vlm.shell.mkdir("-p", publishDist);
  const targetListing = vlm.shell.ls("-lA", publishDist);
  if (!yargv.overwrite && targetListing.length) {
    vlm.warn(`Target directory '${vlm.theme.path(publishDist)}' is not empty:`,
        targetListing.filter(f => f).map(f => f.name));
  }

  const requestGlobs = (yargv.packageNameGlobs || []).length ? yargv.packageNameGlobs : ["**/*"];
  let updatedPackageNames;
  vlm.info("Selecting packages matching:", vlm.theme.argument(...requestGlobs));
  if (!yargv.allowUnchanged) {
    vlm.info("Limiting the package selection to only the updated packages:");
    const updatedPackages = vlm.shell.exec(`npx -c "lerna changed --json --loglevel=silent"`);
    if (updatedPackages.code) {
      vlm.warn("No updated packages found, exiting",
          `(or lerna error with code ${vlm.theme.warning(updatedPackages.code)}`);
      return false;
    }
    updatedPackageNames = JSON.parse(updatedPackages).map(p => p.name);
  }
  const sourcePackageJSONPaths = vlm.shell.find("-l",
      vlm.path.join(yargv.source, "*/package.json"));

  let selections = sourcePackageJSONPaths.map(sourcePackageJSONPath => {
    const sourceDirectory = sourcePackageJSONPath.match(/^(.*)package.json$/)[1];
    const packagePath = vlm.path.join(process.cwd(), sourceDirectory, "package.json");
    // eslint-disable-next-line import/no-dynamic-require
    const packageConfig = require(packagePath);
    const name = packageConfig.name;
    const targetDirectory = vlm.path.join(publishDist, name);
    const ret = {
      name, sourceDirectory, packagePath, packageConfig, targetDirectory, sourcePackageJSONPath,
    };
    if (!(yargv.allowUnchanged || yargv.onlyPending)
        && !updatedPackageNames.includes(name)) return undefined;
    if (!requestGlobs.find(glob => vlm.minimatch(name, glob))) return undefined;
    if (vlm.shell.test("-d", targetDirectory)) {
      ret.exists = true;
    } else if (yargv.onlyPending) return undefined;
    if (packageConfig.private) {
      vlm.warn(`Skipping private package '${vlm.theme.package(name)}'`);
      ret.failure = "private package";
    }
    return ret;
  });
  {
    const orderedSelections = [];
    requestGlobs.forEach(glob => orderedSelections.push(...selections.filter(
        entry => entry && !orderedSelections.includes(entry) && vlm.minimatch(entry.name, glob))));
    selections = orderedSelections;
  }
  vlm.info(`Selected ${vlm.theme.package(selections.length, "packages")} for assembly:\n\t`,
      ...selections.map(({ name }) => vlm.theme.package(name)));

  if (!yargv.assemble) {
    vlm.info(`${vlm.theme.argument("--no-assemble")} requested`,
        "skipping the assembly of", selections.length, "packages");
  } else {
    let defaultNPMIgnore = vlm.path.resolve(".npmignore");
    if (!vlm.shell.test("-f", defaultNPMIgnore)) defaultNPMIgnore = null;

    for (const selection of selections) {
      const { name, sourceDirectory, targetDirectory, exists, failure } = selection;
      if (failure) continue;
      if (exists && !yargv.overwrite) {
        vlm.error(`Cannot assemble package '${vlm.theme.package(name)}'`,
            `an existing assembly exists at '${vlm.theme.path(targetDirectory)
            }' and no --overwrite is specified)`);
        selection.failure = "pending assembly found";
        continue;
      }

      vlm.info(`Assembling package '${vlm.theme.package(name)}'`, "into", targetDirectory);
      if (yargv.overwrite) vlm.shell.rm("-rf", targetDirectory);
      // TODO(iridian): The whole assembly process should maybe delegated to one of the gazillion
      // existing package dist solutions.
      vlm.shell.mkdir("-p", targetDirectory);
      vlm.shell.cp("-R", vlm.path.join(sourceDirectory, "*"), targetDirectory);
      if (defaultNPMIgnore && !vlm.shell.test("-f", vlm.path.join(targetDirectory, ".npmignore"))) {
        vlm.shell.cp(defaultNPMIgnore, targetDirectory);
      }
      if (vlm.shell.test("-f", vlm.path.join(sourceDirectory, "babel.config.js"))) {
        const result = await vlm.delegate(`babel ${sourceDirectory} --out-dir ${targetDirectory}`,
            { spawn: { env: { ...process.env, TARGET_ENV: yargv.babelTargetEnv } } });
        if (!String(result).match(/Successfully compiled/)) {
          selection.failure = "babel transpilation not successful";
          vlm.error(`${selection.failure} for ${vlm.theme.package(name)}`);
          continue;
        }
      }
      vlm.shell.rm("-rf", vlm.path.join(targetDirectory, "node_modules"));
      selection.assembled = true;
    }
    vlm.info("No catastrophic errors during assembly");
  }

  if (!yargv.versioning) {
    vlm.info(`${vlm.theme.argument("--no-versioning")} requested:`,
        `no version update, no git commit, no git tag, no ${vlm.theme.path("package.json")
        } finalizer copying`);
  } else {
    vlm.info("Updating version, making git commit, creating a lerna git tag and",
        `updating target ${vlm.theme.path("package.json")}'s`);
    await vlm.delegate([
      "lerna version", {
        "conventional-commits": true, amend: (yargv.versioning === "amend"), push: false, yes: true,
        "force-publish": selections.map(({ name }) => name).join(","),
      },
    ]);
    if (!yargv.assemble && (!yargv.overwrite || !yargv.onlyPending)) {
      vlm.info(`Skipping ${vlm.theme.path("package.json")} version updates`, "as",
          vlm.theme.argument(yargv.assemble ? "--no-assemble"
              : !yargv.overwrite ? "--no-overwrite" : "--no-only-pending"),
          "was specified");
    } else {
      vlm.info(`Updating version-updated ${vlm.theme.path("package.json")} to assembled packages`);
      selections.forEach(({ name, sourcePackageJSONPath, targetDirectory, assembled }) => {
        if (!sourcePackageJSONPath) return;
        if (assembled || (!yargv.assemble && yargv.overwrite && yargv.onlyPending)) {
          vlm.shell.cp(sourcePackageJSONPath, targetDirectory);
          return;
        }
        if (!yargv.overwrite || !yargv.onlyPending || yargv.assemble) {
          vlm.warn(`Skipped copying updated '${vlm.theme.package(name)
                  }' ${vlm.theme.path("package.json")} to non-assembled package as`,
              vlm.theme.argument(...(yargv.assemble ? ["--assemble"] : []),
                  ...(!yargv.overwrite ? ["--no-overwrite"] : []),
                  ...(!yargv.onlyPending ? ["--no-only-pending"] : [])),
              "was specified");
        }
      });
    }
  }

  if ((yargv.postExecute || []).length) {
    selections.forEach(({ name, targetDirectory, assembled }) => {
      if (!assembled && yargv.assemble) {
        vlm.info(`Skipping post-execute(s) '${
            yargv.postExecute.map(exec => vlm.theme.executable(exec)).join("', '")}' for '${
          vlm.theme.package(name)}'`,
          `assembly was requested but not successful for this package`);
      } else {
        for (const postExecute of yargv.postExecute) {
          const command = postExecute
              .replace(/\$ASSEMBLY_TARGET/g, targetDirectory)
              .replace(/\$PACKAGE_NAME/g, name);
          vlm.info(`${vlm.theme.argument("--post-execute")} requested:`,
              `${vlm.theme.path(targetDirectory)}$`, vlm.theme.executable(command));
          vlm.shell.exec(command);
        }
      }
    });
  }

  const ret = {
    selectedAssemblies: selections.length,
    successfulAssemblies: 0,
    failedAssemblies: 0,
    assemblyBreakdown: ["...", {
      heading: process.argv.slice(1),
      columns: [
        ["package", { style: "package" }],
        ["status", { headerStyle: ["bold", "white"], style: "green" }],
        ["resolution", { headerStyle: ["bold", "white"], style: { matches: [
          ["updated", "success"],
          ["kept at ", "failure"],
          ["", ["bold", "yellow"]],
        ], }, }],
        ["version", { headerStyle: ["bold", "white", "version"], style: "version" }],
        ["original", { headerStyle: ["bold", "white", "version"], style: "version" }],
      ],
    }],
    success: false,
  };
  ret.assemblyBreakdown.push(...selections.map(({ name, packageConfig, packagePath, failure }) => {
    const newConfig = JSON.parse(vlm.shell.head({ "-n": 1000000 }, packagePath));
    if (!failure) ++ret.successfulAssemblies;
    else ++ret.failedAssemblies;
    const result = {
      package: name,
      status: failure ? "failed" : "success",
      resolution: failure ? "kept at " // <- note the space, it's a kludge to color red.
          : (newConfig.version === packageConfig.version) ? "kept at" // <- no space
          : yargv.versioning ? "updated"
          : "unexpectedly updated",
      version: newConfig.version,
    };
    if (newConfig.version !== packageConfig.version) result.original = packageConfig.version;
    return result;
  }));
  if (ret.successfulAssemblies === ret.selectedAssemblies) {
    ret.success = true;
    // TODO(iridian): This is less than ideal way to determine the released version. We should be
    // able to get it from lerna directly somehow.
    ret.version = ret.assemblyBreakdown[2].version;
    vlm.info(vlm.theme.green(`Successfully assembled all packages`), "out of",
        ret.selectedAssemblies, "selected packages");
  } else if (!ret.successfulAssemblies) {
    vlm.error(`Failed to assemble any of the ${ret.selectedAssemblies} selected packages`);
  } else {
    vlm.warn(`Partially assembled only ${ret.successfulAssemblies} out of the ${
        ret.selectedAssemblies} selected packages`);
  }
  return ret;
};
