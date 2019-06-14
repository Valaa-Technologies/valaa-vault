#!/usr/bin/env vlm

exports.command = "release-vault";
exports.describe = "Prepares, commits and potentially publishes a new release";
exports.introduction = `${exports.describe}.

Based on given options and current environment will create a new
release/prerelease branch or extend an existing one.

Prepares the release by first running sanity checks, then cleaning and
reinstalling intermediate files like node_modules, yarn workspaces,
yarn.lock and dist/ and finally requires all test suites and lint to
pass without errors.

Once preparation is done creates a new release commit and tag using
'lerna version'.

If --publish is not explicitly given then the final publish step must
be manually performed. In this case a pre-publish phase is done which
prepares the manual publish command instructions in the results output.
`;

const cleanDefault = Object.freeze({ yes: true, yarn: true, install: true, dist: true });
const assembleDefault = Object.freeze({ "add-unchanged": true });

exports.disabled = (yargs) => !yargs.vlm.packageConfig && "No package.json found";
exports.builder = (yargs) => yargs.options({
  clean: {
    group: "Active options",
    type: "any", default: Object.assign({}, cleanDefault),
    description: `Clean and reinstall intermediate files with '${
        yargs.vlm.theme.command("clean-vault")}'`,
  },
  test: {
    group: "Active options",
    type: "string", array: true, default: ["*"], choices: ["*", "jest", "lint", false],
    description: "Run tests which match given globs",
  },
  assemble: {
    group: "Active options",
    type: "any", default: Object.assign({}, assembleDefault),
    description: `Assemble packages with '${yargs.vlm.theme.vlmCommand("vlm assemble-packages")}')`,
  },
  "update-master": {
    group: "Active options",
    type: "boolean", default: true,
    description: `Update master branch if release updates the latest release/* branch`,
  },
  release: {
    type: "any", choices: [true, "major", "minor", "patch"],
    description: `Create a new release branch based on the current branch.
Prevent yarn lock rebuild by clean.
Bump the version section based on the given value (default to current branch section)`,
  },
  prerelease: {
    type: "any", choices: [true, "major", "minor", "patch"],
    description: `Create a new prerelease branch based on the current branch.
Bump the version section based on the given value (default to current branch section)`,
  },
  dirty: {
    type: "boolean",
    description: `Allow a git-dirty repository to be released (as per '${
        yargs.vlm.theme.executable("git status")}')`
  },
  publish: {
    type: "boolean",
    description: "Publish the repository files and packages to their upstreams",
  },
});

