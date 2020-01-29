#!/usr/bin/env vlm

// 'assemble' first so tab-completion is instant. Everything else 'package' first so assemble and
// publish commands get listed next to each other.
exports.vlm = { toolset: "@valos/type-vault" };
exports.command = "assemble-packages [packageNameGlobs..]";
exports.describe = "Assemble all current modified vault packages (preparing for publish)";
exports.introduction =
`Uses lerna to handle the monorepo sub-packages update detection,
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
  "sibling-node-modules": {
    type: "string", default: true,
    description: "Create a node_modules which symlinks to the target as a sibling of the target.",
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
    type: "boolean", default: true,
    description: "Allow overwriting existing builds in the target directory",
  },
  "add-changed": {
    type: "boolean", default: true,
    description: `Add packages with committed changes since last release to the selection`,
  },
  "add-unchanged": {
    type: "boolean", default: false,
    description: "Add packages with no committed changes since last release to the selection",
  },
  "add-dirty": {
    type: "boolean", default: false,
    description: `Add packages that have non-committed local modifications to the selection`,
  },
  versioning: {
    type: "any", default: false, choices: [false, true, "amend"],
    description: `Bump the version, make a git commit and a git tag with ${
        yargs.vlm.theme.executable("lerna version")}.
'amend' will amend the most recent commit instead of creating a new one.`,
  },
  reassemble: {
    type: "boolean",
    description: `Reassembles packages with only dirty changes.
Causes --no-add-changed --add-dirty.`,
    causes: ["no-add-changed", "add-dirty"],
  },
  assemble: {
    type: "boolean", default: true,
    description: "Actually copy and transpile files to the target",
  },
  "post-execute": {
    type: "string", array: true,
    description: `A command to execute after the assembly of each package.
Replaces $ASSEMBLY_TARGET and $PACKAGE_NAME literals with their appropriate values.`,
  },
  "yalc-push": {
    type: "boolean",
    description: `Push assembled libraries to local yalc repository after assembly.
Causes --post-execute="cd $ASSEMBLY_TARGET && yalc push --no-pure --no-sig"`,
    causes: [`post-execute=cd $ASSEMBLY_TARGET && yalc push --no-pure --no-sig`],
  },
  "yalc-self": {
    type: "boolean",
    description: `yalc links assembled libraries to the local repository after assembly.
