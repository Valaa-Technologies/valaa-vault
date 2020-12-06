const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-vault" };
exports.command = "release-vault";
exports.describe = "Prepare, commit and potentially publish a new release of vault packages";
exports.introduction =
`Prepares a release to a new or existing release/develop branch based
on given options and current environment.

Prepares the release by first running sanity checks, then cleaning and
reinstalling intermediate files like node_modules, yarn workspaces,
yarn.lock and dist/ and finally requires all test suites and lint to
pass without errors.

Once preparation is done creates a new release commit and tag using
'lerna version'.

If --publish is not explicitly given then the final publish step must
be manually performed. In this case a pre-publish phase is done which
prepares the manual publish command instructions in the results output.

Will invoke valma command hooks between phases as follows:
1. 'vlm .release-vault/.prepared-hooks/{**/,}* --summary=<obj>' after successful preparation
2. 'vlm .release-vault/.committed-hooks/{**/,}* --summary=<obj>' after successful commit
3. 'vlm .release-vault/.pre-published-hooks/{**/,}* --summary=<obj>' after successful pre-publish
4. 'vlm .release-vault/.published-hooks/{**/,}* --summary=<obj>' after successful publish
`;

const cleanDefault = Object.freeze({ yes: true, yarn: true, install: true, dist: true });
const assembleDefault = Object.freeze({ "add-unchanged": true });