exports.handler = async (yargv) => {
  // Example template which displays the command name itself and package name where it is ran
  // Only enabled inside package
  const vlm = yargv.vlm;
  const ret = { releaseDescription: "unknown" };

  try {
    ret.preparation = { "...": { indexAfter: "" } };
    await _prepare(ret.preparation);
    vlm.info(`${ret.releaseDescription} preparation phase`, ret.preparation.success
        ? vlm.theme.success("successful") : vlm.theme.failure("FAILED"),
            "into target branch", vlm.theme.name(ret.preparation.targetBranch));

    ret.commit = { "...": { indexAfter: "preparation" } };
    await _commit(ret.preparation, ret.commit);
    vlm.info(`${ret.releaseDescription} commit phase`, ret.commit.success
        ? vlm.theme.success("successful") : vlm.theme.failure("FAILED"),
            "as a new version", vlm.theme.version(ret.commit.version));

    if (!yargv.publish) {
      ret.prePublish = { "...": { indexAfter: "commit" } };
      await _prePublish(ret.preparation, ret.commit, ret.prePublish);
      vlm.info(`${ret.releaseDescription} pre-publish phase`, ret.prePublish.success
          ? vlm.theme.success("successful") : vlm.theme.failure("FAILED"),
            vlm.theme.instruct("see result output for the manual publish step instructions"));
    } else {
      ret.publish = { "...": { indexAfter: "commit" } };
      await _publish(ret.preparation, ret.commit, ret.publish);
      vlm.info(`${ret.releaseDescription} publish phase`, ret.publish.success
          ? vlm.theme.success("successful") : vlm.theme.failure("FAILED"));
    }
    ret.success = ret.preparation.success && ret.commit.success
        && (ret.prePublish || ret.publish).success;
  } catch (error) {
    vlm.exception(error, "release-vault.handler");
    ret.error = error.message;
    ret.trace = ["...", { style: { code: "text" } }, error.stack];
  }
  return ret;

  async function _prepare (preparation) {
    const branches = ((await vlm.delegate("git branch --list --no-color release/* prerelease/*"))
            || "").split("\n")
        .map(name => name.match(/^((\* )| {2})((pre)?release\/([0-9]*)(\.[0-9]+)?(\.[0-9]+)?)$/))
        .filter(match => match);
    const currentBranchMatch = branches.find(match => match[2]); // 2 <=> search for "* "
    if (!currentBranchMatch) throw new Error("Current branch is not a (pre)release branch");
    const [,,, branchName, currentIsPrerelease, major, dotMinor, dotPatch] = currentBranchMatch;
    preparation.lernaConfig = require(vlm.path.join(process.cwd(), "lerna.json"));
    const [, minor, patch] = preparation.lernaConfig.version.match(/^[0-9]*\.([0-9]+)\.([0-9]+)/);
    preparation.isRelease = !!yargv.release || !(yargv.prerelease || currentIsPrerelease);
    preparation.newBranchGroup = yargv.release || yargv.prerelease;
    if (!preparation.newBranchGroup) {
      ret.releaseDescription = preparation.isRelease ? "Release" : "Prerelease";
      preparation.targetBranch = branchName;
    } else {
      const type = yargv.release ? "release" : "prerelease";
      if (preparation.newBranchGroup === true) {
        preparation.newBranchGroup = dotPatch ? "patch" : dotMinor ? "minor" : "major";
      }
      ret.releaseDescription = `New ${preparation.newBranchGroup} ${type} branch`;
      const patchInc = (yargv.release && currentIsPrerelease) ? 0 : 1;
      const minorInc = (patchInc || Number(patch)) ? 1 : 0;
      const majorInc = (minorInc || Number(minor)) ? 1 : 0;
      preparation.branchVersion
          = (preparation.newBranchGroup === "major") ? `${Number(major || 0) + majorInc}`
          : (preparation.newBranchGroup === "minor") ? `${major}.${Number(minor || 0) + minorInc}`
          : `${major}.${minor || 0}.${Number(patch || 0) + patchInc}`;
      preparation.targetBranch = `${type}/${preparation.branchVersion}`;
      if ((await vlm.delegate(`git branch --list --no-color ${preparation.targetBranch}`))
          .split("\n").filter(b => !b.match(/^\s*$/)).length) {
        throw new Error(`Branch '${preparation.targetBranch}' already exists`);
      }
      if (currentIsPrerelease) preparation.previousPrereleaseBranch = branchName;
    }

    const isDirty = (await vlm.delegate("git status -s"))
        .split("\n").filter(b => !b.match(/^\s*$/)).length;
    if (isDirty && !yargv.dirty) {
      throw new Error(`Repository is dirty with modified and/or untracked files ${
          ""} and --dirty was not specified. See 'git status'`);
    }

    preparation["vlm clean-vault"] = !yargv.clean ? "skipped"
        : await vlm.invoke("clean-vault", Object.assign({},
            cleanDefault, yargv.clean, preparation.isRelease ? { yarn: false } : {}));

    const runAllTests = yargv.test.includes("*");
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
    preparation["..."].heading = `${ret.releaseDescription} preparation ${
        preparation.success ? "successful" : "FAILED"}: gathered config files and test results`;
  }

  async function _commit ({ isRelease, targetBranch, newBranchGroup,
      previousPrereleaseBranch, lernaConfig, success }, commit) {
    if (!success) {
      commit.skipped = "preparation phase failed";
      commit["..."].heading = `${ret.releaseDescription} commit skipped: ${commit.skipped}`;
      return;
    }

    if (newBranchGroup) {
      await vlm.delegate(`git checkout -b ${targetBranch}`);
      commit.newBranch = targetBranch;
      commit.lernaConfig = JSON.parse(JSON.stringify(lernaConfig));
      commit.lernaConfig.command.version.bump = isRelease ? newBranchGroup : `pre${newBranchGroup}`;
      commit.lernaConfig.command.version.preid = isRelease ? "" : "prerelease";
      commit.lernaConfig.command.version.allowBranch = targetBranch;
      vlm.shell.ShellString(JSON.stringify(commit.lernaConfig, null, 2)).to("./lerna.json");
      await vlm.delegate(`git add lerna.json`);
    }
    await vlm.delegate(`git add yarn.lock`);
    await vlm.delegate(["git", "commit", "--allow-empty",
      "-m", [`placeholder commit for assemble to amend`]]);

    commit["vlm assemble-packages"] = await vlm.invoke("assemble-packages",
        Object.assign({ versioning: "amend" }, assembleDefault, yargv.assemble));
    commit.success = commit["vlm assemble-packages"].success;
    if (commit.success) {
      commit.version = commit["vlm assemble-packages"].version;
      if (!commit.version) {
        throw new Error("Couldn't locate new version from 'vlm assemble-packages' results");
      }
      await vlm.updatePackageConfig({ version: commit.version });
      const tagName = `v${commit.version}`;
      await vlm.delegate([`git tag -d`, [tagName]]);
      await vlm.delegate(`git add package.json`);
      await vlm.delegate(["git commit --amend -m", [tagName]]);
      await vlm.delegate(["git tag -a", [tagName], "-m", [tagName]]);
      if (isRelease && yargv["update-master"]) {
        try {
          await vlm.delegate(`git checkout master`);
          await vlm.delegate(`git merge --ff-only ${targetBranch}`);
        } catch (error) {
          commit.success = false;
          vlm.error(`failed to fast-forward master to ${targetBranch}, aborting:`,
              `checking out current git branch back to ${targetBranch} for diagnostics`);
          throw error;
        } finally {
          await vlm.delegate(`git checkout ${targetBranch}`);
        }
      }
    }
    commit["..."].heading = `${ret.releaseDescription} commit ${commit.success
        ? "successful" : "FAILED"}: changes to local git and prepared publishables under dist/`;
    commit.publishFiles = `git push --tags origin master ${targetBranch}`;
    commit.vlmPublishPackages = `publish-packages`;
    if (previousPrereleaseBranch) {
      commit.publishFiles += ` :${previousPrereleaseBranch}`;
      commit.deletePrerelease = `git branch -d ${previousPrereleaseBranch}`;
    }
  }

  async function _prePublish ({ success: preparationSuccess },
      { success: commitSuccess, publishFiles, vlmPublishPackages, deletePrerelease }, prePublish) {
    if (!preparationSuccess || !commitSuccess) {
      prePublish.skipped = `${!preparationSuccess ? "preparation" : "commit"} phase failed`;
      prePublish["..."].heading =
          `${ret.releaseDescription} pre-publish skipped: ${prePublish.skipped}`;
    } else {
      prePublish["..."].keyText = "target";
      prePublish["..."].valueText = "command";
      prePublish.files = vlm.theme.executable(publishFiles);
      prePublish.packages = vlm.theme.vlmCommand("vlm", vlmPublishPackages);
      if (deletePrerelease) prePublish.deletePrerelease = vlm.theme.executable(deletePrerelease);
      prePublish.success = true;
      prePublish["..."].heading = `${ret.releaseDescription} pre-publish ${prePublish.success
          ? "successful" : "FAILED"}: list of commands for manual publishing`;
    }
  }

  async function _publish ({ previousPrereleaseBranch, success: preparationSuccess },
      { success: commitSuccess, publishFiles, vlmPublishPackages, deletePrerelease }, publish) {
    if (!preparationSuccess || !commitSuccess) {
      publish.skipped = `${!preparationSuccess ? "preparation" : "commit"} phase failed`;
      publish["..."].heading = `${ret.releaseDescription} publish skipped: ${publish.skipped}`;
    } else {
      // FIXME(iridian): Asking for password breaks inside execute: the stdin inheritance doesn't
      // convey isTTY status to the child process (possibly?)
      publish.files = await vlm.execute(publishFiles);
      publish.packages = await vlm.invoke(vlmPublishPackages);
      if (deletePrerelease) {
        publish.deletedPrereleaseBranch =
            (await vlm.delegate(deletePrerelease)) && previousPrereleaseBranch;
      }
      publish.success = true;
      publish["..."].heading = `${ret.releaseDescription} publish ${
          publish.success ? "successful" : "FAILED"}: changes published to upstream(s)`;
    }
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
