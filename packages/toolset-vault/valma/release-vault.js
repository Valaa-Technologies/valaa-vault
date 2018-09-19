#!/usr/bin/env vlm

exports.command = "release-vault";
exports.describe = "Transforms the current prerelease branch into a release branch";
exports.introduction = `${exports.describe}.

If --publish is not explicitly given the final publish step must be
manually performed by a DevOp. In this case pre-publish phase is done
instead which prepares publish command instructions in the results
output.
`;

exports.disabled = (yargs) => !yargs.vlm.packageConfig;
exports.builder = (yargs) => yargs.options({
  "allow-dirty": {
    type: "boolean",
    description: "Allows a dirty repository to be released"
  },
  reinstall: {
    type: "boolean", default: true,
    description: "Cleans and reinstalls all dependencies",
  },
  unlock: {
    type: "boolean", default: true,
    description: "Removes ./yarn.lock and updates dependency versions as part of the reinstall",
    requires: ["reinstall"],
  },
  "clean-dist": {
    type: "boolean", default: true,
    description:
        "Removes ./dist/ . If disabled then dist/{packages,release} must be manually emptied",
    requires: ["reinstall"],
  },
  test: {
    type: "string", array: true, default: ["all"], choices: ["all", "jest", "lint", false],
    description: "Run test schemes matching these selectors, or all tests if 'all' is specified",
  },
  "allow-unchanged": {
    type: "boolean", default: true,
    description: "Assembles unchanged packages too (see 'vlm assemble-packages --allow-unchanged')",
  },
  publish: {
    type: "boolean",
    description: "Publish the repository files and packages to their upstreams.",
  },
});