Note: --yalc-push should be manually provided before this option (causes are not transitive).
Causes --post-execute="yalc link --no-pure $PACKAGE_NAME"`,
    // FIXME(iridian, 2019-02): yalc-self should cause yalc-push but
    // causes are (quite inappropriately and surprisingly) not transitive yet.
    causes: [`post-execute=yalc link --no-pure $PACKAGE_NAME`],
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const publishDist = yargv.target;
  vlm.shell.mkdir("-p", publishDist);
  if (yargv["sibling-node-modules"]) {
    const target = vlm.path.join("./", publishDist.match(/\/([^/]*)$/)[1]);
    const link = vlm.path.join(publishDist.replace(/(\/[^/]*)$/, ""), "node_modules");
    vlm.info("Creating sibling node_modules symlink to", vlm.theme.path(target),
        "as symlink", vlm.theme.path(link));
    vlm.shell.ln("-sf", target, link);
  }
  const targetListing = vlm.shell.ls("-lA", publishDist);
  if (!yargv.overwrite && targetListing.length) {
    vlm.warn(`Target directory '${vlm.theme.path(publishDist)}' is not empty:`,
        targetListing.filter(f => f).map(f => f.name));
  }

  const requestGlobs = (yargv.packageNameGlobs || []).length ? yargv.packageNameGlobs : ["**/*"];

  const packageSelection = {};
  const addAll = yargv["add-changed"] && yargv["add-unchanged"];
  if (addAll) vlm.info("Adding all packages to initial selection.");
  else if (yargv["add-changed"] || yargv["add-unchanged"]) {
    if (yargv["add-changed"]) {
      vlm.info("Adding only changed packages to initial selection.");
    } else {
      vlm.info("Adding only unchanged packages to initial selection.");
    }
    try {
      const updatedPackages = await vlm.execute(
          `lerna changed --json --loglevel=silent`, { stdout: "json" });
      updatedPackages.forEach(p => {
        packageSelection[vlm.path.join(p.location, "/")]
            = (yargv["add-changed"] && "changed") || false;
      });
    } catch (error) {
      if (error.code !== 1) throw error;
      // Otherwise possibly no commit since last release.
    }
  }
  if (!addAll && yargv["add-dirty"]) {
    vlm.info("Adding dirty packages to initial selection.");
    (await vlm.execute(`git status --porcelain=v1`))
        .split("\n")
        .map(line => (line.match(new RegExp("^.M ([^/]*/[^/]*)/")) || [])[1])
        .forEach(subPath => subPath
              && (packageSelection[vlm.path.join(process.cwd(), subPath, "/")] = "dirty"));
  }
  let sourcePackageJSONPaths = vlm.shell.find("-l",
      vlm.path.join(yargv.source, "*/package.json"));
  if (!sourcePackageJSONPaths || !sourcePackageJSONPaths.length) sourcePackageJSONPaths = [];

  vlm.info("Limiting selection to package names matching:", vlm.theme.argument(...requestGlobs));

  let selections = sourcePackageJSONPaths.map(sourcePackageJSONPath => {
    const sourceDirectory = sourcePackageJSONPath.match(/^(.*)package.json$/)[1];
    const packagePath = vlm.path.join(process.cwd(), sourceDirectory);
    const selectionReason = packageSelection[packagePath];
    if (!addAll ? !selectionReason : selectionReason === false) return undefined;

    const packageJSONPath = vlm.path.join(packagePath, "package.json");
    // eslint-disable-next-line import/no-dynamic-require
    const packageConfig = require(packageJSONPath);
    const name = packageConfig.name;
    if (!requestGlobs.find(glob => vlm.minimatch(name, glob))) return undefined;
    const targetDirectory = vlm.path.join(publishDist, name);
    const ret = {
      name, sourceDirectory, selectionReason,
      packageJSONPath, packageConfig, targetDirectory, sourcePackageJSONPath,
    };
    if (vlm.shell.test("-d", targetDirectory)) ret.exists = true;
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
  if (!selections.length && !yargv.versioning) {
    vlm.warn("Assembly selection empty and no versioning requested, exiting");
    return {
      selectedAssemblies: selections.length, successfulAssemblies: 0, failedAssemblies: 0,
      success: true,
    };
  }
  vlm.info(`Selected ${vlm.theme.package(selections.length, "packages")} for assembly:\n\t`,
      ...selections.map(({ name }) => vlm.theme.package(name)));

  let assemblyErrors = 0;
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
            `an existing assembly found at '${vlm.theme.path(targetDirectory)
            }' (with --no-overwrite)`);
        selection.failure = "existing assembly found (with --no-overwrite)";
        ++assemblyErrors;
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
            { spawn: { env: { ...process.env, TARGET_ENV: yargv["babel-target-env"] } } });
        if (!String(result).match(/Successfully compiled/)) {
          selection.failure = "babel transpilation not successful";
          vlm.error(`${selection.failure} for ${vlm.theme.package(name)}`);
          continue;
        }
      }
      vlm.shell.rm("-rf", vlm.path.join(targetDirectory, "node_modules"));
      selection.assembled = true;
    }
    vlm.info(`${assemblyErrors || "No"} errors found during assembly`);
  }

  let oldVersion, newVersion;
  if (!yargv.versioning) {
    vlm.info(`${vlm.theme.argument("--no-versioning")} requested:`,
        `no version update, no git commit, no git tag, no ${vlm.theme.path("package.json")
        } finalizer copying`);
  } else {
    if (assemblyErrors) throw new Error("Errors found during assembly when trying to bump version");
    vlm.info("Updating version, making git commit, creating a lerna git tag and/or",
        `updating assembly target ${vlm.theme.path("package.json")}'s`);
    let lernaConfig = await vlm.tryReadFile("lerna.json");
    oldVersion = lernaConfig && JSON.parse(lernaConfig).version;
    await vlm.delegate([
      "lerna version", {
        "conventional-commits": true, amend: (yargv.versioning === "amend"), push: false, yes: true,
        ...(!selections.length ? {} : {
          "force-publish": selections.map(({ name }) => name).join(","),
        }),
      },
    ]);
    lernaConfig = await vlm.tryReadFile("lerna.json");
    newVersion = lernaConfig && JSON.parse(lernaConfig).version;
    if (!yargv.assemble && !yargv.overwrite) {
      vlm.info(`Skipping assembly target ${vlm.theme.path("package.json")} version updates`, "as",
          vlm.theme.argument(!yargv.assemble ? "--no-assemble" : "--no-overwrite"),
          "was specified");
    } else {
      vlm.info(`Updating version-updated ${vlm.theme.path("package.json")
          } to ${yargv.assemble ? "only successfully assembled " : "all selected "} packages`);
      selections.forEach(({ name, sourcePackageJSONPath, targetDirectory, assembled, failure }) => {
        if (failure) {
          vlm.warn(`Skipped copying updated '${vlm.theme.package(name)
              }' ${vlm.theme.path("package.json")} because of a previous failure: ${failure}`);
        } else if (sourcePackageJSONPath && (assembled || (!yargv.assemble && yargv.overwrite))) {
          vlm.shell.cp(sourcePackageJSONPath, targetDirectory);
        }
      });
    }
  }

  if ((yargv["post-execute"] || []).length) {
    selections.forEach(({ name, targetDirectory, failure }) => {
      if (failure) {
        vlm.info(`Skipping post-execute(s) '${
            yargv["post-execute"].map(exec => vlm.theme.executable(exec)).join("', '")}' for '${
          vlm.theme.package(name)}'`,
          `because of a previous failure: ${failure}`);
      } else {
        for (const postExecute of yargv["post-execute"]) {
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
  if (oldVersion) ret.oldVersion = oldVersion;
  if (newVersion) ret.version = newVersion;
  ret.assemblyBreakdown.push(...selections.map(
      ({ name, packageConfig, packageJSONPath, failure }) => {
    const newConfig = JSON.parse(vlm.shell.head({ "-n": 1000000 }, packageJSONPath));
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
    if (!ret.version) ret.version = ret.assemblyBreakdown[2].version;
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