exports.disabled = (yargs) => typeToolset.checkToolsetDisabled(yargs.vlm, exports);
exports.builder = (yargs) => yargs.options({
  clean: {
    group: "Phases",
    type: "any", default: Object.assign({}, cleanDefault),
    description: `Clean and reinstall intermediate files with '${
        yargs.vlm.theme.command("clean-vault")}'`,
  },
  test: {
    group: "Phases",
    type: "string", array: true, default: ["*"], choices: ["*", "jest", "lint", false],
    description: "Run tests which match given globs",
  },
  assemble: {
    group: "Phases",
    type: "any", default: Object.assign({}, assembleDefault),
    description: `Assemble packages with '${yargs.vlm.theme.vlmCommand("vlm assemble-packages")}')`,
  },
  publish: {
    group: "Phases",
    type: "boolean", default: false,
    description: "Publish the repository files and packages to their upstreams",
  },
  dirty: {
    group: "Sanity check",
    type: "boolean",
    description: `Allow a git-dirty repository to be released (as per '${
        yargs.vlm.theme.executable("git status")}')`
  },
  "fast-forward-stable": {
    group: "Version control",
    type: "boolean", default: true,
    description: `If a release/* branch is affected fast-forward 'stable' into it if possible`,
  },
  "fast-forward-edge": {
    group: "Version control",
    type: "boolean", default: true,
    description: `If a develop/* branch is affected fast-forward 'edge' into it if possible`,
  },
  release: {
    group: "Version control",
    type: "boolean",
    description:
`Create a new release/* branch based on the current branch.
Suppress yarn.lock rebuild of the cleaning phase.
If current branch is a develop branch remove the prerelease version, otherwise bump the version
section specified in lerna.json:command.version.bump.`,
  },
  develop: {
    group: "Version control",
    type: "string",
    description:
`Create a new develop/* branch based on the current branch.
Bump the version section specified by lerna.json:command.version.bump.
Use the given value or "prerelease" as the preid.`,
  },
  major: {
    group: "Version control",
    type: "any", default: false,
    description: `Bump the major branch version to the given value or by one by default.`,
  },
  minor: {
    group: "Version control",
    type: "any", default: false,
    description: `Bump the minor branch version to the given value or by one by default.`,
  },
  patch: {
    group: "Version control",
    type: "any", default: false,
    description: `Bump the patch branch version to the given value or by one by default.`,
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
    if (ret.preparation.success) {
      ret.preparation.hooks = await vlm.invoke(`.release-vault/.prepared-hooks/{**/,}*`,
          [{ summary: ret.preparation }]);
    }

    ret.commit = { "...": { indexAfter: "preparation" } };
    await _commit(ret.preparation, ret.commit);
    vlm.info(`${ret.releaseDescription} commit phase`, ret.commit.success
            ? vlm.theme.success("successful") : vlm.theme.failure("FAILED"),
        "as a new version", vlm.theme.version(ret.commit.version));
    if (ret.commit.success) {
      ret.commit.hooks = await vlm.invoke(`.release-vault/.committed-hooks/{**/,}*`,
          [{ summary: ret.commit }]);
    }

    if (!yargv.publish) {
      ret.prePublish = { "...": { indexAfter: "commit" } };
      await _prePublish(ret.preparation, ret.commit, ret.prePublish);
      vlm.info(`${ret.releaseDescription} pre-publish phase`, ret.prePublish.success
          ? vlm.theme.success("successful") : vlm.theme.failure("FAILED"),
            vlm.theme.instruct("see result output for the manual publish step instructions"));
      if (ret.prePublish.success) {
        ret.prePublish.hooks = await vlm.invoke(`.release-vault/.pre-published-hooks/{**/,}*`,
            [{ summary: ret.prePublish }]);
      }
    } else {
      ret.publish = { "...": { indexAfter: "commit" } };
      await _publish(ret.preparation, ret.commit, ret.publish);
      vlm.info(`${ret.releaseDescription} publish phase`, ret.publish.success
          ? vlm.theme.success("successful") : vlm.theme.failure("FAILED"));
      if (ret.publish.success) {
        ret.publish.hooks = await vlm.invoke(`.release-vault/.published-hooks/{**/,}*`,
            [{ summary: ret.publish }]);
      }
    }
    ret.success = ret.preparation.success && ret.commit.success
        && (ret.prePublish || ret.publish).success;
  } catch (error) {
    vlm.exception(error, "release-vault.handler");
    ret.error = error.message;
    ret.trace = ["...", { style: { code: "text" } }, error.stack];
  }
  return ret;

  async function _prepare (preparation) { // eslint-disable-line complexity
    const branches =
        ((await vlm.delegate(
            "git branch --list --no-color stable edge release/* develop/* master prerelease/*"))
                || "").split("\n")
        .map(name => name.match(
            /^((\* )| {2})(stable|edge|master|((release|develop|prerelease)\/([0-9]*)(\.[0-9]+)?(\.[0-9]+)?))$/ // eslint-disable-line
        )).filter(match => match);
    const currentBranchMatch = branches.find(match => match[2]); // 2 <=> search for "* "
    if (!currentBranchMatch) {
      throw new Error("Current branch is not 'stable', 'edge' nor a release or a develop branch");
    }
    const [,,, branchName,, releaseOrDevelopBranch, major, dotMinor, dotPatch]
        = currentBranchMatch;
    if (!releaseOrDevelopBranch && (!yargv.release && !yargv.develop)) {
      throw new Error(`Provide --release or --develop when releasing from '${branchName}'`);
    }
    preparation.lernaConfig = require(vlm.path.join(process.cwd(), "lerna.json"));
    const [, minor, patch] = preparation.lernaConfig.version.match(/^[0-9]*\.([0-9]+)\.([0-9]+)/);
    preparation.isRelease = !!yargv.release
        || (!yargv.develop && (releaseOrDevelopBranch === "release"));
    preparation.newBranchKind = (yargv.release || yargv.develop)
        && (yargv.major ? "major" : yargv.minor ? "minor" : yargv.patch ? "patch" : true);
    if (!preparation.newBranchKind) {
      ret.releaseDescription = `Existing ${preparation.isRelease ? "release" : "develop"} branch`;
      preparation.targetBranch = branchName;
    } else {
      const type = preparation.isRelease ? "release" : "develop";
      if (preparation.newBranchKind === true) {
        preparation.newBranchKind = !releaseOrDevelopBranch
            ? preparation.lernaConfig.command.version.bump
            : dotPatch ? "patch" : dotMinor ? "minor" : "major";
      }
      if (yargv.develop) {
        preparation.preid = (yargv.develop === true) ? "prerelease" : yargv.develop;
      }
      ret.releaseDescription = `New ${vlm.theme.strong(preparation.newBranchKind)} ${type} branch`;
      // No patch bump if releasing from develop into a release.
      const bump = (preparation.isRelease && (releaseOrDevelopBranch !== "release")) ? 0 : 1;
      const newMajor = typeof yargv.major === "number" ? yargv.major
          : Number(major || 0) + (preparation.newBranchKind === "major" ? bump : 0);
      const newMinor = typeof yargv.minor === "number" ? yargv.minor
          : Number(minor || 0) + (preparation.newBranchKind === "minor" ? bump : 0);
      const newPatch = typeof yargv.patch === "number" ? yargv.patch
          : Number(patch || 0) + bump;
      preparation.branchVersion
          = (preparation.newBranchKind === "major") ? `${newMajor}`
          : (preparation.newBranchKind === "minor") ? `${newMajor}.${newMinor}`
          : `${newMajor}.${newMinor}.${newPatch}`;
      preparation.targetBranch = `${type}/${preparation.branchVersion}`;
      if ((await vlm.delegate(`git branch --list --no-color ${preparation.targetBranch}`))
          .split("\n").filter(b => !b.match(/^\s*$/)).length) {
        throw new Error(`Branch '${preparation.targetBranch}' already exists`);
      }
      if (releaseOrDevelopBranch === "develop") preparation.previousDevelopBranch = branchName;
    }

    const isDirty = (await vlm.delegate("git status -s"))
        .split("\n").filter(b => !b.match(/^\s*$/)).length;
    if (isDirty && !yargv.dirty) {
      throw new Error(`Workspace is dirty with modified and/or untracked files ${
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

  async function _commit ({ isRelease, targetBranch, newBranchKind, preid,
      previousDevelopBranch, lernaConfig, success }, commit) {
    if (!success) {
      commit.skipped = "preparation phase failed";
      commit["..."].heading = `${ret.releaseDescription} commit skipped: ${commit.skipped}`;
      return;
    }

    const assembleOverrides = { ...yargv.assemble };

    if (newBranchKind) {
      await vlm.delegate(`git checkout -b ${targetBranch}`);
      commit.newBranch = targetBranch;
      commit.lernaConfig = JSON.parse(JSON.stringify(lernaConfig));
      commit.lernaConfig.command.version.bump = preid ? `prerelease` : newBranchKind;
      commit.lernaConfig.command.version.preid = preid || "";
      if (preid) assembleOverrides.bump = `pre${newBranchKind}`;
      commit.lernaConfig.command.version.allowBranch = targetBranch;
      vlm.shell.ShellString(JSON.stringify(commit.lernaConfig, null, 2)).to("./lerna.json");
      await vlm.delegate(`git add lerna.json`);
    }
    await vlm.delegate(`git add yarn.lock`);
    await vlm.delegate([
      "git", "commit", "--allow-empty", "-m", [`placeholder commit for assemble to amend`],
    ]);

    commit["vlm assemble-packages"] = await vlm.invoke("assemble-packages",
        Object.assign({ versioning: "amend" }, assembleDefault, assembleOverrides));

    commit.success = commit["vlm assemble-packages"].success;
    let fastForwardBase;
    if (commit.success) {
      commit.version = commit["vlm assemble-packages"].version;
      if (!commit.version) {
        throw new Error("Couldn't locate new version from 'vlm assemble-packages' results");
      }
      commit.assembled = await vlm.invoke(`.release-vault/.assembled-hooks/{**/,}*`,
          [{ summary: commit }]);
      await vlm.updatePackageConfig({ version: commit.version });
      const tagName = `v${commit.version}`;
      await vlm.delegate([`git tag -d`, [tagName]]);
      await vlm.delegate(`git add package.json`);
      await vlm.delegate(["git commit --amend -m", [tagName]]);
      await vlm.delegate(["git tag -a", [tagName], "-m", [tagName]]);
      fastForwardBase = isRelease
          ? (yargv["fast-forward-stable"] && "stable")
          : (yargv["fast-forward-edge"] && "edge");
      if (fastForwardBase) {
        try {
          await vlm.delegate(`git checkout ${fastForwardBase}`);
          if (await vlm.delegate(`git merge --ff-only ${targetBranch}`, {
            retryChoices: [{
              name: `Skip ${fastForwardBase} fast-forward and continue release`,
              value: "ignored",
            }],
          }) === "ignored") {
            fastForwardBase = "";
          }
        } catch (error) {
          commit.success = false;
          vlm.error(`Failed to fast-forward '${fastForwardBase}' to ${targetBranch}, aborting:`,
              `checking out current git branch back to ${targetBranch} for diagnostics`);
          throw error;
        } finally {
          await vlm.delegate(`git checkout ${targetBranch}`);
        }
      }
    }
    commit["..."].heading = `${ret.releaseDescription} commit ${commit.success
        ? "successful" : "FAILED"}: changes to local git and prepared publishables under dist/`;
    commit.publishFiles = `git push --tags origin ${fastForwardBase} ${targetBranch}`;
    if (previousDevelopBranch) {
      commit.publishFiles += ` :${previousDevelopBranch}`;
      commit.deleteDevelop = `git branch -d ${previousDevelopBranch}`;
    }
    commit.vlmPublishPackages = isRelease
        ? `publish-packages`
        : `publish-packages --tag=prerelease`;
  }

  async function _prePublish ({ success: preparationSuccess },
      { success: commitSuccess, publishFiles, vlmPublishPackages, deleteDevelop }, prePublish) {
    if (!preparationSuccess || !commitSuccess) {
      prePublish.skipped = `${!preparationSuccess ? "preparation" : "commit"} phase failed`;
      prePublish["..."].heading =
          `${ret.releaseDescription} pre-publish skipped: ${prePublish.skipped}`;
    } else {
      prePublish["..."].keyText = "target";
      prePublish["..."].valueText = "command";
      prePublish.files = vlm.theme.executable(publishFiles);
      prePublish.packages = vlm.theme.vlmCommand("vlm", vlmPublishPackages);
      if (deleteDevelop) prePublish.deleteDevelop = vlm.theme.executable(deleteDevelop);
      prePublish.success = true;
      prePublish["..."].heading = `${ret.releaseDescription} pre-publish ${prePublish.success
          ? "successful" : "FAILED"}: list of commands for manual publishing`;
    }
  }

  async function _publish ({ previousDevelopBranch, success: preparationSuccess },
      { success: commitSuccess, publishFiles, vlmPublishPackages, deleteDevelop }, publish) {
    if (!preparationSuccess || !commitSuccess) {
      publish.skipped = `${!preparationSuccess ? "preparation" : "commit"} phase failed`;
      publish["..."].heading = `${ret.releaseDescription} publish skipped: ${publish.skipped}`;
    } else {
      // FIXME(iridian): Asking for password breaks inside execute: the
      // stdin inheritance doesn't convey isTTY status to the child
      // process (possibly?)
      publish.files = await vlm.execute(publishFiles);
      publish.packages = await vlm.invoke(vlmPublishPackages);
      if (deleteDevelop) {
        publish.deletedDevelopBranch =
            (await vlm.delegate(deleteDevelop)) && previousDevelopBranch;
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