exports.handler = async (yargv) => {
  // Example template which displays the command name itself and package name where it is ran
  // Only enabled inside package
  const vlm = yargv.vlm;
  const ret = {};
  ret.preparation = await _prepare();
  vlm.info("Release preparation phase", ret.preparation.success
      ? vlm.theme.success("successful") : vlm.theme.failure("FAILED"),
          "for version", vlm.theme.version(ret.preparation.version));
  ret.commit = await _commit(ret.preparation);
  vlm.info("Release commit phase", ret.commit.success
      ? vlm.theme.success("successful") : vlm.theme.failure("FAILED"),
          "for release branch", vlm.theme.name(ret.preparation.releaseBranch));
  if (!yargv.publish) {
    ret.prePublish = await _prePublish(ret.preparation, ret.commit);
    vlm.info("Release pre-publish phase", ret.prePublish.success
        ? vlm.theme.success("successful") : vlm.theme.failure("FAILED"),
          "see result output for more details");
  } else {
    ret.publish = await _publish(ret.preparation, ret.commit);
    vlm.info("Release publish phase", ret.publish.success
        ? vlm.theme.success("successful") : vlm.theme.failure("FAILED"));
  }
  ret.success = ret.preparation.success && ret.commit.success
      && (ret.prePublish || ret.publish).success;
  return ret;

  async function _prepare () {
    const preparation = { "...": { indexAfter: "" } };
    const prereleases = (await vlm.delegate("git branch --list --no-color prerelease/*"))
        .split("\n").filter(b => !b.match(/^\s*$/));
    if (!prereleases.length) throw new Error("Can't find a prerelease/* git branch");
    if (prereleases.length > 1) {
      throw new Error("Too many prerelease/* branches, only one allowed");
    }
    const [, isCurrent, , branchVersionSuffix] =
        prereleases[0].match(/^((\* )| {2})prerelease\/([0-9.]*)$/);
    // Only accept <MAJOR>(.<MINOR>)?(.<PATCH>)? formatted prerelease branches.
    preparation.version = branchVersionSuffix.match(/^([0-9]*)\.?([0-9]*)?\.?(0-9*)?$/)
        .slice(1).map(v => (v || "0")).join(".");
    preparation.branchVersionSuffix = branchVersionSuffix;
    preparation.prereleaseBranch = `prerelease/${branchVersionSuffix}`;
    preparation.releaseBranch = `release/${branchVersionSuffix}`;
    const matchingRelease =
        (await vlm.delegate(`git branch --list --no-color ${preparation.releaseBranch}`))
        .split("\n").filter(b => !b.match(/^\s*$/));
    if (matchingRelease.length) {
      throw new Error(`A ${preparation.releaseBranch} branch already exists`);
    }

    const isDirty = (await vlm.delegate("git status -s"))
        .split("\n").filter(b => !b.match(/^\s*$/)).length;
    if (isDirty && !yargv["allow-dirty"]) {
      throw new Error(`Repository is dirty with modified and/or untracked files ${
          ""} and --allow-dirty was not specified. See 'git status'`);
    }

    if (!isCurrent) {
      vlm.warn("Current branch is not the prerelease branch.");
      if (!await vlm.inquireConfirm(
          `run ${vlm.theme.executable(`git checkout ${preparation.prereleaseBranch}`)
              } (abort otherwise)?`)) {
        throw new Error("Aborted");
      }
      await vlm.delegate(`git checkout ${preparation.prereleaseBranch}`);
      preparation.prerelease_checkout = true;
    }

    preparation.lernaConfig = require(vlm.path.join(process.cwd(), "lerna.json"));

    preparation["vlm clean-vault"] = !yargv.reinstall ? "skipped"
        : await vlm.invoke("clean-vault",
            { yes: true, yarn: yargv.unlock, dist: yargv["clean-dist"], install: true });

    const runAllTests = yargv.test.includes("all");
    preparation.success = true; // maybe...
    if (!yargv.test[0]) {
      preparation.tests = "skipped";
    } else {
      preparation.tests = {};
      for (const name of Object.keys(tests)) {
        if (runAllTests || yargv.test.includes(name)) {
          preparation.tests[name] = tests[name](vlm);
        }
      }
      for (const name of Object.keys(preparation.tests)) {
        try {
          preparation.tests[name] = await preparation.tests[name];
          if (!preparation.tests[name].success) preparation.success = false; // ...or maybe not
        } catch (error) {
          if (error.stderr) vlm.error(error.stderr);
          throw error;
        }
      }
    }
    preparation["..."].heading = `Release preparation ${
        preparation.success ? "successful" : "FAILED"}: gathered config files and test results`;
    return preparation;
  }

  async function _commit ({ version, releaseBranch, lernaConfig, success }) {
    const commit = { "...": { indexAfter: "preparation" } };
    if (!success) {
      commit.skipped = "preparation phase failed";
      commit["..."].heading = `Release commit skipped: ${commit.skipped}`;
      return commit;
    }
    await vlm.delegate(`git checkout -b ${releaseBranch}`);
    commit.releaseBranchCreated = releaseBranch;

    commit.lernaConfig = JSON.parse(JSON.stringify(lernaConfig));
    commit.lernaConfig.command.version.bump = "patch";
    commit.lernaConfig.command.version.preid = "";
    commit.lernaConfig.command.version.allowBranch = releaseBranch;
    vlm.shell.ShellString(JSON.stringify(commit.lernaConfig, null, 2)).to("./lerna.json");
    await vlm.updatePackageConfig({ version });
    await vlm.delegate(`git add lerna.json yarn.lock package.json`);
    await vlm.delegate(`git commit -m v${version}`);

    commit["vlm assemble-packages"] = await vlm.invoke(
        "assemble-packages", { "allow-unchanged": yargv["allow-unchanged"], versioning: "amend" });
    commit.success = commit["vlm assemble-packages"].success;
    if (commit.success) {
      try {
        await vlm.delegate(`git checkout master`);
        await vlm.delegate(`git merge --ff-only ${releaseBranch}`);
      } catch (error) {
        commit.success = false;
        vlm.error(`failed to fast-forward master to ${releaseBranch}, aborting:`,
            `setting current git branch to ${releaseBranch} for diagnostics`);
        throw error;
      } finally {
        await vlm.delegate(`git checkout ${releaseBranch}`);
      }
    }
    commit["..."].heading = `Release commit ${commit.success ? "successful" : "FAILED"
        }: changes to local git and prepared publishables under dist/`;
    return commit;
  }

  async function _prePublish ({ releaseBranch, prereleaseBranch, success },
      { success: commitSuccess }) {
    if (!success || !commitSuccess) {
      const reason = `${!success ? "preparation" : "commit"} phase failed`;
      return {
        "...": { indexAfter: "commit", heading: `Release pre-publish skipped: ${reason}` },
        skipped: reason,
      };
    }
    const filesCommand = `git push --tags origin master ${releaseBranch} :${prereleaseBranch}`;
    const deletePrerelease = `git branch -d ${prereleaseBranch}`;
    return {
      "...": { indexAfter: "commit",
        heading: "Release pre-publish successful: commands for manual publish prepared",
        keyText: "target", valueText: "command",
      },
      success: true,
      files: vlm.theme.executable(filesCommand),
      packages: `${vlm.theme.executable("vlm")} ${vlm.theme.command("publish-packages")}`,
      deletePrerelease: vlm.theme.executable(deletePrerelease),
    };
  }

  async function _publish ({ releaseBranch, prereleaseBranch, success },
      { success: commitSuccess }) {
    if (!success || !commitSuccess) {
      const reason = `${!success ? "preparation" : "commit"} phase failed`;
      return {
        "...": { indexAfter: "commit", heading: `Release publish skipped: ${reason}` },
        skipped: reason,
      };
    }
    const publish = { "...": { indexAfter: "commit" } };
    publish.files = await vlm.execute(
        `git push --tags origin master ${releaseBranch} :${prereleaseBranch}`);
    publish.packages = await vlm.invoke("publish-packages");
    publish.success = true;
    publish["..."].heading = `Release publish ${publish.success ? "successful" : "FAILED"
        }: changes published to upstream(s)`;
    await vlm.delegate(`git branch -d ${prereleaseBranch}`);
    publish.prereleaseBranchDeleted = prereleaseBranch;
    return publish;
  }
};

const tests = {
  async jest (vlm) {
    let result;
    try {
      result = await vlm.delegate(["jest", { json: true, colors: true }],
          { stdout: "json", stderr: "erroronly" });
    } catch (error) {
      if (typeof error.stdout !== "object") throw error;
      result = error.stdout;
    }
    const ret = {
      success: result.success,
      passedSuites: result.numPassedTestSuites,
      passedTests: result.numPassedTests,
      failedSuites: result.numFailedTestSuites,
      failedTests: result.numFailedTests,
    };
    const failedSuiteBreakdown = result.testResults.reduce((suites, suite) => {
      if (suite.status !== "passed") {
        suites[suite.name] = {
          message: suite.message,
          summary: suite.summary,
        };
      }
      return suites;
    }, {});
    if (Object.keys(failedSuiteBreakdown).length) ret.failedSuiteBreakdown = failedSuiteBreakdown;
    return ret;
  },
  async lint (vlm) {
    let result;
    try {
      result = await vlm.delegate(["eslint .", { format: "json" }],
          { stdout: "json", stderr: "erroronly" });
    } catch (error) {
      if (typeof error.stdout !== "object") throw error;
      result = error.stdout;
    }
    const ret = { success: true, passedFiles: 0, failedFiles: 0 };
    const failedFileBreakdown = result.reduce((breakdown, file) => {
      if (!file.errorCount) {
        ++ret.passedFiles;
      } else {
        ++ret.failedFiles;
        breakdown[file.filePath] = {
          errorCount: file.errorCount,
          warningCount: file.warningCount,
          messageCount: file.messages.length,
        };
      }
      return breakdown;
    }, {});
    if (Object.keys(failedFileBreakdown).length) {
      ret.success = false;
      ret.failedFileBreakdown = failedFileBreakdown;
    }
    return ret;
  },
};
